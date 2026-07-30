import { z } from "zod";

import {
  PREFERRED_CONTACT_METHODS,
} from "../../domain/quote-values.js";

export const CONTACT_ENQUIRY_POLICY =
  Object.freeze({
    maxAttachments: 1,
    maxMessageLength: 5_000,
  });

const unsafeSingleLineCharacters =
  /[\u0000-\u001F\u007F]/u;

const unsafeMultilineCharacters =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;

const singleLineText = (
  minimumLength: number,
  maximumLength: number,
) =>
  z
    .string()
    .trim()
    .min(minimumLength)
    .max(maximumLength)
    .refine(
      (value) =>
        !unsafeSingleLineCharacters.test(
          value,
        ),
      "Remove unsupported control characters.",
    );

const phoneSchema = z
  .string()
  .trim()
  .max(30)
  .regex(
    /^[+()\d\s.-]*$/,
    "Enter a valid phone number.",
  )
  .refine(
    (value) => {
      if (value.length === 0) {
        return true;
      }

      const digitCount =
        value.replace(/\D/g, "").length;

      return (
        digitCount >= 7 &&
        digitCount <= 15
      );
    },
    "Enter a valid phone number.",
  )
  .default("");

export const submitContactEnquirySchema =
  z
    .strictObject({
      submissionId: z
        .string()
        .uuid(
          "Submission ID must be a valid UUID.",
        ),

      schemaVersion: z.literal("1.0"),

      fullName: singleLineText(
        2,
        120,
      ),

      email: z
        .string()
        .trim()
        .max(254)
        .email(
          "Enter a valid email address.",
        )
        .transform((value) =>
          value.toLowerCase(),
        ),

      phone: phoneSchema,

      enquiryType: singleLineText(
        2,
        80,
      ),

      preferredContactMethod: z.enum(
        PREFERRED_CONTACT_METHODS,
      ),

      message: z
        .string()
        .trim()
        .min(
          10,
          "Please provide a little more detail.",
        )
        .max(
          CONTACT_ENQUIRY_POLICY
            .maxMessageLength,
        )
        .refine(
          (value) =>
            !unsafeMultilineCharacters.test(
              value,
            ),
          "Remove unsupported control characters.",
        ),

      privacyConsent: z.literal(true, {
        error:
          "Privacy consent is required.",
      }),

      website: z
        .string()
        .trim()
        .max(200)
        .default(""),

      attachmentCount: z
        .number()
        .int()
        .min(0)
        .max(
          CONTACT_ENQUIRY_POLICY
            .maxAttachments,
        )
        .default(0),
    })
    .superRefine(
      (submission, context) => {
        if (
          submission
            .preferredContactMethod ===
            "Email"
        ) {
          return;
        }

        if (
          submission.phone.length === 0
        ) {
          context.addIssue({
            code: "custom",
            path: ["phone"],
            message:
              "Enter a phone number for Phone or WhatsApp contact.",
          });
        }
      },
    );

export type SubmitContactEnquiryRequest =
  z.infer<
    typeof submitContactEnquirySchema
  >;
