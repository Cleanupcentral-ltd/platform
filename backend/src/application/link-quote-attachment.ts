import {
  ApplicationError,
} from "../domain/errors.js";

import type {
  CreateMediaUploadRecord,
  MediaUploadRecord,
  QuoteRecord,
} from "../domain/models.js";

import type {
  PrivateMediaStorage,
} from "../ports/media-storage.js";

import type {
  MediaUploadRepository,
  QuoteRepository,
} from "../ports/repositories.js";

import type {
  QuoteAttachmentUploadService,
  QuoteAttachmentUploadInput,
} from "./upload-quote-attachment.js";

import {
  QUOTE_ATTACHMENT_POLICY,
  validateQuoteAttachments,
  type ValidatedQuoteAttachment,
} from "./validation/quote-attachment.js";

export const QUOTE_ATTACHMENT_SOURCE_FIELD =
  "quoteAttachments";

export const QUOTE_ATTACHMENT_ITEM_ID_PREFIX =
  "quote-attachment-";

export interface LinkQuoteAttachmentInput {
  readonly submissionId: string;
  readonly attachmentId: string;
  readonly originalFilename: string;
  readonly declaredMimeType: string;
  readonly content: Uint8Array;
}

export interface CreatedLinkedQuoteAttachment {
  readonly outcome: "created";
  readonly attachment:
    MediaUploadRecord;
}

export interface ReplayedLinkedQuoteAttachment {
  readonly outcome: "replayed";
  readonly attachment:
    MediaUploadRecord;
}

export type LinkedQuoteAttachment =
  | CreatedLinkedQuoteAttachment
  | ReplayedLinkedQuoteAttachment;

export interface QuoteAttachmentLinkingService {
  link(
    input:
      LinkQuoteAttachmentInput,
  ): Promise<LinkedQuoteAttachment>;
}

export interface QuoteAttachmentLinkingDependencies {
  readonly quotes: QuoteRepository;
  readonly mediaUploads:
    MediaUploadRepository;
  readonly uploadService:
    QuoteAttachmentUploadService;
  readonly mediaStorage:
    PrivateMediaStorage;
}

function attachmentItemId(
  attachmentId: string,
): string {
  const normalized =
    attachmentId
      .trim()
      .toLowerCase();

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      normalized,
    )
  ) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message:
        "The attachment reference is invalid.",
      statusCode: 400,
    });
  }

  return (
    QUOTE_ATTACHMENT_ITEM_ID_PREFIX +
    normalized
  );
}

function validatedAttachment(
  input:
    LinkQuoteAttachmentInput,
): ValidatedQuoteAttachment {
  const [validated] =
    validateQuoteAttachments([
      {
        originalFilename:
          input.originalFilename,
        declaredMimeType:
          input.declaredMimeType,
        sizeBytes:
          input.content.byteLength,
        headerBytes:
          input.content.slice(
            0,
            QUOTE_ATTACHMENT_POLICY
              .minimumHeaderBytes,
          ),
      },
    ]);

  if (!validated) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message:
        "Attachment validation returned no result.",
      statusCode: 400,
    });
  }

  return validated;
}

function expectedAttachmentCount(
  quote: QuoteRecord,
): number {
  const rawValue =
    quote.rawSubmission[
      "attachmentCount"
    ];

  if (
    typeof rawValue !== "number" ||
    !Number.isSafeInteger(rawValue) ||
    rawValue < 0 ||
    rawValue >
      QUOTE_ATTACHMENT_POLICY.maxFiles
  ) {
    throw new ApplicationError({
      code: "STORAGE_ERROR",
      message:
        "The quote contains an invalid attachment count.",
      statusCode: 502,
      details: {
        quoteId: quote.id,
      },
    });
  }

  return rawValue;
}

function sameAttachment(
  existing: MediaUploadRecord,
  quote: QuoteRecord,
  validated:
    ValidatedQuoteAttachment,
): boolean {
  const expectedMediaType =
    validated.mediaKind === "image"
      ? "Image"
      : "Document";

  return (
    existing.quoteId === quote.id &&
    existing.contactEnquiryId ===
      null &&
    existing.uploadContext ===
      "Quote" &&
    existing.sourceField ===
      QUOTE_ATTACHMENT_SOURCE_FIELD &&
    existing.fileName ===
      validated.safeFilename &&
    existing.fileExtension ===
      validated.extension &&
    existing.mimeType ===
      validated.mimeType &&
    existing.mediaType ===
      expectedMediaType &&
    existing.sizeBytes ===
      validated.sizeBytes &&
    existing.uploadStatus ===
      "Uploaded"
  );
}

function attachmentConflict(
  message: string,
): ApplicationError {
  return new ApplicationError({
    code: "CONFLICT",
    message,
    statusCode: 409,
  });
}

function totalStoredBytes(
  uploads:
    readonly MediaUploadRecord[],
): number {
  return uploads.reduce(
    (total, upload) =>
      total + upload.sizeBytes,
    0,
  );
}

function nextDisplayOrder(
  uploads:
    readonly MediaUploadRecord[],
): number {
  const maximum = uploads.reduce(
    (current, upload) =>
      Math.max(
        current,
        upload.displayOrder,
      ),
    0,
  );

  return maximum + 1;
}

function createUploadRecord(
  quote: QuoteRecord,
  validated:
    ValidatedQuoteAttachment,
  wixMediaId: string,
  displayOrder: number,
): CreateMediaUploadRecord {
  return {
    uploadLabel:
      `${quote.quoteNumber} attachment ${displayOrder}`,
    quoteId: quote.id,
    contactEnquiryId: null,
    uploadContext: "Quote",
    sourceField:
      QUOTE_ATTACHMENT_SOURCE_FIELD,
    fileName:
      validated.safeFilename,
    fileExtension:
      validated.extension,
    mimeType:
      validated.mimeType,
    mediaType:
      validated.mediaKind ===
      "image"
        ? "Image"
        : "Document",
    mediaUrl: null,
    wixMediaId,
    sizeBytes:
      validated.sizeBytes,
    uploadStatus: "Uploaded",
    customerVisible: false,
    displayOrder,
    internalNotes: null,
  };
}

async function cleanUpUploadedMedia(
  mediaStorage:
    PrivateMediaStorage,
  wixMediaId: string,
  originalError: unknown,
): Promise<void> {
  try {
    await mediaStorage
      .deletePrivateFiles([
        wixMediaId,
      ]);
  } catch (cleanupError) {
    throw new ApplicationError({
      code: "STORAGE_ERROR",
      message:
        "The attachment could not be linked and its uploaded file could not be cleaned up.",
      statusCode: 502,
      details: {
        wixMediaId,
        cleanupFailed: true,
      },
      cause: new AggregateError(
        [
          originalError,
          cleanupError,
        ],
        "Attachment linking and cleanup failed.",
      ),
    });
  }
}

async function resolveCreateFailure(
  dependencies:
    QuoteAttachmentLinkingDependencies,
  quote: QuoteRecord,
  validated:
    ValidatedQuoteAttachment,
  itemId: string,
  wixMediaId: string,
  createError: unknown,
): Promise<ReplayedLinkedQuoteAttachment> {
  await cleanUpUploadedMedia(
    dependencies.mediaStorage,
    wixMediaId,
    createError,
  );

  let existing: MediaUploadRecord | null;

  try {
    existing =
      await dependencies.mediaUploads
        .findById(itemId);
  } catch (lookupError) {
    throw new ApplicationError({
      code: "STORAGE_ERROR",
      message:
        "The attachment record could not be confirmed after the upload was cleaned up.",
      statusCode: 502,
      details: {
        itemId,
      },
      cause: new AggregateError(
        [
          createError,
          lookupError,
        ],
        "Attachment record creation and confirmation failed.",
      ),
    });
  }

  if (existing === null) {
    throw createError;
  }

  if (
    !sameAttachment(
      existing,
      quote,
      validated,
    )
  ) {
    throw attachmentConflict(
      "This attachment reference has already been used for different file information.",
    );
  }

  return {
    outcome: "replayed",
    attachment: existing,
  };
}

export function createQuoteAttachmentLinkingService(
  dependencies:
    QuoteAttachmentLinkingDependencies,
): QuoteAttachmentLinkingService {
  const queues = new Map<
    string,
    Promise<void>
  >();

  const linkUnlocked = async (
    input:
      LinkQuoteAttachmentInput,
  ): Promise<LinkedQuoteAttachment> => {
    const validated =
      validatedAttachment(input);

    const quote =
      await dependencies.quotes
        .findBySubmissionId(
          input.submissionId,
        );

    if (quote === null) {
      throw new ApplicationError({
        code: "NOT_FOUND",
        message:
          "The quote could not be found.",
        statusCode: 404,
      });
    }

    const itemId =
      attachmentItemId(
        input.attachmentId,
      );

    const existingById =
      await dependencies.mediaUploads
        .findById(itemId);

    if (existingById !== null) {
      if (
        sameAttachment(
          existingById,
          quote,
          validated,
        )
      ) {
        return {
          outcome: "replayed",
          attachment:
            existingById,
        };
      }

      throw attachmentConflict(
        "This attachment reference has already been used for different file information.",
      );
    }

    const existingUploads =
      await dependencies.mediaUploads
        .findByQuoteId(
          quote.id,
        );

    const expectedCount =
      expectedAttachmentCount(
        quote,
      );

    if (expectedCount === 0) {
      throw new ApplicationError({
        code: "VALIDATION_ERROR",
        message:
          "This quote was submitted without attachments.",
        statusCode: 400,
      });
    }

    if (
      existingUploads.length >=
        expectedCount ||
      existingUploads.length >=
        QUOTE_ATTACHMENT_POLICY
          .maxFiles
    ) {
      throw attachmentConflict(
        "All expected attachments have already been uploaded for this quote.",
      );
    }

    const combinedSize =
      totalStoredBytes(
        existingUploads,
      ) +
      validated.sizeBytes;

    if (
      combinedSize >
      QUOTE_ATTACHMENT_POLICY
        .maxTotalBytes
    ) {
      throw new ApplicationError({
        code: "VALIDATION_ERROR",
        message:
          "The combined attachment size must not exceed 40 MB.",
        statusCode: 400,
      });
    }

    const displayOrder =
      nextDisplayOrder(
        existingUploads,
      );

    const uploadInput:
      QuoteAttachmentUploadInput = {
        originalFilename:
          input.originalFilename,
        declaredMimeType:
          input.declaredMimeType,
        content: input.content,
        storageFolderKey:
          quote.id,
      };

    const uploaded =
      await dependencies
        .uploadService
        .upload(uploadInput);

    try {
      const attachment =
        await dependencies.mediaUploads
          .create(
            createUploadRecord(
              quote,
              validated,
              uploaded.fileId,
              displayOrder,
            ),
            {
              itemId,
            },
          );

      return {
        outcome: "created",
        attachment,
      };
    } catch (error) {
      return resolveCreateFailure(
        dependencies,
        quote,
        validated,
        itemId,
        uploaded.fileId,
        error,
      );
    }
  };

  return {
    async link(
      input,
    ): Promise<LinkedQuoteAttachment> {
      const queueKey =
        input.submissionId
          .trim()
          .toLowerCase();

      const previous =
        queues.get(queueKey) ??
        Promise.resolve();

      let release!: () => void;

      const gate = new Promise<void>(
        (resolve) => {
          release = resolve;
        },
      );

      const tail =
        previous
          .catch(() => undefined)
          .then(() => gate);

      queues.set(
        queueKey,
        tail,
      );

      await previous.catch(
        () => undefined,
      );

      try {
        return await linkUnlocked(
          input,
        );
      } finally {
        release();

        if (
          queues.get(queueKey) ===
          tail
        ) {
          queues.delete(queueKey);
        }
      }
    },
  };
}
