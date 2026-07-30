import {
  ApplicationError,
} from "../../../domain/errors.js";

import type {
  WixCollectionId,
} from "../collections.js";

import type {
  WixDataGateway,
} from "../wix-data-client.js";

import type {
  WixDataItem,
} from "../wix-data-types.js";

function failedResults(
  results: readonly {
    readonly itemMetadata: {
      readonly success?: boolean;
      readonly error?: unknown;
    };
  }[],
): readonly unknown[] {
  return results.filter(
    ({ itemMetadata }) =>
      itemMetadata.success === false ||
      itemMetadata.error !== undefined,
  );
}

export async function removeWixDataItems(
  dataGateway: WixDataGateway,
  collectionId: WixCollectionId,
  itemIds: readonly string[],
): Promise<void> {
  if (itemIds.length === 0) {
    return;
  }

  const response =
    await dataGateway.bulkRemoveDataItems(
      collectionId,
      itemIds,
    );

  const failures = failedResults(
    response.results,
  );

  const totalFailures =
    response.bulkActionMetadata
      ?.totalFailures ?? 0;

  const totalSuccesses =
    response.bulkActionMetadata
      ?.totalSuccesses;

  const confirmedByResults =
    response.results.length ===
      itemIds.length &&
    failures.length === 0;

  const confirmedByMetadata =
    totalSuccesses ===
      itemIds.length &&
    totalFailures === 0;

  if (
    totalFailures > 0 ||
    failures.length > 0 ||
    (!confirmedByResults &&
      !confirmedByMetadata)
  ) {
    throw new ApplicationError({
      code: "STORAGE_ERROR",

      message:
        "One or more Wix records could not be removed.",

      statusCode: 502,

      details: {
        collectionId,
        requestedCount: itemIds.length,
        returnedCount:
          response.results.length,
        totalFailures,
        totalSuccesses:
          totalSuccesses ?? null,
        failedResults: failures,
      },
    });
  }
}

export async function mapInsertedWixItem<
  Result,
>(
  dataGateway: WixDataGateway,
  collectionId: WixCollectionId,
  item: WixDataItem,
  map: (item: WixDataItem) => Result,
): Promise<Result> {
  try {
    return map(item);
  } catch (error) {
    let cleanupError: unknown = null;

    try {
      await removeWixDataItems(
        dataGateway,
        collectionId,
        [item.id],
      );
    } catch (receivedCleanupError) {
      cleanupError = receivedCleanupError;
    }

    throw new ApplicationError({
      code: "STORAGE_ERROR",
      message:
        "Wix saved a record but returned data that could not be verified.",
      statusCode: 502,
      details: {
        collectionId,
        itemId: item.id,
        cleanupFailed:
          cleanupError !== null,
      },
      cause: cleanupError ?? error,
    });
  }
}
