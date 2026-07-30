import type {
  SubmitQuoteRequest,
} from "./validation/submit-quote.js";

import {
  decideCustomerMatch,
} from "../domain/customer-matching.js";

import type {
  CustomerRecord,
  PropertyRecord,
} from "../domain/models.js";

import {
  normalizeAddress,
  normalizeEmail,
  normalizePhone,
  normalizePostcode,
} from "../domain/normalization.js";

import type {
  CustomerVerificationStatus,
  DeclaredCustomerType,
} from "../domain/quote-values.js";

import type {
  CustomerRepository,
  PropertyRepository,
} from "../ports/repositories.js";

export type CustomerResolutionKind =
  | "no-match"
  | "matched"
  | "conflict"
  | "ambiguous";

export type PropertyResolutionKind =
  | "deferred"
  | "no-match"
  | "matched"
  | "ambiguous";

export interface CustomerResolution {
  readonly kind: CustomerResolutionKind;

  readonly customer:
    CustomerRecord | null;

  readonly matchedBy:
    | "email-and-phone"
    | "email"
    | "phone"
    | null;

  readonly normalizedEmail: string;
  readonly normalizedPhone: string;

  readonly verifiedCustomerStatus:
    CustomerVerificationStatus;

  readonly customerStatusMismatch:
    boolean;

  readonly requiresReview: boolean;

  readonly reviewReasons:
    readonly string[];
}

export interface PropertyResolution {
  readonly kind: PropertyResolutionKind;

  readonly property:
    PropertyRecord | null;

  readonly normalizedPostcode: string;
  readonly normalizedAddress: string;

  readonly candidateCount: number;

  readonly requiresReview: boolean;

  readonly reviewReasons:
    readonly string[];
}

export interface QuoteResolutionContext {
  readonly submission:
    SubmitQuoteRequest;

  readonly customer:
    CustomerResolution;

  readonly property:
    PropertyResolution;

  readonly requiresReview: boolean;

  readonly reviewReasons:
    readonly string[];
}

export interface QuoteResolutionService {
  resolve(
    submission: SubmitQuoteRequest,
  ): Promise<QuoteResolutionContext>;
}

export interface QuoteResolutionRepositories {
  readonly customers: Pick<
    CustomerRepository,
    | "findByNormalizedEmail"
    | "findByNormalizedPhone"
  >;

  readonly properties: Pick<
    PropertyRepository,
    "findByCustomerAndPostcode"
  >;
}

function uniqueReasons(
  reasons: readonly string[],
): readonly string[] {
  return [...new Set(reasons)];
}

function actualCustomerType(
  customer: CustomerRecord,
): DeclaredCustomerType {
  return customer.isExistingCustomer
    ? "Existing customer"
    : "New customer";
}

function matchedCustomerStatus(
  customer: CustomerRecord,
  identityRequiresReview: boolean,
): CustomerVerificationStatus {
  if (
    identityRequiresReview ||
    customer.verificationStatus ===
      "Unverified" ||
    customer.verificationStatus ===
      "Review Required"
  ) {
    return "Review Required";
  }

  return customer.verificationStatus;
}

async function resolveCustomer(
  submission: SubmitQuoteRequest,
  repository:
    QuoteResolutionRepositories["customers"],
): Promise<CustomerResolution> {
  const normalizedEmail =
    normalizeEmail(
      submission.customer.email,
    );

  const normalizedPhone =
    normalizePhone(
      submission.customer.phone,
    );

  const [
    emailMatches,
    phoneMatches,
  ] = await Promise.all([
    repository.findByNormalizedEmail(
      normalizedEmail,
    ),

    repository.findByNormalizedPhone(
      normalizedPhone,
    ),
  ]);

  const decision = decideCustomerMatch({
    emailMatches,
    phoneMatches,
  });

  if (decision.kind === "no-match") {
    const declaredExisting =
      submission.customer
        .declaredCustomerType ===
      "Existing customer";

    return {
      kind: "no-match",
      customer: null,
      matchedBy: null,
      normalizedEmail,
      normalizedPhone,

      verifiedCustomerStatus:
        declaredExisting
          ? "Review Required"
          : "Verified New",

      customerStatusMismatch:
        declaredExisting,

      requiresReview: true,

      reviewReasons: declaredExisting
        ? [
            "DECLARED_EXISTING_CUSTOMER_NOT_FOUND",
          ]
        : ["NEW_CUSTOMER"],
    };
  }

  if (decision.kind === "conflict") {
    return {
      kind: "conflict",
      customer: null,
      matchedBy: null,
      normalizedEmail,
      normalizedPhone,

      verifiedCustomerStatus:
        "Review Required",

      customerStatusMismatch: false,
      requiresReview: true,

      reviewReasons: [
        "CUSTOMER_IDENTITY_CONFLICT",
      ],
    };
  }

  if (decision.kind === "ambiguous") {
    return {
      kind: "ambiguous",
      customer: null,
      matchedBy: null,
      normalizedEmail,
      normalizedPhone,

      verifiedCustomerStatus:
        "Review Required",

      customerStatusMismatch: false,
      requiresReview: true,

      reviewReasons: [
        "CUSTOMER_IDENTITY_AMBIGUOUS",
      ],
    };
  }

  const customer = decision.customer;

  const customerStatusMismatch =
    submission.customer
      .declaredCustomerType !==
    actualCustomerType(customer);

  const reviewReasons: string[] = [];

  if (decision.requiresReview) {
    reviewReasons.push(
      "CUSTOMER_PARTIAL_MATCH",
    );
  }

  if (customerStatusMismatch) {
    reviewReasons.push(
      "CUSTOMER_STATUS_MISMATCH",
    );
  }

  if (
    customer.verificationStatus ===
      "Unverified" ||
    customer.verificationStatus ===
      "Review Required"
  ) {
    reviewReasons.push(
      "CUSTOMER_RECORD_UNVERIFIED",
    );
  }

  if (!customer.isExistingCustomer) {
    reviewReasons.push(
      "NEW_CUSTOMER",
    );
  }

  const identityRequiresReview =
    decision.requiresReview ||
    customerStatusMismatch ||
    customer.verificationStatus ===
      "Unverified" ||
    customer.verificationStatus ===
      "Review Required";

  return {
    kind: "matched",
    customer,
    matchedBy: decision.matchedBy,
    normalizedEmail,
    normalizedPhone,

    verifiedCustomerStatus:
      matchedCustomerStatus(
        customer,
        identityRequiresReview,
      ),

    customerStatusMismatch,

    requiresReview:
      reviewReasons.length > 0,

    reviewReasons:
      uniqueReasons(reviewReasons),
  };
}

async function resolveProperty(
  submission: SubmitQuoteRequest,
  customerResolution:
    CustomerResolution,
  repository:
    QuoteResolutionRepositories["properties"],
): Promise<PropertyResolution> {
  const normalizedPostcode =
    normalizePostcode(
      submission.property.postcode,
    );

  const normalizedAddress =
    normalizeAddress(
      submission.property.address,
    );

  if (
    customerResolution.customer ===
    null
  ) {
    return {
      kind: "deferred",
      property: null,
      normalizedPostcode,
      normalizedAddress,
      candidateCount: 0,
      requiresReview: false,
      reviewReasons: [],
    };
  }

  const candidates =
    await repository
      .findByCustomerAndPostcode(
        customerResolution
          .customer.id,

        normalizedPostcode,
      );

  const exactAddressMatches =
    candidates.filter(
      (property) =>
        normalizeAddress(
          property.address,
        ) === normalizedAddress,
    );

  if (
    exactAddressMatches.length > 1
  ) {
    return {
      kind: "ambiguous",
      property: null,
      normalizedPostcode,
      normalizedAddress,

      candidateCount:
        exactAddressMatches.length,

      requiresReview: true,

      reviewReasons: [
        "PROPERTY_MATCH_AMBIGUOUS",
      ],
    };
  }

  const matchedProperty =
    exactAddressMatches[0];

  if (matchedProperty) {
    const reviewReasons: string[] = [];

    if (
      !matchedProperty
        .verifiedProperty
    ) {
      reviewReasons.push(
        "PROPERTY_UNVERIFIED",
      );
    }

    if (
      !matchedProperty
        .activeProperty
    ) {
      reviewReasons.push(
        "PROPERTY_INACTIVE",
      );
    }

    return {
      kind: "matched",

      property:
        matchedProperty,

      normalizedPostcode,
      normalizedAddress,

      candidateCount:
        candidates.length,

      requiresReview:
        reviewReasons.length > 0,

      reviewReasons:
        uniqueReasons(
          reviewReasons,
        ),
    };
  }

  const postcodeCollision =
    candidates.length > 0;

  return {
    kind: "no-match",
    property: null,
    normalizedPostcode,
    normalizedAddress,

    candidateCount:
      candidates.length,

    requiresReview:
      postcodeCollision,

    reviewReasons:
      postcodeCollision
        ? [
            "PROPERTY_POSTCODE_COLLISION",
          ]
        : [],
  };
}

export function createQuoteContextResolver(
  repositories:
    QuoteResolutionRepositories,
): QuoteResolutionService {
  return {
    async resolve(
      submission: SubmitQuoteRequest,
    ): Promise<QuoteResolutionContext> {
      const customer =
        await resolveCustomer(
          submission,
          repositories.customers,
        );

      const property =
        await resolveProperty(
          submission,
          customer,
          repositories.properties,
        );

      const reviewReasons =
        uniqueReasons([
          ...customer.reviewReasons,
          ...property.reviewReasons,
        ]);

      return {
        submission,
        customer,
        property,

        requiresReview:
          customer.requiresReview ||
          property.requiresReview,

        reviewReasons,
      };
    },
  };
}