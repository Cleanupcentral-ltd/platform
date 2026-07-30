import type {
  CreateStatusHistoryRecord,
  StatusHistoryRecord,
} from "../../../domain/models.js";

import type {
  StatusHistoryRepository,
} from "../../../ports/repositories.js";

import {
  WIX_COLLECTIONS,
  WIX_FIELDS,
} from "../collections.js";

import type {
  WixDataGateway,
} from "../wix-data-client.js";

import {
  mapStatusHistoryCreateToWix,
  mapStatusHistoryFromWix,
} from "./status-history-mapper.js";

import {
  mapInsertedWixItem,
  removeWixDataItems,
} from "./wix-bulk-write.js";

export class WixStatusHistoryRepository
  implements StatusHistoryRepository
{
  constructor(
    private readonly dataGateway:
      WixDataGateway,
  ) {}

  async findByQuoteId(
    quoteId: string,
  ): Promise<StatusHistoryRecord | null> {
    const response =
      await this.dataGateway.queryDataItems(
        WIX_COLLECTIONS.statusHistory,
        {
          filter: {
            [WIX_FIELDS.statusHistory.quote]: {
              $eq: quoteId,
            },
          },

          paging: {
            limit: 1,
            offset: 0,
          },
        },
        {
          consistentRead: true,
        },
      );

    const item = response.dataItems[0];

    return item === undefined
      ? null
      : mapStatusHistoryFromWix(item);
  }

  async create(
    history:
      CreateStatusHistoryRecord,
  ): Promise<StatusHistoryRecord> {
    const response =
      await this.dataGateway.insertDataItem(
        WIX_COLLECTIONS.statusHistory,
        mapStatusHistoryCreateToWix(
          history,
        ),
      );

    return mapInsertedWixItem(
      this.dataGateway,
      WIX_COLLECTIONS.statusHistory,
      response.dataItem,
      mapStatusHistoryFromWix,
    );
  }

  async delete(
    historyId: string,
  ): Promise<void> {
    await removeWixDataItems(
      this.dataGateway,
      WIX_COLLECTIONS.statusHistory,
      [historyId],
    );
  }
}
