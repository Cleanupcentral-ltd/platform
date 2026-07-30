import {
  ApplicationError,
} from "../../../domain/errors.js";

import type {
  CreateQuoteRecord,
  QuoteRecord,
} from "../../../domain/models.js";

import type {
  QuoteCreateOptions,
  QuoteRepository,
} from "../../../ports/repositories.js";

import {
  WIX_COLLECTIONS,
  WIX_FIELDS,
} from "../collections.js";

import type {
  WixDataGateway,
} from "../wix-data-client.js";

import {
  mapQuoteCreateToWix,
  mapQuoteFromWix,
} from "./quote-mapper.js";

import {
  mapInsertedWixItem,
  removeWixDataItems,
} from "./wix-bulk-write.js";

export class WixQuoteRepository
  implements QuoteRepository
{
  constructor(
    private readonly dataGateway:
      WixDataGateway,
  ) {}

  async findBySubmissionId(
    submissionId: string,
  ): Promise<QuoteRecord | null> {
    const response =
      await this.dataGateway.queryDataItems(
        WIX_COLLECTIONS.quotes,
        {
          filter: {
            [WIX_FIELDS.quotes
              .submissionId]: {
              $eq: submissionId,
            },
          },

          paging: {
            limit: 2,
            offset: 0,
          },
        },
        {
          consistentRead: true,
        },
      );

    if (response.dataItems.length === 0) {
      return null;
    }

    if (response.dataItems.length > 1) {
      throw new ApplicationError({
        code: "STORAGE_ERROR",

        message:
          "More than one quote uses the same submission ID.",

        statusCode: 502,

        details: {
          submissionId,
          matchingRecordCount:
            response.dataItems.length,
        },
      });
    }

    return mapQuoteFromWix(
      response.dataItems[0]!,
    );
  }

  async create(
    quote: CreateQuoteRecord,
    options: QuoteCreateOptions = {},
  ): Promise<QuoteRecord> {
    const response =
      await this.dataGateway.insertDataItem(
        WIX_COLLECTIONS.quotes,
        mapQuoteCreateToWix(quote),
        options.itemId,
      );

    return mapInsertedWixItem(
      this.dataGateway,
      WIX_COLLECTIONS.quotes,
      response.dataItem,
      mapQuoteFromWix,
    );
  }

  async delete(
    quoteId: string,
  ): Promise<void> {
    await removeWixDataItems(
      this.dataGateway,
      WIX_COLLECTIONS.quotes,
      [quoteId],
    );
  }
}
