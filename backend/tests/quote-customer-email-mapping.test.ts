import assert from "node:assert/strict";
import test from "node:test";

import {
  WIX_FIELDS,
} from "../src/adapters/wix/collections.js";

import {
  mapQuoteCreateToWix,
} from "../src/adapters/wix/repositories/quote-mapper.js";

import type {
  CreateQuoteRecord,
} from "../src/domain/models.js";

function quoteRecord(): CreateQuoteRecord {
  return {
    submissionId:
      "11111111-1111-4111-8111-111111111111",
    quoteNumber: "CUC-Q-111111111111",
    customerId: "customer-1",
    propertyId: "property-1",
    schemaVersion: "1.0",
    pricingVersion: "CUC Phase 0 v1.3",
    status: "Submitted",
    category: "Residential Cleaning",
    serviceType: "Standard Clean",
    cleaningScope: "Whole Property",
    declaredCustomerType: "New customer",
    verifiedCustomerStatus: "Verified New",
    customerStatusMismatch: false,
    preferredContactMethod: "Email",
    preferredDate: null,
    arrivalWindow: null,
    preferredStartDate: null,
    requiredCompletionDate: null,
    sameDay: false,
    arrangement: null,
    frequency: null,
    urgency: null,
    supportServices: [],
    manualReviewRequired: false,
    manualReviewReasons: [],
    estimatedTotal: 70,
    requiredUpfrontPercentage: 30,
    requiredUpfrontAmount: 21,
    remainingBalance: 49,
    travelFee: 0,
    travelPending: false,
    distanceMiles: 0,
    provisional: false,
    customerNotes: null,
    rawSubmission: {
      customer: {
        email: " Customer@Example.com ",
      },
    },
    pricingSnapshot: {},
  };
}

test(
  "maps the submitted customer email directly onto a Wix quote item",
  () => {
    const mapped = mapQuoteCreateToWix(
      quoteRecord(),
    );

    assert.equal(
      mapped[
        WIX_FIELDS.quotes.customerEmail
      ],
      "customer@example.com",
    );

    assert.equal(
      mapped[WIX_FIELDS.quotes.customer],
      "customer-1",
    );
  },
);
