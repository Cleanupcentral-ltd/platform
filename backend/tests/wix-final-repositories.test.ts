import assert from "node:assert/strict";
import test from "node:test";

import {
  ApplicationError,
} from "../src/domain/errors.js";

import type {
  CreateQuoteItemRecord,
  CreateQuoteRecord,
  CreateStatusHistoryRecord,
} from "../src/domain/models.js";

import {
  createWixQuoteRepositoriesFromGateway,
} from "../src/adapters/wix/create-wix-repositories.js";

import {
  WixCustomerRepository,
} from "../src/adapters/wix/repositories/wix-customer-repository.js";

import {
  WixMediaUploadRepository,
} from "../src/adapters/wix/repositories/wix-media-upload-repository.js";

import {
  WixPropertyRepository,
} from "../src/adapters/wix/repositories/wix-property-repository.js";

import {
  WixQuoteItemRepository,
} from "../src/adapters/wix/repositories/wix-quote-item-repository.js";

import {
  WixQuoteRepository,
} from "../src/adapters/wix/repositories/wix-quote-repository.js";

import {
  WixStatusHistoryRepository,
} from "../src/adapters/wix/repositories/wix-status-history-repository.js";

import {
  createWixDataGateway,
} from "./support/create-wix-data-gateway.js";

const quoteCreate = {
  submissionId: "submission-1",
  quoteNumber: "CUC-Q-TEST-001",
  customerId: "customer-1",
  propertyId: "property-1",
  schemaVersion: "1",
  pricingVersion:
    "CUC Phase 0 v1.3",
  status: "Submitted",
  category:
    "Residential Cleaning",
  serviceType: "Standard Clean",
  cleaningScope: "Whole Property",
  declaredCustomerType:
    "New customer",
  verifiedCustomerStatus:
    "Verified New",
  customerStatusMismatch: false,
  preferredContactMethod: "Email",
  preferredDate: "2026-08-15",
  arrivalWindow: "08:00–11:00",
  preferredStartDate: null,
  requiredCompletionDate: null,
  sameDay: false,
  arrangement: null,
  frequency: null,
  urgency: null,
  supportServices: [],
  manualReviewRequired: false,
  manualReviewReasons: [],
  estimatedTotal: 70,
  requiredUpfrontPercentage: 30,
  requiredUpfrontAmount: 21,
  remainingBalance: 49,
  travelFee: 0,
  travelPending: false,
  distanceMiles: 0,
  provisional: true,
  customerNotes: null,

  rawSubmission: {
    source: "repository-test",
  },

  pricingSnapshot: {
    estimatedTotal: 70,
  },
} satisfies CreateQuoteRecord;

const quoteWixData = {
  submissionId:
    quoteCreate.submissionId,

  quoteNumber:
    quoteCreate.quoteNumber,

  customer:
    quoteCreate.customerId,

  property:
    quoteCreate.propertyId,

  schemaVersion:
    quoteCreate.schemaVersion,

  pricingVersion:
    quoteCreate.pricingVersion,

  status:
    quoteCreate.status,

  quoteCategory:
    quoteCreate.category,

  serviceType:
    quoteCreate.serviceType,

  cleaningScope:
    quoteCreate.cleaningScope,

  declaredCustomerType:
    quoteCreate.declaredCustomerType,

  verifiedCustomerStatus:
    quoteCreate
      .verifiedCustomerStatus,

  customerStatusMismatch:
    quoteCreate
      .customerStatusMismatch,

  preferredContactMethod:
    quoteCreate
      .preferredContactMethod,

  preferredDate:
    quoteCreate.preferredDate,

  arrivalWindow:
    quoteCreate.arrivalWindow,

  preferredStartDate:
    quoteCreate.preferredStartDate,

  requiredCompletionDate:
    quoteCreate.requiredCompletionDate,

  sameDay:
    quoteCreate.sameDay,

  arrangement:
    quoteCreate.arrangement,

  frequency:
    quoteCreate.frequency,

  urgency:
    quoteCreate.urgency,

  supportServices:
    quoteCreate.supportServices,

  manualReviewRequired:
    quoteCreate
      .manualReviewRequired,

  manualReviewReasons:
    quoteCreate
      .manualReviewReasons,

  estimatedTotal:
    quoteCreate.estimatedTotal,

  requiredUpfrontPercentage:
    quoteCreate.requiredUpfrontPercentage,

  requiredUpfrontAmount:
    quoteCreate.requiredUpfrontAmount,

  remainingBalance:
    quoteCreate.remainingBalance,

  travelFee:
    quoteCreate.travelFee,

  travelPending:
    quoteCreate.travelPending,

  distanceMiles:
    quoteCreate.distanceMiles,

  provisional:
    quoteCreate.provisional,

  customerNotes:
    quoteCreate.customerNotes,

  rawSubmission:
    quoteCreate.rawSubmission,

  pricingSnapshot:
    quoteCreate.pricingSnapshot,
};

const baseItem = {
  quoteId: "quote-1",
  itemLabel: "Standard Clean",
  sourceKey: "base-clean",
  itemType: "Cleaning",
  itemName: "Standard Clean",
  quantity: 1,
  unitPrice: 70,
  lineTotal: 70,
  discountable: true,
  provisional: false,
  customerVisible: true,
  displayOrder: 1,

  metadata: {
    propertySize: "1 bedroom",
  },
} satisfies CreateQuoteItemRecord;

const ovenItem = {
  quoteId: "quote-1",
  itemLabel: "Oven",
  sourceKey: "oven",
  itemType: "Extra",
  itemName: "Oven",
  quantity: 1,
  unitPrice: 50,
  lineTotal: 50,
  discountable: false,
  provisional: false,
  customerVisible: true,
  displayOrder: 2,
  metadata: null,
} satisfies CreateQuoteItemRecord;

test(
  "creates a quote using the audited Wix field IDs",
  async () => {
    let receivedData: unknown;
    let receivedItemId: string | undefined;

    const gateway =
      createWixDataGateway({
        async insertDataItem(
          collectionId,
          data,
          itemId,
        ) {
          assert.equal(
            collectionId,
            "Quotes",
          );

          receivedData = data;
          receivedItemId = itemId;

          return {
            dataItem: {
              id: "quote-1",
              dataCollectionId:
                "Quotes",
              data,
            },
          };
        },
      });

    const repository =
      new WixQuoteRepository(gateway);

    const quote =
      await repository.create(
        quoteCreate,
        {
          itemId:
            "quote-submission-1",
        },
      );

    assert.deepEqual(
      receivedData,
      quoteWixData,
    );

    assert.equal(
      receivedItemId,
      "quote-submission-1",
    );

    assert.equal(
      quote.id,
      "quote-1",
    );

    assert.equal(
      quote.category,
      "Residential Cleaning",
    );
  },
);

test(
  "finds a quote by submission ID",
  async () => {
    let receivedQuery: unknown;
    let receivedOptions: unknown;

    const gateway =
      createWixDataGateway({
        async queryDataItems(
          collectionId,
          query,
          options,
        ) {
          assert.equal(
            collectionId,
            "Quotes",
          );

          receivedQuery = query;
          receivedOptions = options;

          return {
            dataItems: [
              {
                id: "quote-1",
                dataCollectionId:
                  "Quotes",
                data: quoteWixData,
              },
            ],
          };
        },
      });

    const repository =
      new WixQuoteRepository(gateway);

    const quote =
      await repository
        .findBySubmissionId(
          "submission-1",
        );

    assert.deepEqual(receivedQuery, {
      filter: {
        submissionId: {
          $eq: "submission-1",
        },
      },

      paging: {
        limit: 2,
        offset: 0,
      },
    });

    assert.deepEqual(receivedOptions, {
      consistentRead: true,
    });

    assert.equal(
      quote?.id,
      "quote-1",
    );
  },
);

test(
  "rejects duplicate quote submission IDs",
  async () => {
    const duplicateItem = {
      id: "quote-1",
      dataCollectionId: "Quotes",
      data: quoteWixData,
    };

    const gateway =
      createWixDataGateway({
        async queryDataItems() {
          return {
            dataItems: [
              duplicateItem,

              {
                ...duplicateItem,
                id: "quote-2",
              },
            ],
          };
        },
      });

    const repository =
      new WixQuoteRepository(gateway);

    await assert.rejects(
      () =>
        repository
          .findBySubmissionId(
            "submission-1",
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
  },
);

test(
  "returns no quote items without calling Wix",
  async () => {
    const gateway =
      createWixDataGateway();

    const repository =
      new WixQuoteItemRepository(
        gateway,
      );

    const result =
      await repository.createMany([]);

    assert.deepEqual(result, []);
  },
);

test(
  "bulk creates quote items in original order",
  async () => {
    let receivedDataItems: unknown;

    const gateway =
      createWixDataGateway({
        async bulkInsertDataItems(
          collectionId,
          dataItems,
        ) {
          assert.equal(
            collectionId,
            "QuoteItems",
          );

          receivedDataItems =
            dataItems;

          const baseData =
            dataItems[0]!;

          const ovenData =
            dataItems[1]!;

          return {
            results: [
              {
                action: "INSERT",

                itemMetadata: {
                  id: "item-2",
                  originalIndex: 1,
                  success: true,
                },

                dataItem: {
                  id: "item-2",
                  dataCollectionId:
                    "QuoteItems",
                  data: ovenData,
                },
              },

              {
                action: "INSERT",

                itemMetadata: {
                  id: "item-1",
                  originalIndex: 0,
                  success: true,
                },

                dataItem: {
                  id: "item-1",
                  dataCollectionId:
                    "QuoteItems",
                  data: baseData,
                },
              },
            ],

            bulkActionMetadata: {
              totalSuccesses: 2,
              totalFailures: 0,
            },
          };
        },
      });

    const repository =
      new WixQuoteItemRepository(
        gateway,
      );

    const result =
      await repository.createMany([
        baseItem,
        ovenItem,
      ]);

    assert.equal(
      (
        receivedDataItems as
          readonly unknown[]
      ).length,
      2,
    );

    assert.equal(
      result[0]?.itemName,
      "Standard Clean",
    );

    assert.equal(
      result[1]?.itemName,
      "Oven",
    );
  },
);

test(
  "rejects a partial quote-item bulk failure",
  async () => {
    const gateway =
      createWixDataGateway({
        async bulkInsertDataItems() {
          return {
            results: [
              {
                action: "INSERT",

                itemMetadata: {
                  id: "item-1",
                  originalIndex: 0,
                  success: false,

                  error: {
                    message:
                      "Insert failed",
                  },
                },
              },
            ],

            bulkActionMetadata: {
              totalSuccesses: 0,
              totalFailures: 1,
            },
          };
        },
      });

    const repository =
      new WixQuoteItemRepository(
        gateway,
      );

    await assert.rejects(
      () =>
        repository.createMany([
          baseItem,
        ]),

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
  },
);

test(
  "finds status history for a quote using a consistent read",
  async () => {
    let receivedQuery: unknown;
    let receivedOptions: unknown;

    const historyData = {
      historyLabel:
        "Quote submitted",
      quote: "quote-1",
      contactEnquiry: null,
      recordType: "Quote",
      previousStatus: null,
      newStatus: "Submitted",
      changeSource: "Backend",
      actorType: "System",
      actorId: null,
      actorName: null,
      changeReason:
        "Initial submission",
      customerVisible: true,
      notes: null,
      metadata: {
        submissionId:
          "submission-1",
      },
    };

    const gateway =
      createWixDataGateway({
        async queryDataItems(
          collectionId,
          query,
          options,
        ) {
          assert.equal(
            collectionId,
            "StatusHistory",
          );

          receivedQuery = query;
          receivedOptions = options;

          return {
            dataItems: [
              {
                id: "history-1",
                dataCollectionId:
                  "StatusHistory",
                data: historyData,
              },
            ],
          };
        },
      });

    const repository =
      new WixStatusHistoryRepository(
        gateway,
      );

    const history =
      await repository.findByQuoteId(
        "quote-1",
      );

    assert.deepEqual(receivedQuery, {
      filter: {
        quote: {
          $eq: "quote-1",
        },
      },
      paging: {
        limit: 1,
        offset: 0,
      },
    });

    assert.deepEqual(receivedOptions, {
      consistentRead: true,
    });

    assert.equal(
      history?.id,
      "history-1",
    );
  },
);

test(
  "creates a status-history record",
  async () => {
    const history = {
      historyLabel:
        "Quote submitted",

      quoteId: "quote-1",
      contactEnquiryId: null,
      recordType: "Quote",
      previousStatus: null,
      newStatus: "Submitted",
      changeSource: "Backend",
      actorType: "System",
      actorId: null,
      actorName: null,
      changeReason:
        "Initial submission",
      customerVisible: true,
      notes: null,

      metadata: {
        submissionId:
          "submission-1",
      },
    } satisfies
      CreateStatusHistoryRecord;

    let receivedData: unknown;

    const gateway =
      createWixDataGateway({
        async insertDataItem(
          collectionId,
          data,
        ) {
          assert.equal(
            collectionId,
            "StatusHistory",
          );

          receivedData = data;

          return {
            dataItem: {
              id: "history-1",
              dataCollectionId:
                "StatusHistory",
              data,
            },
          };
        },
      });

    const repository =
      new WixStatusHistoryRepository(
        gateway,
      );

    const created =
      await repository.create(
        history,
      );

    assert.deepEqual(receivedData, {
      historyLabel:
        "Quote submitted",

      quote: "quote-1",
      contactEnquiry: null,
      recordType: "Quote",
      previousStatus: null,
      newStatus: "Submitted",
      changeSource: "Backend",
      actorType: "System",
      actorId: null,
      actorName: null,
      changeReason:
        "Initial submission",
      customerVisible: true,
      notes: null,

      metadata: {
        submissionId:
          "submission-1",
      },
    });

    assert.equal(
      created.id,
      "history-1",
    );
  },
);

test(
  "composes all six Wix repositories",
  () => {
    const gateway =
      createWixDataGateway();

    const repositories =
      createWixQuoteRepositoriesFromGateway(
        gateway,
      );

    assert.ok(
      repositories.customers
        instanceof
        WixCustomerRepository,
    );

    assert.ok(
      repositories.properties
        instanceof
        WixPropertyRepository,
    );

    assert.ok(
      repositories.quotes
        instanceof
        WixQuoteRepository,
    );

    assert.ok(
      repositories.quoteItems
        instanceof
        WixQuoteItemRepository,
    );

    assert.ok(
      repositories.mediaUploads
        instanceof
        WixMediaUploadRepository,
    );

    assert.ok(
      repositories.statusHistory
        instanceof
        WixStatusHistoryRepository,
    );
  },
);