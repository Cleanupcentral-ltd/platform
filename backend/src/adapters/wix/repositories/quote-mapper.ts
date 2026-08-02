import {
  ApplicationError,
} from "../../../domain/errors.js";

import type {
  CreateQuoteRecord,
  QuoteRecord,
} from "../../../domain/models.js";

import {
  ARRANGEMENTS,
  ARRIVAL_WINDOWS,
  CLEANING_SCOPES,
  CUSTOMER_VERIFICATION_STATUSES,
  DECLARED_CUSTOMER_TYPES,
  PREFERRED_CONTACT_METHODS,
  QUOTE_CATEGORIES,
  QUOTE_STATUSES,
  SUPPORT_SERVICES,
  URGENCY_LEVELS,
  type SupportService,
} from "../../../domain/quote-values.js";

import {
  WIX_FIELDS,
} from "../collections.js";

import type {
  WixDataItem,
} from "../wix-data-types.js";

import {
  readNullableEnumValue,
  readNullableNumber,
  readNullableString,
  requireBoolean,
  requireEnumValue,
  requireRecord,
  requireReferenceId,
  requireString,
  requireStringArray,
} from "../wix-value-readers.js";

const fields = WIX_FIELDS.quotes;

function readSupportServices(
  item: WixDataItem,
): readonly SupportService[] {
  const values = requireStringArray(
    item.data,
    fields.supportServices,
  );

  const invalidValues = values.filter(
    (value) =>
      !SUPPORT_SERVICES.includes(
        value as SupportService,
      ),
  );

  if (invalidValues.length > 0) {
    throw new ApplicationError({
      code: "STORAGE_ERROR",
      message:
        "Wix returned invalid property-support services.",
      statusCode: 502,
      details: {
        invalidValues,
      },
    });
  }

  return values as readonly SupportService[];
}

function submittedCustomerText(
  quote: CreateQuoteRecord,
  fieldName: string,
  fieldLabel: string,
): string {
  const customer =
    quote.rawSubmission["customer"];

  if (
    typeof customer !== "object" ||
    customer === null ||
    Array.isArray(customer)
  ) {
    throw new ApplicationError({
      code: "STORAGE_ERROR",
      message:
        "The quote submission does not contain customer details.",
      statusCode: 500,
    });
  }

  const value = (
    customer as Readonly<
      Record<string, unknown>
    >
  )[fieldName];

  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new ApplicationError({
      code: "STORAGE_ERROR",
      message:
        `The quote submission does not contain a customer ${fieldLabel}.`,
      statusCode: 500,
    });
  }

  return value.trim();
}

function submittedCustomerEmail(
  quote: CreateQuoteRecord,
): string {
  return submittedCustomerText(
    quote,
    "email",
    "email address",
  ).toLowerCase();
}

export function mapQuoteFromWix(
  item: WixDataItem,
): QuoteRecord {
  return {
    id: item.id,

    submissionId: requireString(
      item.data,
      fields.submissionId,
    ),

    quoteNumber: requireString(
      item.data,
      fields.quoteNumber,
    ),

    customerId: requireReferenceId(
      item.data,
      fields.customer,
    ),

    propertyId: requireReferenceId(
      item.data,
      fields.property,
    ),

    schemaVersion: requireString(
      item.data,
      fields.schemaVersion,
    ),

    pricingVersion: requireString(
      item.data,
      fields.pricingVersion,
    ),

    status: requireEnumValue(
      item.data,
      fields.status,
      QUOTE_STATUSES,
    ),

    category: requireEnumValue(
      item.data,
      fields.quoteCategory,
      QUOTE_CATEGORIES,
    ),

    serviceType: requireString(
      item.data,
      fields.serviceType,
    ),

    cleaningScope:
      readNullableEnumValue(
        item.data,
        fields.cleaningScope,
        CLEANING_SCOPES,
      ),

    declaredCustomerType:
      requireEnumValue(
        item.data,
        fields.declaredCustomerType,
        DECLARED_CUSTOMER_TYPES,
      ),

    verifiedCustomerStatus:
      requireEnumValue(
        item.data,
        fields.verifiedCustomerStatus,
        CUSTOMER_VERIFICATION_STATUSES,
      ),

    customerStatusMismatch:
      requireBoolean(
        item.data,
        fields.customerStatusMismatch,
      ),

    preferredContactMethod:
      requireEnumValue(
        item.data,
        fields.preferredContactMethod,
        PREFERRED_CONTACT_METHODS,
      ),

    preferredDate: readNullableString(
      item.data,
      fields.preferredDate,
    ),

    arrivalWindow:
      readNullableEnumValue(
        item.data,
        fields.arrivalWindow,
        ARRIVAL_WINDOWS,
      ),

    preferredStartDate:
      readNullableString(
        item.data,
        fields.preferredStartDate,
      ),

    requiredCompletionDate:
      readNullableString(
        item.data,
        fields.requiredCompletionDate,
      ),

    sameDay: requireBoolean(
      item.data,
      fields.sameDay,
    ),

    arrangement:
      readNullableEnumValue(
        item.data,
        fields.arrangement,
        ARRANGEMENTS,
      ),

    frequency: readNullableString(
      item.data,
      fields.frequency,
    ),

    urgency: readNullableEnumValue(
      item.data,
      fields.urgency,
      URGENCY_LEVELS,
    ),

    supportServices:
      readSupportServices(item),

    manualReviewRequired:
      requireBoolean(
        item.data,
        fields.manualReviewRequired,
      ),

    manualReviewReasons:
      requireStringArray(
        item.data,
        fields.manualReviewReasons,
      ),

    estimatedTotal:
      readNullableNumber(
        item.data,
        fields.estimatedTotal,
      ),

    requiredUpfrontPercentage:
      readNullableNumber(
        item.data,
        fields.requiredUpfrontPercentage,
      ),

    requiredUpfrontAmount:
      readNullableNumber(
        item.data,
        fields.requiredUpfrontAmount,
      ),

    remainingBalance:
      readNullableNumber(
        item.data,
        fields.remainingBalance,
      ),

    travelFee: readNullableNumber(
      item.data,
      fields.travelFee,
    ),

    travelPending: requireBoolean(
      item.data,
      fields.travelPending,
    ),

    distanceMiles: readNullableNumber(
      item.data,
      fields.distanceMiles,
    ),

    provisional: requireBoolean(
      item.data,
      fields.provisional,
    ),

    customerNotes: readNullableString(
      item.data,
      fields.customerNotes,
    ),

    rawSubmission: requireRecord(
      item.data,
      fields.rawSubmission,
    ),

    pricingSnapshot: requireRecord(
      item.data,
      fields.pricingSnapshot,
    ),
  };
}

export function mapQuoteCreateToWix(
  quote: CreateQuoteRecord,
): Readonly<Record<string, unknown>> {
  return {
    [fields.submissionId]:
      quote.submissionId,

    [fields.quoteNumber]:
      quote.quoteNumber,

    [fields.customer]:
      quote.customerId,

    [fields.customerEmail]:
      submittedCustomerEmail(quote),

    [fields.customerPhone]:
      submittedCustomerText(
        quote,
        "phone",
        "phone number",
      ),

    [fields.property]:
      quote.propertyId,

    [fields.schemaVersion]:
      quote.schemaVersion,

    [fields.pricingVersion]:
      quote.pricingVersion,

    [fields.status]:
      quote.status,

    [fields.quoteCategory]:
      quote.category,

    [fields.serviceType]:
      quote.serviceType,

    [fields.cleaningScope]:
      quote.cleaningScope,

    [fields.declaredCustomerType]:
      quote.declaredCustomerType,

    [fields.verifiedCustomerStatus]:
      quote.verifiedCustomerStatus,

    [fields.customerStatusMismatch]:
      quote.customerStatusMismatch,

    [fields.preferredContactMethod]:
      quote.preferredContactMethod,

    [fields.preferredDate]:
      quote.preferredDate,

    [fields.arrivalWindow]:
      quote.arrivalWindow,

    [fields.preferredStartDate]:
      quote.preferredStartDate,

    [fields.requiredCompletionDate]:
      quote.requiredCompletionDate,

    [fields.sameDay]:
      quote.sameDay,

    [fields.arrangement]:
      quote.arrangement,

    [fields.frequency]:
      quote.frequency,

    [fields.urgency]:
      quote.urgency,

    [fields.supportServices]:
      quote.supportServices,

    [fields.manualReviewRequired]:
      quote.manualReviewRequired,

    [fields.manualReviewReasons]:
      quote.manualReviewReasons,

    [fields.estimatedTotal]:
      quote.estimatedTotal,

    [fields.requiredUpfrontPercentage]:
      quote.requiredUpfrontPercentage,

    [fields.requiredUpfrontAmount]:
      quote.requiredUpfrontAmount,

    [fields.remainingBalance]:
      quote.remainingBalance,

    [fields.travelFee]:
      quote.travelFee,

    [fields.travelPending]:
      quote.travelPending,

    [fields.distanceMiles]:
      quote.distanceMiles,

    [fields.provisional]:
      quote.provisional,

    [fields.customerNotes]:
      quote.customerNotes,

    [fields.rawSubmission]:
      quote.rawSubmission,

    [fields.pricingSnapshot]:
      quote.pricingSnapshot,
  };
}
