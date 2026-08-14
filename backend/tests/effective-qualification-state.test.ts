import assert from "node:assert/strict";
import test from "node:test";

import {
  effectiveQualification,
} from "../src/domain/effective-qualification-state.js";

test(
  "a newer eligible assessment overrides a stale founder-decision queue state",
  () => {
    assert.deepEqual(
      effectiveQualification({
        automaticQualificationEnabled:
          true,
        storedState:
          "needs_founder_decision",
        storedReasons: [
          "unresolved_subscriber_type",
        ],
        enrichmentCompletedAt:
          "2026-08-13T22:30:00.000Z",
        assessment: {
          eligibilityResult:
            "eligible",
          blockers: [],
          assessedAt:
            "2026-08-13T22:35:00.000Z",
        },
        verifiedInactive: false,
      }),
      {
        state:
          "ready_for_outreach",
        reasons: [],
      },
    );
  },
);

test(
  "an assessment created before enrichment completion does not hide processing state",
  () => {
    assert.equal(
      effectiveQualification({
        automaticQualificationEnabled:
          true,
        storedState: "processing",
        storedReasons: [],
        enrichmentCompletedAt:
          "2026-08-13T22:30:00.000Z",
        assessment: {
          eligibilityResult:
            "research_required",
          blockers: [
            "missing_verified_identity",
          ],
          assessedAt:
            "2026-08-13T22:29:00.000Z",
        },
        verifiedInactive: false,
      }).state,
      "processing",
    );
  },
);

test(
  "stored exclusion is never downgraded by a later assessment",
  () => {
    assert.equal(
      effectiveQualification({
        automaticQualificationEnabled:
          true,
        storedState: "excluded",
        storedReasons: [
          "do_not_contact_or_objection",
        ],
        enrichmentCompletedAt:
          "2026-08-13T22:30:00.000Z",
        assessment: {
          eligibilityResult:
            "eligible",
          blockers: [],
          assessedAt:
            "2026-08-13T22:35:00.000Z",
        },
        verifiedInactive: false,
      }).state,
      "excluded",
    );
  },
);
