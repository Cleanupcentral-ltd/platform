import { z } from "zod";

/**
 * Stable public API wrapper.
 *
 * The complete quote-state object sits inside `payload`.
 * Its detailed journey validation remains the responsibility
 * of the existing application validator in Build 4B.
 */
export const quoteSubmissionEnvelopeSchema =
  z
    .object({
      submissionId: z
        .string()
        .trim()
        .min(
          8,
          "Submission ID is too short.",
        )
        .max(
          128,
          "Submission ID is too long.",
        )
        .regex(
          /^[A-Za-z0-9_-]+$/,
          "Submission ID contains unsupported characters.",
        ),

      payload: z.record(
        z.string(),
        z.unknown(),
      ),
    })
    .strict();

export type QuoteSubmissionEnvelope =
  z.infer<
    typeof quoteSubmissionEnvelopeSchema
  >;