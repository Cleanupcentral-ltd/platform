import assert from "node:assert/strict";
import { createQuotePayload, manualReviewReasons, PRICING_VERSION, validateEmail, validatePhone } from "../src/app/quotePayload.js";

const base = {
  category: "Residential Cleaning", serviceType: "Standard Clean", cleaningScope: "Whole Property",
  propertyType: "House", bedrooms: 2, bathrooms: 2,
  rooms: { Bathroom: 0, Bedroom: 0, Kitchen: 0, "Living Room": 0, Hallway: 0, Stairs: 0 },
  extras: { Oven: 1 }, customerType: "New customer", airbnbCondition: "",
  address: "1 Test Road", postcode: "BR1 1AA", pets: "No", currentCondition: "",
  propertyCount: 1, preferredDate: "2026-08-01", arrivalWindow: "08:00–11:00", sameDay: false,
  parkingDetails: "", accessNotes: "", preferredStartDate: "", requiredCompletionDate: "",
  fullName: "Test Customer", email: "TEST@example.com", phone: "07123456789", company: "",
  preferredContactMethod: "Email", privacyConsent: true, premisesDescription: "", requirements: "",
  operationalRequirements: "", supportServices: [], arrangement: "One-off", frequency: "", otherFrequency: "",
  propertyStatus: "", preferredSchedule: "", urgency: "Standard", safetyWarnings: "", additionalNotes: "", files: [],
};

const payload = createQuotePayload(base, { submittedAt: "2026-07-22T12:00:00.000Z" });
assert.equal(payload.pricingVersion, PRICING_VERSION);
assert.equal(payload.customer.email, "test@example.com");
assert.equal(payload.pricingSnapshot.discountBase, 130);
assert.equal(payload.pricingSnapshot.discountAmount, 19.5);
assert.equal(payload.pricingSnapshot.extrasCharge, 50);
assert.equal(payload.manualReviewRequired, true);
assert.deepEqual(payload.manualReviewReasons, ["New customer's first quote", "Unknown service-area distance"]);

const support = {
  ...base,
  category: "Property Support",
  serviceType: "",
  customerType: "Existing customer",
  supportServices: ["Not Sure"],
  propertyStatus: "Short-let / holiday let",
  arrangement: "Recurring",
  frequency: "Other / Not sure",
  otherFrequency: "Seasonal schedule",
};
const supportPayload = createQuotePayload(support, { distanceMiles: 5, submittedAt: "2026-07-22T12:00:00.000Z" });
assert.equal(supportPayload.property.occupancyStatus, "Short-let / holiday let");
assert.equal(supportPayload.serviceDetails.otherFrequency, "Seasonal schedule");
assert.deepEqual(supportPayload.serviceDetails.supportServices, ["Not Sure"]);

const dirty = { ...base, category: "Airbnb Turnover", serviceType: "", airbnbCondition: "Dirty", customerType: "Existing customer", bedrooms: 1, bathrooms: 1 };
assert.deepEqual(manualReviewReasons(dirty), ["Dirty Airbnb condition", "Unknown service-area distance", "Required photos missing"]);

const existingKnown = { ...base, customerType: "Existing customer" };
assert.deepEqual(manualReviewReasons(existingKnown, { distanceMiles: 8 }), []);
const beyondArea = createQuotePayload(existingKnown, { distanceMiles: 31, travelFee: null, submittedAt: "2026-07-22T12:00:00.000Z" });
assert.equal(beyondArea.travel.pendingReview, true);
assert.equal(beyondArea.manualReviewReasons.includes("More than 30 miles from both origin postcodes"), true);
const flexibleType = createQuotePayload({ ...existingKnown, propertyType: "Other / Not sure", propertyTypeOther: "Maisonette" }, { distanceMiles: 8 });
assert.equal(flexibleType.property.propertyType, "Maisonette");
assert.equal(validateEmail("person@example.com"), true);
assert.equal(validateEmail("not-an-email"), false);
assert.equal(validatePhone("+44 7123 456789"), true);
assert.equal(validatePhone("12"), false);

console.log("Quote payload tests passed: snapshot, discount, media boundary, validation and manual-review reasons.");
