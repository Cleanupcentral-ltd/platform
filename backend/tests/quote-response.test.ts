import assert from "node:assert/strict";
import test from "node:test";

import type {
  QuoteRecord,
} from "../src/domain/models.js";

import {
  createPublicQuoteResponse,
  type PublicQuoteResponseSource,
} from "../src/http/responses/quote-response.js";

function quoteRecord(
  overrides: Partial<QuoteRecord> = {},
): QuoteRecord {
  return {
    id: "internal-quote-id",
    submissionId:
      "11111111-1111-4111-8111-111111111111",
    quoteNumber:
      "CUC-Q-111111111111",
    customerId:
      "internal-customer-id",
    propertyId:
      "internal-property-id",
    schemaVersion: "1.0",
    pricingVersion:
      "CUC Phase 0 v1.3",
    status: "Submitted",
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
    customerStatusMismatch: false,
    preferredContactMethod:
      "Email",
    preferredDate: "2026-08-15",
    arrivalWindow:
      "08:00–11:00",
    preferredStartDate: null,
    requiredCompletionDate: null,
    sameDay: false,
    arrangement: null,
    frequency: null,
    urgency: null,
    supportServices: [],
    manualReviewRequired: false,
    manualReviewReasons: [],
    estimatedTotal: 93.5,
    requiredUpfrontPercentage: 30,
    requiredUpfrontAmount: 28.05,
    remainingBalance: 65.45,
    travelFee: 0,
    travelPending: false,
    distanceMiles: 0,
    provisional: false,
    customerNotes:
      "Sensitive customer note",
    rawSubmission: {
      email: "customer@example.com",
    },
    pricingSnapshot: {
      internalRule:
        "NEW_CUSTOMER",
    },
    ...overrides,
  };
}

function replayedSubmission(
  quote: QuoteRecord,
): PublicQuoteResponseSource {
  return {
    outcome: "replayed",
    quote,
  };
}

test(
  "creates a deliberately limited customer-facing quote response",
  () => {
    const response =
      createPublicQuoteResponse(
        replayedSubmission(
          quoteRecord(),
        ),
        "request-1",
      );

    assert.deepEqual(response, {
      success: true,
      replayed: true,
      confirmation: {
        quoteNumber:
          "CUC-Q-111111111111",
        status: "Submitted",
        message:
          "Your quote request has been received.",
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
      requestId: "request-1",
    });
  },
);

test(
  "returns no price object for a custom quote",
  () => {
    const response =
      createPublicQuoteResponse(
        replayedSubmission(
          quoteRecord({
            status: "In Review",
            serviceType:
              "End of Tenancy",
            estimatedTotal: null,
            requiredUpfrontPercentage:
              null,
            requiredUpfrontAmount:
              null,
            remainingBalance: null,
            travelFee: null,
            travelPending: true,
            distanceMiles: null,
            provisional: true,
          }),
        ),
        "request-2",
      );

    assert.equal(
      response.confirmation.estimate,
      null,
    );
    assert.equal(
      response.confirmation.message,
      "Your quote request has been received and is being reviewed.",
    );
  },
);

test(
  "marks a visible estimate provisional without revealing why",
  () => {
    const response =
      createPublicQuoteResponse(
        replayedSubmission(
          quoteRecord({
            travelPending: true,
            provisional: false,
          }),
        ),
        "request-3",
      );

    assert.equal(
      response.confirmation
        .estimate?.provisional,
      true,
    );

    const serialized =
      JSON.stringify(response);

    for (
      const forbiddenText of [
        "internal-quote-id",
        "internal-customer-id",
        "internal-property-id",
        "customer@example.com",
        "Sensitive customer note",
        "NEW_CUSTOMER",
        "pricingVersion",
        "manualReviewRequired",
        "manualReviewReasons",
        "rawSubmission",
        "pricingSnapshot",
        "travelPending",
        "distanceMiles",
      ]
    ) {
      assert.equal(
        serialized.includes(
          forbiddenText,
        ),
        false,
      );
    }
  },
);
