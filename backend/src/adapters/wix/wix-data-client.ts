import type { WixCollectionId } from "./collections.js";
import type { WixHttpClient } from "./wix-api-client.js";
import type {
  WixBulkDataItemsResponse,
  WixDataQuery,
  WixGetDataCollectionResponse,
  WixGetDataItemResponse,
  WixQueryDataItemsResponse,
  WixWriteDataItemResponse,
} from "./wix-data-types.js";

export interface QueryDataItemsOptions {
  readonly consistentRead?: boolean;
}

export interface WixDataGateway {
  getDataCollection(
    collectionId: WixCollectionId,
  ): Promise<WixGetDataCollectionResponse>;

  getDataItem(
    collectionId: WixCollectionId,
    itemId: string,
  ): Promise<WixGetDataItemResponse>;

  queryDataItems(
    collectionId: WixCollectionId,
    query: WixDataQuery,
    options?: QueryDataItemsOptions,
  ): Promise<WixQueryDataItemsResponse>;

  insertDataItem(
    collectionId: WixCollectionId,
    data: Readonly<Record<string, unknown>>,
    itemId?: string,
  ): Promise<WixWriteDataItemResponse>;

  updateDataItem(
    collectionId: WixCollectionId,
    itemId: string,
    data: Readonly<Record<string, unknown>>,
  ): Promise<WixWriteDataItemResponse>;

  patchDataItem(
  collectionId: WixCollectionId,
  itemId: string,
  changes: Readonly<Record<string, unknown>>,
): Promise<WixWriteDataItemResponse>;

  bulkInsertDataItems(
    collectionId: WixCollectionId,
    dataItems: readonly Readonly<
      Record<string, unknown>
    >[],
  ): Promise<WixBulkDataItemsResponse>;

  bulkRemoveDataItems(
  collectionId: WixCollectionId,
  itemIds: readonly string[],
): Promise<WixBulkDataItemsResponse>;
}

export class WixDataClient
  implements WixDataGateway
{
  constructor(
    private readonly httpClient: WixHttpClient,
  ) {}

  getDataCollection(
    collectionId: WixCollectionId,
  ): Promise<WixGetDataCollectionResponse> {
    const encodedCollectionId =
      encodeURIComponent(collectionId);

    return this.httpClient.get<WixGetDataCollectionResponse>(
      `/wix-data/v2/collections/${encodedCollectionId}?consistentRead=true`,
    );
  }

  getDataItem(
    collectionId: WixCollectionId,
    itemId: string,
  ): Promise<WixGetDataItemResponse> {
    const encodedItemId =
      encodeURIComponent(itemId);

    const encodedCollectionId =
      encodeURIComponent(collectionId);

    return this.httpClient.get<WixGetDataItemResponse>(
      [
        `/wix-data/v2/items/${encodedItemId}`,
        `?dataCollectionId=${encodedCollectionId}`,
        "&consistentRead=true",
      ].join(""),
    );
  }

  queryDataItems(
    collectionId: WixCollectionId,
    query: WixDataQuery,
    options: QueryDataItemsOptions = {},
  ): Promise<WixQueryDataItemsResponse> {
    return this.httpClient.post<WixQueryDataItemsResponse>(
      "/wix-data/v2/items/query",
      {
        dataCollectionId: collectionId,
        query,
        consistentRead:
          options.consistentRead ?? false,
      },
    );
  }

  insertDataItem(
    collectionId: WixCollectionId,
    data: Readonly<Record<string, unknown>>,
    itemId?: string,
  ): Promise<WixWriteDataItemResponse> {
    return this.httpClient.post<WixWriteDataItemResponse>(
      "/wix-data/v2/items",
      {
        dataCollectionId: collectionId,

        dataItem: {
          ...(itemId === undefined
            ? {}
            : { id: itemId }),

          data,
        },
      },
    );
  }

  updateDataItem(
    collectionId: WixCollectionId,
    itemId: string,
    data: Readonly<Record<string, unknown>>,
  ): Promise<WixWriteDataItemResponse> {
    const encodedItemId =
      encodeURIComponent(itemId);

  

    return this.httpClient.put<WixWriteDataItemResponse>(
      `/wix-data/v2/items/${encodedItemId}`,

      
      {
        dataCollectionId: collectionId,

        dataItem: {
          id: itemId,
          data,
        },
      },
    );
  }

  patchDataItem(
  collectionId: WixCollectionId,
  itemId: string,
  changes: Readonly<Record<string, unknown>>,
): Promise<WixWriteDataItemResponse> {
  const encodedItemId =
    encodeURIComponent(itemId);

  const fieldModifications = Object.entries(
    changes,
  )
    .filter(([, value]) => value !== undefined)
    .map(([fieldPath, value]) => ({
      fieldPath,
      action: "SET_FIELD",

      setFieldOptions: {
        value,
      },
    }));

  return this.httpClient.patch<WixWriteDataItemResponse>(
    `/wix-data/v2/items/${encodedItemId}`,
    {
      dataCollectionId: collectionId,

      patch: {
        dataItemId: itemId,
        fieldModifications,
      },
    },
  );
}

  bulkInsertDataItems(
    collectionId: WixCollectionId,
    dataItems: readonly Readonly<
      Record<string, unknown>
    >[],
  ): Promise<WixBulkDataItemsResponse> {
    return this.httpClient.post<WixBulkDataItemsResponse>(
      "/wix-data/v2/bulk/items/insert",
      {
        dataCollectionId: collectionId,

        dataItems: dataItems.map((data) => ({
          data,
        })),

        returnEntity: true,
      },
    );
  }

  bulkRemoveDataItems(
  collectionId: WixCollectionId,
  itemIds: readonly string[],
): Promise<WixBulkDataItemsResponse> {
  if (itemIds.length === 0) {
    return Promise.resolve({
      results: [],

      bulkActionMetadata: {
        totalSuccesses: 0,
        totalFailures: 0,
      },
    });
  }

  return this.httpClient.post<WixBulkDataItemsResponse>(
    "/wix-data/v2/bulk/items/remove",
    {
      dataCollectionId: collectionId,
      dataItemIds: itemIds,
    },
  );
}
}