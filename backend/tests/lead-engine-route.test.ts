import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";

import {
  FounderAuthError,
  type FounderAuthService,
} from "../src/ports/founder-auth.js";

const USER_ID =
  "79b42d3d-78be-42fc-9d91-5d97566d2ed0";

const founderService:
  FounderAuthService = {
    async authenticate() {
      return {
        userId: USER_ID,
        email:
          "founder@example.com",
      };
    },
  };

test(
  "Lead Engine route does not exist when its feature flag is off",
  async (context) => {
    const app = await buildApp({
      leadEngineUiEnabled: false,
      founderAuthService:
        founderService,
    });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "GET",
        url:
          "/api/ops/leads/health",
        headers: {
          authorization:
            "Bearer test-token",
        },
      });

    assert.equal(
      response.statusCode,
      404,
    );
  },
);

test(
  "Lead Engine route requires a bearer token",
  async (context) => {
    const app = await buildApp({
      leadEngineUiEnabled: true,
      founderAuthService:
        founderService,
    });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "GET",
        url:
          "/api/ops/leads/health",
      });

    assert.equal(
      response.statusCode,
      401,
    );

    assert.equal(
      response.json().error.code,
      "AUTHENTICATION_REQUIRED",
    );
  },
);

test(
  "Lead Engine route returns founder-only readiness after MFA auth",
  async (context) => {
    const app = await buildApp({
      leadEngineUiEnabled: true,
      founderAuthService:
        founderService,
    });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "GET",
        url:
          "/api/ops/leads/health",
        headers: {
          authorization:
            "Bearer test-token",
        },
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.deepEqual(
      response.json().foundation,
      {
        ready: true,
        access: "founder",
        mfa: "verified",
        userId: USER_ID,
      },
    );
  },
);

for (
  const scenario of [
    {
      failure:
        "invalid_token",
      expectedStatus: 401,
      expectedCode:
        "INVALID_AUTHENTICATION",
    },
    {
      failure:
        "mfa_required",
      expectedStatus: 403,
      expectedCode:
        "MFA_REQUIRED",
    },
    {
      failure:
        "founder_role_required",
      expectedStatus: 403,
      expectedCode: "FORBIDDEN",
    },
    {
      failure:
        "provider_unavailable",
      expectedStatus: 503,
      expectedCode:
        "AUTH_PROVIDER_UNAVAILABLE",
    },
  ] as const
) {
  test(
    `Lead Engine route maps ${scenario.failure} safely`,
    async (context) => {
      const app = await buildApp({
        leadEngineUiEnabled:
          true,
        founderAuthService: {
          async authenticate() {
            throw new FounderAuthError(
              scenario.failure,
            );
          },
        },
      });

      context.after(
        async () => app.close(),
      );

      const response =
        await app.inject({
          method: "GET",
          url:
            "/api/ops/leads/health",
          headers: {
            authorization:
              "Bearer test-token",
          },
        });

      assert.equal(
        response.statusCode,
        scenario.expectedStatus,
      );

      assert.equal(
        response.json().error.code,
        scenario.expectedCode,
      );
    },
  );
}

test(
  "CORS explicitly permits the Authorization header for the founder UI",
  async (context) => {
    const app = await buildApp({
      leadEngineUiEnabled: true,
      founderAuthService:
        founderService,
    });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "OPTIONS",
        url:
          "/api/ops/leads/health",
        headers: {
          origin:
            "http://localhost:5173",
          "access-control-request-method":
            "GET",
          "access-control-request-headers":
            "authorization",
        },
      });

    assert.equal(
      response.statusCode,
      204,
    );

    assert.match(
      response.headers[
        "access-control-allow-headers"
      ] ?? "",
      /authorization/i,
    );
  },
);
