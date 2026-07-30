import assert from "node:assert/strict";
import test from "node:test";

import {
  buildApp,
} from "../src/app.js";

import type {
  SubmissionNotificationService,
} from "../src/application/deliver-notifications.js";

import type {
  QuotePersistenceService,
} from "../src/application/persist-quote.js";

import type {
  QuotePricingService,
} from "../src/application/price-quote.js";

import type {
  QuoteResolutionContext,
  QuoteResolutionService,
} from "../src/application/resolve-quote-context.js";

import type {
  SubmitQuoteRequest,
} from "../src/application/validation/submit-quote.js";

import {
  ApplicationError,
} from "../src/domain/errors.js";

const submissionId =
  "11111111-1111-4111-8111-111111111111";

const validPayload = {
  submissionId,
  schemaVersion: "1.0",

  customer: {
    fullName: "Test Customer",
    companyName: "",
    email: "customer@example.com",
    phone: "07123 456789",
    declaredCustomerType:
      "New customer",
    preferredContactMethod:
      "Email",
    privacyConsent: true,
    marketingConsent: false,
  },

  property: {
    propertyType: "House",
    address:
      "14 Example Avenue, London",
    postcode: "NW1 1HN",
    bedrooms: 2,
    bathrooms: 1,
    propertyCount: 1,
    propertyStatus: "Occupied",
    parkingDetails: "",
    petsDetails: "",
    accessArrangements: "",
  },

  appointment: {
    preferredDate: "2026-08-15",
    arrivalWindow: "08:00–11:00",
    preferredStartDate: "",
    requiredCompletionDate: "",
    sameDay: false,
  },

  service: {
    category: "Residential Cleaning",
    serviceType: "Standard Clean",
    cleaningScope: "Whole Property",

    rooms: {
      Bathroom: 0,
      Bedroom: 0,
      Kitchen: 0,
      "Living Room": 0,
      Hallway: 0,
      Stairs: 0,
    },

    extras: {
      Oven: 0,
      Fridge: 0,
      "Interior Windows": 0,
      "Grout Cleaning": 0,
      Laundry: 0,
      "Standard Consumables Package": 0,
    },

    currentCondition: "",
    requirements: "",
  },

  safetyWarnings: "",
  additionalNotes: "",
  attachmentCount: 0,
} satisfies SubmitQuoteRequest;

function resolvedContext(
  submission: SubmitQuoteRequest,
): QuoteResolutionContext {
  return {
    submission,

    customer: {
      kind: "no-match",
      customer: null,
      matchedBy: null,
      normalizedEmail:
        "customer@example.com",
      normalizedPhone:
        "447123456789",
      verifiedCustomerStatus:
        "Verified New",
      customerStatusMismatch: false,
      requiresReview: true,
      reviewReasons: [
        "NEW_CUSTOMER",
      ],
    },

    property: {
      kind: "deferred",
      property: null,
      normalizedPostcode: "NW11HN",
      normalizedAddress:
        "14 example avenue london",
      candidateCount: 0,
      requiresReview: false,
      reviewReasons: [],
    },

    requiresReview: true,
    reviewReasons: [
      "NEW_CUSTOMER",
    ],
  };
}

function createResolutionService(
  onResolve?: (
    submission: SubmitQuoteRequest,
  ) => void,
): QuoteResolutionService {
  return {
    async resolve(submission) {
      onResolve?.(submission);
      return resolvedContext(submission);
    },
  };
}

function createPricingService():
  QuotePricingService {
  return {
    async price() {
      return {
        kind: "instant",
        pricingVersion:
          "CUC Phase 0 v1.3",
        estimatedTotal: 93.5,
        requiredUpfrontPercentage: 30,
        requiredUpfrontAmount: 28.05,
        remainingBalance: 65.45,
        travelFee: 0,
        travelPending: false,
        provisional: false,
        clientEstimateMismatch: false,
        manualReviewRequired: true,
        manualReviewReasons: [
          "NEW_CUSTOMER",
        ],
        items: [],
        pricingSnapshot: {
          estimatedTotal: 93.5,
          distanceMiles: 0,
        },
      };
    },
  };
}

function createPersistenceService():
  QuotePersistenceService {
  return {
    async persist(context, pricing) {
      return {
        outcome: "created",

        customer: {
          id: "customer-1",
          fullName:
            context.submission.customer
              .fullName,
          companyName: null,
          email:
            context.submission.customer
              .email,
          emailNormalized:
            context.customer
              .normalizedEmail,
          phone:
            context.submission.customer
              .phone,
          phoneNormalized:
            context.customer
              .normalizedPhone,
          declaredCustomerType:
            context.submission.customer
              .declaredCustomerType,
          verificationStatus:
            context.customer
              .verifiedCustomerStatus,
          isExistingCustomer: false,
          firstEligibleCleanCompleted:
            false,
          privacyConsent: true,
          marketingConsent: false,
          internalNotes: null,
        },

        property: {
          id: "property-1",
          customerId: "customer-1",
          propertyLabel:
            context.submission.property
              .address,
          address:
            context.submission.property
              .address,
          postcode:
            context.submission.property
              .postcode,
          postcodeNormalized:
            context.property
              .normalizedPostcode,
          propertyType: "House",
          bedroomCount: 2,
          bathroomCount: 1,
          occupancyStatus: "Occupied",
          parkingDetails: null,
          petsDetails: null,
          accessArrangements: null,
          verifiedProperty: false,
          activeProperty: true,
        },

        quote: {
          id: "quote-1",
          submissionId:
            context.submission
              .submissionId,
          quoteNumber:
            "CUC-Q-111111111111",
          customerId: "customer-1",
          propertyId: "property-1",
          schemaVersion: "1.0",
          pricingVersion:
            pricing.pricingVersion,
          status: "In Review",
          category:
            "Residential Cleaning",
          serviceType:
            "Standard Clean",
          cleaningScope:
            "Whole Property",
          declaredCustomerType:
            "New customer",
          verifiedCustomerStatus:
            "Verified New",
          customerStatusMismatch:
            false,
          preferredContactMethod:
            "Email",
          preferredDate:
            "2026-08-15",
          arrivalWindow:
            "08:00–11:00",
          preferredStartDate: null,
          requiredCompletionDate:
            null,
          sameDay: false,
          arrangement: null,
          frequency: null,
          urgency: null,
          supportServices: [],
          manualReviewRequired: true,
          manualReviewReasons: [
            "NEW_CUSTOMER",
          ],
          estimatedTotal: 93.5,
          requiredUpfrontPercentage:
            30,
          requiredUpfrontAmount: 28.05,
          remainingBalance: 65.45,
          travelFee: 0,
          travelPending: false,
          distanceMiles: 0,
          provisional: false,
          customerNotes: null,
          rawSubmission: {},
          pricingSnapshot: {},
        },

        quoteItems: [],

        statusHistory: {
          id: "history-1",
          historyLabel:
            "CUC-Q-111111111111 - In Review",
          quoteId: "quote-1",
          contactEnquiryId: null,
          recordType: "Quote",
          previousStatus: null,
          newStatus: "In Review",
          changeSource: "Website",
          actorType: "Customer",
          actorId: "customer-1",
          actorName: "Test Customer",
          changeReason:
            "Quote submitted through the website.",
          customerVisible: true,
          notes: null,
          metadata: null,
        },

        createdCustomer: true,
        createdProperty: true,
      };
    },
  };
}

function createReplayedPersistenceService():
  QuotePersistenceService {
  const createdService =
    createPersistenceService();

  return {
    async persist(context, pricing) {
      const created =
        await createdService.persist(
          context,
          pricing,
        );

      return {
        outcome: "replayed",
        quote: created.quote,
      };
    },
  };
}

function createConflictingPersistenceService():
  QuotePersistenceService {
  return {
    async persist() {
      throw new ApplicationError({
        code: "DUPLICATE_SUBMISSION",
        message:
          "Internal conflict for quote-1 and customer-1.",
        statusCode: 409,
        details: {
          quoteId: "quote-1",
          customerId: "customer-1",
          submissionId,
        },
      });
    },
  };
}

async function testApp(
  resolutionService:
    QuoteResolutionService =
      createResolutionService(),
  persistenceService:
    QuotePersistenceService =
      createPersistenceService(),
) {
  return buildApp({
    quoteResolutionService:
      resolutionService,
    quotePricingService:
      createPricingService(),
    quotePersistenceService:
      persistenceService,
  });
}

test(
  "POST /api/quotes validates, prices and persists a complete submission",
  async (context) => {
    const capturedSubmission: {
      value: SubmitQuoteRequest | null;
    } = {
      value: null,
    };

    const app = await testApp(
      createResolutionService(
        (submission) => {
          capturedSubmission.value =
            submission;
        },
      ),
    );

    context.after(
      async () => app.close(),
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/quotes",
      headers: {
        "content-type":
          "application/json",
      },
      payload: {
        submissionId,
        payload: validPayload,
      },
    });

    assert.equal(
      response.statusCode,
      201,
    );

    const resolvedSubmission =
      capturedSubmission.value;

    assert.ok(
      resolvedSubmission,
      "The resolution service should receive the validated submission.",
    );

    assert.equal(
      resolvedSubmission.submissionId,
      submissionId,
    );

    const body = response.json<{
      success: boolean;
      replayed: boolean;
      confirmation: {
        quoteNumber: string;
        status: string;
        message: string;
        service: {
          category: string;
          serviceType: string;
          cleaningScope:
            string | null;
        };
        appointment: {
          preferredDate:
            string | null;
          arrivalWindow:
            string | null;
          sameDay: boolean;
        };
        estimate: {
          currency: string;
          estimatedTotal: number;
          requiredUpfrontPercentage:
            number | null;
          requiredUpfrontAmount:
            number | null;
          remainingBalance:
            number | null;
          provisional: boolean;
        } | null;
      };
      requestId: string;
    }>();

    assert.deepEqual(
      body.confirmation,
      {
        quoteNumber:
          "CUC-Q-111111111111",
        status: "In Review",
        message:
          "Your quote request has been received and is being reviewed.",
        service: {
          category:
            "Residential Cleaning",
          serviceType:
            "Standard Clean",
          cleaningScope:
            "Whole Property",
        },
        appointment: {
          preferredDate:
            "2026-08-15",
          arrivalWindow:
            "08:00–11:00",
          sameDay: false,
        },
        estimate: {
          currency: "GBP",
          estimatedTotal: 93.5,
          requiredUpfrontPercentage:
            30,
          requiredUpfrontAmount:
            28.05,
          remainingBalance: 65.45,
          provisional: false,
        },
      },
    );

    assert.equal(body.success, true);
    assert.equal(body.replayed, false);
    assert.equal(
      typeof body.requestId,
      "string",
    );
    assert.equal(
      response.headers[
        "cache-control"
      ],
      "no-store",
    );

    const serializedBody =
      JSON.stringify(body);

    for (
      const forbiddenValue of [
        "quote-1",
        "customer-1",
        "property-1",
        submissionId,
        "customer@example.com",
        "07123 456789",
        "14 Example Avenue, London",
        "CUC Phase 0 v1.3",
        "NEW_CUSTOMER",
      ]
    ) {
      assert.equal(
        serializedBody.includes(
          forbiddenValue,
        ),
        false,
        `The public response must not expose ${forbiddenValue}.`,
      );
    }

    for (
      const forbiddenKey of [
        "id",
        "submissionId",
        "customerId",
        "propertyId",
        "schemaVersion",
        "pricingVersion",
        "manualReviewRequired",
        "manualReviewReasons",
        "rawSubmission",
        "pricingSnapshot",
        "distanceMiles",
        "customerStatusMismatch",
        "verifiedCustomerStatus",
      ]
    ) {
      assert.equal(
        serializedBody.includes(
          `\"${forbiddenKey}\"`,
        ),
        false,
        `The public response must not expose the ${forbiddenKey} field.`,
      );
    }
  },
);

test(
  "POST /api/quotes returns the existing quote for an idempotent replay",
  async (context) => {
    const app = await testApp(
      createResolutionService(),
      createReplayedPersistenceService(),
    );

    context.after(
      async () => app.close(),
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/quotes",
      headers: {
        "content-type":
          "application/json",
      },
      payload: {
        submissionId,
        payload: validPayload,
      },
    });

    assert.equal(
      response.statusCode,
      200,
    );

    const body = response.json<{
      success: boolean;
      replayed: boolean;
      confirmation: {
        quoteNumber: string;
      };
    }>();

    assert.equal(body.success, true);
    assert.equal(body.replayed, true);
    assert.equal(
      body.confirmation.quoteNumber,
      "CUC-Q-111111111111",
    );
    assert.equal(
      response.headers[
        "cache-control"
      ],
      "no-store",
    );
  },
);

test(
  "POST /api/quotes rejects conflicting reuse of a submission ID",
  async (context) => {
    const app = await testApp(
      createResolutionService(),
      createConflictingPersistenceService(),
    );

    context.after(
      async () => app.close(),
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/quotes",
      headers: {
        "content-type":
          "application/json",
      },
      payload: {
        submissionId,
        payload: validPayload,
      },
    });

    assert.equal(
      response.statusCode,
      409,
    );

    const body = response.json<{
      success: boolean;
      error: {
        code: string;
        message: string;
        details?: unknown;
      };
      requestId: string;
    }>();

    assert.equal(
      body.error.code,
      "DUPLICATE_SUBMISSION",
    );
    assert.equal(
      body.error.message,
      "This submission reference has already been used for different information.",
    );
    assert.equal(
      "details" in body.error,
      false,
    );
    assert.equal(
      JSON.stringify(body).includes(
        "quote-1",
      ),
      false,
    );
    assert.equal(
      JSON.stringify(body).includes(
        submissionId,
      ),
      false,
    );
    assert.equal(
      response.headers[
        "cache-control"
      ],
      "no-store",
    );
  },
);

test(
  "POST /api/quotes rejects an invalid full quote payload",
  async (context) => {
    const app = await testApp();
    context.after(
      async () => app.close(),
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/quotes",
      headers: {
        "content-type":
          "application/json",
      },
      payload: {
        submissionId,
        payload: {
          submissionId,
          schemaVersion: "1.0",
        },
      },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(
      response.json<{
        error: { code: string };
      }>().error.code,
      "VALIDATION_ERROR",
    );
    assert.equal(
      response.headers[
        "cache-control"
      ],
      "no-store",
    );
  },
);

test(
  "POST /api/quotes rejects mismatched submission IDs",
  async (context) => {
    const app = await testApp();
    context.after(
      async () => app.close(),
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/quotes",
      headers: {
        "content-type":
          "application/json",
      },
      payload: {
        submissionId,
        payload: {
          ...validPayload,
          submissionId:
            "22222222-2222-4222-8222-222222222222",
        },
      },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(
      response.json<{
        error: { code: string };
      }>().error.code,
      "VALIDATION_ERROR",
    );
  },
);

test(
  "POST /api/quotes rejects unexpected envelope fields",
  async (context) => {
    const app = await testApp();
    context.after(
      async () => app.close(),
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/quotes",
      headers: {
        "content-type":
          "application/json",
      },
      payload: {
        submissionId,
        payload: validPayload,
        unexpectedAdminField: true,
      },
    });

    assert.equal(response.statusCode, 400);
  },
);

test(
  "POST /api/quotes rejects non-JSON content",
  async (context) => {
    const app = await testApp();
    context.after(
      async () => app.close(),
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/quotes",
      headers: {
        "content-type": "text/plain",
      },
      payload: JSON.stringify({
        submissionId,
        payload: validPayload,
      }),
    });

    assert.equal(response.statusCode, 415);
    assert.equal(
      response.json<{
        error: { code: string };
      }>().error.code,
      "UNSUPPORTED_MEDIA_TYPE",
    );
  },
);

test(
  "POST /api/quotes rejects an oversized request",
  async (context) => {
    const app = await testApp();
    context.after(
      async () => app.close(),
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/quotes",
      headers: {
        "content-type":
          "application/json",
      },
      payload: {
        submissionId,
        payload: {
          ...validPayload,
          additionalNotes:
            "x".repeat(270 * 1024),
        },
      },
    });

    assert.equal(response.statusCode, 413);
    assert.equal(
      response.json<{
        error: { code: string };
      }>().error.code,
      "PAYLOAD_TOO_LARGE",
    );
  },
);

test(
  "POST /api/quotes rate limits repeated submissions",
  async (context) => {
    const app = await testApp();
    context.after(
      async () => app.close(),
    );

    for (
      let attempt = 1;
      attempt <= 5;
      attempt += 1
    ) {
      const response = await app.inject({
        method: "POST",
        url: "/api/quotes",
        headers: {
          "content-type":
            "application/json",
        },
        payload: {
          submissionId,
          payload: validPayload,
        },
      });

      assert.equal(
        response.statusCode,
        201,
      );
    }

    const blockedResponse =
      await app.inject({
        method: "POST",
        url: "/api/quotes",
        headers: {
          "content-type":
            "application/json",
        },
        payload: {
          submissionId,
          payload: validPayload,
        },
      });

    assert.equal(
      blockedResponse.statusCode,
      429,
    );
    assert.equal(
      blockedResponse.json<{
        error: { code: string };
      }>().error.code,
      "RATE_LIMITED",
    );
  },
);


test(
  "POST /api/quotes still succeeds when notification dispatch throws after persistence",
  async (context) => {
    const notificationService:
      SubmissionNotificationService = {
        async notifyQuote() {
          throw new Error(
            "Simulated notification failure",
          );
        },

        async notifyContactEnquiry() {
          return {
            attempted: 0,
            sent: 0,
            failed: 0,
            items: [],
          };
        },
      };

    const app = await buildApp({
      quoteResolutionService:
        createResolutionService(),

      quotePricingService:
        createPricingService(),

      quotePersistenceService:
        createPersistenceService(),

      submissionNotificationService:
        notificationService,
    });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "POST",
        url: "/api/quotes",

        headers: {
          "content-type":
            "application/json",
        },

        payload: {
          submissionId,
          payload: validPayload,
        },
      });

    assert.equal(
      response.statusCode,
      201,
    );

    assert.equal(
      response.json<{
        success: boolean;
      }>().success,
      true,
    );
  },
);
