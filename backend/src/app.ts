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
  CompaniesHouseClient,
} from "./adapters/companies-house/companies-house-client.js";

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
  SupabaseLeadReviewRepository,
} from "./adapters/supabase/supabase-lead-review-repository.js";

import {
  SupabaseLeadExportRepository,
} from "./adapters/supabase/supabase-lead-export-repository.js";

import {
  SupabaseCompanyEnrichmentRepository,
} from "./adapters/supabase/supabase-company-enrichment-repository.js";

import {
  SupabaseOutreachRepository,
} from "./adapters/supabase/supabase-outreach-repository.js";

import {
  SupabaseOutlookConnectionRepository,
} from "./adapters/supabase/supabase-outlook-connection-repository.js";

import {
  MicrosoftGraphOutlookGateway,
} from "./adapters/microsoft/microsoft-graph-outlook.js";

import {
  FirstPartyCompanyNumberClient,
} from "./adapters/web/first-party-company-number.js";

import {
  FirstPartyResearchClient,
} from "./adapters/web/first-party-research.js";

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
  createLeadReviewService,
  type LeadReviewService,
} from "./application/review-leads.js";

import {
  createCompaniesHouseVerificationService,
  type CompaniesHouseVerificationService,
} from "./application/verify-companies-house.js";

import {
  createCompanyEnrichmentScheduler,
  createCompanyEnrichmentService,
  type CompanyEnrichmentService,
} from "./application/enrich-companies.js";

import {
  createAutomaticQualificationService,
} from "./application/qualify-leads.js";

import {
  createOutreachService,
  type OutreachService,
} from "./application/outreach.js";

import {
  createLeadExportService,
  type LeadExportService,
} from "./application/export-leads.js";

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

  readonly leadReviewEnabled?:
    boolean;

  readonly leadSearchService?:
    LeadSearchService;

  readonly leadReviewService?:
    LeadReviewService;

  readonly companiesHouseVerificationService?:
    CompaniesHouseVerificationService;

  readonly companyEnrichmentEnabled?:
    boolean;

  readonly automaticQualificationEnabled?:
    boolean;

  readonly outlookDraftEnabled?:
    boolean;

  readonly outreachService?:
    OutreachService;

  readonly leadExportEnabled?:
    boolean;

  readonly leadExportService?:
    LeadExportService;

  readonly companyEnrichmentService?:
    CompanyEnrichmentService;

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

  const leadReviewEnabled =
    options.leadReviewEnabled ??
    (
      options.leadReviewService !==
        undefined ||
      env.LEAD_COMPANIES_HOUSE_V1
    );

  const companyEnrichmentEnabled =
    options.companyEnrichmentEnabled ??
    env.LEAD_AUTO_COMPANY_ENRICHMENT_V1;

  const automaticQualificationEnabled =
    options.automaticQualificationEnabled ??
    env.LEAD_AUTOMATIC_QUALIFICATION_V1;

  const outlookDraftEnabled =
    options.outlookDraftEnabled ??
    env.LEAD_OUTLOOK_DRAFT_V1;

  const leadExportEnabled =
    options.leadExportEnabled ??
    env.LEAD_EXPORT_V1;

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

    exposedHeaders: [
      "Content-Disposition",
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
    let defaultLeadReviewRepository:
      SupabaseLeadReviewRepository | null =
        null;
    const leadReviewRepository =
      (): SupabaseLeadReviewRepository => {
        defaultLeadReviewRepository ??=
          new SupabaseLeadReviewRepository({
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
            companyEnrichmentEnabled,
            automaticQualificationEnabled,
          });
        return defaultLeadReviewRepository;
      };

    const leadReviewService =
      leadReviewEnabled
        ? options.leadReviewService ??
          createLeadReviewService(
            leadReviewRepository(),
          )
        : null;

    const companiesHouseVerificationService =
      options
        .companiesHouseVerificationService ??
      (
        leadReviewService !== null &&
        env.COMPANIES_HOUSE_API_KEY !==
          undefined
          ? createCompaniesHouseVerificationService(
              leadReviewRepository(),
              leadReviewService,
              new CompaniesHouseClient({
                apiKey:
                  env.COMPANIES_HOUSE_API_KEY,
                apiBaseUrl:
                  env.COMPANIES_HOUSE_API_BASE_URL,
                timeoutMs:
                  env.COMPANIES_HOUSE_TIMEOUT_MS,
              }),
            )
          : null
      );

    let companyEnrichmentService =
      options.companyEnrichmentService ?? null;
    let defaultCompanyEnrichmentService = false;
    if (
      companyEnrichmentEnabled &&
      companyEnrichmentService === null
    ) {
      if (
        companiesHouseVerificationService === null
      ) {
        throw new Error(
          "Companies House verification is required for automatic company enrichment.",
        );
      }
      const enrichmentRepository =
        new SupabaseCompanyEnrichmentRepository({
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
        });
      companyEnrichmentService =
        automaticQualificationEnabled
          ? createAutomaticQualificationService({
              repository:
                enrichmentRepository,
              firstPartyProvider:
                new FirstPartyResearchClient({
                  timeoutMs:
                    env.LEAD_WEBSITE_LOOKUP_TIMEOUT_MS,
                  maximumBytes:
                    env.LEAD_WEBSITE_LOOKUP_MAX_BYTES,
                  maximumPages:
                    env.LEAD_WEBSITE_RESEARCH_MAX_PAGES,
                  requestRetries:
                    env.LEAD_WEBSITE_REQUEST_RETRIES,
                }),
              companiesHouseService:
                companiesHouseVerificationService,
              leadReviewService:
                leadReviewService!,
              batchSize:
                env.LEAD_COMPANY_ENRICHMENT_BATCH_SIZE,
              leaseSeconds:
                env.LEAD_COMPANY_ENRICHMENT_LEASE_SECONDS,
              activationTotalLimit:
                env.LEAD_AUTOMATIC_QUALIFICATION_ROLLOUT ===
                  "all"
                  ? null
                  : 1,
            })
          : createCompanyEnrichmentService({
              repository:
                enrichmentRepository,
              firstPartyProvider:
                new FirstPartyCompanyNumberClient({
                  timeoutMs:
                    env.LEAD_WEBSITE_LOOKUP_TIMEOUT_MS,
                  maximumBytes:
                    env.LEAD_WEBSITE_LOOKUP_MAX_BYTES,
                }),
              companiesHouseService:
                companiesHouseVerificationService,
              batchSize:
                env.LEAD_COMPANY_ENRICHMENT_BATCH_SIZE,
              leaseSeconds:
                env.LEAD_COMPANY_ENRICHMENT_LEASE_SECONDS,
            });
      defaultCompanyEnrichmentService = true;
    }

    if (
      defaultCompanyEnrichmentService &&
      companyEnrichmentService !== null
    ) {
      const scheduler =
        createCompanyEnrichmentScheduler(
          companyEnrichmentService,
          env.LEAD_COMPANY_ENRICHMENT_INTERVAL_MS,
          (result) => {
            if (result.claimedCount > 0) {
              app.log.info(
                result,
                "Lead company enrichment batch completed",
              );
            }
          },
          (error) => app.log.error(
            error,
            "Lead company enrichment batch failed",
          ),
        );
      app.addHook("onReady", async () => {
        scheduler.start();
      });
      app.addHook("onClose", async () => {
        scheduler.stop();
      });
    }

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
              assessmentService:
                leadReviewService,
          })
        : null;

    const outreachService =
      outlookDraftEnabled
        ? options.outreachService ??
          (() => {
            if (leadReviewService === null) {
              throw new Error(
                "Lead review is required for Outlook drafting.",
              );
            }
            const connectionRepository =
              new SupabaseOutlookConnectionRepository({
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
              });
            return createOutreachService({
              leadReviewService,
              privacyUrl:
                requiredEnvironmentValue(
                  env.OUTREACH_PRIVACY_URL,
                  "OUTREACH_PRIVACY_URL",
                ),
              optOutText:
                requiredEnvironmentValue(
                  env.OUTREACH_OPTOUT_TEXT,
                  "OUTREACH_OPTOUT_TEXT",
                ),
              repository:
                new SupabaseOutreachRepository({
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
              gateway:
                new MicrosoftGraphOutlookGateway({
                  clientId:
                    requiredEnvironmentValue(
                      env.MICROSOFT_CLIENT_ID,
                      "MICROSOFT_CLIENT_ID",
                    ),
                  clientSecret:
                    requiredEnvironmentValue(
                      env.MICROSOFT_CLIENT_SECRET,
                      "MICROSOFT_CLIENT_SECRET",
                    ),
                  tenantId:
                    env.MICROSOFT_TENANT_ID,
                  redirectUri:
                    requiredEnvironmentValue(
                      env.MICROSOFT_REDIRECT_URI,
                      "MICROSOFT_REDIRECT_URI",
                    ),
                  graphBaseUrl:
                    env.MICROSOFT_GRAPH_API_BASE_URL,
                  loginBaseUrl:
                    env.MICROSOFT_LOGIN_BASE_URL,
                  tokenEncryptionKey:
                    requiredEnvironmentValue(
                      env.OUTLOOK_TOKEN_ENCRYPTION_KEY,
                      "OUTLOOK_TOKEN_ENCRYPTION_KEY",
                    ),
                  timeoutMs:
                    env.OUTLOOK_GRAPH_TIMEOUT_MS,
                  repository:
                    connectionRepository,
                }),
            });
          })()
        : null;

    const leadExportService =
      leadExportEnabled
        ? options.leadExportService ??
          createLeadExportService(
            new SupabaseLeadExportRepository({
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
          )
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
      leadReviewService,
      companiesHouseVerificationService,
      companyEnrichmentEnabled,
      companyEnrichmentService,
      automaticQualificationEnabled,
      outlookDraftEnabled,
      outreachService,
      leadExportEnabled,
      leadExportService,
      outlookCallbackRedirectUrl:
        env.LEAD_ENGINE_CONSOLE_ORIGIN ===
          undefined
          ? null
          : `${env.LEAD_ENGINE_CONSOLE_ORIGIN.replace(/\/$/, "")}/ops/leads`,
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
