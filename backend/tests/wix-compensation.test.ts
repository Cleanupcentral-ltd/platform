import assert from "node:assert/strict";
import test from "node:test";

import {
  WixQuoteItemRepository,
} from "../src/adapters/wix/repositories/wix-quote-item-repository.js";

import {
  WixQuoteRepository,
} from "../src/adapters/wix/repositories/wix-quote-repository.js";

import {
  ApplicationError,
} from "../src/domain/errors.js";

import type {
  CreateQuoteItemRecord,
  CreateQuoteRecord,
} from "../src/domain/models.js";

import {
  createWixDataGateway,
} from "./support/create-wix-data-gateway.js";

const quoteCreate = {
  submissionId: "submission-1",
  quoteNumber: "CUC-Q-TEST-001",
  customerId: "customer-1",
  propertyId: "property-1",
  schemaVersion: "1.0",
  pricingVersion:
    "CUC Phase 0 v1.3",
  status: "Submitted",
  category: "Residential Cleaning",
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
  estimatedTotal: 80,
  requiredUpfrontPercentage: 30,
  requiredUpfrontAmount: 24,
  remainingBalance: 56,
  travelFee: 0,
  travelPending: false,
  distanceMiles: 0,
  provisional: false,
  customerNotes: null,
  rawSubmission: {},
  pricingSnapshot: {},
} satisfies CreateQuoteRecord;

const quoteItem = {
  quoteId: "quote-1",
  itemLabel: "Standard Clean",
  sourceKey: "service.standard-clean",
  itemType: "Base Service",
  itemName: "Standard Clean",
  quantity: 1,
  unitPrice: 80,
  lineTotal: 80,
  discountable: true,
  provisional: false,
  customerVisible: true,
  displayOrder: 10,
  metadata: null,
} satisfies CreateQuoteItemRecord;

test(
  "removes a quote through the audited Wix bulk-removal endpoint",
  async () => {
    let receivedCollection = "";
    let receivedIds:
      readonly string[] = [];

    const gateway =
      createWixDataGateway({
        async bulkRemoveDataItems(
          collectionId,
          itemIds,
        ) {
          receivedCollection =
            collectionId;
          receivedIds = itemIds;

          return {
            results: [
              {
                action: "DELETE",
                itemMetadata: {
                  id: "quote-1",
                  originalIndex: 0,
                  success: true,
                },
              },
            ],
            bulkActionMetadata: {
              totalSuccesses: 1,
              totalFailures: 0,
            },
          };
        },
      });

    const repository =
      new WixQuoteRepository(gateway);

    await repository.delete("quote-1");

    assert.equal(
      receivedCollection,
      "Quotes",
    );
    assert.deepEqual(
      receivedIds,
      ["quote-1"],
    );
  },
);

test(
  "removes a newly inserted quote when Wix returns an invalid record",
  async () => {
    const removedIds: string[] = [];

    const gateway =
      createWixDataGateway({
        async insertDataItem() {
          return {
            dataItem: {
              id: "quote-invalid",
              dataCollectionId:
                "Quotes",
              data: {
                quoteNumber:
                  quoteCreate.quoteNumber,
              },
            },
          };
        },

        async bulkRemoveDataItems(
          collectionId,
          itemIds,
        ) {
          assert.equal(
            collectionId,
            "Quotes",
          );
          removedIds.push(...itemIds);

          return {
            results: itemIds.map(
              (id, index) => ({
                action: "DELETE",
                itemMetadata: {
                  id,
                  originalIndex: index,
                  success: true,
                },
              }),
            ),
            bulkActionMetadata: {
              totalSuccesses:
                itemIds.length,
              totalFailures: 0,
            },
          };
        },
      });

    const repository =
      new WixQuoteRepository(gateway);

    await assert.rejects(
      () => repository.create(quoteCreate),
      ApplicationError,
    );

    assert.deepEqual(
      removedIds,
      ["quote-invalid"],
    );
  },
);

test(
  "removes successful quote items when the same bulk insert partly fails",
  async () => {
    const removedIds: string[] = [];

    const gateway =
      createWixDataGateway({
        async bulkInsertDataItems(
          _collectionId,
          dataItems,
        ) {
          return {
            results: [
              {
                action: "INSERT",
                itemMetadata: {
                  id: "item-success",
                  originalIndex: 0,
                  success: true,
                },
                dataItem: {
                  id: "item-success",
                  dataCollectionId:
                    "QuoteItems",
                  data: dataItems[0]!,
                },
              },
              {
                action: "INSERT",
                itemMetadata: {
                  id: "item-failed",
                  originalIndex: 1,
                  success: false,
                  error: {
                    message:
                      "Insert failed.",
                  },
                },
              },
            ],
            bulkActionMetadata: {
              totalSuccesses: 1,
              totalFailures: 1,
            },
          };
        },

        async bulkRemoveDataItems(
          collectionId,
          itemIds,
        ) {
          assert.equal(
            collectionId,
            "QuoteItems",
          );
          removedIds.push(...itemIds);

          return {
            results: itemIds.map(
              (id, index) => ({
                action: "DELETE",
                itemMetadata: {
                  id,
                  originalIndex: index,
                  success: true,
                },
              }),
            ),
            bulkActionMetadata: {
              totalSuccesses:
                itemIds.length,
              totalFailures: 0,
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
          quoteItem,
          {
            ...quoteItem,
            sourceKey: "extra.oven",
            itemLabel: "Oven",
            itemName: "Oven",
          },
        ]),
      ApplicationError,
    );

    assert.deepEqual(
      removedIds,
      ["item-success"],
    );
  },
);
