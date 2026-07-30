import assert from "node:assert/strict";
import test from "node:test";

import { decideCustomerMatch } from "../src/domain/customer-matching.js";
import type { CustomerRecord } from "../src/domain/models.js";

function customer(
  id: string,
): CustomerRecord {
  return {
    id,
    fullName: "Test Customer",
    companyName: null,
    email: "test@example.com",
    emailNormalized: "test@example.com",
    phone: "07123 456789",
    phoneNormalized: "447123456789",
    declaredCustomerType: "Existing customer",
    verificationStatus: "Verified Existing",
    isExistingCustomer: true,
    firstEligibleCleanCompleted: true,
    privacyConsent: true,
    marketingConsent: false,
    internalNotes: null,
  };
}

test("returns no-match when no customer exists", () => {
  assert.deepEqual(
    decideCustomerMatch({
      emailMatches: [],
      phoneMatches: [],
    }),
    {
      kind: "no-match",
    },
  );
});

test("matches when email and phone identify one customer", () => {
  const existingCustomer = customer("customer-1");

  const result = decideCustomerMatch({
    emailMatches: [existingCustomer],
    phoneMatches: [existingCustomer],
  });

  assert.equal(result.kind, "matched");

  if (result.kind === "matched") {
    assert.equal(
      result.matchedBy,
      "email-and-phone",
    );

    assert.equal(
      result.requiresReview,
      false,
    );
  }
});

test("requires review when only email matches", () => {
  const existingCustomer = customer("customer-1");

  const result = decideCustomerMatch({
    emailMatches: [existingCustomer],
    phoneMatches: [],
  });

  assert.equal(result.kind, "matched");

  if (result.kind === "matched") {
    assert.equal(result.matchedBy, "email");
    assert.equal(result.requiresReview, true);
  }
});

test("detects conflicting customer records", () => {
  const result = decideCustomerMatch({
    emailMatches: [customer("customer-1")],
    phoneMatches: [customer("customer-2")],
  });

  assert.deepEqual(result, {
    kind: "conflict",
    emailCustomerIds: ["customer-1"],
    phoneCustomerIds: ["customer-2"],
  });
});