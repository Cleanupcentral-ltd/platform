import type {
  CreateMediaUploadRecord,
  MediaUploadRecord,
} from "../../../domain/models.js";

import {
  WIX_FIELDS,
} from "../collections.js";

import type {
  WixDataItem,
} from "../wix-data-types.js";

import {
  readNullableReferenceId,
  readNullableString,
  requireBoolean,
  requireEnumValue,
  requireNumber,
  requireString,
} from "../wix-value-readers.js";

const fields = WIX_FIELDS.mediaUploads;

const UPLOAD_CONTEXTS = [
  "Quote",
  "Contact Enquiry",
] as const;

const MEDIA_TYPES = [
  "Image",
  "Document",
] as const;

const UPLOAD_STATUSES = [
  "Uploaded",
] as const;

export function mapMediaUploadFromWix(
  item: WixDataItem,
): MediaUploadRecord {
  return {
    id: item.id,

    uploadLabel: requireString(
      item.data,
      fields.uploadLabel,
    ),

    quoteId: readNullableReferenceId(
      item.data,
      fields.quote,
    ),

    contactEnquiryId:
      readNullableReferenceId(
        item.data,
        fields.contactEnquiry,
      ),

    uploadContext: requireEnumValue(
      item.data,
      fields.uploadContext,
      UPLOAD_CONTEXTS,
    ),

    sourceField: requireString(
      item.data,
      fields.sourceField,
    ),

    fileName: requireString(
      item.data,
      fields.fileName,
    ),

    fileExtension: requireString(
      item.data,
      fields.fileExtension,
    ),

    mimeType: requireString(
      item.data,
      fields.mimeType,
    ),

    mediaType: requireEnumValue(
      item.data,
      fields.mediaType,
      MEDIA_TYPES,
    ),

    mediaUrl: readNullableString(
      item.data,
      fields.mediaUrl,
    ),

    wixMediaId: requireString(
      item.data,
      fields.wixMediaId,
    ),

    sizeBytes: requireNumber(
      item.data,
      fields.sizeBytes,
    ),

    uploadStatus: requireEnumValue(
      item.data,
      fields.uploadStatus,
      UPLOAD_STATUSES,
    ),

    customerVisible: requireBoolean(
      item.data,
      fields.customerVisible,
    ),

    displayOrder: requireNumber(
      item.data,
      fields.displayOrder,
    ),

    internalNotes: readNullableString(
      item.data,
      fields.internalNotes,
    ),
  };
}

export function mapMediaUploadCreateToWix(
  upload: CreateMediaUploadRecord,
): Readonly<Record<string, unknown>> {
  return {
    [fields.uploadLabel]:
      upload.uploadLabel,

    [fields.quote]:
      upload.quoteId,

    [fields.contactEnquiry]:
      upload.contactEnquiryId,

    [fields.uploadContext]:
      upload.uploadContext,

    [fields.sourceField]:
      upload.sourceField,

    [fields.fileName]:
      upload.fileName,

    [fields.fileExtension]:
      upload.fileExtension,

    [fields.mimeType]:
      upload.mimeType,

    [fields.mediaType]:
      upload.mediaType,

    [fields.mediaUrl]:
      upload.mediaUrl,

    [fields.wixMediaId]:
      upload.wixMediaId,

    [fields.sizeBytes]:
      upload.sizeBytes,

    [fields.uploadStatus]:
      upload.uploadStatus,

    [fields.customerVisible]:
      upload.customerVisible,

    [fields.displayOrder]:
      upload.displayOrder,

    [fields.internalNotes]:
      upload.internalNotes,
  };
}
