import assert from "node:assert/strict";
import test from "node:test";

import {
  createBackendQuotePayload,
} from "../src/app/quoteRequestMapper.js";

const rooms = {
  Bathroom: 0,
  Bedroom: 0,
  Kitchen: 0,
  "Living Room": 0,
  Hallway: 0,
  Stairs: 0,
};

const extras = {
  Oven: 0,
  Fridge: 0,
  "Interior Windows": 0,
  "Grout Cleaning": 0,
  Laundry: 0,
  "Standard Consumables Package": 0,
};

function baseData(overrides = {}) {
  return {
    category: "Residential Cleaning",
    propertyType: "House",
    serviceType: "Standard Clean",
    cleaningScope: "Whole Property",
    bedrooms: 1,
    bathrooms: 1,
    rooms,
    extras,
    airbnbCondition: "",
    premisesDescription: "",
    currentCondition: "",
    requirements: "",
    operationalRequirements: "",
    supportServices: [],
    propertyCount: 1,
    propertyStatus: "",
    arrangement: "One-off",
    frequency: "",
    otherFrequency: "",
    preferredSchedule: "",
    address: "10 Example Street",
    postcode: "AB1 2CD",
    preferredDate: "2026-08-14",
    arrivalWindow: "14:00–17:00",
    preferredStartDate: "",
    requiredCompletionDate: "",
    parkingDetails: "",
    pets: "",
    accessNotes: "",
    sameDay: false,
    urgency: "Standard",
    fullName: "Test Customer",
    email: "TEST@example.com",
    phone: "07123456789",
    company: "",
    customerType: "New customer",
    preferredContactMethod: "Email",
    privacyConsent: true,
    safetyWarnings: "",
    additionalNotes: "",
    files: [],
    ...overrides,
  };
}

test("maps a residential request to the strict backend contract", () => {
  const payload = createBackendQuotePayload(
    baseData(),
    { estimatedTotal: 68 },
  );

  assert.deepEqual(Object.keys(payload).sort(), [
    "additionalNotes",
    "appointment",
    "attachmentCount",
    "clientEstimate",
    "customer",
    "property",
    "safetyWarnings",
    "schemaVersion",
    "service",
  ]);

  assert.equal(payload.customer.email, "test@example.com");
  assert.equal(payload.customer.declaredCustomerType, "New customer");
  assert.equal(payload.appointment.arrivalWindow, "14:00–17:00");
  assert.equal(payload.service.category, "Residential Cleaning");
  assert.equal(payload.service.serviceType, "Standard Clean");
  assert.equal(payload.service.cleaningScope, "Whole Property");
  assert.equal(payload.clientEstimate.estimatedTotal, 68);
});

test("maps Airbnb, Commercial and Property Support service shapes", () => {
  const airbnb = createBackendQuotePayload(baseData({
    category: "Airbnb Turnover",
    serviceType: "",
    airbnbCondition: "Dirty",
    files: [{ name: "room.jpg" }],
  }));
  assert.equal(airbnb.service.serviceType, "Airbnb Turnover");
  assert.equal(airbnb.attachmentCount, 1);

  const commercial = createBackendQuotePayload(baseData({
    category: "Commercial Cleaning",
    premisesDescription: "Office",
    currentCondition: "Good",
    requirements: "Weekly clean",
    arrangement: "Recurring",
    frequency: "Weekly",
    preferredSchedule: "Friday evenings",
    preferredStartDate: "2026-08-20",
  }));
  assert.equal(commercial.service.category, "Commercial Cleaning");
  assert.equal(commercial.service.frequency, "Weekly");

  const support = createBackendQuotePayload(baseData({
    category: "Property Support",
    supportServices: ["Key Holding"],
    requirements: "Hold keys",
    propertyStatus: "Vacant",
    preferredStartDate: "2026-08-20",
  }));
  assert.equal(support.service.category, "Property Support");
  assert.deepEqual(support.service.supportServices, ["Key Holding"]);
});
