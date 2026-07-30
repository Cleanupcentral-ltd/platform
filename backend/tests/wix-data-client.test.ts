import assert from "node:assert/strict";
import test from "node:test";

import { WIX_COLLECTIONS } from "../src/adapters/wix/collections.js";
import type { WixHttpClient } from "../src/adapters/wix/wix-api-client.js";
import { WixDataClient } from "../src/adapters/wix/wix-data-client.js";

test(
  "Wix Data client sends the correct collection query",
  async () => {
    let receivedPath = "";
    let receivedBody: unknown;

    const httpClient: WixHttpClient = {
      async get<T>(): Promise<T> {
        throw new Error(
          "GET was not expected.",
        );
      },

      async patch<T>(): Promise<T> {
        throw new Error(
          "PATCH was not expected.",
        );
      },

      async put<T>(): Promise<T> {
  throw new Error(
    "PUT was not expected.",
  );
},

      async post<T>(
        path: string,
        body: unknown,
      ): Promise<T> {
        receivedPath = path;
        receivedBody = body;

        return {
          dataItems: [],
        } as T;
      },
    };

    const dataClient = new WixDataClient(
      httpClient,
    );

    const response =
      await dataClient.queryDataItems(
        WIX_COLLECTIONS.customers,
        {
          filter: {
            emailNormalized: {
              $eq: "test@example.com",
            },
          },

          paging: {
            limit: 10,
            offset: 0,
          },
        },
        {
          consistentRead: true,
        },
      );

    assert.equal(
      receivedPath,
      "/wix-data/v2/items/query",
    );

    assert.deepEqual(receivedBody, {
      dataCollectionId: "Customers",

      query: {
        filter: {
          emailNormalized: {
            $eq: "test@example.com",
          },
        },

        paging: {
          limit: 10,
          offset: 0,
        },
      },

      consistentRead: true,
    });

    assert.deepEqual(response, {
      dataItems: [],
    });
  },
);

test(
  "Wix Data client requests a collection schema",
  async () => {
    let receivedPath = "";

    const httpClient: WixHttpClient = {
      async get<T>(
        path: string,
      ): Promise<T> {
        receivedPath = path;

        return {
          collection: {
            id: "Customers",
            displayName: "Customers",
            fields: [],
          },
        } as T;
      },

      async post<T>(): Promise<T> {
        throw new Error(
          "POST was not expected.",
        );
      },

      async put<T>(): Promise<T> {
  throw new Error(
    "PUT was not expected.",
  );
},

      async patch<T>(): Promise<T> {
        throw new Error(
          "PATCH was not expected.",
        );
      },
    };

    const dataClient = new WixDataClient(
      httpClient,
    );

    const response =
      await dataClient.getDataCollection(
        WIX_COLLECTIONS.customers,
      );

    assert.equal(
      receivedPath,
      "/wix-data/v2/collections/Customers?consistentRead=true",
    );

    assert.equal(
      response.collection.id,
      "Customers",
    );
  },
);