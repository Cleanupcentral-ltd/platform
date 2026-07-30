import {
  ApplicationError,
} from "../../../domain/errors.js";

import type {
  CreateQuoteItemRecord,
  QuoteItemRecord,
} from "../../../domain/models.js";

import type {
  QuoteItemRepository,
} from "../../../ports/repositories.js";

import {
  WIX_COLLECTIONS,
} from "../collections.js";

import type {
  WixDataGateway,
} from "../wix-data-client.js";

import {
  mapQuoteItemCreateToWix,
  mapQuoteItemFromWix,
} from "./quote-item-mapper.js";

import {
  removeWixDataItems,
} from "./wix-bulk-write.js";

export class WixQuoteItemRepository
  implements QuoteItemRepository
{
  constructor(
    private readonly dataGateway:
      WixDataGateway,
  ) {}

  async createMany(
    quoteItems:
      readonly CreateQuoteItemRecord[],
  ): Promise<readonly QuoteItemRecord[]> {
    if (quoteItems.length === 0) {
      return [];
    }

    const response =
      await this.dataGateway
        .bulkInsertDataItems(
          WIX_COLLECTIONS.quoteItems,
          quoteItems.map(
            mapQuoteItemCreateToWix,
          ),
        );

    const failedResults =
      response.results.filter(
        ({ itemMetadata }) =>
          itemMetadata.success === false ||
          itemMetadata.error !== undefined,
      );

    const totalFailures =
      response.bulkActionMetadata
        ?.totalFailures ?? 0;

    const orderedResults = [
      ...response.results,
    ].sort(
      (left, right) =>
        (
          left.itemMetadata
            .originalIndex ??
          Number.MAX_SAFE_INTEGER
        ) -
        (
          right.itemMetadata
            .originalIndex ??
          Number.MAX_SAFE_INTEGER
        ),
    );

    const incompleteResponse =
      orderedResults.length !==
        quoteItems.length ||
      orderedResults.some(
        ({ dataItem }) =>
          dataItem === undefined,
      );

    if (
      totalFailures > 0 ||
      failedResults.length > 0 ||
      incompleteResponse
    ) {
      const insertedIds =
        response.results
          .filter(
            ({ itemMetadata }) =>
              itemMetadata.success === true &&
              itemMetadata.error === undefined,
          )
          .map(
            ({ dataItem, itemMetadata }) =>
              dataItem?.id ??
              itemMetadata.id ??
              null,
          )
          .filter(
            (itemId): itemId is string =>
              itemId !== null,
          );

      let cleanupError: unknown = null;

      try {
        await removeWixDataItems(
          this.dataGateway,
          WIX_COLLECTIONS.quoteItems,
          insertedIds,
        );
      } catch (error) {
        cleanupError = error;
      }

      throw new ApplicationError({
        code: "STORAGE_ERROR",

        message:
          "One or more quote items could not be saved.",

        statusCode: 502,

        details: {
          expectedCount:
            quoteItems.length,
          returnedCount:
            orderedResults.length,
          totalFailures,
          failedResults,
          cleanupAttempted:
            insertedIds.length > 0,
          cleanupFailed:
            cleanupError !== null,
        },

        cause:
          cleanupError ?? undefined,
      });
    }

    const insertedIds =
      orderedResults.map(
        ({ dataItem }) =>
          dataItem!.id,
      );

    try {
      return orderedResults.map(
        ({ dataItem }) =>
          mapQuoteItemFromWix(
            dataItem!,
          ),
      );
    } catch (error) {
      let cleanupError: unknown = null;

      try {
        await removeWixDataItems(
          this.dataGateway,
          WIX_COLLECTIONS.quoteItems,
          insertedIds,
        );
      } catch (receivedCleanupError) {
        cleanupError =
          receivedCleanupError;
      }

      throw new ApplicationError({
        code: "STORAGE_ERROR",
        message:
          "Wix saved quote items but returned data that could not be verified.",
        statusCode: 502,
        details: {
          insertedCount:
            insertedIds.length,
          cleanupFailed:
            cleanupError !== null,
        },
        cause: cleanupError ?? error,
      });
    }
  }

  async deleteMany(
    quoteItemIds: readonly string[],
  ): Promise<void> {
    await removeWixDataItems(
      this.dataGateway,
      WIX_COLLECTIONS.quoteItems,
      quoteItemIds,
    );
  }
}
