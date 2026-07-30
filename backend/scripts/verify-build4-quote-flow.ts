import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  WIX_COLLECTIONS,
  WIX_FIELDS,
  type WixCollectionId,
} from "../src/adapters/wix/collections.js";

import {
  createWixQuoteRepositoriesFromGateway,
} from "../src/adapters/wix/create-wix-repositories.js";

import {
  WixApiClient,
} from "../src/adapters/wix/wix-api-client.js";

import {
  loadWixConfig,
} from "../src/adapters/wix/wix-config.js";

import {
  WixDataClient,
} from "../src/adapters/wix/wix-data-client.js";

import {
  buildApp,
} from "../src/app.js";

import {
  createQuotePersistenceService,
  type CreatedQuoteSubmission,
  type QuotePersistenceService,
} from "../src/application/persist-quote.js";

import {
  createQuotePricingService,
} from "../src/application/price-quote.js";

import {
  createQuoteContextResolver,
} from "../src/application/resolve-quote-context.js";

import type {
  SubmitQuoteRequest,
} from "../src/application/validation/submit-quote.js";

import {
  normalizeEmail,
  normalizePostcode,
} from "../src/domain/normalization.js";

import type {
  PublicQuoteSuccessResponse,
} from "../src/http/responses/quote-response.js";

interface PublicErrorResponse {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
  readonly requestId: string;
}

interface CreatedCapture {
  value: CreatedQuoteSubmission | null;
}

interface VerificationSelectors {
  readonly submissionId: string;
  readonly emailNormalized: string;
  readonly propertyAddress: string;
  readonly captured: CreatedCapture;
}

function uniqueIds(
  values: readonly (string | null | undefined)[],
): string[] {
  return [
    ...new Set(
      values.filter(
        (value): value is string =>
          typeof value === "string" &&
          value.length > 0,
      ),
    ),
  ];
}

function londonDateAfterDays(
  days: number,
): string {
  const date = new Date(
    Date.now() +
      days * 24 * 60 * 60 * 1_000,
  );

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: "Europe/London",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    )
      .formatToParts(date)
      .filter(
        ({ type }) =>
          type !== "literal",
      )
      .map(
        ({ type, value }) => [
          type,
          value,
        ],
      ),
  );

  const year = parts["year"];
  const month = parts["month"];
  const day = parts["day"];

  assert.ok(year);
  assert.ok(month);
  assert.ok(day);

  return `${year}-${month}-${day}`;
}

function verificationPhone(
  token: string,
): string {
  const suffix = token
    .split("")
    .map((character) =>
      Number.parseInt(
        character,
        16,
      ) % 10,
    )
    .join("")
    .slice(0, 8)
    .padEnd(8, "0");

  return `070${suffix}`;
}

function createSubmission(
  submissionId: string,
  token: string,
): SubmitQuoteRequest {
  return {
    submissionId,
    schemaVersion: "1.0",

    customer: {
      fullName:
        "Build 4G Verification",
      companyName: "",
      email:
        `build4g-${token}@example.com`,
      phone: verificationPhone(token),
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
        `14 Example Avenue, Verification ${token}, London`,
      postcode: "NW1 1HN",
      bedrooms: 2,
      bathrooms: 1,
      propertyCount: 1,
      propertyStatus: "Vacant",
      parkingDetails: "",
      petsDetails: "",
      accessArrangements: "",
    },

    appointment: {
      preferredDate:
        londonDateAfterDays(30),
      arrivalWindow:
        "08:00–11:00",
      preferredStartDate: "",
      requiredCompletionDate: "",
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
    additionalNotes:
      "Temporary controlled Build 4G verification request.",
    attachmentCount: 0,
  };
}

function capturePersistence(
  delegate: QuotePersistenceService,
  capture: CreatedCapture,
): QuotePersistenceService {
  return {
    async persist(context, pricing) {
      const result =
        await delegate.persist(
          context,
          pricing,
        );

      if (result.outcome === "created") {
        capture.value = result;
      }

      return result;
    },
  };
}

function assertNoInternalResponseData(
  responseBody: unknown,
  created: CreatedQuoteSubmission,
  submission: SubmitQuoteRequest,
): void {
  const serialized =
    JSON.stringify(responseBody);

  for (
    const forbiddenText of [
      created.quote.id,
      created.customer.id,
      created.property.id,
      submission.submissionId,
      submission.customer.email,
      submission.customer.phone,
      submission.property.address,
      "pricingVersion",
      "pricingSnapshot",
      "rawSubmission",
      "manualReviewRequired",
      "manualReviewReasons",
      "verifiedCustomerStatus",
      "customerStatusMismatch",
      "customerId",
      "propertyId",
      "quoteId",
      "submissionId",
      "distanceMiles",
      "travelPending",
    ]
  ) {
    assert.equal(
      serialized.includes(
        forbiddenText,
      ),
      false,
      `Public response exposed forbidden data: ${forbiddenText}`,
    );
  }
}

function assertNoStore(
  response: {
    readonly headers: Readonly<
      Record<
        string,
        string |
          number |
          readonly string[] |
          undefined
      >
    >;
  },
): void {
  assert.equal(
    response.headers[
      "cache-control"
    ],
    "no-store",
  );
}

async function queryIds(
  dataClient: WixDataClient,
  collectionId: WixCollectionId,
  fieldId: string,
  value: string,
): Promise<string[]> {
  const response =
    await dataClient.queryDataItems(
      collectionId,
      {
        filter: {
          [fieldId]: {
            $eq: value,
          },
        },
        paging: {
          limit: 100,
          offset: 0,
        },
      },
      {
        consistentRead: true,
      },
    );

  return response.dataItems.map(
    ({ id }) => id,
  );
}

async function removeRecords(
  dataClient: WixDataClient,
  collectionId: WixCollectionId,
  itemIds: readonly string[],
): Promise<void> {
  const uniqueItemIds =
    uniqueIds(itemIds);

  if (uniqueItemIds.length === 0) {
    return;
  }

  const response =
    await dataClient.bulkRemoveDataItems(
      collectionId,
      uniqueItemIds,
    );

  const failures =
    response.results.filter(
      ({ itemMetadata }) =>
        itemMetadata.success ===
          false ||
        itemMetadata.error !==
          undefined,
    );

  const totalFailures =
    response.bulkActionMetadata
      ?.totalFailures ?? 0;

  const totalSuccesses =
    response.bulkActionMetadata
      ?.totalSuccesses;

  const confirmedByResults =
    response.results.length ===
      uniqueItemIds.length &&
    failures.length === 0;

  const confirmedByMetadata =
    totalSuccesses ===
      uniqueItemIds.length &&
    totalFailures === 0;

  if (
    totalFailures > 0 ||
    failures.length > 0 ||
    (!confirmedByResults &&
      !confirmedByMetadata)
  ) {
    throw new Error(
      [
        "Cleanup could not be confirmed for",
        collectionId,
        `(${uniqueItemIds.length} requested).`,
      ].join(" "),
    );
  }
}

async function discoverQuoteIds(
  dataClient: WixDataClient,
  selectors: VerificationSelectors,
): Promise<string[]> {
  return uniqueIds([
    selectors.captured.value
      ?.quote.id,
    ...await queryIds(
      dataClient,
      WIX_COLLECTIONS.quotes,
      WIX_FIELDS.quotes
        .submissionId,
      selectors.submissionId,
    ),
  ]);
}

async function cleanupVerificationRecords(
  dataClient: WixDataClient,
  selectors: VerificationSelectors,
): Promise<void> {
  const quoteIds =
    await discoverQuoteIds(
      dataClient,
      selectors,
    );

  const historyIds: string[] = [];
  const quoteItemIds: string[] = [];

  for (const quoteId of quoteIds) {
    historyIds.push(
      ...await queryIds(
        dataClient,
        WIX_COLLECTIONS
          .statusHistory,
        WIX_FIELDS.statusHistory
          .quote,
        quoteId,
      ),
    );

    quoteItemIds.push(
      ...await queryIds(
        dataClient,
        WIX_COLLECTIONS
          .quoteItems,
        WIX_FIELDS.quoteItems
          .quote,
        quoteId,
      ),
    );
  }

  historyIds.push(
    selectors.captured.value
      ?.statusHistory.id ?? "",
  );

  quoteItemIds.push(
    ...(
      selectors.captured.value
        ?.quoteItems.map(
          ({ id }) => id,
        ) ?? []
    ),
  );

  const propertyIds = uniqueIds([
    selectors.captured.value
      ?.property.id,
    ...await queryIds(
      dataClient,
      WIX_COLLECTIONS.properties,
      WIX_FIELDS.properties.address,
      selectors.propertyAddress,
    ),
  ]);

  const customerIds = uniqueIds([
    selectors.captured.value
      ?.customer.id,
    ...await queryIds(
      dataClient,
      WIX_COLLECTIONS.customers,
      WIX_FIELDS.customers
        .emailNormalized,
      selectors.emailNormalized,
    ),
  ]);

  await removeRecords(
    dataClient,
    WIX_COLLECTIONS.statusHistory,
    historyIds,
  );

  await removeRecords(
    dataClient,
    WIX_COLLECTIONS.quoteItems,
    quoteItemIds,
  );

  await removeRecords(
    dataClient,
    WIX_COLLECTIONS.quotes,
    quoteIds,
  );

  await removeRecords(
    dataClient,
    WIX_COLLECTIONS.properties,
    propertyIds,
  );

  await removeRecords(
    dataClient,
    WIX_COLLECTIONS.customers,
    customerIds,
  );
}

async function assertCleanupComplete(
  dataClient: WixDataClient,
  selectors: VerificationSelectors,
): Promise<void> {
  const remainingQuoteIds =
    await queryIds(
      dataClient,
      WIX_COLLECTIONS.quotes,
      WIX_FIELDS.quotes
        .submissionId,
      selectors.submissionId,
    );

  const remainingPropertyIds =
    await queryIds(
      dataClient,
      WIX_COLLECTIONS.properties,
      WIX_FIELDS.properties.address,
      selectors.propertyAddress,
    );

  const remainingCustomerIds =
    await queryIds(
      dataClient,
      WIX_COLLECTIONS.customers,
      WIX_FIELDS.customers
        .emailNormalized,
      selectors.emailNormalized,
    );

  const possibleQuoteIds =
    uniqueIds([
      selectors.captured.value
        ?.quote.id,
      `quote-${selectors.submissionId}`,
    ]);

  const remainingHistoryIds: string[] = [];
  const remainingQuoteItemIds: string[] = [];

  for (const quoteId of possibleQuoteIds) {
    remainingHistoryIds.push(
      ...await queryIds(
        dataClient,
        WIX_COLLECTIONS
          .statusHistory,
        WIX_FIELDS.statusHistory
          .quote,
        quoteId,
      ),
    );

    remainingQuoteItemIds.push(
      ...await queryIds(
        dataClient,
        WIX_COLLECTIONS
          .quoteItems,
        WIX_FIELDS.quoteItems
          .quote,
        quoteId,
      ),
    );
  }

  assert.deepEqual(
    remainingQuoteIds,
    [],
  );

  assert.deepEqual(
    remainingHistoryIds,
    [],
  );

  assert.deepEqual(
    remainingQuoteItemIds,
    [],
  );

  assert.deepEqual(
    remainingPropertyIds,
    [],
  );

  assert.deepEqual(
    remainingCustomerIds,
    [],
  );
}

async function verifyBuild4QuoteFlow():
  Promise<void> {
  const config = loadWixConfig();

  const dataClient =
    new WixDataClient(
      new WixApiClient(config),
    );

  const repositories =
    createWixQuoteRepositoriesFromGateway(
      dataClient,
    );

  const submissionId = randomUUID();
  const token = submissionId
    .replaceAll("-", "")
    .slice(0, 12);

  const submission =
    createSubmission(
      submissionId,
      token,
    );

  const capture: CreatedCapture = {
    value: null,
  };

  const resolutionService =
    createQuoteContextResolver({
      customers:
        repositories.customers,
      properties:
        repositories.properties,
    });

  const pricingService =
    createQuotePricingService({
      resolveDistanceMiles:
        async () => 0,
    });

  const persistenceService =
    capturePersistence(
      createQuotePersistenceService(
        repositories,
      ),
      capture,
    );

  const app = await buildApp({
    quoteResolutionService:
      resolutionService,
    quotePricingService:
      pricingService,
    quotePersistenceService:
      persistenceService,
  });

  const selectors: VerificationSelectors = {
    submissionId,
    emailNormalized:
      normalizeEmail(
        submission.customer.email,
      ),
    propertyAddress:
      submission.property.address,
    captured: capture,
  };

  let verificationError: unknown = null;
  let closeError: unknown = null;
  let cleanupError: unknown = null;

  console.log(
    "Running controlled live Build 4 quote-flow verification...",
  );

  console.log(
    "Temporary Wix records will be removed automatically.",
  );

  try {
    const firstResponse =
      await app.inject({
        method: "POST",
        url: "/api/quotes",
        headers: {
          "content-type":
            "application/json",
        },
        payload: {
          submissionId,
          payload: submission,
        },
      });

    assert.equal(
      firstResponse.statusCode,
      201,
    );

    assertNoStore(firstResponse);

    const firstBody =
      firstResponse.json<
        PublicQuoteSuccessResponse
      >();

    assert.equal(
      firstBody.success,
      true,
    );

    assert.equal(
      firstBody.replayed,
      false,
    );

    assert.deepEqual(
      Object.keys(firstBody).sort(),
      [
        "confirmation",
        "replayed",
        "requestId",
        "success",
      ],
    );

    assert.deepEqual(
      Object.keys(
        firstBody.confirmation,
      ).sort(),
      [
        "appointment",
        "estimate",
        "message",
        "quoteNumber",
        "service",
        "status",
      ],
    );

    const created = capture.value;

    assert.ok(
      created,
      "The live request should create a captured quote transaction.",
    );

    assert.equal(
      created.createdCustomer,
      true,
    );

    assert.equal(
      created.createdProperty,
      true,
    );

    assert.equal(
      created.quote.submissionId,
      submissionId,
    );

    assert.ok(
      created.quoteItems.length > 0,
      "The live quote should create at least one quote item.",
    );

    assert.equal(
      created.statusHistory.quoteId,
      created.quote.id,
    );

    assert.equal(
      firstBody.confirmation
        .quoteNumber,
      created.quote.quoteNumber,
    );

    assert.equal(
      firstBody.confirmation
        .service.category,
      "Residential Cleaning",
    );

    assert.equal(
      firstBody.confirmation
        .service.serviceType,
      "Standard Clean",
    );

    assert.equal(
      firstBody.confirmation
        .service.cleaningScope,
      "Whole Property",
    );

    const estimate =
      firstBody.confirmation
        .estimate;

    assert.ok(
      estimate,
      "The instant quote should return a public estimate.",
    );

    assert.equal(
      estimate.currency,
      "GBP",
    );

    assert.ok(
      estimate.estimatedTotal > 0,
    );

    assert.equal(
      estimate
        .requiredUpfrontPercentage,
      30,
    );

    assertNoInternalResponseData(
      firstBody,
      created,
      submission,
    );

    const storedQuote =
      await repositories.quotes
        .findBySubmissionId(
          submissionId,
        );

    assert.equal(
      storedQuote?.id,
      created.quote.id,
    );

    const storedHistory =
      await repositories.statusHistory
        .findByQuoteId(
          created.quote.id,
        );

    assert.equal(
      storedHistory?.id,
      created.statusHistory.id,
    );

    const storedCustomers =
      await repositories.customers
        .findByNormalizedEmail(
          selectors.emailNormalized,
        );

    assert.equal(
      storedCustomers.length,
      1,
    );

    assert.equal(
      storedCustomers[0]?.id,
      created.customer.id,
    );

    const storedProperties =
      await repositories.properties
        .findByCustomerAndPostcode(
          created.customer.id,
          normalizePostcode(
            submission.property
              .postcode,
          ),
        );

    assert.equal(
      storedProperties.length,
      1,
    );

    assert.equal(
      storedProperties[0]?.id,
      created.property.id,
    );

    const storedQuoteItemIds =
      await queryIds(
        dataClient,
        WIX_COLLECTIONS.quoteItems,
        WIX_FIELDS.quoteItems.quote,
        created.quote.id,
      );

    assert.equal(
      storedQuoteItemIds.length,
      created.quoteItems.length,
    );

    console.log(
      "✓ A new quote completed the full live Wix transaction.",
    );

    console.log(
      "✓ Customer, Property, Quote, Quote Items and Status History were verified.",
    );

    console.log(
      "✓ The customer response exposed no internal IDs, matching data or pricing rules.",
    );

    const replayResponse =
      await app.inject({
        method: "POST",
        url: "/api/quotes",
        headers: {
          "content-type":
            "application/json",
        },
        payload: {
          submissionId,
          payload: submission,
        },
      });

    assert.equal(
      replayResponse.statusCode,
      200,
    );

    assertNoStore(replayResponse);

    const replayBody =
      replayResponse.json<
        PublicQuoteSuccessResponse
      >();

    assert.equal(
      replayBody.success,
      true,
    );

    assert.equal(
      replayBody.replayed,
      true,
    );

    assert.deepEqual(
      replayBody.confirmation,
      firstBody.confirmation,
    );

    assertNoInternalResponseData(
      replayBody,
      created,
      submission,
    );

    console.log(
      "✓ An identical retry replayed the existing quote without another write.",
    );

    const conflictResponse =
      await app.inject({
        method: "POST",
        url: "/api/quotes",
        headers: {
          "content-type":
            "application/json",
        },
        payload: {
          submissionId,
          payload: {
            ...submission,
            additionalNotes:
              "Changed information using the same submission reference.",
          },
        },
      });

    assert.equal(
      conflictResponse.statusCode,
      409,
    );

    assertNoStore(conflictResponse);

    const conflictBody =
      conflictResponse.json<
        PublicErrorResponse
      >();

    assert.equal(
      conflictBody.success,
      false,
    );

    assert.equal(
      conflictBody.error.code,
      "DUPLICATE_SUBMISSION",
    );

    assert.deepEqual(
      Object.keys(
        conflictBody.error,
      ).sort(),
      ["code", "message"],
    );

    assertNoInternalResponseData(
      conflictBody,
      created,
      submission,
    );

    const quotesAfterConflict =
      await queryIds(
        dataClient,
        WIX_COLLECTIONS.quotes,
        WIX_FIELDS.quotes
          .submissionId,
        submissionId,
      );

    assert.deepEqual(
      quotesAfterConflict,
      [created.quote.id],
    );

    console.log(
      "✓ Reusing the submission reference with changed data was rejected safely.",
    );
  } catch (error) {
    verificationError = error;
  }

  try {
    await app.close();
  } catch (error) {
    closeError = error;
  }

  try {
    await cleanupVerificationRecords(
      dataClient,
      selectors,
    );

    await assertCleanupComplete(
      dataClient,
      selectors,
    );

    console.log(
      "✓ All temporary Wix verification records were removed.",
    );
  } catch (error) {
    cleanupError = error;
  }

  if (verificationError !== null) {
    if (cleanupError !== null) {
      console.error(
        "Verification failed and cleanup also failed.",
      );

      console.error(
        "Cleanup error:",
        cleanupError,
      );
    }

    throw verificationError;
  }

  if (cleanupError !== null) {
    throw cleanupError;
  }

  if (closeError !== null) {
    throw closeError;
  }

  console.log(
    "Build 4G live quote-flow verification passed.",
  );
}

try {
  await verifyBuild4QuoteFlow();
} catch (error) {
  console.error(
    "Build 4G live quote-flow verification failed.",
  );

  console.error(error);

  process.exitCode = 1;
}
