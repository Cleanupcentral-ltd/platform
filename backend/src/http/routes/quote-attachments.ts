import { z } from "zod";

import type {
  FastifyInstance,
  FastifyReply,
} from "fastify";

import type {
  QuoteAttachmentLinkingService,
} from "../../application/link-quote-attachment.js";

import {
  QUOTE_ATTACHMENT_MIME_TYPES,
  QUOTE_ATTACHMENT_POLICY,
  QuoteAttachmentValidationError,
} from "../../application/validation/quote-attachment.js";

import {
  HttpError,
} from "../http-errors.js";

import {
  createPublicQuoteAttachmentResponse,
} from "../responses/quote-attachment-response.js";

const ATTACHMENT_RATE_LIMIT = {
  max: 15,
  timeWindow: "1 minute",
  groupId: "quote-attachment-upload",
} as const;

const attachmentParamsSchema =
  z.strictObject({
    submissionId:
      z.string().trim().uuid(),

    attachmentId:
      z.string().trim().uuid(),
  });

interface QuoteAttachmentParams {
  readonly submissionId: string;
  readonly attachmentId: string;
}

export interface QuoteAttachmentRouteDependencies {
  readonly getLinkingService:
    () => QuoteAttachmentLinkingService;
}

function readFilenameHeader(
  headerValue:
    string | readonly string[] | undefined,
): string {
  const raw =
    Array.isArray(headerValue)
      ? headerValue[0]
      : headerValue;

  if (
    typeof raw !== "string" ||
    raw.length === 0 ||
    raw.length > 1_024
  ) {
    throw new HttpError({
      code: "VALIDATION_ERROR",
      message:
        "The X-File-Name header is required.",
      statusCode: 400,
    });
  }

  try {
    const decoded =
      decodeURIComponent(raw);

    if (!decoded) {
      throw new Error(
        "Decoded filename is empty.",
      );
    }

    return decoded;
  } catch {
    throw new HttpError({
      code: "VALIDATION_ERROR",
      message:
        "The X-File-Name header is invalid.",
      statusCode: 400,
    });
  }
}

function readMediaType(
  contentType:
    string | readonly string[] | undefined,
): string {
  const raw =
    Array.isArray(contentType)
      ? contentType[0]
      : contentType;

  if (typeof raw !== "string") {
    return "";
  }

  return (
    raw
      .split(";", 1)[0]
      ?.trim()
      .toLowerCase() ?? ""
  );
}

function validationDetails(
  error:
    QuoteAttachmentValidationError,
): Readonly<
  Record<string, unknown>
> {
  return {
    issues: error.issues.map(
      (issue) => ({
        code: issue.code,
        message: issue.message,

        ...(issue.fileIndex ===
        undefined
          ? {}
          : {
              fileIndex:
                issue.fileIndex,
            }),

        ...(issue.field ===
        undefined
          ? {}
          : {
              field:
                issue.field,
            }),
      }),
    ),
  };
}

export function registerQuoteAttachmentContentParsers(
  app: FastifyInstance,
): void {
  app.addContentTypeParser(
    [
      ...QUOTE_ATTACHMENT_MIME_TYPES,
    ],
    {
      parseAs: "buffer",
      bodyLimit:
        QUOTE_ATTACHMENT_POLICY
          .maxFileBytes,
    },
    (
      _request,
      body,
      done,
    ) => {
      done(null, body);
    },
  );
}

export function registerQuoteAttachmentRoutes(
  app: FastifyInstance,
  dependencies:
    QuoteAttachmentRouteDependencies,
): void {
  app.put<{
    Params:
      QuoteAttachmentParams;
  }>(
    "/api/quotes/:submissionId/attachments/:attachmentId",
    {
      bodyLimit:
        QUOTE_ATTACHMENT_POLICY
          .maxFileBytes,

      config: {
        rateLimit:
          ATTACHMENT_RATE_LIMIT,
      },
    },

    async (
      request,
      reply,
    ): Promise<FastifyReply> => {
      const paramsResult =
        attachmentParamsSchema
          .safeParse(
            request.params,
          );

      if (!paramsResult.success) {
        throw new HttpError({
          code: "VALIDATION_ERROR",
          message:
            "The quote or attachment reference is invalid.",
          statusCode: 400,
        });
      }

      const mediaType =
        readMediaType(
          request.headers[
            "content-type"
          ],
        );

      if (
        !QUOTE_ATTACHMENT_MIME_TYPES
          .includes(
            mediaType as
              (typeof QUOTE_ATTACHMENT_MIME_TYPES)[number],
          )
      ) {
        throw new HttpError({
          code:
            "UNSUPPORTED_MEDIA_TYPE",
          message:
            "This attachment type is not supported.",
          statusCode: 415,
        });
      }

      const filename =
        readFilenameHeader(
          request.headers[
            "x-file-name"
          ],
        );

      if (
        !Buffer.isBuffer(
          request.body,
        )
      ) {
        throw new HttpError({
          code: "VALIDATION_ERROR",
          message:
            "The attachment body is invalid.",
          statusCode: 400,
        });
      }

      let linked;

      try {
        linked =
          await dependencies
            .getLinkingService()
            .link({
              submissionId:
                paramsResult
                  .data.submissionId,

              attachmentId:
                paramsResult
                  .data.attachmentId,

              originalFilename:
                filename,

              declaredMimeType:
                mediaType,

              content:
                request.body,
            });
      } catch (error) {
        if (
          error instanceof
            QuoteAttachmentValidationError
        ) {
          throw new HttpError({
            code: "VALIDATION_ERROR",
            message:
              "The attachment could not be accepted.",
            statusCode: 400,
            details:
              validationDetails(
                error,
              ),
          });
        }

        throw error;
      }

      request.log.info(
        {
          requestId:
            request.id,

          submissionId:
            paramsResult
              .data.submissionId,

          attachmentId:
            paramsResult
              .data.attachmentId,

          outcome:
            linked.outcome,

          sizeBytes:
            linked.attachment
              .sizeBytes,

          mediaType:
            linked.attachment
              .mediaType,
        },

        "Quote attachment processed",
      );

      return reply
        .header(
          "Cache-Control",
          "no-store",
        )
        .status(
          linked.outcome ===
            "created"
            ? 201
            : 200,
        )
        .send(
          createPublicQuoteAttachmentResponse(
            linked,
            request.id,
          ),
        );
    },
  );
}
