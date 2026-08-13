import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultReviewQueueFilter,
  filterProspectQueue,
} from "../src/qualification-queue.ts";

import type {
  ProspectSummary,
} from "../src/lead-review-api.ts";

function prospect(
  id: string,
  state:
    | "ready_for_outreach"
    | "needs_founder_decision"
    | "excluded"
    | "processing",
): ProspectSummary {
  return {
    id,
    businessName: `Business ${id}`,
    sector: "offices_coworking",
    primaryPostcode: "BR1 1AA",
    websiteUrl: "https://example.com/",
    createdAt:
      "2026-08-13T12:00:00.000Z",
    viewedAt: null,
    evidenceCounts: {
      unverified: 0,
      verified: 1,
      rejected: 0,
    },
    latestAssessment: null,
    companyEnrichment: {
      status: "review_required",
      discoveredCompanyNumber: null,
      sourceUrl: null,
      candidates: [],
      lastErrorCode: null,
      attemptCount: 1,
      lastAttemptAt: null,
      completedAt: null,
      qualificationState: state,
    },
  };
}

test(
  "Stage 4.2 defaults to Ready for outreach",
  () => {
    assert.equal(
      defaultReviewQueueFilter(true, true),
      "ready_for_outreach",
    );
    assert.equal(
      defaultReviewQueueFilter(false, true),
      "exceptions",
    );
  },
);

test(
  "Unseen is an independent filter over every qualification queue",
  () => {
    const unseen =
      prospect(
        "unseen",
        "needs_founder_decision",
      );
    const viewed = {
      ...prospect(
        "viewed",
        "needs_founder_decision",
      ),
      viewedAt:
        "2026-08-13T14:00:00.000Z",
    };

    assert.deepEqual(
      filterProspectQueue(
        [unseen, viewed],
        "needs_founder_decision",
        "",
        true,
        true,
      ).map((item) => item.id),
      ["unseen"],
    );
  },
);

test(
  "Stage 4.2 filters the founder work queue by automatic state",
  () => {
    const prospects = [
      prospect("ready", "ready_for_outreach"),
      prospect("review", "needs_founder_decision"),
      prospect("excluded", "excluded"),
      prospect("processing", "processing"),
    ];

    assert.deepEqual(
      filterProspectQueue(
        prospects,
        "ready_for_outreach",
        "",
        true,
      ).map((item) => item.id),
      ["ready"],
    );
    assert.deepEqual(
      filterProspectQueue(
        prospects,
        "needs_founder_decision",
        "review",
        true,
      ).map((item) => item.id),
      ["review"],
    );
  },
);
