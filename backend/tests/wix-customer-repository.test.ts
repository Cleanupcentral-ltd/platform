import assert from "node:assert/strict";
import test from "node:test";
import type {
  CreateCustomerRecord,
} from "../src/domain/models.js";

import {
  WixCustomerRepository,
} from "../src/adapters/wix/repositories/wix-customer-repository.js";

import {
  createWixDataGateway,
} from "./support/create-wix-data-gateway.js";

const customerData = {
  fullName: "Prince Example",
  companyName: "Clean Up Central",
  email: "Prince@Example.com",
  emailNormalized: "prince@example.com",
  phone: "07123 456789",
  phoneNormalized: "447123456789",
  declaredCustomerType: "Existing customer",
  verificationStatus: "Verified Existing",
  isExistingCustomer: true,
  firstEligibleCleanCompleted: true,
  privacyConsent: true,
  marketingConsent: false,
  internalNotes: null,
} satisfies CreateCustomerRecord;

test(
  "queries customers by normalized email",
  async () => {
    let receivedCollection = "";
    let receivedQuery: unknown;
    let receivedOptions: unknown;

    const gateway =
      createWixDataGateway({
        async queryDataItems(
          collectionId,
          query,
          options,
        ) {
          receivedCollection =
            collectionId;

          receivedQuery = query;
          receivedOptions = options;

          return {
            dataItems: [
              {
                id: "customer-1",
                dataCollectionId:
                  "Customers",
                data: customerData,
              },
            ],
          };
        },
      });

    const repository =
      new WixCustomerRepository(gateway);

    const customers =
      await repository.findByNormalizedEmail(
        "prince@example.com",
      );

    assert.equal(
      receivedCollection,
      "Customers",
    );

    assert.deepEqual(receivedQuery, {
      filter: {
        emailNormalized: {
          $eq: "prince@example.com",
        },
      },

      paging: {
        limit: 20,
        offset: 0,
      },
    });

    assert.deepEqual(receivedOptions, {
      consistentRead: true,
    });

    assert.equal(
      customers[0]?.id,
      "customer-1",
    );

    assert.equal(
      customers[0]?.verificationStatus,
      "Verified Existing",
    );
  },
);

test(
  "creates a Wix customer using audited field IDs",
  async () => {
    let receivedData: unknown;

    const gateway =
      createWixDataGateway({
        async insertDataItem(
          collectionId,
          data,
        ) {
          assert.equal(
            collectionId,
            "Customers",
          );

          receivedData = data;

          return {
            dataItem: {
              id: "customer-1",
              dataCollectionId:
                "Customers",
              data,
            },
          };
        },
      });

    const repository =
      new WixCustomerRepository(gateway);

    const customer =
      await repository.create(
        customerData,
      );

    assert.deepEqual(
      receivedData,
      customerData,
    );

    assert.equal(
      customer.id,
      "customer-1",
    );
  },
);

test(
  "patches only changed customer fields",
  async () => {
    let receivedChanges: unknown;

    const gateway =
      createWixDataGateway({
        async patchDataItem(
          collectionId,
          itemId,
          changes,
        ) {
          assert.equal(
            collectionId,
            "Customers",
          );

          assert.equal(
            itemId,
            "customer-1",
          );

          receivedChanges = changes;

          return {
            dataItem: {
              id: "customer-1",
              dataCollectionId:
                "Customers",

              data: {
                ...customerData,
                marketingConsent: true,
              },
            },
          };
        },
      });

    const repository =
      new WixCustomerRepository(gateway);

    const updated =
      await repository.update(
        "customer-1",
        {
          marketingConsent: true,
        },
      );

    assert.deepEqual(
      receivedChanges,
      {
        marketingConsent: true,
      },
    );

    assert.equal(
      updated.marketingConsent,
      true,
    );
  },
);