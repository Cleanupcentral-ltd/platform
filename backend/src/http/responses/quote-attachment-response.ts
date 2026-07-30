import type {
  MediaUploadRecord,
} from "../../domain/models.js";

import type {
  LinkedQuoteAttachment,
} from "../../application/link-quote-attachment.js";

export interface PublicQuoteAttachment {
  readonly attachmentId: string;
  readonly fileName: string;
  readonly mediaType:
    "Image" | "Document";
  readonly sizeBytes: number;
  readonly status: "Uploaded";
  readonly displayOrder: number;
}

export interface PublicQuoteAttachmentResponse {
  readonly success: true;
  readonly replayed: boolean;
  readonly attachment:
    PublicQuoteAttachment;
  readonly requestId: string;
}

function publicAttachmentId(
  record: MediaUploadRecord,
): string {
  const prefix =
    "quote-attachment-";

  return record.id.startsWith(
    prefix,
  )
    ? record.id.slice(
        prefix.length,
      )
    : record.id;
}

export function createPublicQuoteAttachmentResponse(
  linked:
    LinkedQuoteAttachment,
  requestId: string,
): PublicQuoteAttachmentResponse {
  const attachment =
    linked.attachment;

  return {
    success: true,
    replayed:
      linked.outcome ===
      "replayed",

    attachment: {
      attachmentId:
        publicAttachmentId(
          attachment,
        ),
      fileName:
        attachment.fileName,
      mediaType:
        attachment.mediaType,
      sizeBytes:
        attachment.sizeBytes,
      status:
        attachment.uploadStatus,
      displayOrder:
        attachment.displayOrder,
    },

    requestId,
  };
}
