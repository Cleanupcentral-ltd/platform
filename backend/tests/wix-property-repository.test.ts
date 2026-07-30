import assert from "node:assert/strict";
import test from "node:test";

import {
  WixPropertyRepository,
} from "../src/adapters/wix/repositories/wix-property-repository.js";

import {
  createWixDataGateway,
} from "./support/create-wix-data-gateway.js";

const propertyData = {
  customer: "customer-1",
  propertyLabel: "14 Example Avenue",
  address: "14 Example Avenue, London",
  postcode: "NW1 1HN",
  postcodeNormalized: "NW11HN",
  propertyType: "House",
  bedroomCount: 2,
  bathroomCount: 1,
  occupancyStatus: "Occupied",
  parkingDetails: null,
  petsDetails: null,
  accessArrangements: null,
  verifiedProperty: false,
  activeProperty: true,
};

test(
  "queries a property by customer and postcode",
  async () => {
    let receivedQuery: unknown;

    const gateway =
      createWixDataGateway({
        async queryDataItems(
          collectionId,
          query,
        ) {
          assert.equal(
            collectionId,
            "Properties",
          );

          receivedQuery = query;

          return {
            dataItems: [
              {
                id: "property-1",
                dataCollectionId:
                  "Properties",
                data: propertyData,
              },
            ],
          };
        },
      });

    const repository =
      new WixPropertyRepository(gateway);

    const properties =
      await repository
        .findByCustomerAndPostcode(
          "customer-1",
          "NW11HN",
        );

    assert.deepEqual(receivedQuery, {
      filter: {
        customer: {
          $eq: "customer-1",
        },

        postcodeNormalized: {
          $eq: "NW11HN",
        },
      },

      paging: {
        limit: 20,
        offset: 0,
      },
    });

    assert.equal(
      properties[0]?.id,
      "property-1",
    );

    assert.equal(
      properties[0]?.customerId,
      "customer-1",
    );
  },
);

test(
  "creates a property with its customer reference",
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
            "Properties",
          );

          receivedData = data;

          return {
            dataItem: {
              id: "property-1",
              dataCollectionId:
                "Properties",
              data,
            },
          };
        },
      });

    const repository =
      new WixPropertyRepository(gateway);

    const property =
      await repository.create({
        customerId: "customer-1",
        propertyLabel:
          "14 Example Avenue",
        address:
          "14 Example Avenue, London",
        postcode: "NW1 1HN",
        postcodeNormalized:
          "NW11HN",
        propertyType: "House",
        bedroomCount: 2,
        bathroomCount: 1,
        occupancyStatus: "Occupied",
        parkingDetails: null,
        petsDetails: null,
        accessArrangements: null,
        verifiedProperty: false,
        activeProperty: true,
      });

    assert.deepEqual(
      receivedData,
      propertyData,
    );

    assert.equal(
      property.id,
      "property-1",
    );
  },
);

test(
  "patches only changed property fields",
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
            "Properties",
          );

          assert.equal(
            itemId,
            "property-1",
          );

          receivedChanges = changes;

          return {
            dataItem: {
              id: "property-1",
              dataCollectionId:
                "Properties",

              data: {
                ...propertyData,
                verifiedProperty: true,
              },
            },
          };
        },
      });

    const repository =
      new WixPropertyRepository(gateway);

    const updated =
      await repository.update(
        "property-1",
        {
          verifiedProperty: true,
        },
      );

    assert.deepEqual(
      receivedChanges,
      {
        verifiedProperty: true,
      },
    );

    assert.equal(
      updated.verifiedProperty,
      true,
    );
  },
);