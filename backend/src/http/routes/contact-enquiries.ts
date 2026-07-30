import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import type {
  SubmissionNotificationService,
} from "../../application/deliver-notifications.js";

import type {
  ContactEnquiryPersistenceService,
} from "../../application/persist-contact-enquiry.js";

import {
  submitContactEnquirySchema,
} from "../../application/validation/contact-enquiry.js";

import {
  HttpError,
} from "../http-errors.js";

import {
  createPublicContactEnquiryResponse,
} from "../responses/contact-enquiry-response.js";

import {
  contactEnquiryEnvelopeSchema,
} from "../schemas/contact-enquiry-envelope.js";

const CONTACT_BODY_LIMIT_BYTES =
  32 * 1024;

const CONTACT_RATE_LIMIT = {
  max: 3,
  timeWindow: "10 minutes",
  groupId: "contact-enquiry-submission",
} as const;

export interface ContactEnquiryRouteDependencies {
  readonly persistenceService:
    ContactEnquiryPersistenceService;

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

export function registerContactEnquiryRoutes(
  app: FastifyInstance,
  dependencies:
    ContactEnquiryRouteDependencies,
): void {
  app.post(
    "/api/contact-enquiries",
    {
      bodyLimit:
        CONTACT_BODY_LIMIT_BYTES,

      config: {
        rateLimit:
          CONTACT_RATE_LIMIT,
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
            "Contact enquiries must use application/json.",

          statusCode: 415,
        });
      }

      const envelopeResult =
        contactEnquiryEnvelopeSchema
          .safeParse(request.body);

      if (
        !envelopeResult.success
      ) {
        throw new HttpError({
          code: "VALIDATION_ERROR",

          message:
            "The contact enquiry contains invalid or unexpected information.",

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
        submitContactEnquirySchema
          .safeParse({
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
            "The contact enquiry contains invalid or unexpected information.",

          statusCode: 400,

          details:
            validationDetails(
              submissionResult
                .error.issues,

              "payload",
            ),
        });
      }

      const persisted =
        await dependencies
          .persistenceService
          .persist(
            submissionResult.data,
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
            .notifyContactEnquiry(
              persisted,
            );
      } catch {
        request.log.error(
          {
            requestId: request.id,

            submissionId:
              submissionResult
                .data.submissionId,

            enquiryNumber:
              persisted.outcome ===
              "suppressed"
                ? persisted
                    .enquiryNumber
                : persisted
                    .enquiry
                    .enquiryNumber,
          },

          "Contact notification dispatch failed after persistence",
        );
      }

      request.log.info(
        {
          requestId: request.id,
          submissionId:
            submissionResult
              .data.submissionId,
          enquiryType:
            submissionResult
              .data.enquiryType,
          preferredContactMethod:
            submissionResult
              .data
              .preferredContactMethod,
          attachmentCount:
            submissionResult
              .data.attachmentCount,
          persistenceOutcome:
            persisted.outcome,

          notificationsAttempted:
            notificationReport
              .attempted,

          notificationsSent:
            notificationReport.sent,

          notificationsFailed:
            notificationReport.failed,
        },
        "Contact enquiry processed with duplicate, abuse and notification protection",
      );

      const statusCode =
        persisted.outcome ===
        "replayed"
          ? 200
          : 201;

      return reply
        .header(
          "Cache-Control",
          "no-store",
        )
        .status(statusCode)
        .send(
          createPublicContactEnquiryResponse(
            persisted,
            request.id,
          ),
        );
    },
  );
}
