import assert from "node:assert/strict";
import test from "node:test";

import type {
  LeadSearchResult,
} from "../src/lead-search-api";
import type {
  ProspectSummary,
} from "../src/lead-review-api";

import {
  buildSearchResultStates,
  filterSearchResultStates,
  matchSearchResultToProspect,
  prospectQualificationLabel,
} from "../src/search-result-state.ts";

const result: LeadSearchResult = {
  businessName: "Example Hall",
  formattedAddress: "1 High Street",
  primaryPostcode: "BR1 1AA",
  websiteUrl:
    "https://example.org/venue?utm_source=google",
  phone: null,
  sourceUrl:
    "https://places.googleapis.com/example",
  distanceMiles: null,
  evidenceStatus: "unverified",
};

function prospect(
  overrides: Partial<ProspectSummary> = {},
): ProspectSummary {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    businessName: "Example Hall",
    sector: "community_halls_event_venues",
    primaryPostcode: "BR1 1AA",
    websiteUrl: "https://example.org/venue",
    createdAt: "2026-08-14T00:00:00.000Z",
    viewedAt: null,
    evidenceCounts: {
      unverified: 0,
      verified: 0,
      rejected: 0,
    },
    latestAssessment: null,
    companyEnrichment: {
      status: "pending",
      discoveredCompanyNumber: null,
      sourceUrl: null,
      candidates: [],
      lastErrorCode: null,
      attemptCount: 0,
      lastAttemptAt: null,
      completedAt: null,
      qualificationState: "processing",
      qualificationReasons: [],
      researchSummary: {},
      researchCompletedAt: null,
    },
    ...overrides,
  };
}

test(
  "matches the persisted prospect while ignoring tracking parameters",
  () => {
    const matched =
      matchSearchResultToProspect(
        result,
        [prospect()],
      );
    assert.equal(
      matched?.businessName,
      "Example Hall",
    );
  },
);

test(
  "reports the real qualification state instead of hard-coded unverified",
  () => {
    const base = prospect();
    assert.equal(
      prospectQualificationLabel(
        prospect({
          companyEnrichment: {
            ...base.companyEnrichment!,
            status: "auto_verified",
            qualificationState:
              "ready_for_outreach",
          },
        }),
      ),
      "Ready for outreach",
    );
  },
);

test(
  "distinguishes a queued qualification job from one already processing",
  () => {
    const queued = prospect();
    assert.equal(
      prospectQualificationLabel(queued),
      "Queued",
    );

    const running =
      prospect({
        companyEnrichment: {
          ...queued.companyEnrichment!,
          status: "processing",
          attemptCount: 1,
        },
      });
    assert.equal(
      prospectQualificationLabel(running),
      "Processing",
    );
  },
);

test(
  "filters search results by seen and unseen state",
  () => {
    const unseen = prospect();
    const seen = prospect({
      id: "00000000-0000-4000-8000-000000000002",
      businessName: "Seen Hall",
      primaryPostcode: "BR2 2BB",
      websiteUrl: "https://seen.example/",
      viewedAt: "2026-08-14T01:00:00.000Z",
    });

    const states = buildSearchResultStates(
      [
        result,
        {
          ...result,
          businessName: "Seen Hall",
          primaryPostcode: "BR2 2BB",
          websiteUrl: "https://seen.example/",
          sourceUrl:
            "https://places.googleapis.com/seen",
        },
      ],
      [unseen, seen],
    );

    assert.equal(
      filterSearchResultStates(
        states,
        "unseen",
      ).length,
      1,
    );
    assert.equal(
      filterSearchResultStates(
        states,
        "seen",
      ).length,
      1,
    );
  },
);
