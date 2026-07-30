import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import type {
  SubmissionNotificationService,
} from "../../application/deliver-notifications.js";

import type {
  QuotePersistenceService,
} from "../../application/persist-quote.js";

import type {
  QuotePricingService,
} from "../../application/price-quote.js";

import type {
  QuoteResolutionService,
} from "../../application/resolve-quote-context.js";

import {
  submitQuoteSchema,
} from "../../application/validation/submit-quote.js";

import {
  HttpError,
} from "../http-errors.js";

import {
  createPublicQuoteResponse,
} from "../responses/quote-response.js";

import {
  quoteSubmissionEnvelopeSchema,
} from "../schemas/quote-submission-envelope.js";

const QUOTE_BODY_LIMIT_BYTES =
  256 * 1024;

const QUOTE_RATE_LIMIT = {
  max: 5,
  timeWindow: "1 minute",
  groupId: "quote-submission",
} as const;

export interface QuoteRouteDependencies {
  readonly quoteResolutionService:
    QuoteResolutionService;

  readonly quotePricingService:
    QuotePricingService;

  readonly quotePersistenceService:
    QuotePersistenceService;

  readonly notificationService:
    SubmissionNotificationService;
}

function readMediaType(
  request: FastifyRequest,
): string {
  const contentType =
    request.headers["content-type"];

  if (
    typeof contentType !== "string"
  ) {
    return "";
  }

  return (
    contentType
      .split(";", 1)[0]
      ?.trim()
      .toLowerCase() ?? ""
  );
}

function validationDetails(
  issues: readonly {
    readonly path:
      readonly PropertyKey[];

    readonly message: string;
  }[],

  prefix = "",
): Readonly<
  Record<string, unknown>
> {
  return {
    issues: issues.map(
      ({ path, message }) => {
        const fieldPath =
          path.length === 0
            ? "request"
            : path
                .map(String)
                .join(".");

        return {
          field:
            prefix.length === 0
              ? fieldPath
              : `${prefix}.${fieldPath}`,

          message,
        };
      },
    ),
  };
}

function hasOwnSubmissionId(
  payload:
    Readonly<Record<string, unknown>>,
): boolean {
  return Object.prototype
    .hasOwnProperty.call(
      payload,
      "submissionId",
    );
}

export function registerQuoteRoutes(
  app: FastifyInstance,
  dependencies:
    QuoteRouteDependencies,
): void {
  app.post(
    "/api/quotes",
    {
      bodyLimit:
        QUOTE_BODY_LIMIT_BYTES,

      config: {
        rateLimit:
          QUOTE_RATE_LIMIT,
      },
    },

    async (
      request,
      reply,
    ): Promise<FastifyReply> => {
      const mediaType =
        readMediaType(request);

      if (
        mediaType !==
        "application/json"
      ) {
        throw new HttpError({
          code:
            "UNSUPPORTED_MEDIA_TYPE",

          message:
            "Quote submissions must use application/json.",

          statusCode: 415,
        });
      }

      const envelopeResult =
        quoteSubmissionEnvelopeSchema
          .safeParse(request.body);

      if (
        !envelopeResult.success
      ) {
        throw new HttpError({
          code: "VALIDATION_ERROR",

          message:
            "The quote submission contains invalid or unexpected information.",

          statusCode: 400,

          details:
            validationDetails(
              envelopeResult
                .error.issues,
            ),
        });
      }

      const envelope =
        envelopeResult.data;

      if (
        hasOwnSubmissionId(
          envelope.payload,
        ) &&
        envelope.payload
          .submissionId !==
          envelope.submissionId
      ) {
        throw new HttpError({
          code: "VALIDATION_ERROR",

          message:
            "The submission identifiers do not match.",

          statusCode: 400,

          details: {
            issues: [
              {
                field:
                  "payload.submissionId",

                message:
                  "The payload submission ID must match the request envelope.",
              },
            ],
          },
        });
      }

      const submissionResult =
        submitQuoteSchema.safeParse({
          ...envelope.payload,

          submissionId:
            envelope.submissionId,
        });

      if (
        !submissionResult.success
      ) {
        throw new HttpError({
          code: "VALIDATION_ERROR",

          message:
            "The quote submission contains invalid or unexpected information.",

          statusCode: 400,

          details:
            validationDetails(
              submissionResult
                .error.issues,

              "payload",
            ),
        });
      }

      const resolution =
        await dependencies
          .quoteResolutionService
          .resolve(
            submissionResult.data,
          );

      const pricing =
        await dependencies
          .quotePricingService
          .price(resolution);

      const persisted =
        await dependencies
          .quotePersistenceService
          .persist(
            resolution,
            pricing,
          );

      let notificationReport = {
        attempted: 0,
        sent: 0,
        failed: 0,
      };

      try {
        notificationReport =
          await dependencies
            .notificationService
            .notifyQuote(
              persisted,
            );
      } catch {
        request.log.error(
          {
            requestId: request.id,

            submissionId:
              submissionResult
                .data.submissionId,

            quoteNumber:
              persisted.quote
                .quoteNumber,
          },

          "Quote notification dispatch failed after persistence",
        );
      }

      request.log.info(
        {
          requestId: request.id,
          submissionId:
            submissionResult
              .data.submissionId,
          quoteId:
            persisted.quote.id,
          quoteNumber:
            persisted.quote
              .quoteNumber,
          customerResolution:
            resolution.customer.kind,
          propertyResolution:
            resolution.property.kind,
          persistenceOutcome:
            persisted.outcome,
          createdCustomer:
            persisted.outcome ===
            "created"
              ? persisted.createdCustomer
              : false,
          createdProperty:
            persisted.outcome ===
            "created"
              ? persisted.createdProperty
              : false,
          pricingKind: pricing.kind,
          pricingVersion:
            pricing.pricingVersion,
          estimatedTotal:
            pricing.estimatedTotal,
          manualReviewRequired:
            persisted.quote
              .manualReviewRequired,

          notificationsAttempted:
            notificationReport
              .attempted,

          notificationsSent:
            notificationReport.sent,

          notificationsFailed:
            notificationReport.failed,
        },

        "Quote submission processed with idempotency and notification protection",
      );

      const statusCode =
        persisted.outcome ===
        "created"
          ? 201
          : 200;

      return reply
        .header(
          "Cache-Control",
          "no-store",
        )
        .status(statusCode)
        .send(
          createPublicQuoteResponse(
            persisted,
            request.id,
          ),
        );
    },
  );
}
