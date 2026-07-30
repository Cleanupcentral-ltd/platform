import {
  ApplicationError,
} from "../../../domain/errors.js";

import type {
  CreateMediaUploadRecord,
  MediaUploadRecord,
} from "../../../domain/models.js";

import type {
  MediaUploadCreateOptions,
  MediaUploadRepository,
} from "../../../ports/repositories.js";

import {
  WIX_COLLECTIONS,
  WIX_FIELDS,
} from "../collections.js";

import type {
  WixDataGateway,
} from "../wix-data-client.js";

import {
  mapMediaUploadCreateToWix,
  mapMediaUploadFromWix,
} from "./media-upload-mapper.js";

import {
  mapInsertedWixItem,
  removeWixDataItems,
} from "./wix-bulk-write.js";

function duplicateRecordError(
  uploadId: string,
): ApplicationError {
  return new ApplicationError({
    code: "STORAGE_ERROR",
    message:
      "Wix returned duplicate media upload records.",
    statusCode: 502,
    details: {
      uploadId,
    },
  });
}

export class WixMediaUploadRepository
  implements MediaUploadRepository
{
  constructor(
    private readonly dataGateway:
      WixDataGateway,
  ) {}

  async findById(
    uploadId: string,
  ): Promise<MediaUploadRecord | null> {
    const response =
      await this.dataGateway.queryDataItems(
        WIX_COLLECTIONS.mediaUploads,
        {
          filter: {
            _id: {
              $eq: uploadId,
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

    if (response.dataItems.length > 1) {
      throw duplicateRecordError(
        uploadId,
      );
    }

    const item = response.dataItems[0];

    return item === undefined
      ? null
      : mapMediaUploadFromWix(item);
  }

  async findByQuoteId(
    quoteId: string,
  ): Promise<readonly MediaUploadRecord[]> {
    const response =
      await this.dataGateway.queryDataItems(
        WIX_COLLECTIONS.mediaUploads,
        {
          filter: {
            [WIX_FIELDS.mediaUploads.quote]: {
              $eq: quoteId,
            },
          },

          paging: {
            limit: 20,
            offset: 0,
          },
        },
        {
          consistentRead: true,
        },
      );

    return response.dataItems
      .map(mapMediaUploadFromWix)
      .sort(
        (left, right) =>
          left.displayOrder -
          right.displayOrder,
      );
  }

  async create(
    upload: CreateMediaUploadRecord,
    options:
      MediaUploadCreateOptions = {},
  ): Promise<MediaUploadRecord> {
    const response =
      await this.dataGateway.insertDataItem(
        WIX_COLLECTIONS.mediaUploads,
        mapMediaUploadCreateToWix(
          upload,
        ),
        options.itemId,
      );

    return mapInsertedWixItem(
      this.dataGateway,
      WIX_COLLECTIONS.mediaUploads,
      response.dataItem,
      mapMediaUploadFromWix,
    );
  }

  async delete(
    uploadId: string,
  ): Promise<void> {
    await this.deleteMany([
      uploadId,
    ]);
  }

  async deleteMany(
    uploadIds: readonly string[],
  ): Promise<void> {
    await removeWixDataItems(
      this.dataGateway,
      WIX_COLLECTIONS.mediaUploads,
      uploadIds,
    );
  }
}
