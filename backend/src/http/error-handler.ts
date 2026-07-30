import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import {
  ApplicationError,
} from "../domain/errors.js";

import {
  HttpError,
} from "./http-errors.js";

interface PublicErrorResponse {
  readonly success: false;

  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Readonly<
      Record<string, unknown>
    >;
  };

  readonly requestId: string;
}

function publicCodeForStatus(
  statusCode: number,
): string {
  switch (statusCode) {
    case 400:
      return "INVALID_REQUEST";

    case 404:
      return "NOT_FOUND";

    case 413:
      return "PAYLOAD_TOO_LARGE";

    case 415:
      return "UNSUPPORTED_MEDIA_TYPE";

    case 429:
      return "RATE_LIMITED";

    default:
      return statusCode >= 500
        ? "INTERNAL_ERROR"
        : "REQUEST_REJECTED";
  }
}

function publicMessageForStatus(
  statusCode: number,
): string {
  switch (statusCode) {
    case 400:
      return "The request could not be understood.";

    case 404:
      return "The requested endpoint was not found.";

    case 413:
      return "The submitted request is too large.";

    case 415:
      return "The request uses an unsupported media type.";

    case 429:
      return "Too many requests were received. Please wait before trying again.";

    default:
      return statusCode >= 500
        ? "Something went wrong while processing the request."
        : "The request could not be completed.";
  }
}

function sendError(
  reply: FastifyReply,
  requestId: string,
  statusCode: number,
  code: string,
  message: string,
  details?: Readonly<
    Record<string, unknown>
  >,
): FastifyReply {
  const response: PublicErrorResponse = {
    success: false,

    error: {
      code,
      message,

      ...(details === undefined
        ? {}
        : { details }),
    },

    requestId,
  };

  return reply
    .header(
      "Cache-Control",
      "no-store",
    )
    .status(statusCode)
    .type("application/json")
    .send(response);
}

function publicApplicationMessage(
  error: ApplicationError,
): string {
  switch (error.code) {
    case "VALIDATION_ERROR":
      return "The submitted information could not be accepted.";

    case "NOT_FOUND":
      return "The requested record could not be found.";

    case "CONFLICT":
      return "This request conflicts with an operation already in progress. Please retry shortly.";

    case "DUPLICATE_SUBMISSION":
      return "This submission reference has already been used for different information.";

    case "STORAGE_ERROR":
    case "UNEXPECTED_ERROR":
      return "Something went wrong while processing the request.";
  }
}

function handleApplicationError(
  error: ApplicationError,
  request: FastifyRequest,
  reply: FastifyReply,
): FastifyReply {
  if (error.statusCode >= 500) {
    request.log.error(
      {
        err: error,
        requestId: request.id,
      },
      "Backend application error",
    );

    return sendError(
      reply,
      request.id,
      500,
      "INTERNAL_ERROR",
      "Something went wrong while processing the request.",
    );
  }

  request.log.info(
    {
      errorCode: error.code,
      requestId: request.id,
      statusCode: error.statusCode,
    },
    "Application request rejected",
  );

  return sendError(
    reply,
    request.id,
    error.statusCode,
    error.code,
    publicApplicationMessage(
      error,
    ),
  );
}

function handleFastifyError(
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
): FastifyReply {
  const errorDetails =
    typeof error === "object" &&
    error !== null
      ? error as {
          readonly statusCode?: unknown;
          readonly code?: unknown;
        }
      : {};

  const receivedStatus =
    typeof errorDetails.statusCode ===
    "number"
      ? errorDetails.statusCode
      : 500;

  const statusCode =
    receivedStatus >= 400 &&
    receivedStatus <= 599
      ? receivedStatus
      : 500;

  const errorCode =
    typeof errorDetails.code === "string"
      ? errorDetails.code
      : "UNKNOWN_ERROR";

  if (statusCode >= 500) {
    request.log.error(
      {
        err: error,
        requestId: request.id,
      },
      "Unhandled HTTP error",
    );
  } else {
    request.log.info(
      {
        errorCode,
        requestId: request.id,
        statusCode,
      },
      "HTTP request rejected",
    );
  }

  return sendError(
    reply,
    request.id,
    statusCode,
    publicCodeForStatus(statusCode),
    publicMessageForStatus(statusCode),
  );
}

export function registerHttpErrorHandlers(
  app: FastifyInstance,
): void {
  app.setErrorHandler(
    (
      error,
      request,
      reply,
    ): FastifyReply => {
      if (error instanceof HttpError) {
        if (error.statusCode >= 500) {
          request.log.error(
            {
              err: error,
              requestId: request.id,
            },
            "HTTP application error",
          );
        } else {
          request.log.info(
            {
              errorCode: error.code,
              requestId: request.id,
              statusCode:
                error.statusCode,
            },
            "HTTP request rejected",
          );
        }

        return sendError(
          reply,
          request.id,
          error.statusCode,
          error.code,
          error.message,
          error.details,
        );
      }

      if (
        error instanceof
          ApplicationError
      ) {
        return handleApplicationError(
          error,
          request,
          reply,
        );
      }

      return handleFastifyError(
        error,
        request,
        reply,
      );
    },
  );

  app.setNotFoundHandler(
    (
      request,
      reply,
    ): FastifyReply =>
      sendError(
        reply,
        request.id,
        404,
        "NOT_FOUND",
        "The requested endpoint was not found.",
      ),
  );
}