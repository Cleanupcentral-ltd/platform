import { calculateSelectedRoomsEstimate, calculateWholePropertyEstimate } from "./pricing.js";

export const PRICING_VERSION = "CUC Phase 0 v1.4";

const clean = (value) => typeof value === "string" ? value.trim() : value;

export function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export function validatePhone(value) {
  return /^[+()\d\s-]{7,20}$/.test(String(value || "").trim());
}

export function manualReviewReasons(data, { distanceMiles = null, priceManuallyAdjusted = false, bankHoliday = false } = {}) {
  const reasons = [];
  if (data.customerType === "New customer") reasons.push("New customer's first quote");
  if (data.category === "Commercial Cleaning") reasons.push("Commercial cleaning");
  if (data.category === "Property Support") reasons.push("Property Support");
  if (data.serviceType === "End of Tenancy") reasons.push("End of Tenancy");
  if (data.category === "Airbnb Turnover" && data.airbnbCondition === "Dirty") reasons.push("Dirty Airbnb condition");
  const today = new Date().toISOString().slice(0, 10);
  if (data.sameDay || data.preferredDate === today) reasons.push("Same-day booking");
  if (Number(data.bedrooms) >= 4) reasons.push("4+ bedroom property");
  if (distanceMiles === null || distanceMiles === undefined) reasons.push("Unknown service-area distance");
  else if (Number(distanceMiles) > 30) reasons.push("More than 30 miles from both origin postcodes");
  if (clean(data.safetyWarnings)) reasons.push("Unsafe-condition warning");
  if (clean(data.additionalNotes)) reasons.push("Customer notes require review");
  const photosRequired = data.serviceType === "End of Tenancy" || (data.category === "Airbnb Turnover" && data.airbnbCondition === "Dirty");
  if (photosRequired && !(data.files || []).length) reasons.push("Required photos missing");
  if (priceManuallyAdjusted) reasons.push("Price manually adjusted");
  if (bankHoliday) reasons.push("Bank-holiday booking");
  return [...new Set(reasons)];
}

export function calculateEstimate(data, travelFee = null) {
  if (data.category === "Residential Cleaning" && data.cleaningScope === "Selected Rooms") {
    return calculateSelectedRoomsEstimate({
      cleaningLevel: data.serviceType,
      rooms: data.rooms,
      extras: data.extras,
      isNewCustomer: data.customerType === "New customer",
      travelFee,
    });
  }
  if (data.category === "Residential Cleaning" && data.serviceType !== "End of Tenancy") {
    return calculateWholePropertyEstimate({
      service: data.serviceType,
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      extras: data.extras,
      isNewCustomer: data.customerType === "New customer",
      travelFee,
    });
  }
  if (data.category === "Airbnb Turnover") {
    return calculateWholePropertyEstimate({
      service: "Airbnb Turnover",
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      extras: data.extras,
      isNewCustomer: data.customerType === "New customer",
      airbnbCondition: data.airbnbCondition,
      travelFee,
    });
  }
  return null;
}

export function createQuotePayload(data, options = {}) {
  const estimate = calculateEstimate(data, options.travelFee ?? null);
  const reasons = manualReviewReasons(data, options);
  return {
    schemaVersion: "1.0",
    pricingVersion: PRICING_VERSION,
    quoteCategory: data.category,
    serviceType: data.serviceType || data.category,
    cleaningScope: data.cleaningScope || null,
    property: {
      propertyType: data.propertyType === "Other / Not sure" ? clean(data.propertyTypeOther) || data.propertyType : data.propertyType || null,
      bedrooms: Number(data.bedrooms) || 0,
      bathrooms: Number(data.bathrooms) || 0,
      selectedRooms: data.rooms,
      address: clean(data.address),
      postcode: clean(data.postcode),
      pets: data.pets || null,
      condition: clean(data.currentCondition) || data.airbnbCondition || null,
      propertyCount: Number(data.propertyCount) || 1,
      occupancyStatus: data.propertyStatus || null,
    },
    appointment: {
      preferredDate: data.preferredDate || null,
      preferredArrivalWindow: data.arrivalWindow || null,
      preferredStartDate: data.preferredStartDate || null,
      requiredCompletionDate: data.requiredCompletionDate || null,
      sameDay: Boolean(data.sameDay),
      parkingDetails: clean(data.parkingDetails),
      accessNotes: clean(data.accessNotes),
    },
    customer: {
      fullName: clean(data.fullName),
      email: clean(data.email)?.toLowerCase(),
      phone: clean(data.phone),
      company: clean(data.company),
      customerType: data.customerType || null,
      preferredContactMethod: data.preferredContactMethod || null,
      privacyConsent: Boolean(data.privacyConsent),
    },
    serviceDetails: {
      extras: data.extras,
      airbnbCondition: data.airbnbCondition || null,
      premisesDescription: clean(data.premisesDescription),
      requirements: clean(data.requirements),
      operationalRequirements: clean(data.operationalRequirements),
      supportServices: data.supportServices || [],
      arrangement: data.arrangement || null,
      frequency: data.arrangement === "Recurring" ? data.frequency || null : null,
      otherFrequency: String(data.frequency || "").startsWith("Other") ? clean(data.otherFrequency) : null,
      preferredSchedule: clean(data.preferredSchedule),
      urgency: data.urgency || null,
      safetyWarnings: clean(data.safetyWarnings),
      additionalNotes: clean(data.additionalNotes),
    },
    media: (data.files || []).map((file) => ({ name: file.name, type: file.type, size: file.size, lastModified: file.lastModified })),
    pricingSnapshot: estimate,
    travel: { distanceMiles: options.distanceMiles ?? null, fee: options.travelFee ?? null, pendingReview: options.distanceMiles == null || Number(options.distanceMiles) > 30 },
    manualReviewRequired: reasons.length > 0,
    manualReviewReasons: reasons,
    status: "Submitted",
    submittedAt: options.submittedAt || new Date().toISOString(),
  };
}
