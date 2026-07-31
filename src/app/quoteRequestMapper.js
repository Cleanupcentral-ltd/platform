import { PRICING_VERSION } from "./quotePayload.js";

const clean = (value) =>
  typeof value === "string" ? value.trim() : "";

function mapService(data) {
  if (data.category === "Residential Cleaning") {
    return {
      category: "Residential Cleaning",
      serviceType: data.serviceType,
      cleaningScope: data.cleaningScope || "",
      rooms: data.rooms,
      extras: data.extras,
      currentCondition: clean(data.currentCondition),
      requirements: clean(data.requirements),
    };
  }

  if (data.category === "Airbnb Turnover") {
    return {
      category: "Airbnb Turnover",
      serviceType: "Airbnb Turnover",
      airbnbCondition: data.airbnbCondition,
      extras: data.extras,
    };
  }

  if (data.category === "Commercial Cleaning") {
    return {
      category: "Commercial Cleaning",
      serviceType: "Commercial Cleaning",
      premisesDescription: clean(data.premisesDescription),
      currentCondition: clean(data.currentCondition),
      requirements: clean(data.requirements),
      operationalRequirements: clean(data.operationalRequirements),
      arrangement: data.arrangement,
      frequency:
        data.arrangement === "Recurring"
          ? data.frequency || ""
          : "",
      otherFrequency:
        String(data.frequency || "").startsWith("Other")
          ? clean(data.otherFrequency)
          : "",
      preferredSchedule: clean(data.preferredSchedule),
    };
  }

  return {
    category: "Property Support",
    serviceType: "Property Support",
    supportServices: data.supportServices,
    requirements: clean(data.requirements),
    operationalRequirements: clean(data.operationalRequirements),
    arrangement: data.arrangement,
    frequency:
      data.arrangement === "Recurring"
        ? data.frequency || ""
        : "",
    otherFrequency:
      data.frequency === "Other"
        ? clean(data.otherFrequency)
        : "",
    urgency: data.urgency || "Standard",
  };
}

export function createBackendQuotePayload(data, estimate) {
  const postcode = clean(data.postcode) || "Not supplied";

  return {
    schemaVersion: "1.0",
    customer: {
      fullName: clean(data.fullName),
      companyName: clean(data.company),
      email: clean(data.email).toLowerCase(),
      phone: clean(data.phone),
      declaredCustomerType: data.customerType,
      preferredContactMethod: data.preferredContactMethod,
      privacyConsent: Boolean(data.privacyConsent),
      marketingConsent: false,
    },
    property: {
      propertyType:
        data.propertyType === "Other / Not sure"
          ? ""
          : data.propertyType || "",
      address:
        clean(data.address) ||
        clean(data.premisesDescription),
      postcode,
      bedrooms: Number(data.bedrooms) || 0,
      bathrooms: Number(data.bathrooms) || 0,
      propertyCount: Number(data.propertyCount) || 1,
      propertyStatus: data.propertyStatus || "",
      parkingDetails: clean(data.parkingDetails),
      petsDetails: clean(data.pets),
      accessArrangements: clean(data.accessNotes),
    },
    appointment: {
      preferredDate: data.preferredDate || "",
      arrivalWindow: data.arrivalWindow || "",
      preferredStartDate: data.preferredStartDate || "",
      requiredCompletionDate:
        data.requiredCompletionDate || "",
      sameDay: Boolean(data.sameDay),
    },
    service: mapService(data),
    safetyWarnings: clean(data.safetyWarnings),
    additionalNotes: clean(data.additionalNotes),
    attachmentCount: Array.isArray(data.files)
      ? data.files.length
      : 0,
    ...(estimate
      ? {
          clientEstimate: {
            pricingVersion: PRICING_VERSION,
            estimatedTotal: Number(
              estimate.estimatedTotal,
            ),
          },
        }
      : {}),
  };
}
