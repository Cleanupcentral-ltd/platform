export type EffectiveQualificationState =
  | "ready_for_outreach"
  | "needs_founder_decision"
  | "excluded"
  | "processing";

export interface EffectiveQualificationInput {
  readonly automaticQualificationEnabled:
    boolean;
  readonly storedState:
    EffectiveQualificationState | undefined;
  readonly storedReasons:
    readonly string[] | undefined;
  readonly enrichmentCompletedAt:
    string | null | undefined;
  readonly assessment:
    | {
        readonly eligibilityResult:
          | "eligible"
          | "research_required";
        readonly blockers:
          readonly string[];
        readonly assessedAt: string;
      }
    | null;
  readonly verifiedInactive: boolean;
}

export function effectiveQualification(
  input: EffectiveQualificationInput,
): {
  readonly state:
    EffectiveQualificationState | undefined;
  readonly reasons:
    readonly string[] | undefined;
} {
  if (
    !input.automaticQualificationEnabled ||
    input.assessment === null ||
    input.storedState === "excluded"
  ) {
    return {
      state: input.storedState,
      reasons: input.storedReasons,
    };
  }

  const completedAt =
    input.enrichmentCompletedAt ===
      null ||
    input.enrichmentCompletedAt ===
      undefined
      ? Number.NaN
      : Date.parse(
          input.enrichmentCompletedAt,
        );
  const assessedAt = Date.parse(
    input.assessment.assessedAt,
  );

  if (
    !Number.isFinite(completedAt) ||
    !Number.isFinite(assessedAt) ||
    assessedAt <= completedAt
  ) {
    return {
      state: input.storedState,
      reasons: input.storedReasons,
    };
  }

  if (
    input.verifiedInactive ||
    input.assessment.blockers.includes(
      "do_not_contact_or_objection",
    )
  ) {
    return {
      state: "excluded",
      reasons:
        input.assessment.blockers,
    };
  }

  if (
    input.assessment
      .eligibilityResult ===
        "eligible" &&
    input.assessment.blockers.length ===
      0
  ) {
    return {
      state: "ready_for_outreach",
      reasons: [],
    };
  }

  return {
    state: "needs_founder_decision",
    reasons:
      input.assessment.blockers,
  };
}
