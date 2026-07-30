import assert from "node:assert/strict";
import test from "node:test";

import {
  createQuotePricingService,
} from "../src/application/price-quote.js";

import type {
  QuoteResolutionContext,
} from "../src/application/resolve-quote-context.js";

import type {
  SubmitQuoteRequest,
} from "../src/application/validation/submit-quote.js";

function submission():
  SubmitQuoteRequest {
  return {
    submissionId:
      "11111111-1111-4111-8111-111111111111",

    schemaVersion: "1.0",

    customer: {
      fullName:
        "Test Customer",

      companyName: "",

      email:
        "customer@example.com",

      phone:
        "07123 456789",

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

      postcode: "SE1 2AA",
      bedrooms: 2,
      bathrooms: 1,
      propertyCount: 1,

      propertyStatus:
        "Occupied",

      parkingDetails: "",
      petsDetails: "",
      accessArrangements: "",
    },

    appointment: {
      preferredDate:
        "2026-08-15",

      arrivalWindow:
        "08:00–11:00",

      preferredStartDate: "",

      requiredCompletionDate:
        "",

      sameDay: false,
    },

    service: {
      category:
        "Residential Cleaning",

      serviceType:
        "Standard Clean",

      cleaningScope:
        "Whole Property",

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

        "Standard Consumables Package":
          0,
      },

      currentCondition: "",
      requirements: "",
    },

    safetyWarnings: "",
    additionalNotes: "",
    attachmentCount: 0,
  };
}

function context(
  request:
    SubmitQuoteRequest =
      submission(),
): QuoteResolutionContext {
  return {
    submission: request,

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

      customerStatusMismatch:
        false,

      requiresReview: true,

      reviewReasons: [
        "NEW_CUSTOMER",
      ],
    },

    property: {
      kind: "deferred",
      property: null,

      normalizedPostcode:
        "SE12AA",

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

test(
  "prices a valid instant quote on the server",
  async () => {
    const service =
      createQuotePricingService({
        async resolveDistanceMiles() {
          return 0;
        },

        now: () =>
          new Date(
            "2026-08-10T10:00:00Z",
          ),
      });

    const result =
      await service.price(
        context(),
      );

    assert.equal(
      result.kind,
      "instant",
    );

    assert.equal(
      result.estimatedTotal,
      93.5,
    );

    assert.equal(
      result.pricingVersion,
      "CUC Phase 0 v1.3",
    );

    assert.equal(
      result.items.length > 0,
      true,
    );
  },
);

test(
  "detects a manipulated browser estimate",
  async () => {
    const request =
      submission();

    request.clientEstimate = {
      pricingVersion:
        "CUC Phase 0 v1.3",

      estimatedTotal: 1,
    };

    const service =
      createQuotePricingService({
        async resolveDistanceMiles() {
          return 0;
        },

        now: () =>
          new Date(
            "2026-08-10T10:00:00Z",
          ),
      });

    const result =
      await service.price(
        context(request),
      );

    assert.equal(
      result.clientEstimateMismatch,
      true,
    );

    assert.ok(
      result.manualReviewReasons
        .includes(
          "CLIENT_ESTIMATE_MISMATCH",
        ),
    );

    assert.equal(
      result.estimatedTotal,
      93.5,
    );
  },
);

test(
  "does not instant-price End of Tenancy",
  async () => {
    const request =
      submission();

    request.service = {
      category:
        "Residential Cleaning",

      serviceType:
        "End of Tenancy",

      cleaningScope: "",

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

        "Standard Consumables Package":
          0,
      },

      currentCondition:
        "Move-out clean required.",

      requirements:
        "Full internal clean.",
    };

    const service =
      createQuotePricingService();

    const result =
      await service.price(
        context(request),
      );

    assert.equal(
      result.kind,
      "custom",
    );

    assert.equal(
      result.estimatedTotal,
      null,
    );

    assert.ok(
      result.manualReviewReasons
        .includes(
          "END_OF_TENANCY_CUSTOM_QUOTE",
        ),
    );
  },
);