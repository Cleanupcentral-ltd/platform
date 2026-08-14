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

    LEAD_AUTO_COMPANY_ENRICHMENT_V1:
      z.enum(["true", "false"])
        .default("false")
        .transform(
          (value) => value === "true",
        ),

    LEAD_AUTOMATIC_QUALIFICATION_V1:
      z.enum(["true", "false"])
        .default("false")
        .transform(
          (value) => value === "true",
        ),

    LEAD_AUTOMATIC_QUALIFICATION_ROLLOUT:
      z.enum(["canary", "all"])
        .default("canary"),

    LEAD_CHARITY_COMMISSION_V1:
      z.enum(["true", "false"])
        .default("false")
        .transform(
          (value) => value === "true",
        ),

    CHARITY_COMMISSION_API_KEY:
      z.string()
        .trim()
        .min(1)
        .optional(),

    CHARITY_COMMISSION_API_BASE_URL:
      z.string()
        .trim()
        .url()
        .refine(
          (value) => {
            const parsed =
              new URL(value);
            const host =
              parsed.hostname;
            return (
              parsed.protocol ===
                "https:" &&
              (
                host ===
                  "charitycommission.gov.uk" ||
                host.endsWith(
                  ".charitycommission.gov.uk",
                )
              )
            );
          },
          "CHARITY_COMMISSION_API_BASE_URL must use an official charitycommission.gov.uk HTTPS host.",
        )
        .optional(),

    CHARITY_COMMISSION_TIMEOUT_MS:
      z.coerce
        .number()
        .int()
        .min(1_000)
        .max(15_000)
        .default(8_000),

    LEAD_COMPANY_ENRICHMENT_INTERVAL_MS:
      z.coerce.number().int()
        .min(15_000)
        .max(900_000)
        .default(60_000),

    LEAD_COMPANY_ENRICHMENT_BATCH_SIZE:
      z.coerce.number().int()
        .min(1)
        .max(20)
        .default(5),

    LEAD_COMPANY_ENRICHMENT_LEASE_SECONDS:
      z.coerce.number().int()
        .min(30)
        .max(900)
        .default(180),

    LEAD_WEBSITE_LOOKUP_TIMEOUT_MS:
      z.coerce.number().int()
        .min(1_000)
        .max(15_000)
        .default(5_000),

    LEAD_WEBSITE_LOOKUP_MAX_BYTES:
      z.coerce.number().int()
        .min(32_768)
        .max(1_048_576)
        .default(524_288),

    LEAD_WEBSITE_RESEARCH_MAX_PAGES:
      z.coerce.number().int()
        .min(1)
        .max(8)
        .default(6),

    LEAD_WEBSITE_REQUEST_RETRIES:
      z.coerce.number().int()
        .min(0)
        .max(2)
        .default(1),

    COMPANIES_HOUSE_API_KEY:
      z.string()
        .trim()
        .min(1)
        .optional(),

    COMPANIES_HOUSE_API_BASE_URL:
      z.string()
        .trim()
        .url()
        .default(
          "https://api.company-information.service.gov.uk",
        ),

    COMPANIES_HOUSE_TIMEOUT_MS:
      z.coerce
        .number()
        .int()
        .min(1_000)
        .max(15_000)
        .default(8_000),

    LEAD_OUTLOOK_DRAFT_V1:
      z.enum(["true", "false"])
        .default("false")
        .transform(
          (value) =>
            value === "true",
        ),

    MICROSOFT_CLIENT_ID:
      z.string()
        .trim()
        .uuid()
        .optional(),

    MICROSOFT_CLIENT_SECRET:
      z.string()
        .trim()
        .min(1)
        .optional(),

    MICROSOFT_TENANT_ID:
      z.string()
        .trim()
        .min(1)
        .default("consumers"),

    MICROSOFT_REDIRECT_URI:
      z.string()
        .trim()
        .url()
        .optional(),

    MICROSOFT_GRAPH_API_BASE_URL:
      z.string()
        .trim()
        .url()
        .default(
          "https://graph.microsoft.com/v1.0",
        ),

    MICROSOFT_LOGIN_BASE_URL:
      z.string()
        .trim()
        .url()
        .default(
          "https://login.microsoftonline.com",
        ),

    OUTLOOK_TOKEN_ENCRYPTION_KEY:
      z.string()
        .trim()
        .min(43)
        .optional(),

    OUTLOOK_GRAPH_TIMEOUT_MS:
      z.coerce.number().int()
        .min(1_000)
        .max(30_000)
        .default(10_000),

    OUTREACH_PRIVACY_URL:
      z.string()
        .trim()
        .url()
        .refine(
          (value) =>
            value.startsWith("https://"),
          "OUTREACH_PRIVACY_URL must use HTTPS.",
        )
        .optional(),

    OUTREACH_OPTOUT_TEXT:
      z.string()
        .trim()
        .min(1)
        .max(500)
        .optional(),

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

      if (
        value.LEAD_AUTO_COMPANY_ENRICHMENT_V1 &&
        !value.LEAD_COMPANIES_HOUSE_V1
      ) {
        context.addIssue({
          code: "custom",
          path: ["LEAD_AUTO_COMPANY_ENRICHMENT_V1"],
          message:
            "Automatic company enrichment requires Companies House verification to be enabled.",
        });
      }

      if (
        value.LEAD_CHARITY_COMMISSION_V1
      ) {
        if (
          !value
            .LEAD_AUTOMATIC_QUALIFICATION_V1
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "LEAD_CHARITY_COMMISSION_V1",
            ],
            message:
              "Charity Commission verification requires automatic qualification to be enabled.",
          });
        }

        for (
          const [field, fieldValue] of
            [
              [
                "CHARITY_COMMISSION_API_KEY",
                value
                  .CHARITY_COMMISSION_API_KEY,
              ],
              [
                "CHARITY_COMMISSION_API_BASE_URL",
                value
                  .CHARITY_COMMISSION_API_BASE_URL,
              ],
            ] as const
        ) {
          if (
            fieldValue === undefined ||
            fieldValue.length === 0
          ) {
            context.addIssue({
              code: "custom",
              path: [field],
              message:
                `${field} is required when Charity Commission verification is enabled.`,
            });
          }
        }
      }

      if (
        value.LEAD_OUTLOOK_DRAFT_V1 &&
        !value.LEAD_AUTOMATIC_QUALIFICATION_V1
      ) {
        context.addIssue({
          code: "custom",
          path: ["LEAD_OUTLOOK_DRAFT_V1"],
          message:
            "Outlook drafting requires automatic qualification to be enabled.",
        });
      }

      if (value.LEAD_OUTLOOK_DRAFT_V1) {
        const outlookRequired = [
          [
            "MICROSOFT_CLIENT_ID",
            value.MICROSOFT_CLIENT_ID,
          ],
          [
            "MICROSOFT_CLIENT_SECRET",
            value.MICROSOFT_CLIENT_SECRET,
          ],
          [
            "MICROSOFT_REDIRECT_URI",
            value.MICROSOFT_REDIRECT_URI,
          ],
          [
            "OUTLOOK_TOKEN_ENCRYPTION_KEY",
            value.OUTLOOK_TOKEN_ENCRYPTION_KEY,
          ],
          [
            "OUTREACH_PRIVACY_URL",
            value.OUTREACH_PRIVACY_URL,
          ],
          [
            "OUTREACH_OPTOUT_TEXT",
            value.OUTREACH_OPTOUT_TEXT,
          ],
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
            outlookRequired
        ) {
          if (
            fieldValue === undefined ||
            fieldValue.length === 0
          ) {
            context.addIssue({
              code: "custom",
              path: [field],
              message:
                `${field} is required when Outlook drafting is enabled.`,
            });
          }
        }
      }

      if (
        value.LEAD_AUTOMATIC_QUALIFICATION_V1 &&
        !value.LEAD_AUTO_COMPANY_ENRICHMENT_V1
      ) {
        context.addIssue({
          code: "custom",
          path: ["LEAD_AUTOMATIC_QUALIFICATION_V1"],
          message:
            "Automatic qualification requires automatic company enrichment to be enabled.",
        });
      }

      if (
        value.LEAD_AUTO_COMPANY_ENRICHMENT_V1 &&
        value.COMPANIES_HOUSE_API_KEY === undefined
      ) {
        context.addIssue({
          code: "custom",
          path: ["COMPANIES_HOUSE_API_KEY"],
          message:
            "COMPANIES_HOUSE_API_KEY is required when automatic company enrichment is enabled.",
        });
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
