import assert from "node:assert/strict";
import test from "node:test";

import {
  createQuoteContextResolver,
} from "../src/application/resolve-quote-context.js";

import type {
  SubmitQuoteRequest,
} from "../src/application/validation/submit-quote.js";

import type {
  CustomerRecord,
  PropertyRecord,
} from "../src/domain/models.js";

function validSubmission():
  SubmitQuoteRequest {
  return {
    submissionId:
      "11111111-1111-4111-8111-111111111111",

    schemaVersion: "1.0",

    customer: {
      fullName: "Prince Example",
      companyName: "",
      email: "Prince@Example.com",
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

function customer(
  overrides:
    Partial<CustomerRecord> = {},
): CustomerRecord {
  return {
    id: "customer-1",
    fullName: "Prince Example",
    companyName: null,
    email: "princess@example.com",

    emailNormalized:
      "prince@example.com",

    phone: "07123 456789",

    phoneNormalized:
      "447123456789",

    declaredCustomerType:
      "Existing customer",

    verificationStatus:
      "Verified Existing",

    isExistingCustomer: true,

    firstEligibleCleanCompleted:
      true,

    privacyConsent: true,
    marketingConsent: false,
    internalNotes: null,

    ...overrides,
  };
}

function property(
  overrides:
    Partial<PropertyRecord> = {},
): PropertyRecord {
  return {
    id: "property-1",
    customerId: "customer-1",

    propertyLabel:
      "14 Example Avenue",

    address:
      "14 Example Avenue, London",

    postcode: "NW1 1HN",

    postcodeNormalized:
      "NW11HN",

    propertyType: "House",
    bedroomCount: 2,
    bathroomCount: 1,

    occupancyStatus:
      "Occupied",

    parkingDetails: null,
    petsDetails: null,

    accessArrangements:
      null,

    verifiedProperty: true,
    activeProperty: true,

    ...overrides,
  };
}

test(
  "resolves a new customer and defers property lookup",
  async () => {
    let propertyQueries = 0;

    const resolver =
      createQuoteContextResolver({
        customers: {
          async findByNormalizedEmail() {
            return [];
          },

          async findByNormalizedPhone() {
            return [];
          },
        },

        properties: {
          async findByCustomerAndPostcode() {
            propertyQueries += 1;
            return [];
          },
        },
      });

    const result =
      await resolver.resolve(
        validSubmission(),
      );

    assert.equal(
      result.customer.kind,
      "no-match",
    );

    assert.equal(
      result.customer
        .verifiedCustomerStatus,
      "Verified New",
    );

    assert.equal(
      result.customer
        .customerStatusMismatch,
      false,
    );

    assert.equal(
      result.customer
        .normalizedEmail,
      "prince@example.com",
    );

    assert.equal(
      result.customer
        .normalizedPhone,
      "447123456789",
    );

    assert.equal(
      result.property.kind,
      "deferred",
    );

    assert.equal(
      propertyQueries,
      0,
    );

    assert.deepEqual(
      result.reviewReasons,
      ["NEW_CUSTOMER"],
    );
  },
);

test(
  "flags an existing customer declaration when no record matches",
  async () => {
    const resolver =
      createQuoteContextResolver({
        customers: {
          async findByNormalizedEmail() {
            return [];
          },

          async findByNormalizedPhone() {
            return [];
          },
        },

        properties: {
          async findByCustomerAndPostcode() {
            return [];
          },
        },
      });

    const submission =
      validSubmission();

    submission.customer
      .declaredCustomerType =
        "Existing customer";

    const result =
      await resolver.resolve(
        submission,
      );

    assert.equal(
      result.customer
        .verifiedCustomerStatus,
      "Review Required",
    );

    assert.equal(
      result.customer
        .customerStatusMismatch,
      true,
    );

    assert.deepEqual(
      result.reviewReasons,
      [
        "DECLARED_EXISTING_CUSTOMER_NOT_FOUND",
      ],
    );
  },
);

test(
  "matches one verified customer and one exact property",
  async () => {
    const existingCustomer =
      customer();

    const existingProperty =
      property();

    const resolver =
      createQuoteContextResolver({
        customers: {
          async findByNormalizedEmail() {
            return [
              existingCustomer,
            ];
          },

          async findByNormalizedPhone() {
            return [
              existingCustomer,
            ];
          },
        },

        properties: {
          async findByCustomerAndPostcode(
            customerId,
            postcode,
          ) {
            assert.equal(
              customerId,
              "customer-1",
            );

            assert.equal(
              postcode,
              "NW11HN",
            );

            return [
              existingProperty,
            ];
          },
        },
      });

    const submission =
      validSubmission();

    submission.customer
      .declaredCustomerType =
        "Existing customer";

    const result =
      await resolver.resolve(
        submission,
      );

    assert.equal(
      result.customer.kind,
      "matched",
    );

    assert.equal(
      result.customer.matchedBy,
      "email-and-phone",
    );

    assert.equal(
      result.customer.requiresReview,
      false,
    );

    assert.equal(
      result.property.kind,
      "matched",
    );

    assert.equal(
      result.property.property?.id,
      "property-1",
    );

    assert.equal(
      result.requiresReview,
      false,
    );

    assert.deepEqual(
      result.reviewReasons,
      [],
    );
  },
);

test(
  "requires review for a partial customer match",
  async () => {
    const existingCustomer =
      customer();

    const resolver =
      createQuoteContextResolver({
        customers: {
          async findByNormalizedEmail() {
            return [
              existingCustomer,
            ];
          },

          async findByNormalizedPhone() {
            return [];
          },
        },

        properties: {
          async findByCustomerAndPostcode() {
            return [property()];
          },
        },
      });

    const submission =
      validSubmission();

    submission.customer
      .declaredCustomerType =
        "Existing customer";

    const result =
      await resolver.resolve(
        submission,
      );

    assert.equal(
      result.customer.matchedBy,
      "email",
    );

    assert.equal(
      result.customer
        .verifiedCustomerStatus,
      "Review Required",
    );

    assert.ok(
      result.reviewReasons.includes(
        "CUSTOMER_PARTIAL_MATCH",
      ),
    );
  },
);

test(
  "does not guess when email and phone identify different customers",
  async () => {
    let propertyQueries = 0;

    const resolver =
      createQuoteContextResolver({
        customers: {
          async findByNormalizedEmail() {
            return [
              customer({
                id: "customer-1",
              }),
            ];
          },

          async findByNormalizedPhone() {
            return [
              customer({
                id: "customer-2",
              }),
            ];
          },
        },

        properties: {
          async findByCustomerAndPostcode() {
            propertyQueries += 1;
            return [];
          },
        },
      });

    const result =
      await resolver.resolve(
        validSubmission(),
      );

    assert.equal(
      result.customer.kind,
      "conflict",
    );

    assert.equal(
      result.customer.customer,
      null,
    );

    assert.equal(
      result.property.kind,
      "deferred",
    );

    assert.equal(
      propertyQueries,
      0,
    );

    assert.deepEqual(
      result.reviewReasons,
      [
        "CUSTOMER_IDENTITY_CONFLICT",
      ],
    );
  },
);

test(
  "flags a postcode match with a different address",
  async () => {
    const existingCustomer =
      customer();

    const resolver =
      createQuoteContextResolver({
        customers: {
          async findByNormalizedEmail() {
            return [
              existingCustomer,
            ];
          },

          async findByNormalizedPhone() {
            return [
              existingCustomer,
            ];
          },
        },

        properties: {
          async findByCustomerAndPostcode() {
            return [
              property({
                address:
                  "16 Example Avenue, London",
              }),
            ];
          },
        },
      });

    const submission =
      validSubmission();

    submission.customer
      .declaredCustomerType =
        "Existing customer";

    const result =
      await resolver.resolve(
        submission,
      );

    assert.equal(
      result.property.kind,
      "no-match",
    );

    assert.equal(
      result.property
        .candidateCount,
      1,
    );

    assert.equal(
      result.property
        .requiresReview,
      true,
    );

    assert.ok(
      result.reviewReasons.includes(
        "PROPERTY_POSTCODE_COLLISION",
      ),
    );
  },
);