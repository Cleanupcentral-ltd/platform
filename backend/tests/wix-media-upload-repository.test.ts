import assert from "node:assert/strict";
import test from "node:test";

import type {
  CreateMediaUploadRecord,
} from "../src/domain/models.js";

import {
  WixMediaUploadRepository,
} from "../src/adapters/wix/repositories/wix-media-upload-repository.js";

import {
  createWixDataGateway,
} from "./support/create-wix-data-gateway.js";

const createRecord = {
  uploadLabel:
    "CUC-Q-TEST attachment 1",
  quoteId: "quote-1",
  contactEnquiryId: null,
  uploadContext: "Quote",
  sourceField:
    "quoteAttachments",
  fileName:
    "kitchen-photo.jpg",
  fileExtension: "jpg",
  mimeType: "image/jpeg",
  mediaType: "Image",
  mediaUrl: null,
  wixMediaId:
    "media-file-1.jpg",
  sizeBytes: 16,
  uploadStatus: "Uploaded",
  customerVisible: false,
  displayOrder: 1,
  internalNotes: null,
} satisfies CreateMediaUploadRecord;

const wixData = {
  uploadLabel:
    createRecord.uploadLabel,
  quote: createRecord.quoteId,
  contactEnquiry:
    createRecord.contactEnquiryId,
  uploadContext:
    createRecord.uploadContext,
  sourceField:
    createRecord.sourceField,
  fileName:
    createRecord.fileName,
  fileExtension:
    createRecord.fileExtension,
  mimeType:
    createRecord.mimeType,
  mediaType:
    createRecord.mediaType,
  mediaUrl:
    createRecord.mediaUrl,
  wixMediaId:
    createRecord.wixMediaId,
  sizeBytes:
    createRecord.sizeBytes,
  uploadStatus:
    createRecord.uploadStatus,
  customerVisible:
    createRecord.customerVisible,
  displayOrder:
    createRecord.displayOrder,
  internalNotes:
    createRecord.internalNotes,
};

test(
  "creates a Media Uploads record with a deterministic item ID",
  async () => {
    let receivedCollection = "";
    let receivedData: unknown;
    let receivedItemId:
      string | undefined;

    const gateway =
      createWixDataGateway({
        async insertDataItem(
          collectionId,
          data,
          itemId,
        ) {
          receivedCollection =
            collectionId;
          receivedData = data;
          receivedItemId =
            itemId;

          return {
            dataItem: {
              id:
                itemId ??
                "upload-1",
              dataCollectionId:
                collectionId,
              data,
            },
          };
        },
      });

    const repository =
      new WixMediaUploadRepository(
        gateway,
      );

    const created =
      await repository.create(
        createRecord,
        {
          itemId:
            "quote-attachment-1",
        },
      );

    assert.equal(
      receivedCollection,
      "MediaUploads",
    );

    assert.deepEqual(
      receivedData,
      wixData,
    );

    assert.equal(
      receivedItemId,
      "quote-attachment-1",
    );

    assert.equal(
      created.quoteId,
      "quote-1",
    );
  },
);

test(
  "finds a Media Uploads record by deterministic item ID",
  async () => {
    let receivedQuery: unknown;
    let receivedOptions: unknown;

    const gateway =
      createWixDataGateway({
        async queryDataItems(
          collectionId,
          query,
          options,
        ) {
          assert.equal(
            collectionId,
            "MediaUploads",
          );

          receivedQuery = query;
          receivedOptions =
            options;

          return {
            dataItems: [
              {
                id:
                  "quote-attachment-1",
                dataCollectionId:
                  "MediaUploads",
                data: wixData,
              },
            ],
          };
        },
      });

    const repository =
      new WixMediaUploadRepository(
        gateway,
      );

    const found =
      await repository.findById(
        "quote-attachment-1",
      );

    assert.deepEqual(
      receivedQuery,
      {
        filter: {
          _id: {
            $eq:
              "quote-attachment-1",
          },
        },
        paging: {
          limit: 2,
          offset: 0,
        },
      },
    );

    assert.deepEqual(
      receivedOptions,
      {
        consistentRead: true,
      },
    );

    assert.equal(
      found?.wixMediaId,
      "media-file-1.jpg",
    );
  },
);

test(
  "finds quote attachments in display order using a consistent read",
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
            "MediaUploads",
          );

          receivedQuery = query;

          return {
            dataItems: [
              {
                id: "upload-2",
                dataCollectionId:
                  "MediaUploads",
                data: {
                  ...wixData,
                  displayOrder: 2,
                  fileName:
                    "second.jpg",
                },
              },
              {
                id: "upload-1",
                dataCollectionId:
                  "MediaUploads",
                data: wixData,
              },
            ],
          };
        },
      });

    const repository =
      new WixMediaUploadRepository(
        gateway,
      );

    const found =
      await repository.findByQuoteId(
        "quote-1",
      );

    assert.deepEqual(
      receivedQuery,
      {
        filter: {
          quote: {
            $eq: "quote-1",
          },
        },
        paging: {
          limit: 20,
          offset: 0,
        },
      },
    );

    assert.deepEqual(
      found.map(
        ({ displayOrder }) =>
          displayOrder,
      ),
      [1, 2],
    );
  },
);
