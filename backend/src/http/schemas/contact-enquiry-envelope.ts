import { z } from "zod";

export const contactEnquiryEnvelopeSchema =
  z
    .object({
      submissionId: z
        .string()
        .trim()
        .uuid(
          "Submission ID must be a valid UUID.",
        ),

      payload: z.record(
        z.string(),
        z.unknown(),
      ),
    })
    .strict();

export type ContactEnquiryEnvelope =
  z.infer<
    typeof contactEnquiryEnvelopeSchema
  >;
