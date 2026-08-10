export type AssuranceLevel = "aal1" | "aal2" | null;

export type AccessGate =
  | "signed_out"
  | "founder_role_required"
  | "mfa_enrollment_required"
  | "mfa_challenge_required"
  | "ready";

export interface AccessGateInput {
  readonly hasSession: boolean;
  readonly role: unknown;
  readonly currentLevel: AssuranceLevel;
  readonly nextLevel: AssuranceLevel;
}

export function normalizeAssuranceLevel(
  value: unknown,
): AssuranceLevel {
  return value === "aal1" || value === "aal2" ? value : null;
}

export function determineAccessGate(
  input: AccessGateInput,
): AccessGate {
  if (!input.hasSession) {
    return "signed_out";
  }

  if (input.role !== "founder") {
    return "founder_role_required";
  }

  if (input.currentLevel === "aal2") {
    return "ready";
  }

  if (input.nextLevel === "aal2") {
    return "mfa_challenge_required";
  }

  return "mfa_enrollment_required";
}
