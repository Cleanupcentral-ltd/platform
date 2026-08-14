import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { z } from "zod";

import {
  OutreachError,
  type ManualOutreachService,
} from "../../application/outreach.js";

import {
  FounderAuthError,
  type FounderAuthService,
} from "../../ports/founder-auth.js";

import { HttpError } from "../http-errors.js";

export interface ManualOutreachRouteDependencies {
  readonly founderAuthService:
    FounderAuthService;
  readonly service:
    ManualOutreachService;
}

const paramsSchema = z.object({
  prospectId: z.string().uuid(),
});

const previewRequestSchema =
  z.strictObject({
    contactId: z.string()
      .uuid()
      .nullable()
      .optional()
      .default(null),
  });

const nullableText = (maximum: number) =>
  z.string()
    .trim()
    .min(1)
    .max(maximum)
    .nullable()
    .optional()
    .default(null);

const activityRequestSchema =
  z.strictObject({
    activityType: z.enum([
      "contacted",
      "replied",
      "follow_up_scheduled",
      "outcome",
    ]),
    outcome: z.enum([
      "won",
      "lost",
      "not_now",
      "not_interested",
      "do_not_contact",
    ]).nullable().optional().default(null),
    notes: nullableText(1_000),
    followUpAt: z.string()
      .datetime({ offset: true })
      .nullable()
      .optional()
      .default(null),
  });

const RATE_LIMIT = {
  max: 20,
  timeWindow: "1 minute",
  groupId: "manual-outreach",
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
      code: "AUTHENTICATION_REQUIRED",
      message:
        "Founder authentication is required.",
      statusCode: 401,
    });
  }
  return match[1];
}

async function authenticateFounder(
  request: FastifyRequest,
  service: FounderAuthService,
) {
  try {
    return await service.authenticate(
      readBearerToken(request),
    );
  } catch (error) {
    if (error instanceof FounderAuthError) {
      switch (error.failure) {
        case "invalid_token":
          throw new HttpError({
            code: "INVALID_AUTHENTICATION",
            message:
              "Founder authentication is invalid or expired.",
            statusCode: 401,
          });
        case "mfa_required":
          throw new HttpError({
            code: "MFA_REQUIRED",
            message:
              "Multi-factor authentication is required.",
            statusCode: 403,
          });
        case "founder_role_required":
          throw new HttpError({
            code: "FORBIDDEN",
            message:
              "Founder access is required.",
            statusCode: 403,
          });
        case "provider_unavailable":
          throw new HttpError({
            code: "AUTH_PROVIDER_UNAVAILABLE",
            message:
              "Founder authentication is temporarily unavailable.",
            statusCode: 503,
          });
      }
    }
    throw error;
  }
}

function requireJson(
  request: FastifyRequest,
): void {
  const contentType =
    request.headers["content-type"];
  const mediaType =
    typeof contentType === "string"
      ? contentType
          .split(";", 1)[0]
          ?.trim()
          .toLowerCase() ?? ""
      : "";
  if (mediaType !== "application/json") {
    throw new HttpError({
      code: "UNSUPPORTED_MEDIA_TYPE",
      message:
        "Manual outreach requests must use application/json.",
      statusCode: 415,
    });
  }
}

async function run<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!(error instanceof OutreachError)) {
      throw error;
    }
    switch (error.failure) {
      case "not_found":
        throw new HttpError({
          code: "LEAD_NOT_FOUND",
          message:
            "The requested prospect was not found.",
          statusCode: 404,
        });
      case "not_eligible":
        throw new HttpError({
          code: "OUTREACH_NOT_ELIGIBLE",
          message:
            "This prospect is not currently Ready for outreach. Resolve every evidence, subscriber and suppression blocker first.",
          statusCode: 409,
        });
      case "unsupported_contact":
        throw new HttpError({
          code: "OUTREACH_CONTACT_UNSUPPORTED",
          message:
            "Choose a verified generic business email from the prospect's first-party website.",
          statusCode: 400,
        });
      case "invalid_activity":
        throw new HttpError({
          code: "INVALID_OUTREACH_ACTIVITY",
          message:
            "The activity is not valid for the prospect's current outreach stage.",
          statusCode: 400,
        });
      case "repository_unavailable":
        throw new HttpError({
          code: "OUTREACH_STORE_UNAVAILABLE",
          message:
            "Outreach tracking is temporarily unavailable. No email was sent.",
          statusCode: 503,
        });
      case "stale_preview":
      case "not_connected":
      case "provider_unavailable":
        throw new HttpError({
          code: "MANUAL_OUTREACH_UNAVAILABLE",
          message:
            "The manual outreach preview is temporarily unavailable. No email was sent.",
          statusCode: 503,
        });
    }
  }
}

export function registerManualOutreachRoutes(
  app: FastifyInstance,
  dependencies:
    ManualOutreachRouteDependencies,
): void {
  app.get(
    "/api/ops/leads/manual-outreach/follow-ups",
    {
      config: {
        rateLimit: RATE_LIMIT,
      },
    },
    async (
      request,
      reply,
    ): Promise<FastifyReply> => {
      const founder =
        await authenticateFounder(
          request,
          dependencies.founderAuthService,
        );
      const followUps = await run(
        () => dependencies.service
          .listFollowUps(founder.userId),
      );
      return reply
        .header("Cache-Control", "no-store")
        .status(200)
        .type("application/json")
        .send({
          success: true,
          followUps,
          requestId: request.id,
        });
    },
  );

  app.get(
    "/api/ops/leads/prospects/:prospectId/manual-outreach",
    {
      config: {
        rateLimit: RATE_LIMIT,
      },
    },
    async (
      request,
      reply,
    ): Promise<FastifyReply> => {
      const founder =
        await authenticateFounder(
          request,
          dependencies.founderAuthService,
        );
      const params = paramsSchema
        .safeParse(request.params);
      if (!params.success) {
        throw new HttpError({
          code: "VALIDATION_ERROR",
          message:
            "Enter a valid prospect reference.",
          statusCode: 400,
        });
      }
      const outreach = await run(
        () => dependencies.service
          .getWorkspace(
            founder.userId,
            params.data.prospectId,
          ),
      );
      return reply
        .header("Cache-Control", "no-store")
        .status(200)
        .type("application/json")
        .send({
          success: true,
          outreach,
          requestId: request.id,
        });
    },
  );

  app.post(
    "/api/ops/leads/prospects/:prospectId/manual-outreach-preview",
    {
      bodyLimit: 4 * 1024,
      config: {
        rateLimit: RATE_LIMIT,
      },
    },
    async (
      request,
      reply,
    ): Promise<FastifyReply> => {
      const founder =
        await authenticateFounder(
          request,
          dependencies.founderAuthService,
        );
      requireJson(request);
      const params = paramsSchema
        .safeParse(request.params);
      const body = previewRequestSchema
        .safeParse(request.body);
      if (!params.success || !body.success) {
        throw new HttpError({
          code: "VALIDATION_ERROR",
          message:
            "The manual outreach preview request is invalid.",
          statusCode: 400,
        });
      }
      const preview = await run(
        () => dependencies.service
          .previewDraft(
            founder.userId,
            params.data.prospectId,
            body.data.contactId,
          ),
      );
      return reply
        .header("Cache-Control", "no-store")
        .status(200)
        .type("application/json")
        .send({
          success: true,
          preview,
          sent: false,
          requestId: request.id,
        });
    },
  );

  app.post(
    "/api/ops/leads/prospects/:prospectId/manual-outreach-activities",
    {
      bodyLimit: 4 * 1024,
      config: {
        rateLimit: RATE_LIMIT,
      },
    },
    async (
      request,
      reply,
    ): Promise<FastifyReply> => {
      const founder =
        await authenticateFounder(
          request,
          dependencies.founderAuthService,
        );
      requireJson(request);
      const params = paramsSchema
        .safeParse(request.params);
      const body = activityRequestSchema
        .safeParse(request.body);
      if (!params.success || !body.success) {
        throw new HttpError({
          code: "VALIDATION_ERROR",
          message:
            "The outreach activity request is invalid.",
          statusCode: 400,
        });
      }
      const activity = await run(
        () => dependencies.service
          .recordActivity(
            founder.userId,
            params.data.prospectId,
            body.data,
          ),
      );
      return reply
        .header("Cache-Control", "no-store")
        .status(201)
        .type("application/json")
        .send({
          success: true,
          activity,
          requestId: request.id,
        });
    },
  );
}
