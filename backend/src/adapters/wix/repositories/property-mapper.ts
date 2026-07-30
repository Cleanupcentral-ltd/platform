import type {
  CreatePropertyRecord,
  PropertyRecord,
  UpdatePropertyRecord,
} from "../../../domain/models.js";

import {
  PROPERTY_TYPES,
} from "../../../domain/quote-values.js";

import {
  WIX_FIELDS,
} from "../collections.js";

import type {
  WixDataItem,
} from "../wix-data-types.js";

import {
  readNullableEnumValue,
  readNullableNumber,
  readNullableString,
  requireBoolean,
  requireReferenceId,
  requireString,
} from "../wix-value-readers.js";

const fields = WIX_FIELDS.properties;

function assignIfDefined(
  target: Record<string, unknown>,
  fieldName: string,
  value: unknown,
): void {
  if (value !== undefined) {
    target[fieldName] = value;
  }
}

export function mapPropertyFromWix(
  item: WixDataItem,
): PropertyRecord {
  return {
    id: item.id,

    customerId: requireReferenceId(
      item.data,
      fields.customer,
    ),

    propertyLabel: requireString(
      item.data,
      fields.propertyLabel,
    ),

    address: requireString(
      item.data,
      fields.address,
    ),

    postcode: requireString(
      item.data,
      fields.postcode,
    ),

    postcodeNormalized:
      requireString(
        item.data,
        fields.postcodeNormalized,
      ),

    propertyType:
      readNullableEnumValue(
        item.data,
        fields.propertyType,
        PROPERTY_TYPES,
      ),

    bedroomCount: readNullableNumber(
      item.data,
      fields.bedroomCount,
    ),

    bathroomCount: readNullableNumber(
      item.data,
      fields.bathroomCount,
    ),

    occupancyStatus:
      readNullableString(
        item.data,
        fields.occupancyStatus,
      ),

    parkingDetails: readNullableString(
      item.data,
      fields.parkingDetails,
    ),

    petsDetails: readNullableString(
      item.data,
      fields.petsDetails,
    ),

    accessArrangements:
      readNullableString(
        item.data,
        fields.accessArrangements,
      ),

    verifiedProperty: requireBoolean(
      item.data,
      fields.verifiedProperty,
    ),

    activeProperty: requireBoolean(
      item.data,
      fields.activeProperty,
    ),
  };
}

export function mapPropertyCreateToWix(
  property: CreatePropertyRecord,
): Readonly<Record<string, unknown>> {
  return {
    [fields.customer]:
      property.customerId,

    [fields.propertyLabel]:
      property.propertyLabel,

    [fields.address]:
      property.address,

    [fields.postcode]:
      property.postcode,

    [fields.postcodeNormalized]:
      property.postcodeNormalized,

    [fields.propertyType]:
      property.propertyType,

    [fields.bedroomCount]:
      property.bedroomCount,

    [fields.bathroomCount]:
      property.bathroomCount,

    [fields.occupancyStatus]:
      property.occupancyStatus,

    [fields.parkingDetails]:
      property.parkingDetails,

    [fields.petsDetails]:
      property.petsDetails,

    [fields.accessArrangements]:
      property.accessArrangements,

    [fields.verifiedProperty]:
      property.verifiedProperty,

    [fields.activeProperty]:
      property.activeProperty,
  };
}

export function mapPropertyChangesToWix(
  changes: UpdatePropertyRecord,
): Readonly<Record<string, unknown>> {
  const data: Record<string, unknown> = {};

  assignIfDefined(
    data,
    fields.customer,
    changes.customerId,
  );

  assignIfDefined(
    data,
    fields.propertyLabel,
    changes.propertyLabel,
  );

  assignIfDefined(
    data,
    fields.address,
    changes.address,
  );

  assignIfDefined(
    data,
    fields.postcode,
    changes.postcode,
  );

  assignIfDefined(
    data,
    fields.postcodeNormalized,
    changes.postcodeNormalized,
  );

  assignIfDefined(
    data,
    fields.propertyType,
    changes.propertyType,
  );

  assignIfDefined(
    data,
    fields.bedroomCount,
    changes.bedroomCount,
  );

  assignIfDefined(
    data,
    fields.bathroomCount,
    changes.bathroomCount,
  );

  assignIfDefined(
    data,
    fields.occupancyStatus,
    changes.occupancyStatus,
  );

  assignIfDefined(
    data,
    fields.parkingDetails,
    changes.parkingDetails,
  );

  assignIfDefined(
    data,
    fields.petsDetails,
    changes.petsDetails,
  );

  assignIfDefined(
    data,
    fields.accessArrangements,
    changes.accessArrangements,
  );

  assignIfDefined(
    data,
    fields.verifiedProperty,
    changes.verifiedProperty,
  );

  assignIfDefined(
    data,
    fields.activeProperty,
    changes.activeProperty,
  );

  return data;
}