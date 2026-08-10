import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";

import Fastify, {
  type FastifyInstance,
} from "fastify";

import {
  ResendNotificationDelivery,
} from "./adapters/resend/resend-notification-delivery.js";

import {
  GoogleRoutesMatrixProvider,
} from "./adapters/google/google-routes-matrix.js";

import {
  GooglePlacesLeadSearchProvider,
} from "./adapters/google/google-places-lead-search.js";

import {
  PostcodesIoLocator,
} from "./adapters/postcodes-io/postcodes-io-locator.js";

import {
  SupabaseFounderAuthService,
} from "./adapters/supabase/supabase-founder-auth.js";

import {
  SupabaseLeadSearchRepository,
} from "./adapters/supabase/supabase-lead-search-repository.js";

import {
  createWixContactEnquiryRepository,
} from "./adapters/wix/create-wix-contact-enquiry-repository.js";

import {
  createWixQuoteRepositories,
} from "./adapters/wix/create-wix-repositories.js";

import {
  createWixMediaStorage,
} from "./adapters/wix/create-wix-media-storage.js";

import {
  WixNotificationDeliveryRecorder,
} from "./adapters/wix/wix-notification-delivery-recorder.js";

import {
  createSubmissionNotificationService,
  NOOP_SUBMISSION_NOTIFICATION_SERVICE,
  type SubmissionNotificationService,
} from "./application/deliver-notifications.js";

import {
  createQuoteAttachmentLinkingService,
  type QuoteAttachmentLinkingService,
} from "./application/link-quote-attachment.js";

import {
  createTravelCalculationService,
  type TravelCalculationService,
} from "./application/calculate-travel.js";

import {
  createLeadSearchService,
  type LeadSearchService,
} from "./application/search-leads.js";

import {
  createContactEnquiryPersistenceService,
  type ContactEnquiryPersistenceService,
} from "./application/persist-contact-enquiry.js";

import {
  createQuotePersistenceService,
  type QuotePersistenceService,
} from "./application/persist-quote.js";

import {
  createQuotePricingService,
  type QuotePricingService,
} from "./application/price-quote.js";

import {
  createQuoteContextResolver,
  type QuoteResolutionService,
} from "./application/resolve-quote-context.js";

import {
  createQuoteAttachmentUploadService,
} from "./application/upload-quote-attachment.js";

import { env } from "./config/env.js";

import {
  registerHttpErrorHandlers,
} from "./http/error-handler.js";

import {
  registerContactEnquiryRoutes,
} from "./http/routes/contact-enquiries.js";

import {
  healthRoutes,
} from "./http/routes/health.js";

import {
  registerLeadEngineRoutes,
} from "./http/routes/lead-engine.js";

import {
  registerQuoteAttachmentContentParsers,
  registerQuoteAttachmentRoutes,
} from "./http/routes/quote-attachments.js";

import {
  registerQuoteRoutes,
} from "./http/routes/quotes.js";

import {
  registerTravelRoutes,
} from "./http/routes/travel.js";

import type {
  NotificationRecipient,
} from "./ports/notifications.js";

import type {
  FounderAuthService,
} from "./ports/founder-auth.js";

import type {
  QuoteRepositories,
} from "./ports/repositories.js";

export interface BuildAppOptions {
  readonly quoteResolutionService?:
    QuoteResolutionService;

  readonly quotePricingService?:
    QuotePricingService;

  readonly quotePersistenceService?:
    QuotePersistenceService;

  readonly quoteAttachmentLinkingService?:
    QuoteAttachmentLinkingService;

  readonly contactEnquiryPersistenceService?:
    ContactEnquiryPersistenceService;

  readonly submissionNotificationService?:
    SubmissionNotificationService;

  readonly travelCalculationService?:
    TravelCalculationService;

  readonly leadEngineUiEnabled?:
    boolean;

  readonly leadSearchEnabled?:
    boolean;

  readonly leadSearchService?:
    LeadSearchService;

  readonly founderAuthService?:
    FounderAuthService;
}

export function buildAllowedOrigins(
  corsOrigins: string,
  leadEngineUiEnabled: boolean,
  leadEngineConsoleOrigin?: string,
): string[] {
  const origins = corsOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (
    leadEngineUiEnabled &&
    leadEngineConsoleOrigin !== undefined &&
    !origins.includes(leadEngineConsoleOrigin)
  ) {
    origins.push(leadEngineConsoleOrigin);
  }

  return origins;
}

function requiredEnvironmentValue(
  value: string | undefined,
  name: string,
): string {
  if (
    value === undefined ||
    value.length === 0
  ) {
    throw new Error(
      `${name} is required for the enabled feature.`,
    );
  }

  return value;
}

function internalNotificationRecipients():
  readonly NotificationRecipient[] {
  const emails =
    env.INTERNAL_NOTIFICATION_EMAILS
      .split(",")
      .map(
        (email) =>
          email.trim(),
      )
      .filter(Boolean);

  if (emails.length === 0) {
    throw new Error(
      "At least one internal notification email is required when notifications are enabled.",
    );
  }

  for (const email of emails) {
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email,
      )
    ) {
      throw new Error(
        "INTERNAL_NOTIFICATION_EMAILS contains an invalid email address.",
      );
    }
  }

  return emails.map(
    (email) => ({
      email,
      name: null,
    }),
  );
}

export async function buildApp(
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const leadEngineUiEnabled =
    options.leadEngineUiEnabled ??
    env.LEAD_ENGINE_UI_V1;

  const leadSearchEnabled =
    options.leadSearchEnabled ??
    env.LEAD_SEARCH_GOOGLE_V1;

  const app = Fastify({
    bodyLimit: 1_048_576,

    logger: {
      level:
        env.NODE_ENV === "production"
          ? "info"
          : "debug",

      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
        ],

        censor: "[REDACTED]",
      },
    },
  });

  registerHttpErrorHandlers(app);

  await app.register(helmet);

  await app.register(cors, {
    origin: buildAllowedOrigins(
      env.CORS_ORIGINS,
      leadEngineUiEnabled,
      env.LEAD_ENGINE_CONSOLE_ORIGIN,
    ),

    methods: [
      "GET",
      "POST",
      "PUT",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "X-Submission-Id",
      "X-File-Name",
    ],

    credentials: false,
  });

  await app.register(rateLimit, {
    global: false,
  });

  registerQuoteAttachmentContentParsers(
    app,
  );

  await app.register(
    healthRoutes,
  );

  if (leadEngineUiEnabled) {
    const leadSearchService =
      leadSearchEnabled
        ? options.leadSearchService ??
          createLeadSearchService({
              enabled: true,
              postcodeLocator:
                new PostcodesIoLocator({
                  apiBaseUrl:
                    env.POSTCODES_IO_API_BASE_URL,
                  timeoutMs:
                    env.POSTCODES_IO_TIMEOUT_MS,
                }),
              searchProvider:
                new GooglePlacesLeadSearchProvider({
                  apiKey:
                    requiredEnvironmentValue(
                      env.GOOGLE_PLACES_API_KEY,
                      "GOOGLE_PLACES_API_KEY",
                    ),
                  apiBaseUrl:
                    env.GOOGLE_PLACES_API_BASE_URL,
                  timeoutMs:
                    env.GOOGLE_PLACES_TIMEOUT_MS,
                }),
              repository:
                new SupabaseLeadSearchRepository({
                  supabaseUrl:
                    requiredEnvironmentValue(
                      env.SUPABASE_URL,
                      "SUPABASE_URL",
                    ),
                  secretKey:
                    requiredEnvironmentValue(
                      env.SUPABASE_SECRET_KEY,
                      "SUPABASE_SECRET_KEY",
                    ),
                  timeoutMs:
                    env.SUPABASE_DATA_TIMEOUT_MS,
                }),
          })
        : null;

    registerLeadEngineRoutes(app, {
      founderAuthService:
        options.founderAuthService ??
        new SupabaseFounderAuthService({
          supabaseUrl:
            requiredEnvironmentValue(
              env.SUPABASE_URL,
              "SUPABASE_URL",
            ),
          publishableKey:
            requiredEnvironmentValue(
              env.SUPABASE_PUBLISHABLE_KEY,
              "SUPABASE_PUBLISHABLE_KEY",
            ),
          timeoutMs:
            env.SUPABASE_AUTH_TIMEOUT_MS,
        }),
      leadSearchEnabled,
      leadSearchService,
    });
  }

  const travelCalculationService =
    options
      .travelCalculationService ??
    createTravelCalculationService({
      enabled:
        env.TRAVEL_AUTO_ENABLED,

      provider:
        env.GOOGLE_ROUTES_API_KEY ===
        undefined
          ? null
          : new GoogleRoutesMatrixProvider({
              apiKey:
                env.GOOGLE_ROUTES_API_KEY,

              apiBaseUrl:
                env.GOOGLE_ROUTES_API_BASE_URL,

              timeoutMs:
                env.GOOGLE_ROUTES_TIMEOUT_MS,
            }),
    });

  registerTravelRoutes(app, {
    service:
      travelCalculationService,
  });

  let defaultRepositories:
    QuoteRepositories | null = null;

  const repositories =
    (): QuoteRepositories => {
      defaultRepositories ??=
        createWixQuoteRepositories();

      return defaultRepositories;
    };

  const submissionNotificationService =
    options
      .submissionNotificationService ??
    (
      env.NOTIFICATIONS_ENABLED
        ? createSubmissionNotificationService({
            branding: {
              businessName:
                env.NOTIFICATION_BUSINESS_NAME,

              customerReplyTo: {
                email:
                  requiredEnvironmentValue(
                    env.CUSTOMER_REPLY_TO_EMAIL,
                    "CUSTOMER_REPLY_TO_EMAIL",
                  ),

                name:
                  env.NOTIFICATION_BUSINESS_NAME,
              },

              internalRecipients:
                internalNotificationRecipients(),
            },

            delivery:
              new ResendNotificationDelivery({
                apiKey:
                  requiredEnvironmentValue(
                    env.RESEND_API_KEY,
                    "RESEND_API_KEY",
                  ),

                apiBaseUrl:
                  env.RESEND_API_BASE_URL,

                from: {
                  email:
                    requiredEnvironmentValue(
                      env.NOTIFICATION_FROM_EMAIL,
                      "NOTIFICATION_FROM_EMAIL",
                    ),

                  name:
                    env.NOTIFICATION_FROM_NAME ??
                    env.NOTIFICATION_BUSINESS_NAME,
                },

                timeoutMs:
                  env.NOTIFICATION_TIMEOUT_MS,
              }),

            recorder:
              new WixNotificationDeliveryRecorder(
                repositories()
                  .statusHistory,
              ),
          })
        : NOOP_SUBMISSION_NOTIFICATION_SERVICE
    );

  const contactEnquiryPersistenceService =
    options.contactEnquiryPersistenceService ??
    createContactEnquiryPersistenceService(
      createWixContactEnquiryRepository(),
    );

  registerContactEnquiryRoutes(
    app,
    {
      persistenceService:
        contactEnquiryPersistenceService,

      notificationService:
        submissionNotificationService,
    },
  );

  const quoteResolutionService =
    options.quoteResolutionService ??
    createQuoteContextResolver({
      customers:
        repositories().customers,
      properties:
        repositories().properties,
    });

  const quotePricingService =
    options.quotePricingService ??
    createQuotePricingService(
      env.TRAVEL_AUTO_ENABLED
        ? {
            resolveTravel:
              (postcode) =>
                travelCalculationService
                  .calculate(
                    postcode,
                  ),
          }
        : {},
    );

  const quotePersistenceService =
    options.quotePersistenceService ??
    createQuotePersistenceService(
      repositories(),
    );

  let defaultAttachmentService:
    QuoteAttachmentLinkingService | null =
      null;

  const quoteAttachmentLinkingService =
    (): QuoteAttachmentLinkingService => {
      if (
        options.quoteAttachmentLinkingService
      ) {
        return options
          .quoteAttachmentLinkingService;
      }

      if (
        defaultAttachmentService ===
        null
      ) {
        const mediaStorage =
          createWixMediaStorage();

        const uploadService =
          createQuoteAttachmentUploadService({
            mediaStorage,
          });

        defaultAttachmentService =
          createQuoteAttachmentLinkingService({
            quotes:
              repositories().quotes,
            mediaUploads:
              repositories()
                .mediaUploads,
            uploadService,
            mediaStorage,
          });
      }

      return defaultAttachmentService;
    };

  registerQuoteRoutes(app, {
    quoteResolutionService,
    quotePricingService,
    quotePersistenceService,

    notificationService:
      submissionNotificationService,
  });

  registerQuoteAttachmentRoutes(
    app,
    {
      getLinkingService:
        quoteAttachmentLinkingService,
    },
  );

  return app;
}
