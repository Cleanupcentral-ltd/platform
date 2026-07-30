import assert from "node:assert/strict";
import test from "node:test";

import {
  QUOTE_ATTACHMENT_POLICY,
} from "../src/application/validation/quote-attachment.js";

import { submitQuoteSchema } from "../src/application/validation/submit-quote.js";

const zeroRooms = {
  Bathroom: 0,
  Bedroom: 0,
  Kitchen: 0,
  "Living Room": 0,
  Hallway: 0,
  Stairs: 0,
};

const zeroExtras = {
  Oven: 0,
  Fridge: 0,
  "Interior Windows": 0,
  "Grout Cleaning": 0,
  Laundry: 0,
  "Standard Consumables Package": 0,
};

function validResidentialSubmission() {
  return {
    submissionId:
      "11111111-1111-4111-8111-111111111111",

    schemaVersion: "1.0",

    customer: {
      fullName: "Prince Example",
      companyName: "",
      email: "prince@example.com",
      phone: "07123 456789",
      declaredCustomerType: "New customer",
      preferredContactMethod: "Email",
      privacyConsent: true,
      marketingConsent: false,
    },

    property: {
      propertyType: "House",
      address: "14 Example Avenue, London",
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
      rooms: zeroRooms,
      extras: zeroExtras,
      currentCondition: "",
      requirements: "",
    },

    safetyWarnings: "",
    additionalNotes: "",
    attachmentCount: 0,
  };
}

test("accepts a valid residential quote", () => {
  const result = submitQuoteSchema.safeParse(
    validResidentialSubmission(),
  );

  assert.equal(result.success, true);
});

test("rejects unexpected fields", () => {
  const submission = {
    ...validResidentialSubmission(),
    browserControlledPrice: 1,
  };

  const result =
    submitQuoteSchema.safeParse(submission);

  assert.equal(result.success, false);
});

test("requires a room for Selected Rooms", () => {
  const submission =
    validResidentialSubmission();

  submission.service.cleaningScope =
    "Selected Rooms";

  const result =
    submitQuoteSchema.safeParse(submission);

  assert.equal(result.success, false);
});

test("requires photos for End of Tenancy", () => {
  const submission =
    validResidentialSubmission();

  submission.service.serviceType =
    "End of Tenancy";

  submission.service.cleaningScope = "";

  const result =
    submitQuoteSchema.safeParse(submission);

  assert.equal(result.success, false);
});

test("requires photos for Dirty Airbnb", () => {
  const submission =
    validResidentialSubmission();

  const result = submitQuoteSchema.safeParse({
    ...submission,

    service: {
      category: "Airbnb Turnover",
      serviceType: "Airbnb Turnover",
      airbnbCondition: "Dirty",
      extras: zeroExtras,
    },

    attachmentCount: 0,
  });

  assert.equal(result.success, false);
});

test("keeps Property Support Not Sure exclusive", () => {
  const submission =
    validResidentialSubmission();

  const result = submitQuoteSchema.safeParse({
    ...submission,

    appointment: {
      ...submission.appointment,
      preferredDate: "",
      arrivalWindow: "",
      preferredStartDate: "2026-08-15",
    },

    service: {
      category: "Property Support",
      serviceType: "Property Support",

      supportServices: [
        "Not Sure",
        "Key Holding",
      ],

      requirements:
        "I need support with property access.",

      operationalRequirements: "",

      arrangement: "One-off",

      frequency: "",

      otherFrequency: "",

      urgency: "Standard",
    },
  });

  assert.equal(result.success, false);
});

test("requires frequency for recurring commercial work", () => {
  const submission =
    validResidentialSubmission();

  const result = submitQuoteSchema.safeParse({
    ...submission,

    appointment: {
      ...submission.appointment,
      preferredDate: "",
      arrivalWindow: "",
      preferredStartDate: "2026-08-15",
    },

    service: {
      category: "Commercial Cleaning",
      serviceType: "Commercial Cleaning",

      premisesDescription:
        "A small office building.",

      currentCondition:
        "Currently occupied and maintained.",

      requirements:
        "General office cleaning.",

      operationalRequirements: "",

      arrangement: "Recurring",

      frequency: "",

      otherFrequency: "",

      preferredSchedule:
        "Weekday evenings.",
    },
  });

  assert.equal(result.success, false);
});

test("rejects more than the attachment limit", () => {
  const result =
    submitQuoteSchema.safeParse({
      ...validResidentialSubmission(),

      attachmentCount:
        QUOTE_ATTACHMENT_POLICY
          .maxFiles + 1,
    });

  assert.equal(result.success, false);
});
