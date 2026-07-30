import assert from "node:assert/strict";
import test from "node:test";

import {
  createQuotePersistenceService,
} from "../src/application/persist-quote.js";

import type {
  QuotePricingDecision,
} from "../src/application/price-quote.js";

import type {
  QuoteResolutionContext,
} from "../src/application/resolve-quote-context.js";

import type {
  SubmitQuoteRequest,
} from "../src/application/validation/submit-quote.js";

import {
  ApplicationError,
} from "../src/domain/errors.js";

import type {
  CustomerRecord,
  PropertyRecord,
  QuoteItemRecord,
  QuoteRecord,
  StatusHistoryRecord,
} from "../src/domain/models.js";

import type {
  QuoteRepositories,
} from "../src/ports/repositories.js";

function submission(): SubmitQuoteRequest {
  return {
    submissionId:
      "11111111-1111-4111-8111-111111111111",
    schemaVersion: "1.0",

    customer: {
      fullName: "Test Customer",
      companyName: "Example Estates",
      email: "customer@example.com",
      phone: "07123 456789",
      declaredCustomerType:
        "New customer",
      preferredContactMethod: "Email",
      privacyConsent: true,
      marketingConsent: true,
    },

    property: {
      propertyType: "House",
      address:
        "14 Example Avenue, London",
      postcode: "SE1 2AA",
      bedrooms: 2,
      bathrooms: 1,
      propertyCount: 1,
      propertyStatus: "Occupied",
      parkingDetails:
        "Street parking available.",
      petsDetails: "",
      accessArrangements:
        "Meet at the property.",
    },

    appointment: {
      preferredDate: "2026-08-15",
      arrivalWindow: "08:00–11:00",
      preferredStartDate: "",
      requiredCompletionDate: "",
      sameDay: false,
    },

    service: {
      category:
        "Residential Cleaning",
      serviceType: "Standard Clean",
      cleaningScope: "Whole Property",
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
        "Standard Consumables Package": 0,
      },
      currentCondition: "",
      requirements: "",
    },

    safetyWarnings: "",
    additionalNotes:
      "Please call before arrival.",
    attachmentCount: 0,
  };
}

function newContext(): QuoteResolutionContext {
  return {
    submission: submission(),

    customer: {
      kind: "no-match",
      customer: null,
      matchedBy: null,
      normalizedEmail:
        "customer@example.com",
      normalizedPhone:
        "447123456789",
      verifiedCustomerStatus:
        "Verified New",
      customerStatusMismatch: false,
      requiresReview: true,
      reviewReasons: [
        "NEW_CUSTOMER",
      ],
    },

    property: {
      kind: "deferred",
      property: null,
      normalizedPostcode: "SE12AA",
      normalizedAddress:
        "14 example avenue london",
      candidateCount: 0,
      requiresReview: false,
      reviewReasons: [],
    },

    requiresReview: true,
    reviewReasons: [
      "NEW_CUSTOMER",
    ],
  };
}

function pricing(): QuotePricingDecision {
  return {
    kind: "instant",
    pricingVersion:
      "CUC Phase 0 v1.3",
    estimatedTotal: 93.5,
    requiredUpfrontPercentage: 30,
    requiredUpfrontAmount: 28.05,
    remainingBalance: 65.45,
    travelFee: 0,
    travelPending: false,
    provisional: false,
    clientEstimateMismatch: false,
    manualReviewRequired: true,
    manualReviewReasons: [
      "NEW_CUSTOMER",
    ],
    items: [
      {
        itemLabel: "Standard Clean",
        sourceKey:
          "service.standard-clean.2-bed",
        itemType: "Base Service",
        itemName: "Standard Clean",
        quantity: 1,
        unitPrice: 110,
        lineTotal: 110,
        discountable: true,
        provisional: false,
        customerVisible: true,
        displayOrder: 10,
        metadata: {
          bedrooms: 2,
        },
      },
    ],
    pricingSnapshot: {
      estimatedTotal: 93.5,
      distanceMiles: 0,
    },
  };
}

interface RepositoryState {
  readonly customers: CustomerRecord[];
  readonly properties: PropertyRecord[];
  readonly quotes: QuoteRecord[];
  readonly quoteItems: QuoteItemRecord[];
  readonly history: StatusHistoryRecord[];
}

function repositories(
  options: {
    readonly failQuoteCreate?: boolean;
    readonly failHistoryCreate?: boolean;
    readonly beforeQuoteCreate?:
      () => Promise<void>;
    readonly raceExistingQuote?:
      QuoteRecord;
    readonly raceExistingHistory?:
      StatusHistoryRecord;
    readonly customer?: CustomerRecord;
    readonly property?: PropertyRecord;
  } = {},
): {
  readonly repositories:
    QuoteRepositories;
  readonly state: RepositoryState;
} {
  let raceExistingVisible = false;

  const state: RepositoryState = {
    customers:
      options.customer
        ? [{ ...options.customer }]
        : [],
    properties:
      options.property
        ? [{ ...options.property }]
        : [],
    quotes: [],
    quoteItems: [],
    history: [],
  };

  const removeById = <
    RecordType extends { id: string },
  >(
    records: RecordType[],
    id: string,
  ): void => {
    const index = records.findIndex(
      (record) => record.id === id,
    );

    if (index >= 0) {
      records.splice(index, 1);
    }
  };

  const repositorySet: QuoteRepositories = {
    customers: {
      async findByNormalizedEmail() {
        return [];
      },
      async findByNormalizedPhone() {
        return [];
      },
      async findById(customerId) {
        return (
          state.customers.find(
            ({ id }) => id === customerId,
          ) ?? null
        );
      },
      async create(customer) {
        const record: CustomerRecord = {
          ...customer,
          id: `customer-${state.customers.length + 1}`,
        };
        state.customers.push(record);
        return record;
      },
      async update(customerId, changes) {
        const index =
          state.customers.findIndex(
            ({ id }) => id === customerId,
          );
        assert.notEqual(index, -1);
        const current =
          state.customers[index]!;
        const updated: CustomerRecord = {
          ...current,
          ...changes,
        };
        state.customers[index] = updated;
        return updated;
      },
      async delete(customerId) {
        removeById(
          state.customers,
          customerId,
        );
      },
    },

    properties: {
      async findByCustomerAndPostcode() {
        return [];
      },
      async findById(propertyId) {
        return (
          state.properties.find(
            ({ id }) => id === propertyId,
          ) ?? null
        );
      },
      async create(property) {
        const record: PropertyRecord = {
          ...property,
          id: `property-${state.properties.length + 1}`,
        };
        state.properties.push(record);
        return record;
      },
      async update(propertyId, changes) {
        const index =
          state.properties.findIndex(
            ({ id }) => id === propertyId,
          );
        assert.notEqual(index, -1);
        const current =
          state.properties[index]!;
        const updated: PropertyRecord = {
          ...current,
          ...changes,
        };
        state.properties[index] = updated;
        return updated;
      },
      async delete(propertyId) {
        removeById(
          state.properties,
          propertyId,
        );
      },
    },

    quotes: {
      async findBySubmissionId(
        submissionId,
      ) {
        return (
          state.quotes.find(
            (quote) =>
              quote.submissionId ===
              submissionId,
          ) ??
          (raceExistingVisible &&
          options.raceExistingQuote
            ?.submissionId ===
            submissionId
            ? options.raceExistingQuote
            : null)
        );
      },
      async create(quote, createOptions) {
        await options.beforeQuoteCreate?.();

        if (options.failQuoteCreate) {
          raceExistingVisible = true;

          throw new Error(
            "Quote write failed.",
          );
        }
        const record: QuoteRecord = {
          ...quote,
          id:
            createOptions?.itemId ??
            "quote-1",
        };
        state.quotes.push(record);
        return record;
      },
      async delete(quoteId) {
        removeById(
          state.quotes,
          quoteId,
        );
      },
    },

    quoteItems: {
      async createMany(items) {
        const records = items.map(
          (item, index): QuoteItemRecord => ({
            ...item,
            id: `item-${index + 1}`,
          }),
        );
        state.quoteItems.push(...records);
        return records;
      },
      async deleteMany(itemIds) {
        for (const itemId of itemIds) {
          removeById(
            state.quoteItems,
            itemId,
          );
        }
      },
    },

    mediaUploads: {
      async findById() {
        return null;
      },
      async findByQuoteId() {
        return [];
      },
      async create(upload, createOptions) {
        return {
          ...upload,
          id:
            createOptions?.itemId ??
            "media-upload-1",
        };
      },
      async delete() {},
      async deleteMany() {},
    },

    statusHistory: {
      async findByQuoteId(quoteId) {
        return (
          state.history.find(
            (history) =>
              history.quoteId ===
              quoteId,
          ) ??
          (raceExistingVisible &&
          options.raceExistingHistory
            ?.quoteId === quoteId
            ? options.raceExistingHistory
            : null)
        );
      },
      async create(history) {
        if (options.failHistoryCreate) {
          throw new Error(
            "History write failed.",
          );
        }
        const record: StatusHistoryRecord = {
          ...history,
          id: "history-1",
        };
        state.history.push(record);
        return record;
      },
      async delete(historyId) {
        removeById(
          state.history,
          historyId,
        );
      },
    },
  };

  return {
    repositories: repositorySet,
    state,
  };
}

test(
  "persists a new customer, property, quote, items and initial status history",
  async () => {
    const fixture = repositories();
    const service =
      createQuotePersistenceService(
        fixture.repositories,
      );

    const result = await service.persist(
      newContext(),
      pricing(),
    );

    assert.equal(
      result.outcome,
      "created",
    );

    assert.ok(
      result.outcome === "created",
    );

    assert.equal(
      result.createdCustomer,
      true,
    );
    assert.equal(
      result.createdProperty,
      true,
    );
    assert.equal(
      result.quote.status,
      "In Review",
    );
    assert.equal(
      result.quote.quoteNumber,
      "CUC-Q-111111111111",
    );
    assert.equal(
      result.quote.id,
      "quote-11111111-1111-4111-8111-111111111111",
    );
    assert.equal(
      result.quote.requiredUpfrontAmount,
      28.05,
    );
    assert.equal(
      result.quote.customerNotes,
      "Please call before arrival.",
    );
    assert.equal(
      fixture.state.customers.length,
      1,
    );
    assert.equal(
      fixture.state.properties.length,
      1,
    );
    assert.equal(
      fixture.state.quotes.length,
      1,
    );
    assert.equal(
      fixture.state.quoteItems.length,
      1,
    );
    assert.equal(
      fixture.state.history.length,
      1,
    );
  },
);

test(
  "replays an identical completed submission without creating duplicate records",
  async () => {
    const fixture = repositories();
    const service =
      createQuotePersistenceService(
        fixture.repositories,
        {
          duplicatePollDelaysMs: [],
        },
      );

    const first = await service.persist(
      newContext(),
      pricing(),
    );

    const second = await service.persist(
      newContext(),
      pricing(),
    );

    assert.equal(first.outcome, "created");
    assert.equal(second.outcome, "replayed");
    assert.equal(
      second.quote.id,
      "quote-11111111-1111-4111-8111-111111111111",
    );
    assert.equal(
      fixture.state.customers.length,
      1,
    );
    assert.equal(
      fixture.state.properties.length,
      1,
    );
    assert.equal(
      fixture.state.quotes.length,
      1,
    );
    assert.equal(
      fixture.state.quoteItems.length,
      1,
    );
    assert.equal(
      fixture.state.history.length,
      1,
    );
  },
);

test(
  "rejects reuse of a submission ID with different quote information",
  async () => {
    const fixture = repositories();
    const service =
      createQuotePersistenceService(
        fixture.repositories,
        {
          duplicatePollDelaysMs: [],
        },
      );

    await service.persist(
      newContext(),
      pricing(),
    );

    const baseContext =
      newContext();

    const conflictingContext:
      QuoteResolutionContext = {
        ...baseContext,
        submission: {
          ...baseContext.submission,
          additionalNotes:
            "Different instructions.",
        },
      };

    await assert.rejects(
      () =>
        service.persist(
          conflictingContext,
          pricing(),
        ),
      (error: unknown) => {
        assert.ok(
          error instanceof
            ApplicationError,
        );
        assert.equal(
          error.code,
          "DUPLICATE_SUBMISSION",
        );
        assert.equal(
          error.statusCode,
          409,
        );
        return true;
      },
    );

    assert.equal(
      fixture.state.quotes.length,
      1,
    );
  },
);

test(
  "serializes simultaneous submissions with the same ID",
  async () => {
    const controls: {
      releaseQuoteCreate:
        (() => void) | null;
      markQuoteCreateStarted:
        (() => void) | null;
    } = {
      releaseQuoteCreate: null,
      markQuoteCreateStarted: null,
    };

    const quoteCreateStarted =
      new Promise<void>((resolve) => {
        controls.markQuoteCreateStarted =
          resolve;
      });

    const quoteCreateGate =
      new Promise<void>((resolve) => {
        controls.releaseQuoteCreate =
          resolve;
      });

    const fixture = repositories({
      async beforeQuoteCreate() {
        controls.markQuoteCreateStarted?.();
        await quoteCreateGate;
      },
    });

    const service =
      createQuotePersistenceService(
        fixture.repositories,
        {
          duplicatePollDelaysMs: [],
        },
      );

    const firstPromise = service.persist(
      newContext(),
      pricing(),
    );

    await quoteCreateStarted;

    const secondPromise =
      service.persist(
        newContext(),
        pricing(),
      );

    controls.releaseQuoteCreate?.();

    const [first, second] =
      await Promise.all([
        firstPromise,
        secondPromise,
      ]);

    assert.equal(first.outcome, "created");
    assert.equal(second.outcome, "replayed");
    assert.equal(
      fixture.state.quotes.length,
      1,
    );
    assert.equal(
      fixture.state.history.length,
      1,
    );
  },
);

test(
  "returns the completed quote when another backend wins the create race",
  async () => {
    const winningFixture =
      repositories();

    const winningService =
      createQuotePersistenceService(
        winningFixture.repositories,
        {
          duplicatePollDelaysMs: [],
        },
      );

    const winningResult =
      await winningService.persist(
        newContext(),
        pricing(),
      );

    assert.ok(
      winningResult.outcome ===
        "created",
    );

    const racingFixture =
      repositories({
        failQuoteCreate: true,
        raceExistingQuote:
          winningResult.quote,
        raceExistingHistory:
          winningResult.statusHistory,
      });

    const racingService =
      createQuotePersistenceService(
        racingFixture.repositories,
        {
          duplicatePollDelaysMs: [],
        },
      );

    const result =
      await racingService.persist(
        newContext(),
        pricing(),
      );

    assert.equal(
      result.outcome,
      "replayed",
    );
    assert.equal(
      result.quote.id,
      winningResult.quote.id,
    );
    assert.equal(
      racingFixture.state
        .customers.length,
      0,
    );
    assert.equal(
      racingFixture.state
        .properties.length,
      0,
    );
    assert.equal(
      racingFixture.state.quotes.length,
      0,
    );
  },
);

test(
  "removes all newly-created records when the final history write fails",
  async () => {
    const fixture = repositories({
      failHistoryCreate: true,
    });
    const service =
      createQuotePersistenceService(
        fixture.repositories,
        {
          duplicatePollDelaysMs: [],
        },
      );

    await assert.rejects(
      () =>
        service.persist(
          newContext(),
          pricing(),
        ),
      (error: unknown) => {
        assert.ok(
          error instanceof
            ApplicationError,
        );
        assert.equal(
          error.code,
          "STORAGE_ERROR",
        );
        return true;
      },
    );

    assert.equal(
      fixture.state.customers.length,
      0,
    );
    assert.equal(
      fixture.state.properties.length,
      0,
    );
    assert.equal(
      fixture.state.quotes.length,
      0,
    );
    assert.equal(
      fixture.state.quoteItems.length,
      0,
    );
    assert.equal(
      fixture.state.history.length,
      0,
    );
  },
);

test(
  "restores matched customer and property records when quote creation fails",
  async () => {
    const existingCustomer: CustomerRecord = {
      id: "customer-existing",
      fullName: "Original Name",
      companyName: null,
      email: "customer@example.com",
      emailNormalized:
        "customer@example.com",
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
    };

    const existingProperty: PropertyRecord = {
      id: "property-existing",
      customerId: "customer-existing",
      propertyLabel: "Existing Home",
      address:
        "14 Example Avenue, London",
      postcode: "SE1 2AA",
      postcodeNormalized: "SE12AA",
      propertyType: "House",
      bedroomCount: 1,
      bathroomCount: 1,
      occupancyStatus: "Occupied",
      parkingDetails: null,
      petsDetails: null,
      accessArrangements: null,
      verifiedProperty: true,
      activeProperty: true,
    };

    const fixture = repositories({
      failQuoteCreate: true,
      customer: existingCustomer,
      property: existingProperty,
    });

    const request = submission();
    request.customer.fullName =
      "Updated Name";
    request.customer.declaredCustomerType =
      "Existing customer";

    const matchedContext: QuoteResolutionContext = {
      submission: request,
      customer: {
        kind: "matched",
        customer: existingCustomer,
        matchedBy: "email-and-phone",
        normalizedEmail:
          "customer@example.com",
        normalizedPhone:
          "447123456789",
        verifiedCustomerStatus:
          "Verified Existing",
        customerStatusMismatch: false,
        requiresReview: false,
        reviewReasons: [],
      },
      property: {
        kind: "matched",
        property: existingProperty,
        normalizedPostcode: "SE12AA",
        normalizedAddress:
          "14 example avenue london",
        candidateCount: 1,
        requiresReview: false,
        reviewReasons: [],
      },
      requiresReview: false,
      reviewReasons: [],
    };

    const service =
      createQuotePersistenceService(
        fixture.repositories,
        {
          duplicatePollDelaysMs: [],
        },
      );

    await assert.rejects(
      () =>
        service.persist(
          matchedContext,
          pricing(),
        ),
      ApplicationError,
    );

    assert.deepEqual(
      fixture.state.customers[0],
      existingCustomer,
    );
    assert.deepEqual(
      fixture.state.properties[0],
      existingProperty,
    );
    assert.equal(
      fixture.state.quotes.length,
      0,
    );
  },
);
