import assert from "node:assert/strict";
import test from "node:test";

import {
  QUOTE_ATTACHMENT_STAGING_PATH,
  createQuoteAttachmentUploadService,
} from "../src/application/upload-quote-attachment.js";

import {
  QuoteAttachmentValidationError,
} from "../src/application/validation/quote-attachment.js";

import type {
  PrivateMediaStorage,
  PrivateMediaUploadRequest,
} from "../src/ports/media-storage.js";

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

test(
  "validates and stages a private quote attachment",
  async () => {
    const captured: {
      value:
        PrivateMediaUploadRequest | null;
    } = {
      value: null,
    };

    const mediaStorage:
      PrivateMediaStorage = {
        async uploadPrivateFile(
          input,
        ) {
          captured.value = input;

          return {
            fileId:
              "media-file-1.jpg",
            displayName:
              input.filename,
            parentFolderId:
              "folder-1",
            sizeBytes:
              input.content.byteLength,
            private: true,
            operationStatus:
              "READY",
          };
        },

        async deletePrivateFiles() {},
      };

    const service =
      createQuoteAttachmentUploadService({
        mediaStorage,
        idGenerator: {
          create: () =>
            "11111111-1111-4111-8111-111111111111",
        },
      });

    const result = await service.upload({
      originalFilename:
        "Kitchen Photo.JPG",
      declaredMimeType:
        "image/jpeg",
      content: jpegBytes(),
    });

    const storedRequest =
      captured.value;

    assert.ok(storedRequest);

    assert.equal(
      storedRequest.filename,
      [
        "11111111-1111-4111-8111-111111111111",
        "kitchen-photo.jpg",
      ].join("-"),
    );

    assert.equal(
      storedRequest.filePath,
      QUOTE_ATTACHMENT_STAGING_PATH,
    );

    assert.deepEqual(
      storedRequest.labels,
      [
        "cleanup-central",
        "quote-attachment",
        "pending",
      ],
    );

    assert.equal(
      result.fileId,
      "media-file-1.jpg",
    );

    assert.equal(
      result.safeFilename,
      "kitchen-photo.jpg",
    );

    assert.equal(
      result.private,
      true,
    );
  },
);

test(
  "stores a linked attachment in its quote-specific private folder",
  async () => {
    const received: {
      value:
        PrivateMediaUploadRequest | null;
    } = {
      value: null,
    };

    const mediaStorage:
      PrivateMediaStorage = {
        async uploadPrivateFile(
          input,
        ) {
          received.value =
            input;

          return {
            fileId:
              "media-file-2.jpg",
            displayName:
              input.filename,
            parentFolderId:
              "folder-2",
            sizeBytes:
              input.content.byteLength,
            private: true,
            operationStatus:
              "READY",
          };
        },

        async deletePrivateFiles() {},
      };

    const service =
      createQuoteAttachmentUploadService({
        mediaStorage,
        idGenerator: {
          create: () =>
            "22222222-2222-4222-8222-222222222222",
        },
      });

    await service.upload({
      originalFilename:
        "Bathroom Photo.jpg",
      declaredMimeType:
        "image/jpeg",
      content: jpegBytes(),
      storageFolderKey:
        "quote-11111111-1111-4111-8111-111111111111",
    });

    assert.ok(
      received.value,
    );

    assert.equal(
      received.value.filePath,
      "/cleanup-central/quote-attachments/quote-11111111-1111-4111-8111-111111111111",
    );

    assert.deepEqual(
      received.value.labels,
      [
        "cleanup-central",
        "quote-attachment",
        "linked",
      ],
    );
  },
);

test(
  "rejects invalid file contents before calling Wix Media",
  async () => {
    let uploadCalls = 0;

    const mediaStorage:
      PrivateMediaStorage = {
        async uploadPrivateFile() {
          uploadCalls += 1;

          throw new Error(
            "Upload should not run.",
          );
        },

        async deletePrivateFiles() {},
      };

    const service =
      createQuoteAttachmentUploadService({
        mediaStorage,
      });

    await assert.rejects(
      () =>
        service.upload({
          originalFilename:
            "photo.jpg",
          declaredMimeType:
            "image/jpeg",
          content:
            new TextEncoder().encode(
              "not an image",
            ),
        }),
      QuoteAttachmentValidationError,
    );

    assert.equal(uploadCalls, 0);
  },
);

test(
  "rejects an unsafe generated upload ID",
  async () => {
    const mediaStorage:
      PrivateMediaStorage = {
        async uploadPrivateFile() {
          throw new Error(
            "Upload should not run.",
          );
        },

        async deletePrivateFiles() {},
      };

    const service =
      createQuoteAttachmentUploadService({
        mediaStorage,
        idGenerator: {
          create: () =>
            "../../unsafe",
        },
      });

    await assert.rejects(
      () =>
        service.upload({
          originalFilename:
            "photo.jpg",
          declaredMimeType:
            "image/jpeg",
          content: jpegBytes(),
        }),
      /upload ID is invalid/,
    );
  },
);
