import type {
  CreateQuoteItemRecord,
  QuoteItemRecord,
} from "../../../domain/models.js";

import {
  WIX_FIELDS,
} from "../collections.js";

import type {
  WixDataItem,
} from "../wix-data-types.js";

import {
  readNullableRecord,
  requireBoolean,
  requireNumber,
  requireReferenceId,
  requireString,
} from "../wix-value-readers.js";

const fields = WIX_FIELDS.quoteItems;

export function mapQuoteItemFromWix(
  item: WixDataItem,
): QuoteItemRecord {
  return {
    id: item.id,

    quoteId: requireReferenceId(
      item.data,
      fields.quote,
    ),

    itemLabel: requireString(
      item.data,
      fields.itemLabel,
    ),

    sourceKey: requireString(
      item.data,
      fields.sourceKey,
    ),

    itemType: requireString(
      item.data,
      fields.itemType,
    ),

    itemName: requireString(
      item.data,
      fields.itemName,
    ),

    quantity: requireNumber(
      item.data,
      fields.quantity,
    ),

    unitPrice: requireNumber(
      item.data,
      fields.unitPrice,
    ),

    lineTotal: requireNumber(
      item.data,
      fields.lineTotal,
    ),

    discountable: requireBoolean(
      item.data,
      fields.discountable,
    ),

    provisional: requireBoolean(
      item.data,
      fields.provisional,
    ),

    customerVisible: requireBoolean(
      item.data,
      fields.customerVisible,
    ),

    displayOrder: requireNumber(
      item.data,
      fields.displayOrder,
    ),

    metadata: readNullableRecord(
      item.data,
      fields.metadata,
    ),
  };
}

export function mapQuoteItemCreateToWix(
  quoteItem: CreateQuoteItemRecord,
): Readonly<Record<string, unknown>> {
  return {
    [fields.quote]:
      quoteItem.quoteId,

    [fields.itemLabel]:
      quoteItem.itemLabel,

    [fields.sourceKey]:
      quoteItem.sourceKey,

    [fields.itemType]:
      quoteItem.itemType,

    [fields.itemName]:
      quoteItem.itemName,

    [fields.quantity]:
      quoteItem.quantity,

    [fields.unitPrice]:
      quoteItem.unitPrice,

    [fields.lineTotal]:
      quoteItem.lineTotal,

    [fields.discountable]:
      quoteItem.discountable,

    [fields.provisional]:
      quoteItem.provisional,

    [fields.customerVisible]:
      quoteItem.customerVisible,

    [fields.displayOrder]:
      quoteItem.displayOrder,

    [fields.metadata]:
      quoteItem.metadata,
  };
}