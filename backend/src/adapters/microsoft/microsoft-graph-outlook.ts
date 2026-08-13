import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { z } from "zod";

import type {
  OutlookConnectionRepository,
  StoredOutlookConnection,
} from "../supabase/supabase-outlook-connection-repository.js";

import type {
  OutlookDraftGateway,
} from "../../ports/outreach.js";

const MICROSOFT_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "Mail.ReadWrite",
] as const;

const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().int().positive(),
  scope: z.string().min(1),
});

const profileSchema = z.object({
  mail: z.string().email().nullable().optional(),
  userPrincipalName:
    z.string().email(),
});

const messageSchema = z.object({
  id: z.string().min(1),
  webLink: z.string().url().nullable().optional(),
  internetMessageHeaders: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
    }),
  ).optional(),
});

const messageListSchema = z.object({
  value: z.array(messageSchema),
});

type FetchFunction = typeof fetch;

export interface MicrosoftGraphOutlookOptions {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly tenantId: string;
  readonly redirectUri: string;
  readonly graphBaseUrl: string;
  readonly loginBaseUrl: string;
  readonly tokenEncryptionKey: string;
  readonly timeoutMs: number;
  readonly repository:
    OutlookConnectionRepository;
  readonly fetchFunction?: FetchFunction;
}

function sha256(value: string): Buffer {
  return createHash("sha256")
    .update(value)
    .digest();
}

function hasScope(
  scope: string,
  expected: string,
): boolean {
  const normalized = expected.toLowerCase();
  return scope
    .split(/\s+/)
    .map((item) => item.toLowerCase())
    .some(
      (item) =>
        item === normalized ||
        item.endsWith(`/${normalized}`),
    );
}

class TokenCipher {
  private readonly key: Buffer;

  constructor(encodedKey: string) {
    this.key = Buffer.from(
      encodedKey,
      "base64",
    );
    if (this.key.length !== 32) {
      throw new Error(
        "OUTLOOK_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
      );
    }
  }

  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(
      "aes-256-gcm",
      this.key,
      iv,
    );
    const encrypted = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    return [
      "v1",
      iv.toString("base64url"),
      cipher.getAuthTag()
        .toString("base64url"),
      encrypted.toString("base64url"),
    ].join(".");
  }

  decrypt(value: string): string {
    const [version, iv, tag, encrypted] =
      value.split(".");
    if (
      version !== "v1" ||
      iv === undefined ||
      tag === undefined ||
      encrypted === undefined
    ) {
      throw new Error(
        "Encrypted Outlook token is invalid.",
      );
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(
      Buffer.from(tag, "base64url"),
    );
    return Buffer.concat([
      decipher.update(
        Buffer.from(
          encrypted,
          "base64url",
        ),
      ),
      decipher.final(),
    ]).toString("utf8");
  }
}

export class MicrosoftGraphOutlookGateway
implements OutlookDraftGateway {
  private readonly options:
    MicrosoftGraphOutlookOptions;
  private readonly fetchFunction:
    FetchFunction;
  private readonly cipher: TokenCipher;

  constructor(
    options: MicrosoftGraphOutlookOptions,
  ) {
    this.options = options;
    this.fetchFunction =
      options.fetchFunction ?? fetch;
    this.cipher = new TokenCipher(
      options.tokenEncryptionKey,
    );
  }

  private async request(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs,
    );
    try {
      return await this.fetchFunction(
        url,
        {
          ...init,
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private tokenUrl(): string {
    return `${this.options.loginBaseUrl.replace(/\/$/, "")}/${encodeURIComponent(this.options.tenantId)}/oauth2/v2.0/token`;
  }

  private async exchange(
    parameters: URLSearchParams,
  ): Promise<z.infer<typeof tokenSchema>> {
    parameters.set(
      "client_id",
      this.options.clientId,
    );
    parameters.set(
      "client_secret",
      this.options.clientSecret,
    );
    parameters.set(
      "scope",
      MICROSOFT_SCOPES.join(" "),
    );
    const response = await this.request(
      this.tokenUrl(),
      {
        method: "POST",
        headers: {
          "content-type":
            "application/x-www-form-urlencoded",
        },
        body: parameters,
      },
    );
    if (!response.ok) {
      throw new Error(
        `Microsoft token exchange failed with status ${response.status}.`,
      );
    }
    const parsed = tokenSchema.safeParse(
      await response.json(),
    );
    if (
      !parsed.success ||
      !hasScope(
        parsed.data.scope,
        "Mail.ReadWrite",
      ) ||
      hasScope(
        parsed.data.scope,
        "Mail.Send",
      )
    ) {
      throw new Error(
        "Microsoft returned unsupported Outlook permissions.",
      );
    }
    return parsed.data;
  }

  private async profile(
    accessToken: string,
  ): Promise<z.infer<typeof profileSchema>> {
    const response = await this.request(
      `${this.options.graphBaseUrl.replace(/\/$/, "")}/me?$select=mail,userPrincipalName`,
      {
        method: "GET",
        headers: {
          authorization:
            `Bearer ${accessToken}`,
          accept: "application/json",
        },
      },
    );
    if (!response.ok) {
      throw new Error(
        `Microsoft profile request failed with status ${response.status}.`,
      );
    }
    const parsed = profileSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      throw new Error(
        "Microsoft returned an invalid profile.",
      );
    }
    return parsed.data;
  }

  private async refresh(
    connection: StoredOutlookConnection,
  ): Promise<string> {
    const token = await this.exchange(
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.cipher.decrypt(
          connection.encryptedRefreshToken,
        ),
      }),
    );
    const refreshToken =
      token.refresh_token ??
      this.cipher.decrypt(
        connection.encryptedRefreshToken,
      );
    const accessExpiresAt = new Date(
      Date.now() + token.expires_in * 1_000,
    ).toISOString();
    await this.options.repository
      .saveConnection({
        founderId: connection.founderId,
        mailboxEmail:
          connection.mailboxEmail,
        encryptedAccessToken:
          this.cipher.encrypt(
            token.access_token,
          ),
        encryptedRefreshToken:
          this.cipher.encrypt(
            refreshToken,
          ),
        accessExpiresAt,
        scope: token.scope,
      });
    return token.access_token;
  }

  private async accessToken(
    founderId: string,
    forceRefresh = false,
  ): Promise<string> {
    const connection =
      await this.options.repository
        .getConnection(founderId);
    if (connection === null) {
      throw new Error(
        "Outlook is not connected.",
      );
    }
    const expiresSoon =
      Date.parse(
        connection.accessExpiresAt,
      ) <= Date.now() + 120_000;
    if (forceRefresh || expiresSoon) {
      return this.refresh(connection);
    }
    return this.cipher.decrypt(
      connection.encryptedAccessToken,
    );
  }

  private async graphRequest(
    founderId: string,
    path: string,
    init: RequestInit,
  ): Promise<Response> {
    const attempt = async (
      forceRefresh: boolean,
    ) => this.request(
      `${this.options.graphBaseUrl.replace(/\/$/, "")}${path}`,
      {
        ...init,
        headers: {
          authorization:
            `Bearer ${await this.accessToken(founderId, forceRefresh)}`,
          accept: "application/json",
          ...init.headers,
        },
      },
    );
    let response = await attempt(false);
    if (response.status === 401) {
      response = await attempt(true);
    }
    return response;
  }

  async connectionStatus(founderId: string) {
    const connection =
      await this.options.repository
        .getConnection(founderId);
    return connection === null
      ? {
          connected: false,
          mailboxEmail: null,
          connectedAt: null,
        }
      : {
          connected: true,
          mailboxEmail:
            connection.mailboxEmail,
          connectedAt:
            connection.connectedAt,
        };
  }

  async createAuthorizationUrl(
    founderId: string,
  ): Promise<string> {
    const state = randomBytes(32)
      .toString("base64url");
    const verifier = randomBytes(64)
      .toString("base64url");
    const challenge = sha256(verifier)
      .toString("base64url");
    await this.options.repository
      .saveOAuthState({
        stateHash: sha256(state)
          .toString("hex"),
        founderId,
        encryptedVerifier:
          this.cipher.encrypt(verifier),
        expiresAt: new Date(
          Date.now() + 10 * 60_000,
        ).toISOString(),
      });
    const url = new URL(
      `${this.options.loginBaseUrl.replace(/\/$/, "")}/${encodeURIComponent(this.options.tenantId)}/oauth2/v2.0/authorize`,
    );
    url.search = new URLSearchParams({
      client_id: this.options.clientId,
      response_type: "code",
      redirect_uri:
        this.options.redirectUri,
      response_mode: "query",
      scope: MICROSOFT_SCOPES.join(" "),
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    return url.toString();
  }

  async completeAuthorization(
    code: string,
    state: string,
  ): Promise<void> {
    const consumed =
      await this.options.repository
        .consumeOAuthState(
          sha256(state).toString("hex"),
        );
    const verifier = this.cipher.decrypt(
      consumed.encryptedVerifier,
    );
    const token = await this.exchange(
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri:
          this.options.redirectUri,
        code_verifier: verifier,
      }),
    );
    if (token.refresh_token === undefined) {
      throw new Error(
        "Microsoft did not return an offline refresh token.",
      );
    }
    const profile = await this.profile(
      token.access_token,
    );
    await this.options.repository
      .saveConnection({
        founderId: consumed.founderId,
        mailboxEmail:
          profile.mail ??
          profile.userPrincipalName,
        encryptedAccessToken:
          this.cipher.encrypt(
            token.access_token,
          ),
        encryptedRefreshToken:
          this.cipher.encrypt(
            token.refresh_token,
          ),
        accessExpiresAt: new Date(
          Date.now() +
            token.expires_in * 1_000,
        ).toISOString(),
        scope: token.scope,
      });
  }

  async createOrRecoverDraft(input: {
    readonly founderId: string;
    readonly internalDraftId: string;
    readonly recipientEmail: string;
    readonly subject: string;
    readonly body: string;
  }): Promise<{
    readonly outlookDraftId: string;
    readonly outlookWebUrl: string | null;
  }> {
    const headerName =
      "x-clean-up-central-draft-id";
    const list = await this.graphRequest(
      input.founderId,
      "/me/mailFolders/drafts/messages?$select=id,webLink,internetMessageHeaders&$top=50&$orderby=createdDateTime%20desc",
      { method: "GET" },
    );
    if (list.ok) {
      const parsed = messageListSchema
        .safeParse(await list.json());
      const recovered = parsed.success
        ? parsed.data.value.find((message) =>
            message.internetMessageHeaders
              ?.some(
                (header) =>
                  header.name.toLowerCase() ===
                    headerName &&
                  header.value ===
                    input.internalDraftId,
              ),
          )
        : undefined;
      if (recovered !== undefined) {
        return {
          outlookDraftId: recovered.id,
          outlookWebUrl:
            recovered.webLink ?? null,
        };
      }
    }

    const response = await this.graphRequest(
      input.founderId,
      "/me/messages",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          subject: input.subject,
          importance: "normal",
          body: {
            contentType: "Text",
            content: input.body,
          },
          toRecipients: [{
            emailAddress: {
              address:
                input.recipientEmail,
            },
          }],
          internetMessageHeaders: [{
            name: headerName,
            value:
              input.internalDraftId,
          }],
        }),
      },
    );
    if (response.status !== 201) {
      throw new Error(
        `Microsoft Graph draft creation failed with status ${response.status}.`,
      );
    }
    const parsed = messageSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      throw new Error(
        "Microsoft Graph returned an invalid draft.",
      );
    }
    return {
      outlookDraftId: parsed.data.id,
      outlookWebUrl:
        parsed.data.webLink ?? null,
    };
  }
}
