import assert from "node:assert/strict";
import test from "node:test";

import {
  SupabaseFounderAuthService,
} from "../src/adapters/supabase/supabase-founder-auth.js";

import {
  FounderAuthError,
} from "../src/ports/founder-auth.js";

const USER_ID =
  "79b42d3d-78be-42fc-9d91-5d97566d2ed0";

const SUPABASE_URL =
  "https://example.supabase.co";

const NOW_MS =
  Date.UTC(2026, 7, 10, 12);

function tokenWith(
  overrides:
    Readonly<Record<string, unknown>> = {},
): string {
  const header =
    Buffer.from(
      JSON.stringify({
        alg: "HS256",
        typ: "JWT",
      }),
    ).toString("base64url");

  const payload =
    Buffer.from(
      JSON.stringify({
        iss:
          `${SUPABASE_URL}/auth/v1`,
        sub: USER_ID,
        aud: "authenticated",
        exp:
          Math.floor(NOW_MS / 1_000) +
          3_600,
        aal: "aal2",
        ...overrides,
      }),
    ).toString("base64url");

  return `${header}.${payload}.signature`;
}

function userResponse(
  overrides:
    Readonly<Record<string, unknown>> = {},
): Response {
  return Response.json({
    id: USER_ID,
    email:
      "founder@example.com",
    is_anonymous: false,
    app_metadata: {
      role: "founder",
    },
    ...overrides,
  });
}

function createService(
  response: Response,
): SupabaseFounderAuthService {
  return new SupabaseFounderAuthService({
    supabaseUrl: SUPABASE_URL,
    publishableKey:
      "sb_publishable_test",
    timeoutMs: 1_000,
    now: () => NOW_MS,
    fetchFunction:
      (async () => response) as
        typeof fetch,
  });
}

async function assertFailure(
  promise: Promise<unknown>,
  failure:
    FounderAuthError["failure"],
): Promise<void> {
  await assert.rejects(
    promise,
    (error: unknown) =>
      error instanceof
        FounderAuthError &&
      error.failure === failure,
  );
}

test(
  "Supabase founder auth accepts a remotely validated founder aal2 session",
  async () => {
    const identity =
      await createService(
        userResponse(),
      ).authenticate(
        tokenWith(),
      );

    assert.deepEqual(identity, {
      userId: USER_ID,
      email:
        "founder@example.com",
    });
  },
);

test(
  "Supabase founder auth rejects a valid aal1 session",
  async () => {
    await assertFailure(
      createService(
        userResponse(),
      ).authenticate(
        tokenWith({
          aal: "aal1",
        }),
      ),
      "mfa_required",
    );
  },
);

test(
  "Supabase founder auth uses app_metadata and rejects a non-founder",
  async () => {
    await assertFailure(
      createService(
        userResponse({
          app_metadata: {
            role: "staff",
          },
          user_metadata: {
            role: "founder",
          },
        }),
      ).authenticate(
        tokenWith(),
      ),
      "founder_role_required",
    );
  },
);

test(
  "Supabase founder auth rejects claims that do not match the validated user",
  async () => {
    await assertFailure(
      createService(
        userResponse(),
      ).authenticate(
        tokenWith({
          sub:
            "f985fc90-497c-4baa-9d63-b039bf09ca34",
        }),
      ),
      "invalid_token",
    );
  },
);

test(
  "Supabase founder auth maps a rejected remote token to invalid authentication",
  async () => {
    await assertFailure(
      createService(
        Response.json(
          { message: "invalid" },
          { status: 401 },
        ),
      ).authenticate(
        tokenWith(),
      ),
      "invalid_token",
    );
  },
);
