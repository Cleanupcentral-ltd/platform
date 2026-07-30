import assert from "node:assert/strict";
import test from "node:test";

import {
  createQuoteAttachmentLinkingService,
} from "../src/application/link-quote-attachment.js";

import type {
  QuoteAttachmentUploadService,
  QuoteAttachmentUploadInput,
} from "../src/application/upload-quote-attachment.js";

import {
  ApplicationError,
} from "../src/domain/errors.js";

import type {
  CreateMediaUploadRecord,
  MediaUploadRecord,
  QuoteRecord,
} from "../src/domain/models.js";

import type {
  PrivateMediaStorage,
} from "../src/ports/media-storage.js";

import type {
  MediaUploadRepository,
  QuoteRepository,
} from "../src/ports/repositories.js";

const submissionId =
  "11111111-1111-4111-8111-111111111111";

const attachmentId =
  "22222222-2222-4222-8222-222222222222";

function jpegBytes(): Uint8Array {
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x10,
    0x4a,
    0x46,
    0x49,
    0x46,
    0x00,
    0x01,
    0x44,
    0x41,
    0x54,
    0x41,
  ]);
}

function quote(
  attachmentCount = 2,
): QuoteRecord {
  return {
    id:
      `quote-${submissionId}`,
    submissionId,
    quoteNumber:
      "CUC-Q-111111111111",
    customerId: "customer-1",
    propertyId: "property-1",
    schemaVersion: "1.0",
    pricingVersion:
      "CUC Phase 0 v1.3",
    status: "Submitted",
    category:
      "Residential Cleaning",
    serviceType:
      "Standard Clean",
    cleaningScope:
      "Whole Property",
    declaredCustomerType:
      "New customer",
    verifiedCustomerStatus:
      "Verified New",
    customerStatusMismatch: false,
    preferredContactMethod:
      "Email",
    preferredDate:
      "2026-08-15",
    arrivalWindow:
      "08:00–11:00",
    preferredStartDate: null,
    requiredCompletionDate: null,
    sameDay: false,
    arrangement: null,
    frequency: null,
    urgency: null,
    supportServices: [],
    manualReviewRequired: false,
    manualReviewReasons: [],
    estimatedTotal: 93.5,
    requiredUpfrontPercentage: 30,
    requiredUpfrontAmount: 28.05,
    remainingBalance: 65.45,
    travelFee: 0,
    travelPending: false,
    distanceMiles: 0,
    provisional: false,
    customerNotes: null,
    rawSubmission: {
      attachmentCount,
    },
    pricingSnapshot: {},
  };
}

function storedRecord(
  overrides:
    Partial<MediaUploadRecord> = {},
): MediaUploadRecord {
  return {
    id:
      `quote-attachment-${attachmentId}`,
    uploadLabel:
      "CUC-Q-111111111111 attachment 1",
    quoteId:
      `quote-${submissionId}`,
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
    sizeBytes:
      jpegBytes().byteLength,
    uploadStatus: "Uploaded",
    customerVisible: false,
    displayOrder: 1,
    internalNotes: null,
    ...overrides,
  };
}

function quoteRepository(
  record:
    QuoteRecord | null,
): QuoteRepository {
  return {
    async findBySubmissionId() {
      return record;
    },

    async create() {
      throw new Error(
        "Not used by attachment tests.",
      );
    },

    async delete() {},
  };
}

function mediaRepository(
  options: {
    readonly byId?:
      MediaUploadRecord | null;
    readonly onFindById?: () =>
      Promise<MediaUploadRecord | null>;
    readonly byQuote?:
      readonly MediaUploadRecord[];
    readonly onCreate?: (
      upload:
        CreateMediaUploadRecord,
      itemId:
        string | undefined,
    ) => Promise<MediaUploadRecord>;
  } = {},
): MediaUploadRepository {
  return {
    async findById() {
      if (options.onFindById) {
        return options.onFindById();
      }

      return options.byId ?? null;
    },

    async findByQuoteId() {
      return options.byQuote ?? [];
    },

    async create(
      upload,
      createOptions,
    ) {
      if (options.onCreate) {
        return options.onCreate(
          upload,
          createOptions?.itemId,
        );
      }

      return {
        id:
          createOptions?.itemId ??
          "media-upload-1",
        ...upload,
      };
    },

    async delete() {},
    async deleteMany() {},
  };
}

function uploadService(
  onUpload?: (
    input:
      QuoteAttachmentUploadInput,
  ) => void,
): QuoteAttachmentUploadService {
  return {
    async upload(input) {
      onUpload?.(input);

      return {
        fileId:
          "media-file-1.jpg",
        originalFilename:
          input.originalFilename,
        safeFilename:
          "kitchen-photo.jpg",
        storedFilename:
          "upload-kitchen-photo.jpg",
        mimeType: "image/jpeg",
        mediaKind: "image",
        sizeBytes:
          input.content.byteLength,
        parentFolderId:
          "folder-1",
        operationStatus: "READY",
        private: true,
      };
    },
  };
}

function mediaStorage(
  onDelete?: (
    fileIds:
      readonly string[],
  ) => Promise<void>,
): PrivateMediaStorage {
  return {
    async uploadPrivateFile() {
      throw new Error(
        "The linking service should use the upload service.",
      );
    },

    async deletePrivateFiles(
      fileIds,
    ) {
      await onDelete?.(fileIds);
    },
  };
}

function input() {
  return {
    submissionId,
    attachmentId,
    originalFilename:
      "Kitchen Photo.JPG",
    declaredMimeType:
      "image/jpeg",
    content: jpegBytes(),
  } as const;
}

test(
  "uploads and links a private attachment to its quote record",
  async () => {
    const uploadedInput: {
      value:
        QuoteAttachmentUploadInput | null;
    } = {
      value: null,
    };

    const createdRecord: {
      value:
        CreateMediaUploadRecord | null;
    } = {
      value: null,
    };

    const createdItemId: {
      value:
        string | undefined;
    } = {
      value: undefined,
    };

    const service =
      createQuoteAttachmentLinkingService({
        quotes:
          quoteRepository(
            quote(),
          ),

        mediaUploads:
          mediaRepository({
            onCreate:
              async (
                record,
                itemId,
              ) => {
                createdRecord.value =
                  record;
                createdItemId.value =
                  itemId;

                return {
                  id:
                    itemId ??
                    "media-upload-1",
                  ...record,
                };
              },
          }),

        uploadService:
          uploadService(
            (received) => {
              uploadedInput.value =
                received;
            },
          ),

        mediaStorage:
          mediaStorage(),
      });

    const result =
      await service.link(
        input(),
      );

    assert.equal(
      result.outcome,
      "created",
    );

    assert.ok(
      uploadedInput.value,
    );

    assert.equal(
      uploadedInput.value
        .storageFolderKey,
      `quote-${submissionId}`,
    );

    assert.equal(
      createdItemId.value,
      `quote-attachment-${attachmentId}`,
    );

    assert.ok(
      createdRecord.value,
    );

    assert.equal(
      createdRecord.value.quoteId,
      `quote-${submissionId}`,
    );

    assert.equal(
      createdRecord.value.fileName,
      "kitchen-photo.jpg",
    );

    assert.equal(
      createdRecord.value.wixMediaId,
      "media-file-1.jpg",
    );

    assert.equal(
      createdRecord.value.uploadStatus,
      "Uploaded",
    );
  },
);

test(
  "replays an identical attachment without uploading another file",
  async () => {
    let uploadCalls = 0;

    const service =
      createQuoteAttachmentLinkingService({
        quotes:
          quoteRepository(
            quote(),
          ),

        mediaUploads:
          mediaRepository({
            byId:
              storedRecord(),
          }),

        uploadService:
          uploadService(() => {
            uploadCalls += 1;
          }),

        mediaStorage:
          mediaStorage(),
      });

    const result =
      await service.link(
        input(),
      );

    assert.equal(
      result.outcome,
      "replayed",
    );

    assert.equal(uploadCalls, 0);
  },
);

test(
  "rejects an attachment when the quote cannot be found",
  async () => {
    let uploadCalls = 0;

    const service =
      createQuoteAttachmentLinkingService({
        quotes:
          quoteRepository(null),

        mediaUploads:
          mediaRepository(),

        uploadService:
          uploadService(() => {
            uploadCalls += 1;
          }),

        mediaStorage:
          mediaStorage(),
      });

    await assert.rejects(
      () =>
        service.link(
          input(),
        ),

      (error: unknown) => {
        assert.ok(
          error instanceof
            ApplicationError,
        );

        assert.equal(
          error.code,
          "NOT_FOUND",
        );

        return true;
      },
    );

    assert.equal(uploadCalls, 0);
  },
);

test(
  "does not exceed the attachment count declared by the quote",
  async () => {
    let uploadCalls = 0;

    const service =
      createQuoteAttachmentLinkingService({
        quotes:
          quoteRepository(
            quote(1),
          ),

        mediaUploads:
          mediaRepository({
            byQuote: [
              storedRecord({
                id:
                  "quote-attachment-33333333-3333-4333-8333-333333333333",
              }),
            ],
          }),

        uploadService:
          uploadService(() => {
            uploadCalls += 1;
          }),

        mediaStorage:
          mediaStorage(),
      });

    await assert.rejects(
      () =>
        service.link(
          input(),
        ),

      (error: unknown) => {
        assert.ok(
          error instanceof
            ApplicationError,
        );

        assert.equal(
          error.code,
          "CONFLICT",
        );

        return true;
      },
    );

    assert.equal(uploadCalls, 0);
  },
);

test(
  "deletes the uploaded Wix file when the Media Uploads record fails",
  async () => {
    const deleted:
      string[][] = [];

    const recordError =
      new ApplicationError({
        code: "STORAGE_ERROR",
        message:
          "CMS record failed.",
        statusCode: 502,
      });

    const service =
      createQuoteAttachmentLinkingService({
        quotes:
          quoteRepository(
            quote(),
          ),

        mediaUploads:
          mediaRepository({
            onCreate:
              async () => {
                throw recordError;
              },
          }),

        uploadService:
          uploadService(),

        mediaStorage:
          mediaStorage(
            async (fileIds) => {
              deleted.push([
                ...fileIds,
              ]);
            },
          ),
      });

    await assert.rejects(
      () =>
        service.link(
          input(),
        ),
      (error: unknown) =>
        error === recordError,
    );

    assert.deepEqual(
      deleted,
      [
        [
          "media-file-1.jpg",
        ],
      ],
    );
  },
);


test(
  "replays safely when another backend creates the same attachment record first",
  async () => {
    let findCalls = 0;

    const deleted:
      string[][] = [];

    const existing =
      storedRecord({
        wixMediaId:
          "media-file-from-other-backend.jpg",
      });

    const service =
      createQuoteAttachmentLinkingService({
        quotes:
          quoteRepository(
            quote(),
          ),

        mediaUploads:
          mediaRepository({
            onFindById:
              async () => {
                findCalls += 1;

                return findCalls === 1
                  ? null
                  : existing;
              },

            onCreate:
              async () => {
                throw new ApplicationError({
                  code: "STORAGE_ERROR",
                  message:
                    "The deterministic item ID already exists.",
                  statusCode: 502,
                });
              },
          }),

        uploadService:
          uploadService(),

        mediaStorage:
          mediaStorage(
            async (fileIds) => {
              deleted.push([
                ...fileIds,
              ]);
            },
          ),
      });

    const result =
      await service.link(
        input(),
      );

    assert.equal(
      result.outcome,
      "replayed",
    );

    assert.equal(
      result.attachment.wixMediaId,
      "media-file-from-other-backend.jpg",
    );

    assert.deepEqual(
      deleted,
      [
        [
          "media-file-1.jpg",
        ],
      ],
    );
  },
);

test(
  "reports a cleanup failure when neither the record nor uploaded file can be retained safely",
  async () => {
    const service =
      createQuoteAttachmentLinkingService({
        quotes:
          quoteRepository(
            quote(),
          ),

        mediaUploads:
          mediaRepository({
            onCreate:
              async () => {
                throw new Error(
                  "CMS failed.",
                );
              },
          }),

        uploadService:
          uploadService(),

        mediaStorage:
          mediaStorage(
            async () => {
              throw new Error(
                "Media cleanup failed.",
              );
            },
          ),
      });

    await assert.rejects(
      () =>
        service.link(
          input(),
        ),

      (error: unknown) => {
        assert.ok(
          error instanceof
            ApplicationError,
        );

        assert.equal(
          error.code,
          "STORAGE_ERROR",
        );

        assert.equal(
          error.details?.[
            "cleanupFailed"
          ],
          true,
        );

        return true;
      },
    );
  },
);
