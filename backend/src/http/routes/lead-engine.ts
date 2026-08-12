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
  LeadReviewError,
  type LeadReviewService,
} from "../../application/review-leads.js";

import {
  FounderAuthError,
  type FounderAuthService,
} from "../../ports/founder-auth.js";

import {
  LEAD_SECTORS,
} from "../../ports/lead-search.js";

import {
  LEAD_EVIDENCE_SOURCE_TYPES,
  LEAD_VERIFICATION_FACTS,
} from "../../ports/lead-review.js";

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

  readonly leadReviewService?:
    LeadReviewService | null;
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

const prospectParamsSchema =
  z.object({
    prospectId: z.string().uuid(),
  });

const evidenceParamsSchema =
  z.object({
    prospectId: z.string().uuid(),
    evidenceId: z.string().uuid(),
  });

const addEvidenceRequestSchema =
  z.strictObject({
    sourceType: z.enum(
      LEAD_EVIDENCE_SOURCE_TYPES,
    ),
    sourceUrl: z.string()
      .trim()
      .url()
      .max(2_000),
    factName: z.enum(
      LEAD_VERIFICATION_FACTS,
    ),
    factValue: z.string()
      .trim()
      .min(1)
      .max(500),
    sourceExcerpt:
      nullableText(500),
  });

const evidenceDecisionRequestSchema =
  z.strictObject({
    decision: z.enum([
      "verified",
      "rejected",
    ]),
    reviewNote:
      nullableText(500),
  });

const assessmentRequestSchema =
  z.strictObject({});

const SEARCH_RATE_LIMIT = {
  max: 7,
  timeWindow: "1 minute",
  groupId: "lead-search",
} as const;

const MANUAL_RATE_LIMIT = {
  max: 20,
  timeWindow: "1 minute",
  groupId: "manual-lead-capture",
} as const;

const REVIEW_RATE_LIMIT = {
  max: 30,
  timeWindow: "1 minute",
  groupId: "lead-review",
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

function mapLeadReviewError(
  error: LeadReviewError,
): HttpError {
  switch (error.failure) {
    case "not_found":
      return new HttpError({
        code: "LEAD_NOT_FOUND",
        message:
          "The requested prospect or evidence record was not found.",
        statusCode: 404,
      });
    case "invalid_evidence":
      return new HttpError({
        code: "INVALID_LEAD_EVIDENCE",
        message:
          "Enter a supported fact from an HTTPS first-party or Companies House source.",
        statusCode: 400,
      });
    case "repository_unavailable":
      return new HttpError({
        code:
          "LEAD_REVIEW_STORE_UNAVAILABLE",
        message:
          "Prospect review is temporarily unavailable. No review change has been accepted.",
        statusCode: 503,
      });
  }
}

async function runReviewOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (
      error instanceof LeadReviewError
    ) {
      throw mapLeadReviewError(error);
    }
    throw error;
  }
}

function requireJson(
  request: FastifyRequest,
  message: string,
): void {
  if (
    readMediaType(request) !==
    "application/json"
  ) {
    throw new HttpError({
      code: "UNSUPPORTED_MEDIA_TYPE",
      message,
      statusCode: 415,
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
            reviewAndScoring:
              dependencies
                .leadReviewService !==
                null &&
              dependencies
                .leadReviewService !==
                undefined,
            outlookDrafts: false,
          },
          requestId: request.id,
        });
    },
  );

  if (
    dependencies.leadReviewService !==
      null &&
    dependencies.leadReviewService !==
      undefined
  ) {
    const reviewService =
      dependencies.leadReviewService;

    app.get(
      "/api/ops/leads/prospects",
      {
        config: {
          rateLimit:
            REVIEW_RATE_LIMIT,
        },
      },
      async (
        request,
        reply,
      ): Promise<FastifyReply> => {
        await authenticateFounder(
          request,
          dependencies
            .founderAuthService,
        );
        const prospects =
          await runReviewOperation(
            () => reviewService
              .listProspects(),
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
            prospects,
            requestId: request.id,
          });
      },
    );

    app.get(
      "/api/ops/leads/prospects/:prospectId",
      {
        config: {
          rateLimit:
            REVIEW_RATE_LIMIT,
        },
      },
      async (
        request,
        reply,
      ): Promise<FastifyReply> => {
        await authenticateFounder(
          request,
          dependencies
            .founderAuthService,
        );
        const params =
          prospectParamsSchema
            .safeParse(request.params);
        if (!params.success) {
          throw new HttpError({
            code: "VALIDATION_ERROR",
            message:
              "Enter a valid prospect reference.",
            statusCode: 400,
          });
        }
        const prospect =
          await runReviewOperation(
            () => reviewService
              .getProspect(
                params.data
                  .prospectId,
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
            prospect,
            requestId: request.id,
          });
      },
    );

    app.post(
      "/api/ops/leads/prospects/:prospectId/evidence",
      {
        bodyLimit: 16 * 1024,
        config: {
          rateLimit:
            REVIEW_RATE_LIMIT,
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
        requireJson(
          request,
          "Verification evidence must use application/json.",
        );
        const params =
          prospectParamsSchema
            .safeParse(request.params);
        const body =
          addEvidenceRequestSchema
            .safeParse(request.body);
        if (
          !params.success ||
          !body.success
        ) {
          throw new HttpError({
            code: "VALIDATION_ERROR",
            message:
              "Enter a supported fact from a first-party or Companies House source.",
            statusCode: 400,
          });
        }
        const result =
          await runReviewOperation(
            () => reviewService
              .addEvidence(
                founder.userId,
                params.data
                  .prospectId,
                body.data,
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
            verification: result,
            requestId: request.id,
          });
      },
    );

    app.post(
      "/api/ops/leads/prospects/:prospectId/evidence/:evidenceId/decision",
      {
        bodyLimit: 8 * 1024,
        config: {
          rateLimit:
            REVIEW_RATE_LIMIT,
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
        requireJson(
          request,
          "Evidence decisions must use application/json.",
        );
        const params =
          evidenceParamsSchema
            .safeParse(request.params);
        const body =
          evidenceDecisionRequestSchema
            .safeParse(request.body);
        if (
          !params.success ||
          !body.success
        ) {
          throw new HttpError({
            code: "VALIDATION_ERROR",
            message:
              "Choose verified or rejected for a valid evidence record.",
            statusCode: 400,
          });
        }
        const automaticAssessment =
          await runReviewOperation(
          () => reviewService
            .decideEvidence(
              founder.userId,
              params.data.prospectId,
              params.data.evidenceId,
              body.data,
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
            decision:
              body.data.decision,
            automaticAssessment,
            requestId: request.id,
          });
      },
    );

    app.post(
      "/api/ops/leads/prospects/:prospectId/assessments",
      {
        bodyLimit: 1 * 1024,
        config: {
          rateLimit:
            REVIEW_RATE_LIMIT,
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
        requireJson(
          request,
          "Assessments must use application/json.",
        );
        const params =
          prospectParamsSchema
            .safeParse(request.params);
        const body =
          assessmentRequestSchema
            .safeParse(request.body);
        if (
          !params.success ||
          !body.success
        ) {
          throw new HttpError({
            code: "VALIDATION_ERROR",
            message:
              "Enter a valid prospect reference without client-supplied scoring data.",
            statusCode: 400,
          });
        }
        const assessment =
          await runReviewOperation(
            () => reviewService.assess(
              founder.userId,
              params.data.prospectId,
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
            assessment,
            requestId: request.id,
          });
      },
    );
  }

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
