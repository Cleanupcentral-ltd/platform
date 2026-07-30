import {
  randomUUID,
} from "node:crypto";

import type {
  PrivateMediaStorage,
  StoredPrivateMediaFile,
} from "../ports/media-storage.js";

import type {
  IdGenerator,
} from "../ports/system.js";

import {
  QUOTE_ATTACHMENT_POLICY,
  validateQuoteAttachments,
  type QuoteAttachmentMediaKind,
  type QuoteAttachmentMimeType,
} from "./validation/quote-attachment.js";

export const QUOTE_ATTACHMENT_STAGING_PATH =
  "/cleanup-central/quote-attachments/pending";

export const QUOTE_ATTACHMENT_STORAGE_PATH =
  "/cleanup-central/quote-attachments";

const QUOTE_ATTACHMENT_STAGING_LABELS = [
  "cleanup-central",
  "quote-attachment",
  "pending",
] as const;

const QUOTE_ATTACHMENT_LINKED_LABELS = [
  "cleanup-central",
  "quote-attachment",
  "linked",
] as const;

export interface QuoteAttachmentUploadInput {
  readonly originalFilename: string;
  readonly declaredMimeType: string;
  readonly content: Uint8Array;

  /**
   * When present, the file is stored directly in the
   * quote-specific private folder. When omitted, the file
   * remains in the pending staging folder.
   */
  readonly storageFolderKey?: string;
}

export interface StagedQuoteAttachment {
  readonly fileId: string;
  readonly originalFilename: string;
  readonly safeFilename: string;
  readonly storedFilename: string;
  readonly mimeType:
    QuoteAttachmentMimeType;
  readonly mediaKind:
    QuoteAttachmentMediaKind;
  readonly sizeBytes: number;
  readonly parentFolderId:
    string | null;
  readonly operationStatus:
    string | null;
  readonly private: true;
}

export interface QuoteAttachmentUploadService {
  upload(
    input:
      QuoteAttachmentUploadInput,
  ): Promise<StagedQuoteAttachment>;
}

export interface QuoteAttachmentUploadDependencies {
  readonly mediaStorage:
    PrivateMediaStorage;
  readonly idGenerator?:
    IdGenerator;
}

function defaultIdGenerator(): IdGenerator {
  return {
    create: randomUUID,
  };
}

function safeUploadId(
  id: string,
): string {
  const normalized = id
    .trim()
    .toLowerCase();

  if (
    !/^[a-z0-9][a-z0-9-]{7,63}$/.test(
      normalized,
    )
  ) {
    throw new Error(
      "The attachment upload ID is invalid.",
    );
  }

  return normalized;
}

function safeStorageFolderKey(
  value: string,
): string {
  const normalized = value
    .trim()
    .toLowerCase();

  if (
    !/^[a-z0-9][a-z0-9-]{7,127}$/.test(
      normalized,
    )
  ) {
    throw new Error(
      "The attachment storage folder key is invalid.",
    );
  }

  return normalized;
}

function storageDestination(
  storageFolderKey:
    string | undefined,
): {
  readonly filePath: string;
  readonly labels:
    readonly string[];
} {
  if (
    storageFolderKey === undefined
  ) {
    return {
      filePath:
        QUOTE_ATTACHMENT_STAGING_PATH,
      labels:
        QUOTE_ATTACHMENT_STAGING_LABELS,
    };
  }

  const folderKey =
    safeStorageFolderKey(
      storageFolderKey,
    );

  return {
    filePath:
      `${QUOTE_ATTACHMENT_STORAGE_PATH}/${folderKey}`,
    labels:
      QUOTE_ATTACHMENT_LINKED_LABELS,
  };
}

function storedFilename(
  uploadId: string,
  safeFilename: string,
): string {
  return `${uploadId}-${safeFilename}`;
}

function validateStoredFile(
  file: StoredPrivateMediaFile,
  expectedSize: number,
): void {
  if (
    file.private !== true ||
    file.sizeBytes !== expectedSize
  ) {
    throw new Error(
      "The stored attachment metadata is invalid.",
    );
  }
}

export function createQuoteAttachmentUploadService(
  dependencies:
    QuoteAttachmentUploadDependencies,
): QuoteAttachmentUploadService {
  const idGenerator =
    dependencies.idGenerator ??
    defaultIdGenerator();

  return {
    async upload(
      input,
    ): Promise<StagedQuoteAttachment> {
      const headerBytes =
        input.content.slice(
          0,
          QUOTE_ATTACHMENT_POLICY
            .minimumHeaderBytes,
        );

      const [validated] =
        validateQuoteAttachments([
          {
            originalFilename:
              input.originalFilename,
            declaredMimeType:
              input.declaredMimeType,
            sizeBytes:
              input.content.byteLength,
            headerBytes,
          },
        ]);

      if (!validated) {
        throw new Error(
          "Attachment validation returned no result.",
        );
      }

      const uploadId = safeUploadId(
        idGenerator.create(),
      );

      const uploadFilename =
        storedFilename(
          uploadId,
          validated.safeFilename,
        );

      const destination =
        storageDestination(
          input.storageFolderKey,
        );

      const stored =
        await dependencies.mediaStorage
          .uploadPrivateFile({
            filename:
              uploadFilename,
            mimeType:
              validated.mimeType,
            content:
              input.content,
            filePath:
              destination.filePath,
            labels:
              destination.labels,
          });

      validateStoredFile(
        stored,
        validated.sizeBytes,
      );

      return {
        fileId: stored.fileId,
        originalFilename:
          validated.originalFilename,
        safeFilename:
          validated.safeFilename,
        storedFilename:
          uploadFilename,
        mimeType:
          validated.mimeType,
        mediaKind:
          validated.mediaKind,
        sizeBytes:
          validated.sizeBytes,
        parentFolderId:
          stored.parentFolderId,
        operationStatus:
          stored.operationStatus,
        private: true,
      };
    },
  };
}
