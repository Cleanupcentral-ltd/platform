import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { z } from "zod";

import {
  LeadSearchError,
  type LeadSearchService,
} from "../../application/search-leads.js";

import {
  FounderAuthError,
  type FounderAuthService,
} from "../../ports/founder-auth.js";

import {
  LEAD_SECTORS,
} from "../../ports/lead-search.js";

import {
  HttpError,
} from "../http-errors.js";

export interface LeadEngineRouteDependencies {
  readonly founderAuthService:
    FounderAuthService;

  readonly leadSearchEnabled:
    boolean;

  readonly leadSearchService:
    LeadSearchService | null;
}

const UK_POSTCODE =
  /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/;

const searchRequestSchema =
  z.strictObject({
    postcode: z.string()
      .trim()
      .min(5)
      .max(12)
      .regex(UK_POSTCODE),
    radiusMiles: z.number()
      .min(0.1)
      .max(30),
    sector: z.enum(
      LEAD_SECTORS,
    ),
  });

const nullableText = (maximum: number) =>
  z.string()
    .trim()
    .min(1)
    .max(maximum)
    .nullable()
    .optional()
    .default(null);

const nullableUrl = z.string()
  .trim()
  .url()
  .nullable()
  .optional()
  .default(null);

const manualRequestSchema =
  z.strictObject({
    businessName: z.string()
      .trim()
      .min(2)
      .max(200),
    sector: z.enum(
      LEAD_SECTORS,
    ),
    sourceUrl: z.string()
      .trim()
      .url(),
    formattedAddress:
      nullableText(300),
    primaryPostcode: z.string()
      .trim()
      .min(5)
      .max(12)
      .regex(UK_POSTCODE)
      .nullable()
      .optional()
      .default(null),
    websiteUrl: nullableUrl,
    phone: z.string()
      .trim()
      .min(5)
      .max(30)
      .nullable()
      .optional()
      .default(null),
    email: z.string()
      .trim()
      .email()
      .nullable()
      .optional()
      .default(null),
    contactFormUrl: nullableUrl,
  });

const SEARCH_RATE_LIMIT = {
  max: 5,
  timeWindow: "1 minute",
  groupId: "lead-search",
} as const;

const MANUAL_RATE_LIMIT = {
  max: 20,
  timeWindow: "1 minute",
  groupId: "manual-lead-capture",
} as const;

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

async function authenticateFounder(
  request: FastifyRequest,
  service: FounderAuthService,
) {
  const accessToken =
    readBearerToken(request);

  try {
    return await service.authenticate(
      accessToken,
    );
  } catch (error) {
    if (
      error instanceof FounderAuthError
    ) {
      throw mapAuthError(error);
    }

    throw error;
  }
}

function readMediaType(
  request: FastifyRequest,
): string {
  const contentType =
    request.headers["content-type"];

  return typeof contentType === "string"
    ? contentType
        .split(";", 1)[0]
        ?.trim()
        .toLowerCase() ?? ""
    : "";
}

function mapLeadSearchError(
  error: LeadSearchError,
): HttpError {
  switch (error.failure) {
    case "disabled":
      return new HttpError({
        code: "LEAD_SEARCH_DISABLED",
        message:
          "Lead search is not enabled.",
        statusCode: 503,
      });
    case "invalid_postcode":
      return new HttpError({
        code: "INVALID_POSTCODE",
        message:
          "Enter a valid UK postcode.",
        statusCode: 400,
      });
    case "postcode_provider_unavailable":
      return new HttpError({
        code:
          "POSTCODE_PROVIDER_UNAVAILABLE",
        message:
          "Postcode lookup is temporarily unavailable. Use manual capture or try again.",
        statusCode: 503,
      });
    case "search_provider_unavailable":
      return new HttpError({
        code:
          "SEARCH_PROVIDER_UNAVAILABLE",
        message:
          "Business search is temporarily unavailable. Use manual capture or try again.",
        statusCode: 503,
      });
    case "repository_unavailable":
      return new HttpError({
        code: "LEAD_STORE_UNAVAILABLE",
        message:
          "Lead results could not be saved. No results have been accepted.",
        statusCode: 503,
      });
  }
}

async function runSearchOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (
      error instanceof LeadSearchError
    ) {
      throw mapLeadSearchError(error);
    }
    throw error;
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
      const founder =
        await authenticateFounder(
          request,
          dependencies
            .founderAuthService,
        );

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
          capabilities: {
            search:
              dependencies
                .leadSearchEnabled,
            manualCapture:
              dependencies
                .leadSearchEnabled,
          },
          requestId: request.id,
        });
    },
  );

  if (
    dependencies.leadSearchService ===
    null
  ) {
    return;
  }

  app.post(
    "/api/ops/leads/search",
    {
      bodyLimit: 8 * 1024,
      config: {
        rateLimit:
          SEARCH_RATE_LIMIT,
      },
    },
    async (
      request,
      reply,
    ): Promise<FastifyReply> => {
      const founder =
        await authenticateFounder(
          request,
          dependencies
            .founderAuthService,
        );

      if (
        readMediaType(request) !==
        "application/json"
      ) {
        throw new HttpError({
          code:
            "UNSUPPORTED_MEDIA_TYPE",
          message:
            "Lead searches must use application/json.",
          statusCode: 415,
        });
      }

      const parsed =
        searchRequestSchema.safeParse(
          request.body,
        );

      if (!parsed.success) {
        throw new HttpError({
          code: "VALIDATION_ERROR",
          message:
            "Enter a valid postcode, radius up to 30 miles, and approved sector.",
          statusCode: 400,
        });
      }

      const outcome =
        await runSearchOperation(
          () => dependencies
            .leadSearchService!
            .search(
              founder.userId,
              parsed.data,
            ),
        );

      return reply
        .header(
          "Cache-Control",
          "no-store",
        )
        .status(200)
        .type("application/json")
        .send({
          success: true,
          search: outcome,
          requestId: request.id,
        });
    },
  );

  app.post(
    "/api/ops/leads/manual",
    {
      bodyLimit: 16 * 1024,
      config: {
        rateLimit:
          MANUAL_RATE_LIMIT,
      },
    },
    async (
      request,
      reply,
    ): Promise<FastifyReply> => {
      const founder =
        await authenticateFounder(
          request,
          dependencies
            .founderAuthService,
        );

      if (
        readMediaType(request) !==
        "application/json"
      ) {
        throw new HttpError({
          code:
            "UNSUPPORTED_MEDIA_TYPE",
          message:
            "Manual lead capture must use application/json.",
          statusCode: 415,
        });
      }

      const parsed =
        manualRequestSchema.safeParse(
          request.body,
        );

      if (!parsed.success) {
        throw new HttpError({
          code: "VALIDATION_ERROR",
          message:
            "Enter a business name, approved sector and public source URL.",
          statusCode: 400,
        });
      }

      const outcome =
        await runSearchOperation(
          () => dependencies
            .leadSearchService!
            .captureManual(
              founder.userId,
              parsed.data,
            ),
        );

      return reply
        .header(
          "Cache-Control",
          "no-store",
        )
        .status(201)
        .type("application/json")
        .send({
          success: true,
          manualCapture: outcome,
          requestId: request.id,
        });
    },
  );
}
