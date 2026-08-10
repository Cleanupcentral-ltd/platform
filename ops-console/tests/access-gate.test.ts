import assert from "node:assert/strict";
import test from "node:test";

import {
  determineAccessGate,
  normalizeAssuranceLevel,
} from "../src/access-gate.ts";

test("unknown assurance values fail closed", () => {
  assert.equal(normalizeAssuranceLevel("aal3"), null);
});

test("signed-out users are sent to sign in", () => {
  assert.equal(
    determineAccessGate({
      hasSession: false,
      role: null,
      currentLevel: null,
      nextLevel: null,
    }),
    "signed_out",
  );
});

test("non-founder sessions are denied before MFA state is considered", () => {
  assert.equal(
    determineAccessGate({
      hasSession: true,
      role: "staff",
      currentLevel: "aal2",
      nextLevel: "aal2",
    }),
    "founder_role_required",
  );
});

test("founders without a factor must enrol MFA", () => {
  assert.equal(
    determineAccessGate({
      hasSession: true,
      role: "founder",
      currentLevel: "aal1",
      nextLevel: "aal1",
    }),
    "mfa_enrollment_required",
  );
});

test("founders with an unverified session must complete the MFA challenge", () => {
  assert.equal(
    determineAccessGate({
      hasSession: true,
      role: "founder",
      currentLevel: "aal1",
      nextLevel: "aal2",
    }),
    "mfa_challenge_required",
  );
});

test("only founder aal2 sessions reach the protected foundation", () => {
  assert.equal(
    determineAccessGate({
      hasSession: true,
      role: "founder",
      currentLevel: "aal2",
      nextLevel: "aal2",
    }),
    "ready",
  );
});
