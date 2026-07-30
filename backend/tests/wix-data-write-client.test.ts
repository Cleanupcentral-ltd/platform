import assert from "node:assert/strict";
import test from "node:test";

import { WIX_COLLECTIONS } from "../src/adapters/wix/collections.js";
import type { WixHttpClient } from "../src/adapters/wix/wix-api-client.js";
import { WixDataClient } from "../src/adapters/wix/wix-data-client.js";

function unexpectedMethod(
  method: string,
): never {
  throw new Error(
    `${method} was not expected.`,
  );
}

test(
  "retrieves one Wix data item using a consistent read",
  async () => {
    let receivedPath = "";

    const httpClient: WixHttpClient = {
      async get<T>(
        path: string,
      ): Promise<T> {
        receivedPath = path;

        return {
          dataItem: {
            id: "customer-1",
            dataCollectionId: "Customers",
            data: {
              fullName: "Prince Example",
            },
          },
        } as T;
      },

      async post<T>(): Promise<T> {
        return unexpectedMethod("POST");
      },

      async put<T>(): Promise<T> {
        return unexpectedMethod("PUT");
      },

      async patch<T>(): Promise<T> {
        return unexpectedMethod("PATCH");
      },
    };

    const client = new WixDataClient(
      httpClient,
    );

    const response =
      await client.getDataItem(
        WIX_COLLECTIONS.customers,
        "customer-1",
      );

    assert.equal(
      receivedPath,
      [
        "/wix-data/v2/items/customer-1",
        "?dataCollectionId=Customers",
        "&consistentRead=true",
      ].join(""),
    );

    assert.equal(
      response.dataItem.id,
      "customer-1",
    );
  },
);

test(
  "inserts one Wix data item",
  async () => {
    let receivedPath = "";
    let receivedBody: unknown;

    const httpClient: WixHttpClient = {
      async get<T>(): Promise<T> {
        return unexpectedMethod("GET");
      },

      async post<T>(
        path: string,
        body: unknown,
      ): Promise<T> {
        receivedPath = path;
        receivedBody = body;

        return {
          dataItem: {
            id: "customer-1",
            dataCollectionId: "Customers",
            data: {
              fullName: "Prince Example",
            },
          },
        } as T;
      },

      async put<T>(): Promise<T> {
        return unexpectedMethod("PUT");
      },

      async patch<T>(): Promise<T> {
        return unexpectedMethod("PATCH");
      },
    };

    const client = new WixDataClient(
      httpClient,
    );

    const response =
      await client.insertDataItem(
        WIX_COLLECTIONS.customers,
        {
          fullName: "Prince Example",
        },
      );

    assert.equal(
      receivedPath,
      "/wix-data/v2/items",
    );

    assert.deepEqual(receivedBody, {
      dataCollectionId: "Customers",

      dataItem: {
        data: {
          fullName: "Prince Example",
        },
      },
    });

    assert.equal(
      response.dataItem.id,
      "customer-1",
    );
  },
);

test(
  "inserts a Wix data item with a deterministic custom ID",
  async () => {
    let receivedBody: unknown;

    const httpClient: WixHttpClient = {
      async get<T>(): Promise<T> {
        return unexpectedMethod("GET");
      },

      async post<T>(
        _path: string,
        body: unknown,
      ): Promise<T> {
        receivedBody = body;

        return {
          dataItem: {
            id: "quote-submission-1",
            dataCollectionId: "Quotes",
            data: {
              submissionId:
                "submission-1",
            },
          },
        } as T;
      },

      async put<T>(): Promise<T> {
        return unexpectedMethod("PUT");
      },

      async patch<T>(): Promise<T> {
        return unexpectedMethod("PATCH");
      },
    };

    const client = new WixDataClient(
      httpClient,
    );

    await client.insertDataItem(
      WIX_COLLECTIONS.quotes,
      {
        submissionId: "submission-1",
      },
      "quote-submission-1",
    );

    assert.deepEqual(receivedBody, {
      dataCollectionId: "Quotes",
      dataItem: {
        id: "quote-submission-1",
        data: {
          submissionId:
            "submission-1",
        },
      },
    });
  },
);

test(
  "updates one Wix data item",
  async () => {
    let receivedPath = "";
    let receivedBody: unknown;

    const httpClient: WixHttpClient = {
      async get<T>(): Promise<T> {
        return unexpectedMethod("GET");
      },

      async post<T>(): Promise<T> {
        return unexpectedMethod("POST");
      },

      async put<T>(
        path: string,
        body: unknown,
      ): Promise<T> {
        receivedPath = path;
        receivedBody = body;

        return {
          dataItem: {
            id: "customer-1",
            dataCollectionId: "Customers",
            data: {
              fullName: "Updated Name",
            },
          },
        } as T;
      },

      async patch<T>(): Promise<T> {
        return unexpectedMethod("PATCH");
      },
    };

    const client = new WixDataClient(
      httpClient,
    );

    await client.updateDataItem(
      WIX_COLLECTIONS.customers,
      "customer-1",
      {
        fullName: "Updated Name",
      },
    );

    assert.equal(
      receivedPath,
      "/wix-data/v2/items/customer-1",
    );

    assert.deepEqual(receivedBody, {
      dataCollectionId: "Customers",

      dataItem: {
        id: "customer-1",

        data: {
          fullName: "Updated Name",
        },
      },
    });
  },
);

test(
  "bulk inserts Wix data items and requests returned entities",
  async () => {
    let receivedPath = "";
    let receivedBody: unknown;

    const httpClient: WixHttpClient = {
      async get<T>(): Promise<T> {
        return unexpectedMethod("GET");
      },

      async post<T>(
        path: string,
        body: unknown,
      ): Promise<T> {
        receivedPath = path;
        receivedBody = body;

        return {
          results: [
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
                data: {
                  itemName: "Oven",
                },
              },
            },
          ],

          bulkActionMetadata: {
            totalSuccesses: 1,
            totalFailures: 0,
          },
        } as T;
      },

      async put<T>(): Promise<T> {
        return unexpectedMethod("PUT");
      },

      async patch<T>(): Promise<T> {
        return unexpectedMethod("PATCH");
      },
    };

    const client = new WixDataClient(
      httpClient,
    );

    const response =
      await client.bulkInsertDataItems(
        WIX_COLLECTIONS.quoteItems,
        [
          {
            itemName: "Oven",
          },
        ],
      );

    assert.equal(
      receivedPath,
      "/wix-data/v2/bulk/items/insert",
    );

    assert.deepEqual(receivedBody, {
      dataCollectionId: "QuoteItems",

      dataItems: [
        {
          data: {
            itemName: "Oven",
          },
        },
      ],

      returnEntity: true,
    });

    assert.equal(
      response.results[0]?.dataItem?.id,
      "item-1",
    );
  },
);

test(
  "patches selected Wix fields without replacing the full item",
  async () => {
    let receivedPath = "";
    let receivedBody: unknown;

    const httpClient: WixHttpClient = {
      async get<T>(): Promise<T> {
        return unexpectedMethod("GET");
      },

      async post<T>(): Promise<T> {
        return unexpectedMethod("POST");
      },

      async put<T>(): Promise<T> {
        return unexpectedMethod("PUT");
      },

      async patch<T>(
        path: string,
        body: unknown,
      ): Promise<T> {
        receivedPath = path;
        receivedBody = body;

        return {
          dataItem: {
            id: "customer-1",
            dataCollectionId: "Customers",

            data: {
              fullName: "Updated Name",
              marketingConsent: true,
            },
          },
        } as T;
      },
    };

    const client = new WixDataClient(
      httpClient,
    );

    const response =
      await client.patchDataItem(
        WIX_COLLECTIONS.customers,
        "customer-1",
        {
          fullName: "Updated Name",
          marketingConsent: true,
        },
      );

    assert.equal(
      receivedPath,
      "/wix-data/v2/items/customer-1",
    );

    assert.deepEqual(receivedBody, {
      dataCollectionId: "Customers",

      patch: {
        dataItemId: "customer-1",

        fieldModifications: [
          {
            fieldPath: "fullName",
            action: "SET_FIELD",

            setFieldOptions: {
              value: "Updated Name",
            },
          },
          {
            fieldPath: "marketingConsent",
            action: "SET_FIELD",

            setFieldOptions: {
              value: true,
            },
          },
        ],
      },
    });

    assert.equal(
      response.dataItem.id,
      "customer-1",
    );
  },
);

test(
  "bulk removes Wix data items",
  async () => {
    let receivedPath = "";
    let receivedBody: unknown;

    const httpClient: WixHttpClient = {
      async get<T>(): Promise<T> {
        return unexpectedMethod("GET");
      },

      async post<T>(
        path: string,
        body: unknown,
      ): Promise<T> {
        receivedPath = path;
        receivedBody = body;

        return {
          results: [
            {
              action: "DELETE",

              itemMetadata: {
                id: "item-1",
                originalIndex: 0,
                success: true,
              },
            },
          ],

          bulkActionMetadata: {
            totalSuccesses: 1,
            totalFailures: 0,
          },
        } as T;
      },

      async put<T>(): Promise<T> {
        return unexpectedMethod("PUT");
      },

      async patch<T>(): Promise<T> {
        return unexpectedMethod("PATCH");
      },
    };

    const client = new WixDataClient(
      httpClient,
    );

    const response =
      await client.bulkRemoveDataItems(
        WIX_COLLECTIONS.quoteItems,
        ["item-1"],
      );

    assert.equal(
      receivedPath,
      "/wix-data/v2/bulk/items/remove",
    );

    assert.deepEqual(receivedBody, {
      dataCollectionId: "QuoteItems",
      dataItemIds: ["item-1"],
    });

    assert.equal(
      response.bulkActionMetadata
        ?.totalFailures,
      0,
    );
  },
);