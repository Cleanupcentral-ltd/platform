import { ApplicationError } from "../../domain/errors.js";

export function isWixNotFoundError(
  error: unknown,
): boolean {
  if (!(error instanceof ApplicationError)) {
    return false;
  }

  return (
    error.code === "STORAGE_ERROR" &&
    error.details?.upstreamStatus === 404
  );
}