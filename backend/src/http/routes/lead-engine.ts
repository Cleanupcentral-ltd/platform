import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import {
  FounderAuthError,
  type FounderAuthService,
} from "../../ports/founder-auth.js";

import {
  HttpError,
} from "../http-errors.js";

export interface LeadEngineRouteDependencies {
  readonly founderAuthService:
    FounderAuthService;
}

function readBearerToken(
  request: FastifyRequest,
): string {
  const authorization =
    request.headers.authorization;

  const match =
    typeof authorization === "string"
      ? /^Bearer\s+([^\s]+)$/i.exec(
          authorization,
        )
      : null;

  if (
    match === null ||
    match[1] === undefined
  ) {
    throw new HttpError({
      code:
        "AUTHENTICATION_REQUIRED",
      message:
        "Founder authentication is required.",
      statusCode: 401,
    });
  }

  return match[1];
}

function mapAuthError(
  error: FounderAuthError,
): HttpError {
  switch (error.failure) {
    case "invalid_token":
      return new HttpError({
        code:
          "INVALID_AUTHENTICATION",
        message:
          "Founder authentication is invalid or expired.",
        statusCode: 401,
      });

    case "mfa_required":
      return new HttpError({
        code: "MFA_REQUIRED",
        message:
          "Multi-factor authentication is required.",
        statusCode: 403,
      });

    case "founder_role_required":
      return new HttpError({
        code: "FORBIDDEN",
        message:
          "Founder access is required.",
        statusCode: 403,
      });

    case "provider_unavailable":
      return new HttpError({
        code:
          "AUTH_PROVIDER_UNAVAILABLE",
        message:
          "Founder authentication is temporarily unavailable.",
        statusCode: 503,
      });
  }
}

export function registerLeadEngineRoutes(
  app: FastifyInstance,
  dependencies:
    LeadEngineRouteDependencies,
): void {
  app.get(
    "/api/ops/leads/health",
    async (
      request,
      reply,
    ): Promise<FastifyReply> => {
      const accessToken =
        readBearerToken(request);

      let founder;

      try {
        founder =
          await dependencies
            .founderAuthService
            .authenticate(
              accessToken,
            );
      } catch (error) {
        if (
          error instanceof
          FounderAuthError
        ) {
          throw mapAuthError(error);
        }

        throw error;
      }

      return reply
        .header(
          "Cache-Control",
          "no-store",
        )
        .status(200)
        .type("application/json")
        .send({
          success: true,
          foundation: {
            ready: true,
            access: "founder",
            mfa: "verified",
            userId:
              founder.userId,
          },
          requestId: request.id,
        });
    },
  );
}
