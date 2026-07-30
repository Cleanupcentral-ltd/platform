import type {
  CreateCustomerRecord,
  CustomerRecord,
  UpdateCustomerRecord,
} from "../../../domain/models.js";

import {
  CUSTOMER_VERIFICATION_STATUSES,
  DECLARED_CUSTOMER_TYPES,
} from "../../../domain/quote-values.js";

import {
  WIX_FIELDS,
} from "../collections.js";

import type {
  WixDataItem,
} from "../wix-data-types.js";

import {
  readNullableString,
  requireBoolean,
  requireEnumValue,
  requireString,
} from "../wix-value-readers.js";

const fields = WIX_FIELDS.customers;

function assignIfDefined(
  target: Record<string, unknown>,
  fieldName: string,
  value: unknown,
): void {
  if (value !== undefined) {
    target[fieldName] = value;
  }
}

export function mapCustomerFromWix(
  item: WixDataItem,
): CustomerRecord {
  return {
    id: item.id,

    fullName: requireString(
      item.data,
      fields.fullName,
    ),

    companyName: readNullableString(
      item.data,
      fields.companyName,
    ),

    email: requireString(
      item.data,
      fields.email,
    ),

    emailNormalized: requireString(
      item.data,
      fields.emailNormalized,
    ),

    phone: requireString(
      item.data,
      fields.phone,
    ),

    phoneNormalized: requireString(
      item.data,
      fields.phoneNormalized,
    ),

    declaredCustomerType:
      requireEnumValue(
        item.data,
        fields.declaredCustomerType,
        DECLARED_CUSTOMER_TYPES,
      ),

    verificationStatus:
      requireEnumValue(
        item.data,
        fields.verificationStatus,
        CUSTOMER_VERIFICATION_STATUSES,
      ),

    isExistingCustomer:
      requireBoolean(
        item.data,
        fields.isExistingCustomer,
      ),

    firstEligibleCleanCompleted:
      requireBoolean(
        item.data,
        fields.firstEligibleCleanCompleted,
      ),

    privacyConsent: requireBoolean(
      item.data,
      fields.privacyConsent,
    ),

    marketingConsent: requireBoolean(
      item.data,
      fields.marketingConsent,
    ),

    internalNotes: readNullableString(
      item.data,
      fields.internalNotes,
    ),
  };
}

export function mapCustomerCreateToWix(
  customer: CreateCustomerRecord,
): Readonly<Record<string, unknown>> {
  return {
    [fields.fullName]:
      customer.fullName,

    [fields.companyName]:
      customer.companyName,

    [fields.email]:
      customer.email,

    [fields.emailNormalized]:
      customer.emailNormalized,

    [fields.phone]:
      customer.phone,

    [fields.phoneNormalized]:
      customer.phoneNormalized,

    [fields.declaredCustomerType]:
      customer.declaredCustomerType,

    [fields.verificationStatus]:
      customer.verificationStatus,

    [fields.isExistingCustomer]:
      customer.isExistingCustomer,

    [fields.firstEligibleCleanCompleted]:
      customer.firstEligibleCleanCompleted,

    [fields.privacyConsent]:
      customer.privacyConsent,

    [fields.marketingConsent]:
      customer.marketingConsent,

    [fields.internalNotes]:
      customer.internalNotes,
  };
}

export function mapCustomerChangesToWix(
  changes: UpdateCustomerRecord,
): Readonly<Record<string, unknown>> {
  const data: Record<string, unknown> = {};

  assignIfDefined(
    data,
    fields.fullName,
    changes.fullName,
  );

  assignIfDefined(
    data,
    fields.companyName,
    changes.companyName,
  );

  assignIfDefined(
    data,
    fields.email,
    changes.email,
  );

  assignIfDefined(
    data,
    fields.emailNormalized,
    changes.emailNormalized,
  );

  assignIfDefined(
    data,
    fields.phone,
    changes.phone,
  );

  assignIfDefined(
    data,
    fields.phoneNormalized,
    changes.phoneNormalized,
  );

  assignIfDefined(
    data,
    fields.declaredCustomerType,
    changes.declaredCustomerType,
  );

  assignIfDefined(
    data,
    fields.verificationStatus,
    changes.verificationStatus,
  );

  assignIfDefined(
    data,
    fields.isExistingCustomer,
    changes.isExistingCustomer,
  );

  assignIfDefined(
    data,
    fields.firstEligibleCleanCompleted,
    changes.firstEligibleCleanCompleted,
  );

  assignIfDefined(
    data,
    fields.privacyConsent,
    changes.privacyConsent,
  );

  assignIfDefined(
    data,
    fields.marketingConsent,
    changes.marketingConsent,
  );

  assignIfDefined(
    data,
    fields.internalNotes,
    changes.internalNotes,
  );

  return data;
}