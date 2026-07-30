import type {
  CreateStatusHistoryRecord,
  StatusHistoryRecord,
} from "../../../domain/models.js";

import {
  WIX_FIELDS,
} from "../collections.js";

import type {
  WixDataItem,
} from "../wix-data-types.js";

import {
  readNullableRecord,
  readNullableReferenceId,
  readNullableString,
  requireBoolean,
  requireEnumValue,
  requireString,
} from "../wix-value-readers.js";

const fields = WIX_FIELDS.statusHistory;

const RECORD_TYPES = [
  "Quote",
  "Contact Enquiry",
] as const;

export function mapStatusHistoryFromWix(
  item: WixDataItem,
): StatusHistoryRecord {
  return {
    id: item.id,

    historyLabel: requireString(
      item.data,
      fields.historyLabel,
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

    recordType: requireEnumValue(
      item.data,
      fields.recordType,
      RECORD_TYPES,
    ),

    previousStatus:
      readNullableString(
        item.data,
        fields.previousStatus,
      ),

    newStatus: requireString(
      item.data,
      fields.newStatus,
    ),

    changeSource: requireString(
      item.data,
      fields.changeSource,
    ),

    actorType: requireString(
      item.data,
      fields.actorType,
    ),

    actorId: readNullableString(
      item.data,
      fields.actorId,
    ),

    actorName: readNullableString(
      item.data,
      fields.actorName,
    ),

    changeReason: readNullableString(
      item.data,
      fields.changeReason,
    ),

    customerVisible: requireBoolean(
      item.data,
      fields.customerVisible,
    ),

    notes: readNullableString(
      item.data,
      fields.notes,
    ),

    metadata: readNullableRecord(
      item.data,
      fields.metadata,
    ),
  };
}

export function mapStatusHistoryCreateToWix(
  history: CreateStatusHistoryRecord,
): Readonly<Record<string, unknown>> {
  return {
    [fields.historyLabel]:
      history.historyLabel,

    [fields.quote]:
      history.quoteId,

    [fields.contactEnquiry]:
      history.contactEnquiryId,

    [fields.recordType]:
      history.recordType,

    [fields.previousStatus]:
      history.previousStatus,

    [fields.newStatus]:
      history.newStatus,

    [fields.changeSource]:
      history.changeSource,

    [fields.actorType]:
      history.actorType,

    [fields.actorId]:
      history.actorId,

    [fields.actorName]:
      history.actorName,

    [fields.changeReason]:
      history.changeReason,

    [fields.customerVisible]:
      history.customerVisible,

    [fields.notes]:
      history.notes,

    [fields.metadata]:
      history.metadata,
  };
}