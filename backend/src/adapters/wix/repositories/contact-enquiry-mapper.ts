import type {
  ContactEnquiryRecord,
  CreateContactEnquiryRecord,
} from "../../../domain/models.js";

import {
  PREFERRED_CONTACT_METHODS,
} from "../../../domain/quote-values.js";

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

const fields =
  WIX_FIELDS.contactEnquiries;

export function mapContactEnquiryFromWix(
  item: WixDataItem,
): ContactEnquiryRecord {
  return {
    id: item.id,

    enquiryNumber: requireString(
      item.data,
      fields.enquiryNumber,
    ),

    submissionId: requireString(
      item.data,
      fields.submissionId,
    ),

    customerId:
      readNullableReferenceId(
        item.data,
        fields.customer,
      ),

    propertyId:
      readNullableReferenceId(
        item.data,
        fields.property,
      ),

    convertedQuoteId:
      readNullableReferenceId(
        item.data,
        fields.convertedQuote,
      ),

    status: requireString(
      item.data,
      fields.status,
    ),

    fullName: requireString(
      item.data,
      fields.fullName,
    ),

    email: requireString(
      item.data,
      fields.email,
    ),

    emailNormalized: requireString(
      item.data,
      fields.emailNormalized,
    ),

    phone:
      readNullableString(
        item.data,
        fields.phone,
      ) ?? "",

    phoneNormalized:
      readNullableString(
        item.data,
        fields.phoneNormalized,
      ) ?? "",

    enquiryType: requireString(
      item.data,
      fields.enquiryType,
    ),

    preferredContactMethod:
      requireEnumValue(
        item.data,
        fields.preferredContactMethod,
        PREFERRED_CONTACT_METHODS,
      ),

    message: requireString(
      item.data,
      fields.message,
    ),

    hasAttachments: requireBoolean(
      item.data,
      fields.hasAttachments,
    ),

    attachmentCount: requireNumber(
      item.data,
      fields.attachmentCount,
    ),

    submissionSource: requireString(
      item.data,
      fields.submissionSource,
    ),

    reviewedAt: readNullableString(
      item.data,
      fields.reviewedAt,
    ),

    respondedAt: readNullableString(
      item.data,
      fields.respondedAt,
    ),

    internalNotes: readNullableString(
      item.data,
      fields.internalNotes,
    ),
  };
}

export function mapContactEnquiryCreateToWix(
  enquiry: CreateContactEnquiryRecord,
): Readonly<Record<string, unknown>> {
  return {
    [fields.enquiryNumber]:
      enquiry.enquiryNumber,

    [fields.submissionId]:
      enquiry.submissionId,

    [fields.customer]:
      enquiry.customerId,

    [fields.property]:
      enquiry.propertyId,

    [fields.convertedQuote]:
      enquiry.convertedQuoteId,

    [fields.status]:
      enquiry.status,

    [fields.fullName]:
      enquiry.fullName,

    [fields.email]:
      enquiry.email,

    [fields.emailNormalized]:
      enquiry.emailNormalized,

    [fields.phone]:
      enquiry.phone,

    [fields.phoneNormalized]:
      enquiry.phoneNormalized,

    [fields.enquiryType]:
      enquiry.enquiryType,

    [fields.preferredContactMethod]:
      enquiry.preferredContactMethod,

    [fields.message]:
      enquiry.message,

    [fields.hasAttachments]:
      enquiry.hasAttachments,

    [fields.attachmentCount]:
      enquiry.attachmentCount,

    [fields.submissionSource]:
      enquiry.submissionSource,

    [fields.reviewedAt]:
      enquiry.reviewedAt,

    [fields.respondedAt]:
      enquiry.respondedAt,

    [fields.internalNotes]:
      enquiry.internalNotes,
  };
}
