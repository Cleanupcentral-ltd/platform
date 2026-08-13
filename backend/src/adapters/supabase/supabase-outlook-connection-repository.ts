import { z } from "zod";

type FetchFunction = typeof fetch;

export interface StoredOutlookConnection {
  readonly founderId: string;
  readonly mailboxEmail: string;
  readonly encryptedAccessToken: string;
  readonly encryptedRefreshToken: string;
  readonly accessExpiresAt: string;
  readonly scope: string;
  readonly connectedAt: string;
}

export interface SaveOutlookConnectionInput {
  readonly founderId: string;
  readonly mailboxEmail: string;
  readonly encryptedAccessToken: string;
  readonly encryptedRefreshToken: string;
  readonly accessExpiresAt: string;
  readonly scope: string;
}

export interface OutlookConnectionRepository {
  saveOAuthState(input: {
    readonly stateHash: string;
    readonly founderId: string;
    readonly encryptedVerifier: string;
    readonly expiresAt: string;
  }): Promise<void>;

  consumeOAuthState(
    stateHash: string,
  ): Promise<{
    readonly founderId: string;
    readonly encryptedVerifier: string;
  }>;

  getConnection(
    founderId: string,
  ): Promise<StoredOutlookConnection | null>;

  saveConnection(
    input: SaveOutlookConnectionInput,
  ): Promise<void>;
}

const connectionRowSchema = z.object({
  founder_id: z.string().uuid(),
  mailbox_email: z.string().email(),
  encrypted_access_token: z.string(),
  encrypted_refresh_token: z.string(),
  access_expires_at: z.string(),
  scope: z.string(),
  connected_at: z.string(),
});

const consumedStateSchema = z.array(
  z.object({
    founder_id: z.string().uuid(),
    encrypted_verifier: z.string(),
  }),
).length(1);

export interface SupabaseOutlookConnectionRepositoryOptions {
  readonly supabaseUrl: string;
  readonly secretKey: string;
  readonly timeoutMs: number;
  readonly fetchFunction?: FetchFunction;
}

export class SupabaseOutlookConnectionRepository
implements OutlookConnectionRepository {
  private readonly restUrl: string;
  private readonly secretKey: string;
  private readonly timeoutMs: number;
  private readonly fetchFunction: FetchFunction;

  constructor(
    options:
      SupabaseOutlookConnectionRepositoryOptions,
  ) {
    this.restUrl =
      `${options.supabaseUrl.replace(/\/$/, "")}/rest/v1`;
    this.secretKey = options.secretKey;
    this.timeoutMs = options.timeoutMs;
    this.fetchFunction =
      options.fetchFunction ?? fetch;
  }

  private async request(
    path: string,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.timeoutMs,
    );
    try {
      const response = await this.fetchFunction(
        `${this.restUrl}${path}`,
        {
          ...init,
          headers: {
            accept: "application/json",
            apikey: this.secretKey,
            authorization:
              `Bearer ${this.secretKey}`,
            "accept-profile": "lead_engine",
            "content-profile": "lead_engine",
            ...init.headers,
          },
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new Error(
          `Outlook connection store request failed with status ${response.status}.`,
        );
      }
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  async saveOAuthState(input: {
    readonly stateHash: string;
    readonly founderId: string;
    readonly encryptedVerifier: string;
    readonly expiresAt: string;
  }): Promise<void> {
    await this.request(
      "/outlook_oauth_states",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          state_hash: input.stateHash,
          founder_id: input.founderId,
          encrypted_verifier:
            input.encryptedVerifier,
          expires_at: input.expiresAt,
        }),
      },
    );
  }

  async consumeOAuthState(
    stateHash: string,
  ): Promise<{
    readonly founderId: string;
    readonly encryptedVerifier: string;
  }> {
    const response = await this.request(
      "/rpc/consume_outlook_oauth_state",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          p_state_hash: stateHash,
        }),
      },
    );
    const parsed = consumedStateSchema
      .safeParse(await response.json());
    if (!parsed.success) {
      throw new Error(
        "Outlook OAuth state is invalid or expired.",
      );
    }
    return {
      founderId:
        parsed.data[0]!.founder_id,
      encryptedVerifier:
        parsed.data[0]!
          .encrypted_verifier,
    };
  }

  async getConnection(
    founderId: string,
  ): Promise<StoredOutlookConnection | null> {
    const response = await this.request(
      `/outlook_connections?founder_id=eq.${encodeURIComponent(founderId)}&select=founder_id,mailbox_email,encrypted_access_token,encrypted_refresh_token,access_expires_at,scope,connected_at&limit=1`,
      { method: "GET" },
    );
    const parsed = z.array(
      connectionRowSchema,
    ).max(1).safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      throw new Error(
        "Outlook connection store returned an invalid response.",
      );
    }
    const row = parsed.data[0];
    return row === undefined
      ? null
      : {
          founderId: row.founder_id,
          mailboxEmail:
            row.mailbox_email,
          encryptedAccessToken:
            row.encrypted_access_token,
          encryptedRefreshToken:
            row.encrypted_refresh_token,
          accessExpiresAt:
            row.access_expires_at,
          scope: row.scope,
          connectedAt: row.connected_at,
        };
  }

  async saveConnection(
    input: SaveOutlookConnectionInput,
  ): Promise<void> {
    await this.request(
      "/outlook_connections?on_conflict=founder_id",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          prefer:
            "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          founder_id: input.founderId,
          mailbox_email:
            input.mailboxEmail,
          encrypted_access_token:
            input.encryptedAccessToken,
          encrypted_refresh_token:
            input.encryptedRefreshToken,
          access_expires_at:
            input.accessExpiresAt,
          scope: input.scope,
          updated_at:
            new Date().toISOString(),
        }),
      },
    );
  }
}
