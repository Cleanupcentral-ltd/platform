import type { CustomerRecord } from "./models.js";

export type CustomerMatchDecision =
  | {
      readonly kind: "no-match";
    }
  | {
      readonly kind: "matched";
      readonly customer: CustomerRecord;
      readonly matchedBy:
        | "email-and-phone"
        | "email"
        | "phone";
      readonly requiresReview: boolean;
    }
  | {
      readonly kind: "conflict";
      readonly emailCustomerIds: readonly string[];
      readonly phoneCustomerIds: readonly string[];
    }
  | {
      readonly kind: "ambiguous";
      readonly customerIds: readonly string[];
    };

export interface CustomerMatchInput {
  readonly emailMatches: readonly CustomerRecord[];
  readonly phoneMatches: readonly CustomerRecord[];
}

function uniqueCustomers(
  customers: readonly CustomerRecord[],
): CustomerRecord[] {
  return [
    ...new Map(
      customers.map((customer) => [
        customer.id,
        customer,
      ]),
    ).values(),
  ];
}

function uniqueIds(
  customers: readonly CustomerRecord[],
): string[] {
  return [...new Set(customers.map(({ id }) => id))];
}

export function decideCustomerMatch({
  emailMatches,
  phoneMatches,
}: CustomerMatchInput): CustomerMatchDecision {
  const uniqueEmailMatches =
    uniqueCustomers(emailMatches);

  const uniquePhoneMatches =
    uniqueCustomers(phoneMatches);

  if (
    uniqueEmailMatches.length > 1 ||
    uniquePhoneMatches.length > 1
  ) {
    return {
      kind: "ambiguous",
      customerIds: uniqueIds([
        ...uniqueEmailMatches,
        ...uniquePhoneMatches,
      ]),
    };
  }

  const emailCustomer = uniqueEmailMatches[0] ?? null;
  const phoneCustomer = uniquePhoneMatches[0] ?? null;

  if (emailCustomer && phoneCustomer) {
    if (emailCustomer.id === phoneCustomer.id) {
      return {
        kind: "matched",
        customer: emailCustomer,
        matchedBy: "email-and-phone",
        requiresReview: false,
      };
    }

    return {
      kind: "conflict",
      emailCustomerIds: [emailCustomer.id],
      phoneCustomerIds: [phoneCustomer.id],
    };
  }

  if (emailCustomer) {
    return {
      kind: "matched",
      customer: emailCustomer,
      matchedBy: "email",
      requiresReview: true,
    };
  }

  if (phoneCustomer) {
    return {
      kind: "matched",
      customer: phoneCustomer,
      matchedBy: "phone",
      requiresReview: true,
    };
  }

  return {
    kind: "no-match",
  };
}