export const APPLICATION_ERROR_CODES = [
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "CONFLICT",
  "DUPLICATE_SUBMISSION",
  "STORAGE_ERROR",
  "UNEXPECTED_ERROR",
] as const;

export type ApplicationErrorCode =
  (typeof APPLICATION_ERROR_CODES)[number];

export interface ApplicationErrorOptions {
  readonly code: ApplicationErrorCode;
  readonly message: string;
  readonly statusCode: number;
  readonly details?: Readonly<
    Record<string, unknown>
  >;
  readonly cause?: unknown;
}

export class ApplicationError extends Error {
  readonly code: ApplicationErrorCode;
  readonly statusCode: number;
  readonly details: Readonly<
    Record<string, unknown>
  > | null;

  constructor(options: ApplicationErrorOptions) {
    super(
      options.message,
      options.cause === undefined
        ? undefined
        : { cause: options.cause },
    );

    this.name = "ApplicationError";
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.details = options.details ?? null;
  }
}

export function isApplicationError(
  error: unknown,
): error is ApplicationError {
  return error instanceof ApplicationError;
}