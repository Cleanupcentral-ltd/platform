import { z } from "zod";

import {
  FounderAuthError,
  type FounderAuthService,
  type FounderIdentity,
} from "../../ports/founder-auth.js";

const authenticatedUserSchema =
  z.object({
    id: z.string().uuid(),
    email: z.string().email().optional(),
    is_anonymous: z.boolean().optional(),
    app_metadata: z
      .record(
        z.string(),
        z.unknown(),
      )
      .default({}),
  });

const accessTokenClaimsSchema =
  z.object({
    iss: z.string(),
    sub: z.string().uuid(),
    aud: z.union([
      z.string(),
      z.array(z.string()),
    ]),
    exp: z.number().int(),
    aal: z.string(),
  });

type FetchFunction = typeof fetch;

export interface SupabaseFounderAuthOptions {
  readonly supabaseUrl: string;
  readonly publishableKey: string;
  readonly timeoutMs: number;
  readonly fetchFunction?: FetchFunction;
  readonly now?: () => number;
}

function decodeClaims(
  accessToken: string,
): z.infer<
  typeof accessTokenClaimsSchema
> {
  const parts =
    accessToken.split(".");

  if (
    parts.length !== 3 ||
    parts[1] === undefined
  ) {
    throw new FounderAuthError(
      "invalid_token",
    );
  }

  try {
    return accessTokenClaimsSchema.parse(
      JSON.parse(
        Buffer.from(
          parts[1],
          "base64url",
        ).toString("utf8"),
      ),
    );
  } catch (error) {
    if (
      error instanceof
      FounderAuthError
    ) {
      throw error;
    }

    throw new FounderAuthError(
      "invalid_token",
    );
  }
}

function hasAuthenticatedAudience(
  audience: string | readonly string[],
): boolean {
  return Array.isArray(audience)
    ? audience.includes("authenticated")
    : audience === "authenticated";
}

export class SupabaseFounderAuthService
implements FounderAuthService {
  private readonly authUserUrl: string;
  private readonly expectedIssuer: string;
  private readonly publishableKey: string;
  private readonly timeoutMs: number;
  private readonly fetchFunction: FetchFunction;
  private readonly now: () => number;

  constructor(
    options: SupabaseFounderAuthOptions,
  ) {
    const baseUrl =
      options.supabaseUrl.replace(
        /\/$/,
        "",
      );

    this.authUserUrl =
      `${baseUrl}/auth/v1/user`;
    this.expectedIssuer =
      `${baseUrl}/auth/v1`;
    this.publishableKey =
      options.publishableKey;
    this.timeoutMs =
      options.timeoutMs;
    this.fetchFunction =
      options.fetchFunction ?? fetch;
    this.now =
      options.now ?? Date.now;
  }

  async authenticate(
    accessToken: string,
  ): Promise<FounderIdentity> {
    const claims =
      decodeClaims(accessToken);

    const controller =
      new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      this.timeoutMs,
    );

    let response: Response;

    try {
      response =
        await this.fetchFunction(
          this.authUserUrl,
          {
            method: "GET",
            headers: {
              apikey:
                this.publishableKey,
              authorization:
                `Bearer ${accessToken}`,
            },
            signal:
              controller.signal,
          },
        );
    } catch {
      throw new FounderAuthError(
        "provider_unavailable",
      );
    } finally {
      clearTimeout(timeout);
    }

    if (
      response.status === 401 ||
      response.status === 403
    ) {
      throw new FounderAuthError(
        "invalid_token",
      );
    }

    if (!response.ok) {
      throw new FounderAuthError(
        "provider_unavailable",
      );
    }

    let userResult:
      ReturnType<
        typeof authenticatedUserSchema.safeParse
      >;

    try {
      userResult =
        authenticatedUserSchema.safeParse(
          await response.json(),
        );
    } catch {
      throw new FounderAuthError(
        "provider_unavailable",
      );
    }

    if (!userResult.success) {
      throw new FounderAuthError(
        "provider_unavailable",
      );
    }

    const user = userResult.data;
    const nowSeconds =
      Math.floor(this.now() / 1_000);

    if (
      claims.iss !==
        this.expectedIssuer ||
      !hasAuthenticatedAudience(
        claims.aud,
      ) ||
      claims.exp <= nowSeconds ||
      claims.sub !== user.id ||
      user.is_anonymous === true
    ) {
      throw new FounderAuthError(
        "invalid_token",
      );
    }

    if (claims.aal !== "aal2") {
      throw new FounderAuthError(
        "mfa_required",
      );
    }

    if (
      user.app_metadata.role !==
      "founder"
    ) {
      throw new FounderAuthError(
        "founder_role_required",
      );
    }

    return {
      userId: user.id,
      email: user.email ?? null,
    };
  }
}
