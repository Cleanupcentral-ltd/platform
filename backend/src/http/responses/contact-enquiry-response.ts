import type {
  PersistedContactEnquirySubmission,
} from "../../application/persist-contact-enquiry.js";

import type {
  PreferredContactMethod,
} from "../../domain/quote-values.js";

export interface PublicContactEnquiryConfirmation {
  readonly enquiryNumber: string;
  readonly status: string;
  readonly message: string;
  readonly preferredContactMethod:
    PreferredContactMethod;
  readonly attachmentExpected: boolean;
}

export interface PublicContactEnquirySuccessResponse {
  readonly success: true;
  readonly replayed: boolean;
  readonly confirmation:
    PublicContactEnquiryConfirmation;
  readonly requestId: string;
}

export function createPublicContactEnquiryResponse(
  persisted:
    PersistedContactEnquirySubmission,
  requestId: string,
): PublicContactEnquirySuccessResponse {
  const suppressed =
    persisted.outcome ===
    "suppressed";

  const enquiryNumber = suppressed
    ? persisted.enquiryNumber
    : persisted.enquiry
        .enquiryNumber;

  const preferredContactMethod =
    suppressed
      ? persisted
          .preferredContactMethod
      : persisted.enquiry
          .preferredContactMethod;

  const attachmentExpected =
    suppressed
      ? false
      : persisted.enquiry
          .hasAttachments;

  return {
    success: true,
    replayed:
      persisted.outcome ===
      "replayed",

    confirmation: {
      enquiryNumber,
      status: suppressed
        ? "New"
        : persisted.enquiry.status,
      message:
        "Your enquiry has been received. Our team will contact you using your preferred method.",
      preferredContactMethod,
      attachmentExpected,
    },

    requestId,
  };
}
