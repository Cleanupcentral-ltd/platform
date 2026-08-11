import { z } from "zod";

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum([
        "development",
        "test",
        "production",
      ])
      .default("development"),

    HOST: z
      .string()
      .min(1)
      .default("127.0.0.1"),

    PORT: z.coerce
      .number()
      .int()
      .min(1)
      .max(65_535)
      .default(3001),

    CORS_ORIGINS:
      z.string().min(1),

    NOTIFICATIONS_ENABLED:
      z.enum(["true", "false"])
        .default("false")
        .transform(
          (value) =>
            value === "true",
        ),

    NOTIFICATION_BUSINESS_NAME:
      z.string()
        .trim()
        .min(1)
        .default(
          "Clean Up Central",
        ),

    NOTIFICATION_FROM_NAME:
      z.string()
        .trim()
        .optional(),

    NOTIFICATION_FROM_EMAIL:
      z.string()
        .trim()
        .email()
        .optional(),

    CUSTOMER_REPLY_TO_EMAIL:
      z.string()
        .trim()
        .email()
        .optional(),

    INTERNAL_NOTIFICATION_EMAILS:
      z.string()
        .trim()
        .default(""),

    RESEND_API_KEY:
      z.string()
        .trim()
        .optional(),

    RESEND_API_BASE_URL:
      z.string()
        .trim()
        .url()
        .default(
          "https://api.resend.com",
        ),

    NOTIFICATION_TIMEOUT_MS:
      z.coerce
        .number()
        .int()
        .min(1_000)
        .max(60_000)
        .default(10_000),

    TRAVEL_AUTO_ENABLED:
      z.enum(["true", "false"])
        .default("false")
        .transform(
          (value) =>
            value === "true",
        ),

    GOOGLE_ROUTES_API_KEY:
      z.string()
        .trim()
        .min(1)
        .optional(),

    GOOGLE_ROUTES_API_BASE_URL:
      z.string()
        .trim()
        .url()
        .default(
          "https://routes.googleapis.com",
        ),

    GOOGLE_ROUTES_TIMEOUT_MS:
      z.coerce
        .number()
        .int()
        .min(1_000)
        .max(15_000)
        .default(5_000),

    LEAD_ENGINE_UI_V1:
      z.enum(["true", "false"])
        .default("false")
        .transform(
          (value) =>
            value === "true",
        ),

    LEAD_SEARCH_GOOGLE_V1:
      z.enum(["true", "false"])
        .default("false")
        .transform(
          (value) =>
            value === "true",
        ),

    GOOGLE_PLACES_API_KEY:
      z.string()
        .trim()
        .min(1)
        .optional(),

    GOOGLE_PLACES_API_BASE_URL:
      z.string()
        .trim()
        .url()
        .default(
          "https://places.googleapis.com/v1",
        ),

    GOOGLE_PLACES_TIMEOUT_MS:
      z.coerce
        .number()
        .int()
        .min(1_000)
        .max(15_000)
        .default(8_000),

    POSTCODES_IO_API_BASE_URL:
      z.string()
        .trim()
        .url()
        .default(
          "https://api.postcodes.io",
        ),

    POSTCODES_IO_TIMEOUT_MS:
      z.coerce
        .number()
        .int()
        .min(1_000)
        .max(15_000)
        .default(5_000),

    LEAD_COMPANIES_HOUSE_V1:
      z.enum(["true", "false"])
        .default("false")
        .transform(
          (value) =>
            value === "true",
        ),

    LEAD_OUTLOOK_DRAFT_V1:
      z.enum(["true", "false"])
        .default("false")
        .transform(
          (value) =>
            value === "true",
        ),

    LEAD_EXPORT_V1:
      z.enum(["true", "false"])
        .default("false")
        .transform(
          (value) =>
            value === "true",
        ),

    SUPABASE_URL:
      z.string()
        .trim()
        .url()
        .optional(),

    SUPABASE_PUBLISHABLE_KEY:
      z.string()
        .trim()
        .min(1)
        .optional(),

    SUPABASE_SECRET_KEY:
      z.string()
        .trim()
        .min(1)
        .optional(),

    SUPABASE_DATA_TIMEOUT_MS:
      z.coerce
        .number()
        .int()
        .min(1_000)
        .max(15_000)
        .default(8_000),

    SUPABASE_AUTH_TIMEOUT_MS:
      z.coerce
        .number()
        .int()
        .min(1_000)
        .max(15_000)
        .default(5_000),

    LEAD_ENGINE_CONSOLE_ORIGIN:
      z.string()
        .trim()
        .url()
        .optional(),
  })
  .superRefine(
    (value, context) => {
      const notificationRequired = [
        [
          "RESEND_API_KEY",
          value.RESEND_API_KEY,
        ],
        [
          "NOTIFICATION_FROM_EMAIL",
          value.NOTIFICATION_FROM_EMAIL,
        ],
        [
          "CUSTOMER_REPLY_TO_EMAIL",
          value.CUSTOMER_REPLY_TO_EMAIL,
        ],
        [
          "INTERNAL_NOTIFICATION_EMAILS",
          value.INTERNAL_NOTIFICATION_EMAILS,
        ],
      ] as const;

      if (value.NOTIFICATIONS_ENABLED) {
        for (
          const [field, fieldValue] of
            notificationRequired
        ) {
          if (
            fieldValue === undefined ||
            fieldValue.length === 0
          ) {
            context.addIssue({
              code:
                "custom",

              path: [field],

              message:
                `${field} is required when notifications are enabled.`,
            });
          }
        }
      }

      if (value.LEAD_ENGINE_UI_V1) {
        const leadEngineRequired = [
          [
            "SUPABASE_URL",
            value.SUPABASE_URL,
          ],
          [
            "SUPABASE_PUBLISHABLE_KEY",
            value.SUPABASE_PUBLISHABLE_KEY,
          ],
          [
            "LEAD_ENGINE_CONSOLE_ORIGIN",
            value.LEAD_ENGINE_CONSOLE_ORIGIN,
          ],
        ] as const;

        for (
          const [field, fieldValue] of
            leadEngineRequired
        ) {
          if (
            fieldValue === undefined ||
            fieldValue.length === 0
          ) {
            context.addIssue({
              code: "custom",
              path: [field],
              message:
                `${field} is required when the Lead Engine founder UI is enabled.`,
            });
          }
        }
      }

      if (value.LEAD_SEARCH_GOOGLE_V1) {
        const leadSearchRequired = [
          [
            "SUPABASE_URL",
            value.SUPABASE_URL,
          ],
          [
            "SUPABASE_SECRET_KEY",
            value.SUPABASE_SECRET_KEY,
          ],
          [
            "GOOGLE_PLACES_API_KEY",
            value.GOOGLE_PLACES_API_KEY,
          ],
        ] as const;

        for (
          const [field, fieldValue] of
            leadSearchRequired
        ) {
          if (
            fieldValue === undefined ||
            fieldValue.length === 0
          ) {
            context.addIssue({
              code: "custom",
              path: [field],
              message:
                `${field} is required when Google lead search is enabled.`,
            });
          }
        }
      }

      if (value.LEAD_COMPANIES_HOUSE_V1) {
        const leadReviewRequired = [
          [
            "SUPABASE_URL",
            value.SUPABASE_URL,
          ],
          [
            "SUPABASE_SECRET_KEY",
            value.SUPABASE_SECRET_KEY,
          ],
        ] as const;

        for (
          const [field, fieldValue] of
            leadReviewRequired
        ) {
          if (
            fieldValue === undefined ||
            fieldValue.length === 0
          ) {
            context.addIssue({
              code: "custom",
              path: [field],
              message:
                `${field} is required when lead review and scoring are enabled.`,
            });
          }
        }
      }
    },
  );

const parsedEnvironment =
  environmentSchema.safeParse(
    process.env,
  );

if (!parsedEnvironment.success) {
  console.error(
    "Invalid backend environment configuration:",
    parsedEnvironment
      .error.flatten().fieldErrors,
  );

  throw new Error(
    "The backend environment configuration is invalid.",
  );
}

export const env =
  parsedEnvironment.data;
