import assert from "node:assert/strict";
import test from "node:test";

import {
  addVerificationEvidence,
  assessProspect,
  listProspects,
} from "../src/lead-review-api.ts";

const PROSPECT_ID =
  "11111111-1111-4111-8111-111111111111";

test(
  "prospect review queue uses the MFA session only as a bearer token",
  async () => {
    let requestUrl = "";
    let requestInit:
      RequestInit | undefined;
    const result = await listProspects(
      "https://backend.example/",
      "founder-aal2-token",
      (async (input, init) => {
        requestUrl = String(input);
        requestInit = init;
        return Response.json({
          success: true,
          prospects: [],
        });
      }) as typeof fetch,
    );

    assert.equal(
      requestUrl,
      "https://backend.example/api/ops/leads/prospects",
    );
    const headers = new Headers(
      requestInit?.headers,
    );
    assert.equal(
      headers.get("authorization"),
      "Bearer founder-aal2-token",
    );
    assert.deepEqual(result, []);
  },
);

test(
  "first-party verification sends one atomic fact and its source",
  async () => {
    let requestBody = "";
    const evidenceId =
      await addVerificationEvidence(
        "https://backend.example",
        "founder-aal2-token",
        PROSPECT_ID,
        {
          sourceType:
            "first_party_website",
          sourceUrl:
            "https://example.com/about",
          factName:
            "business_name",
          factValue:
            "Example Business",
          sourceExcerpt: null,
        },
        (async (_input, init) => {
          requestBody =
            String(init?.body);
          return Response.json(
            {
              success: true,
              verification: {
                evidenceId:
                  "33333333-3333-4333-8333-333333333333",
              },
            },
            { status: 201 },
          );
        }) as typeof fetch,
      );

    const body = JSON.parse(requestBody);
    assert.equal(
      body.sourceType,
      "first_party_website",
    );
    assert.equal(
      body.factName,
      "business_name",
    );
    assert.equal(
      body.sourceUrl,
      "https://example.com/about",
    );
    assert.equal(
      evidenceId,
      "33333333-3333-4333-8333-333333333333",
    );
  },
);

test(
  "assessment request has no client-supplied score",
  async () => {
    let requestBody = "";
    const result = await assessProspect(
      "https://backend.example",
      "founder-aal2-token",
      PROSPECT_ID,
      (async (_input, init) => {
        requestBody = String(init?.body);
        return Response.json(
          {
            success: true,
            assessment: {
              id:
                "44444444-4444-4444-8444-444444444444",
              totalScore: 2,
              rulesVersion:
                "cuc-lel-0-10-v1",
              eligibilityResult:
                "research_required",
              scoreBreakdown: {},
              blockers: [
                "missing_verified_identity",
              ],
              rationale:
                "Research required.",
              evidenceIds: [],
              assessedAt:
                "2026-08-11T12:00:00.000Z",
            },
          },
          { status: 201 },
        );
      }) as typeof fetch,
    );

    assert.equal(requestBody, "{}");
    assert.equal(result.totalScore, 2);
    assert.equal(
      result.rulesVersion,
      "cuc-lel-0-10-v1",
    );
  },
);
