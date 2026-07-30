import {
  ApplicationError,
} from "../domain/errors.js";

import type {
  CreateCustomerRecord,
  CreatePropertyRecord,
  CreateQuoteRecord,
  CustomerRecord,
  PropertyRecord,
  QuoteItemRecord,
  QuoteRecord,
  StatusHistoryRecord,
  UpdateCustomerRecord,
  UpdatePropertyRecord,
} from "../domain/models.js";

import type {
  CleaningScope,
  QuoteStatus,
} from "../domain/quote-values.js";

import type {
  QuoteRepositories,
} from "../ports/repositories.js";

import type {
  QuotePricingDecision,
} from "./price-quote.js";

import type {
  QuoteResolutionContext,
} from "./resolve-quote-context.js";

export interface CreatedQuoteSubmission {
  readonly outcome: "created";
  readonly customer: CustomerRecord;
  readonly property: PropertyRecord;
  readonly quote: QuoteRecord;
  readonly quoteItems:
    readonly QuoteItemRecord[];
  readonly statusHistory:
    StatusHistoryRecord;
  readonly createdCustomer: boolean;
  readonly createdProperty: boolean;
}

export interface ReplayedQuoteSubmission {
  readonly outcome: "replayed";
  readonly quote: QuoteRecord;
}

export type PersistedQuoteSubmission =
  | CreatedQuoteSubmission
  | ReplayedQuoteSubmission;

export type QuotePersistenceRepositories =
  Pick<
    QuoteRepositories,
    | "customers"
    | "properties"
    | "quotes"
    | "quoteItems"
    | "statusHistory"
  >;

export interface QuotePersistenceService {
  persist(
    context: QuoteResolutionContext,
    pricing: QuotePricingDecision,
  ): Promise<PersistedQuoteSubmission>;
}

export interface QuotePersistenceOptions {
  readonly createQuoteNumber?: (
    submissionId: string,
  ) => string;

  readonly createQuoteId?: (
    submissionId: string,
  ) => string;

  readonly duplicatePollDelaysMs?:
    readonly number[];

  readonly wait?: (
    milliseconds: number,
  ) => Promise<void>;
}

interface Compensation {
  readonly label: string;
  readonly run: () => Promise<void>;
}

function uniqueReasons(
  reasons: readonly string[],
): readonly string[] {
  return [...new Set(reasons)];
}

function nullableText(
  value: string,
): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0
    ? trimmed
    : null;
}

function hasChanges(
  changes: Readonly<
    Record<string, unknown>
  >,
): boolean {
  return Object.keys(changes).length > 0;
}

function defaultQuoteNumber(
  submissionId: string,
): string {
  const compactId = submissionId
    .replaceAll("-", "")
    .slice(0, 12)
    .toUpperCase();

  return `CUC-Q-${compactId}`;
}

function defaultQuoteId(
  submissionId: string,
): string {
  return `quote-${submissionId}`;
}

function defaultWait(
  milliseconds: number,
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function canonicalValue(
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalValue);
  }

  if (
    typeof value === "object" &&
    value !== null
  ) {
    const entries = Object.entries(
      value as Readonly<
        Record<string, unknown>
      >,
    )
      .sort(([left], [right]) =>
        left.localeCompare(right),
      )
      .map(([key, entryValue]) => [
        key,
        canonicalValue(entryValue),
      ]);

    return Object.fromEntries(entries);
  }

  return value;
}

function sameSubmission(
  existingQuote: QuoteRecord,
  context: QuoteResolutionContext,
): boolean {
  return (
    JSON.stringify(
      canonicalValue(
        existingQuote.rawSubmission,
      ),
    ) ===
    JSON.stringify(
      canonicalValue(
        context.submission,
      ),
    )
  );
}

function duplicateSubmissionError(
  submissionId: string,
  quoteId: string,
): ApplicationError {
  return new ApplicationError({
    code: "DUPLICATE_SUBMISSION",
    message:
      "This submission ID has already been used for different quote information.",
    statusCode: 409,
    details: {
      submissionId,
      quoteId,
    },
  });
}

function submissionInProgressError(
  submissionId: string,
  quoteId: string,
): ApplicationError {
  return new ApplicationError({
    code: "CONFLICT",
    message:
      "This quote submission is still being processed. Please retry shortly.",
    statusCode: 409,
    details: {
      submissionId,
      quoteId,
    },
  });
}

function customerSnapshot(
  customer: CustomerRecord,
): UpdateCustomerRecord {
  return {
    fullName: customer.fullName,
    companyName: customer.companyName,
    email: customer.email,
    emailNormalized:
      customer.emailNormalized,
    phone: customer.phone,
    phoneNormalized:
      customer.phoneNormalized,
    declaredCustomerType:
      customer.declaredCustomerType,
    verificationStatus:
      customer.verificationStatus,
    isExistingCustomer:
      customer.isExistingCustomer,
    firstEligibleCleanCompleted:
      customer.firstEligibleCleanCompleted,
    privacyConsent:
      customer.privacyConsent,
    marketingConsent:
      customer.marketingConsent,
    internalNotes:
      customer.internalNotes,
  };
}

function propertySnapshot(
  property: PropertyRecord,
): UpdatePropertyRecord {
  return {
    customerId: property.customerId,
    propertyLabel:
      property.propertyLabel,
    address: property.address,
    postcode: property.postcode,
    postcodeNormalized:
      property.postcodeNormalized,
    propertyType:
      property.propertyType,
    bedroomCount:
      property.bedroomCount,
    bathroomCount:
      property.bathroomCount,
    occupancyStatus:
      property.occupancyStatus,
    parkingDetails:
      property.parkingDetails,
    petsDetails:
      property.petsDetails,
    accessArrangements:
      property.accessArrangements,
    verifiedProperty:
      property.verifiedProperty,
    activeProperty:
      property.activeProperty,
  };
}

function newCustomerRecord(
  context: QuoteResolutionContext,
): CreateCustomerRecord {
  const submission =
    context.submission.customer;

  return {
    fullName: submission.fullName,
    companyName:
      nullableText(
        submission.companyName,
      ),
    email: submission.email,
    emailNormalized:
      context.customer.normalizedEmail,
    phone: submission.phone,
    phoneNormalized:
      context.customer.normalizedPhone,
    declaredCustomerType:
      submission.declaredCustomerType,
    verificationStatus:
      context.customer
        .verifiedCustomerStatus,
    isExistingCustomer: false,
    firstEligibleCleanCompleted:
      false,
    privacyConsent:
      submission.privacyConsent,
    marketingConsent:
      submission.marketingConsent,
    internalNotes: null,
  };
}

function customerChanges(
  context: QuoteResolutionContext,
  customer: CustomerRecord,
): UpdateCustomerRecord {
  const submitted =
    context.submission.customer;

  const changes: Record<
    string,
    unknown
  > = {};

  if (!customer.privacyConsent) {
    changes["privacyConsent"] = true;
  }

  if (
    submitted.marketingConsent &&
    !customer.marketingConsent
  ) {
    changes["marketingConsent"] = true;
  }

  if (
    context.customer.matchedBy !==
    "email-and-phone"
  ) {
    return changes as UpdateCustomerRecord;
  }

  if (
    submitted.fullName !==
    customer.fullName
  ) {
    changes["fullName"] =
      submitted.fullName;
  }

  const companyName = nullableText(
    submitted.companyName,
  );

  if (
    companyName !== null &&
    companyName !== customer.companyName
  ) {
    changes["companyName"] =
      companyName;
  }

  if (submitted.email !== customer.email) {
    changes["email"] = submitted.email;
  }

  if (submitted.phone !== customer.phone) {
    changes["phone"] = submitted.phone;
  }

  if (
    submitted.declaredCustomerType !==
    customer.declaredCustomerType
  ) {
    changes["declaredCustomerType"] =
      submitted.declaredCustomerType;
  }

  return changes as UpdateCustomerRecord;
}

function newPropertyRecord(
  context: QuoteResolutionContext,
  customerId: string,
): CreatePropertyRecord {
  const property =
    context.submission.property;

  return {
    customerId,
    propertyLabel: property.address,
    address: property.address,
    postcode: property.postcode,
    postcodeNormalized:
      context.property
        .normalizedPostcode,
    propertyType:
      property.propertyType || null,
    bedroomCount:
      property.bedrooms,
    bathroomCount:
      property.bathrooms,
    occupancyStatus:
      nullableText(
        property.propertyStatus,
      ),
    parkingDetails:
      nullableText(
        property.parkingDetails,
      ),
    petsDetails:
      nullableText(
        property.petsDetails,
      ),
    accessArrangements:
      nullableText(
        property.accessArrangements,
      ),
    verifiedProperty: false,
    activeProperty: true,
  };
}

function propertyChanges(
  context: QuoteResolutionContext,
  property: PropertyRecord,
): UpdatePropertyRecord {
  const submitted =
    context.submission.property;

  const changes: Record<
    string,
    unknown
  > = {};

  if (submitted.address !== property.address) {
    changes["address"] =
      submitted.address;
  }

  if (submitted.postcode !== property.postcode) {
    changes["postcode"] =
      submitted.postcode;
  }

  if (
    context.property.normalizedPostcode !==
    property.postcodeNormalized
  ) {
    changes["postcodeNormalized"] =
      context.property.normalizedPostcode;
  }

  if (
    submitted.propertyType &&
    submitted.propertyType !==
      property.propertyType
  ) {
    changes["propertyType"] =
      submitted.propertyType;
  }

  const capturesRoomCounts =
    context.submission.service.category ===
      "Residential Cleaning" ||
    context.submission.service.category ===
      "Airbnb Turnover";

  if (
    capturesRoomCounts &&
    submitted.bedrooms !==
      property.bedroomCount
  ) {
    changes["bedroomCount"] =
      submitted.bedrooms;
  }

  if (
    capturesRoomCounts &&
    submitted.bathrooms !==
      property.bathroomCount
  ) {
    changes["bathroomCount"] =
      submitted.bathrooms;
  }

  const occupancyStatus = nullableText(
    submitted.propertyStatus,
  );

  if (
    occupancyStatus !== null &&
    occupancyStatus !==
      property.occupancyStatus
  ) {
    changes["occupancyStatus"] =
      occupancyStatus;
  }

  const optionalDetails = [
    [
      "parkingDetails",
      nullableText(
        submitted.parkingDetails,
      ),
      property.parkingDetails,
    ],
    [
      "petsDetails",
      nullableText(
        submitted.petsDetails,
      ),
      property.petsDetails,
    ],
    [
      "accessArrangements",
      nullableText(
        submitted.accessArrangements,
      ),
      property.accessArrangements,
    ],
  ] as const;

  for (
    const [field, value, existing] of
      optionalDetails
  ) {
    if (
      value !== null &&
      value !== existing
    ) {
      changes[field] = value;
    }
  }

  return changes as UpdatePropertyRecord;
}

function cleaningScope(
  context: QuoteResolutionContext,
): CleaningScope | null {
  const service =
    context.submission.service;

  if (
    service.category !==
      "Residential Cleaning" ||
    !service.cleaningScope
  ) {
    return null;
  }

  return service.cleaningScope;
}

function distanceMiles(
  pricing: QuotePricingDecision,
): number | null {
  const value =
    pricing.pricingSnapshot[
      "distanceMiles"
    ];

  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : null;
}

function quoteRecord(
  context: QuoteResolutionContext,
  pricing: QuotePricingDecision,
  customerId: string,
  propertyId: string,
  quoteNumber: string,
): CreateQuoteRecord {
  const { submission } = context;
  const { service } = submission;

  const reviewReasons = uniqueReasons([
    ...context.reviewReasons,
    ...pricing.manualReviewReasons,
  ]);

  const manualReviewRequired =
    context.requiresReview ||
    pricing.manualReviewRequired ||
    reviewReasons.length > 0;

  const status: QuoteStatus =
    manualReviewRequired
      ? "In Review"
      : "Submitted";

  const arrangement =
    service.category ===
      "Commercial Cleaning" ||
    service.category ===
      "Property Support"
      ? service.arrangement
      : null;

  const frequency =
    service.category ===
      "Commercial Cleaning" ||
    service.category ===
      "Property Support"
      ? nullableText(service.frequency)
      : null;

  const urgency =
    service.category ===
    "Property Support"
      ? service.urgency
      : null;

  const supportServices =
    service.category ===
    "Property Support"
      ? service.supportServices
      : [];

  const rawSubmission =
    structuredClone(
      submission,
    ) as unknown as Readonly<
      Record<string, unknown>
    >;

  return {
    submissionId:
      submission.submissionId,
    quoteNumber,
    customerId,
    propertyId,
    schemaVersion:
      submission.schemaVersion,
    pricingVersion:
      pricing.pricingVersion,
    status,
    category: service.category,
    serviceType: service.serviceType,
    cleaningScope:
      cleaningScope(context),
    declaredCustomerType:
      submission.customer
        .declaredCustomerType,
    verifiedCustomerStatus:
      context.customer
        .verifiedCustomerStatus,
    customerStatusMismatch:
      context.customer
        .customerStatusMismatch,
    preferredContactMethod:
      submission.customer
        .preferredContactMethod,
    preferredDate:
      nullableText(
        submission.appointment
          .preferredDate,
      ),
    arrivalWindow:
      submission.appointment
        .arrivalWindow || null,
    preferredStartDate:
      nullableText(
        submission.appointment
          .preferredStartDate,
      ),
    requiredCompletionDate:
      nullableText(
        submission.appointment
          .requiredCompletionDate,
      ),
    sameDay:
      submission.appointment.sameDay,
    arrangement,
    frequency,
    urgency,
    supportServices,
    manualReviewRequired,
    manualReviewReasons:
      reviewReasons,
    estimatedTotal:
      pricing.estimatedTotal,
    requiredUpfrontPercentage:
      pricing.requiredUpfrontPercentage,
    requiredUpfrontAmount:
      pricing.requiredUpfrontAmount,
    remainingBalance:
      pricing.remainingBalance,
    travelFee: pricing.travelFee,
    travelPending:
      pricing.travelPending,
    distanceMiles:
      distanceMiles(pricing),
    provisional: pricing.provisional,
    customerNotes:
      nullableText(
        submission.additionalNotes,
      ),
    rawSubmission,
    pricingSnapshot:
      pricing.pricingSnapshot,
  };
}

async function rollback(
  compensations: readonly Compensation[],
): Promise<readonly string[]> {
  const failedLabels: string[] = [];

  for (
    const compensation of [
      ...compensations,
    ].reverse()
  ) {
    try {
      await compensation.run();
    } catch {
      failedLabels.push(
        compensation.label,
      );
    }
  }

  return failedLabels;
}

async function inspectExistingQuote(
  repositories: QuotePersistenceRepositories,
  context: QuoteResolutionContext,
  quote: QuoteRecord,
): Promise<ReplayedQuoteSubmission | null> {
  if (!sameSubmission(quote, context)) {
    throw duplicateSubmissionError(
      context.submission.submissionId,
      quote.id,
    );
  }

  const history =
    await repositories.statusHistory
      .findByQuoteId(quote.id);

  return history === null
    ? null
    : {
        outcome: "replayed",
        quote,
      };
}

async function resolveExistingBeforeWrites(
  repositories: QuotePersistenceRepositories,
  context: QuoteResolutionContext,
  pollDelaysMs: readonly number[],
  wait: (milliseconds: number) => Promise<void>,
): Promise<ReplayedQuoteSubmission | null> {
  let quote =
    await repositories.quotes
      .findBySubmissionId(
        context.submission.submissionId,
      );

  if (quote === null) {
    return null;
  }

  const immediate =
    await inspectExistingQuote(
      repositories,
      context,
      quote,
    );

  if (immediate !== null) {
    return immediate;
  }

  for (const delay of pollDelaysMs) {
    await wait(delay);

    quote =
      await repositories.quotes
        .findBySubmissionId(
          context.submission.submissionId,
        );

    if (quote === null) {
      return null;
    }

    const replayed =
      await inspectExistingQuote(
        repositories,
        context,
        quote,
      );

    if (replayed !== null) {
      return replayed;
    }
  }

  throw submissionInProgressError(
    context.submission.submissionId,
    quote.id,
  );
}

async function waitForExistingAfterCreateFailure(
  repositories: QuotePersistenceRepositories,
  context: QuoteResolutionContext,
  pollDelaysMs: readonly number[],
  wait: (milliseconds: number) => Promise<void>,
): Promise<ReplayedQuoteSubmission | null> {
  let incompleteQuote: QuoteRecord | null = null;

  for (const delay of [0, ...pollDelaysMs]) {
    if (delay > 0) {
      await wait(delay);
    }

    const quote =
      await repositories.quotes
        .findBySubmissionId(
          context.submission.submissionId,
        );

    if (quote === null) {
      continue;
    }

    incompleteQuote = quote;

    const replayed =
      await inspectExistingQuote(
        repositories,
        context,
        quote,
      );

    if (replayed !== null) {
      return replayed;
    }
  }

  if (incompleteQuote !== null) {
    throw submissionInProgressError(
      context.submission.submissionId,
      incompleteQuote.id,
    );
  }

  return null;
}

function storageError(
  cause: unknown,
  completedWriteCount: number,
  rollbackFailures: readonly string[],
): ApplicationError {
  return new ApplicationError({
    code: "STORAGE_ERROR",
    message:
      "The quote could not be saved safely.",
    statusCode: 502,
    details: {
      completedWriteCount,
      rollbackFailed:
        rollbackFailures.length > 0,
      rollbackFailures,
    },
    cause,
  });
}

export function createQuotePersistenceService(
  repositories:
    QuotePersistenceRepositories,
  options: QuotePersistenceOptions = {},
): QuotePersistenceService {
  const createQuoteNumber =
    options.createQuoteNumber ??
    defaultQuoteNumber;

  const createQuoteId =
    options.createQuoteId ??
    defaultQuoteId;

  const duplicatePollDelaysMs =
    options.duplicatePollDelaysMs ??
    [50, 100, 200, 400, 800];

  const wait =
    options.wait ??
    defaultWait;

  const inFlight = new Map<
    string,
    Promise<PersistedQuoteSubmission>
  >();

  const persistUnlocked = async (
    context: QuoteResolutionContext,
    pricing: QuotePricingDecision,
  ): Promise<PersistedQuoteSubmission> => {
    const existing =
      await resolveExistingBeforeWrites(
        repositories,
        context,
        duplicatePollDelaysMs,
        wait,
      );

    if (existing !== null) {
      return existing;
    }

    const compensations:
      Compensation[] = [];

    let customer: CustomerRecord;
    let property: PropertyRecord;
    let createdCustomer = false;
    let createdProperty = false;

    try {
      const matchedCustomer =
        context.customer.customer;

      if (matchedCustomer === null) {
        customer =
          await repositories.customers
            .create(
              newCustomerRecord(
                context,
              ),
            );

        createdCustomer = true;

        compensations.push({
          label: "delete-customer",
          run: () =>
            repositories.customers
              .delete(customer.id),
        });
      } else {
        const changes = customerChanges(
          context,
          matchedCustomer,
        );

        if (
          hasChanges(
            changes as Readonly<
              Record<string, unknown>
            >,
          )
        ) {
          const original =
            customerSnapshot(
              matchedCustomer,
            );

          compensations.push({
            label: "restore-customer",
            run: async () => {
              await repositories.customers
                .update(
                  matchedCustomer.id,
                  original,
                );
            },
          });

          customer =
            await repositories.customers
              .update(
                matchedCustomer.id,
                changes,
              );
        } else {
          customer = matchedCustomer;
        }
      }

      const matchedProperty =
        context.property.property;

      if (matchedProperty === null) {
        property =
          await repositories.properties
            .create(
              newPropertyRecord(
                context,
                customer.id,
              ),
            );

        createdProperty = true;

        compensations.push({
          label: "delete-property",
          run: () =>
            repositories.properties
              .delete(property.id),
        });
      } else {
        const changes = propertyChanges(
          context,
          matchedProperty,
        );

        if (
          hasChanges(
            changes as Readonly<
              Record<string, unknown>
            >,
          )
        ) {
          const original =
            propertySnapshot(
              matchedProperty,
            );

          compensations.push({
            label: "restore-property",
            run: async () => {
              await repositories.properties
                .update(
                  matchedProperty.id,
                  original,
                );
            },
          });

          property =
            await repositories.properties
              .update(
                matchedProperty.id,
                changes,
              );
        } else {
          property = matchedProperty;
        }
      }

      const quoteNumber =
        createQuoteNumber(
          context.submission
            .submissionId,
        );

      let quote: QuoteRecord;

      try {
        quote =
          await repositories.quotes.create(
            quoteRecord(
              context,
              pricing,
              customer.id,
              property.id,
              quoteNumber,
            ),
            {
              itemId: createQuoteId(
                context.submission
                  .submissionId,
              ),
            },
          );
      } catch (error) {
        const replayed =
          await waitForExistingAfterCreateFailure(
            repositories,
            context,
            duplicatePollDelaysMs,
            wait,
          );

        if (replayed !== null) {
          const rollbackFailures =
            await rollback(
              compensations,
            );

          if (rollbackFailures.length > 0) {
            throw storageError(
              error,
              compensations.length,
              rollbackFailures,
            );
          }

          return replayed;
        }

        throw error;
      }

      compensations.push({
        label: "delete-quote",
        run: () =>
          repositories.quotes.delete(
            quote.id,
          ),
      });

      const quoteItems =
        await repositories.quoteItems
          .createMany(
            pricing.items.map(
              (item) => ({
                ...item,
                quoteId: quote.id,
              }),
            ),
          );

      if (quoteItems.length > 0) {
        compensations.push({
          label: "delete-quote-items",
          run: () =>
            repositories.quoteItems
              .deleteMany(
                quoteItems.map(
                  ({ id }) => id,
                ),
              ),
        });
      }

      const statusHistory =
        await repositories.statusHistory
          .create({
            historyLabel:
              `${quote.quoteNumber} - ${quote.status}`,
            quoteId: quote.id,
            contactEnquiryId: null,
            recordType: "Quote",
            previousStatus: null,
            newStatus: quote.status,
            changeSource: "Website",
            actorType: "Customer",
            actorId: customer.id,
            actorName: customer.fullName,
            changeReason:
              "Quote submitted through the website.",
            customerVisible: true,
            notes: null,
            metadata: {
              submissionId:
                quote.submissionId,
              pricingVersion:
                quote.pricingVersion,
              manualReviewRequired:
                quote.manualReviewRequired,
            },
          });

      return {
        outcome: "created",
        customer,
        property,
        quote,
        quoteItems,
        statusHistory,
        createdCustomer,
        createdProperty,
      };
    } catch (error) {
      const rollbackFailures =
        await rollback(
          compensations,
        );

      if (
        error instanceof ApplicationError &&
        error.statusCode < 500 &&
        rollbackFailures.length === 0
      ) {
        throw error;
      }

      throw storageError(
        error,
        compensations.length,
        rollbackFailures,
      );
    }
  };

  return {
    async persist(
      context,
      pricing,
    ): Promise<PersistedQuoteSubmission> {
      const submissionId =
        context.submission.submissionId;

      const running =
        inFlight.get(submissionId);

      if (running !== undefined) {
        const completed =
          await running;

        if (
          !sameSubmission(
            completed.quote,
            context,
          )
        ) {
          throw duplicateSubmissionError(
            submissionId,
            completed.quote.id,
          );
        }

        return {
          outcome: "replayed",
          quote: completed.quote,
        };
      }

      const operation =
        persistUnlocked(
          context,
          pricing,
        );

      inFlight.set(
        submissionId,
        operation,
      );

      try {
        return await operation;
      } finally {
        if (
          inFlight.get(submissionId) ===
          operation
        ) {
          inFlight.delete(submissionId);
        }
      }
    },
  };
}
