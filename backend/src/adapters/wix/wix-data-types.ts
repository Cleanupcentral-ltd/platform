export type WixDataValue = unknown;

export interface WixDataItem {
  readonly id: string;
  readonly dataCollectionId?: string;
  readonly data: Readonly<
    Record<string, WixDataValue>
  >;
}

export interface WixOffsetPaging {
  readonly limit: number;
  readonly offset?: number;
}

export interface WixSort {
  readonly fieldName: string;
  readonly order: "ASC" | "DESC";
}

export interface WixDataQuery {
  readonly filter?: Readonly<
    Record<string, unknown>
  >;

  readonly sort?: readonly WixSort[];

  readonly paging?: WixOffsetPaging;
}

export interface WixPagingMetadata {
  readonly count?: number;
  readonly offset?: number;
  readonly total?: number;
}

export interface WixQueryDataItemsResponse {
  readonly dataItems: readonly WixDataItem[];
  readonly pagingMetadata?: WixPagingMetadata;
}

export interface WixApiErrorPayload {
  readonly message?: string;
  readonly details?: unknown;
}

export interface WixDataCollectionField {
  readonly key: string;
  readonly displayName?: string;
  readonly type?: string;
}

export interface WixDataCollection {
  readonly id: string;
  readonly displayName?: string;
  readonly fields: readonly WixDataCollectionField[];
}

export interface WixGetDataCollectionResponse {
  readonly collection: WixDataCollection;
}

export interface WixGetDataItemResponse {
  readonly dataItem: WixDataItem;
}

export interface WixWriteDataItemResponse {
  readonly dataItem: WixDataItem;
}

export interface WixBulkItemMetadata {
  readonly id?: string;
  readonly originalIndex?: number;
  readonly success?: boolean;
  readonly error?: unknown;
}

export interface WixBulkDataItemResult {
  readonly action?: string;
  readonly itemMetadata: WixBulkItemMetadata;
  readonly dataItem?: WixDataItem;
}

export interface WixBulkActionMetadata {
  readonly totalSuccesses?: number;
  readonly totalFailures?: number;
}

export interface WixBulkDataItemsResponse {
  readonly results: readonly WixBulkDataItemResult[];

  readonly bulkActionMetadata?:
    WixBulkActionMetadata;
}