import assert from "node:assert/strict";
import test from "node:test";

import {
  SupabaseLeadSearchRepository,
} from "../src/adapters/supabase/supabase-lead-search-repository.js";

const SEARCH_RUN_ID =
  "1f8a558b-f3b6-453b-b201-6d57323d0663";

test(
  "Supabase lead repository uses the private schema and secret key without a bearer header",
  async () => {
    const requests:
      {
        url: string;
        init: RequestInit | undefined;
      }[] =
        [];
    const repository =
      new SupabaseLeadSearchRepository({
        supabaseUrl:
          "https://example.supabase.co",
        secretKey:
          "sb_secret_private",
        timeoutMs: 1_000,
        fetchFunction:
          (async (input, init) => {
            requests.push({
              url: String(input),
              init,
            });
            return requests.length === 1
              ? Response.json([
                  { id: SEARCH_RUN_ID },
                ])
                : Response.json([{
                  result_count: 1,
                  created_count: 1,
                  created_prospect_ids: [
                    "11111111-1111-4111-8111-111111111111",
                  ],
                }]);
          }) as typeof fetch,
      });

    const runId =
      await repository.startSearch({
        founderId:
          "79b42d3d-78be-42fc-9d91-5d97566d2ed0",
        postcode: "BR1 5HP",
        radiusMiles: 5,
        sector:
          "offices_coworking",
      });
    const outcome =
      await repository.completeSearch({
        searchRunId: runId,
        sector:
          "offices_coworking",
        results: [{
          dedupeKey:
            "google_places:place-1",
          businessName:
            "Example Office",
          websiteUrl: null,
          primaryPostcode:
            "BR1 1AA",
          sourceRank: 1,
          evidence: [],
        }],
      });

    assert.deepEqual(outcome, {
      resultCount: 1,
      createdCount: 1,
      createdProspectIds: [
        "11111111-1111-4111-8111-111111111111",
      ],
    });
    assert.equal(
      requests[0]?.url,
      "https://example.supabase.co/rest/v1/search_runs?select=id",
    );
    assert.equal(
      requests[1]?.url,
      "https://example.supabase.co/rest/v1/rpc/capture_lead_results",
    );
    for (const request of requests) {
      const headers =
        new Headers(
          request.init?.headers,
        );
      assert.equal(
        headers.get("apikey"),
        "sb_secret_private",
      );
      assert.equal(
        headers.get(
          "accept-profile",
        ),
        "lead_engine",
      );
      assert.equal(
        headers.get(
          "content-profile",
        ),
        "lead_engine",
      );
      assert.equal(
        headers.has("authorization"),
        false,
      );
    }
  },
);

test(
  "Supabase lead repository remains compatible until the automatic-assessment migration is applied",
  async () => {
    const repository =
      new SupabaseLeadSearchRepository({
        supabaseUrl:
          "https://example.supabase.co",
        secretKey:
          "sb_secret_private",
        timeoutMs: 1_000,
        fetchFunction:
          (async () => Response.json([{
            result_count: 1,
            created_count: 1,
          }])) as typeof fetch,
      });

    const outcome =
      await repository.completeSearch({
        searchRunId: SEARCH_RUN_ID,
        sector:
          "offices_coworking",
        results: [],
      });

    assert.deepEqual(outcome, {
      resultCount: 1,
      createdCount: 1,
      createdProspectIds: [],
    });
  },
);

test(
  "stores borough search provenance without inventing a postcode radius",
  async () => {
    let body:
      Record<string, unknown> = {};
    const repository =
      new SupabaseLeadSearchRepository({
        supabaseUrl:
          "https://example.supabase.co",
        secretKey:
          "sb_secret_private",
        timeoutMs: 1_000,
        fetchFunction:
          (async (_input, init) => {
            body = JSON.parse(
              String(init?.body),
            ) as
              Record<string, unknown>;
            return Response.json([
              { id: SEARCH_RUN_ID },
            ]);
          }) as typeof fetch,
      });

    await repository.startSearch({
      founderId:
        "79b42d3d-78be-42fc-9d91-5d97566d2ed0",
      searchMode: "borough",
      postcode: null,
      radiusMiles: null,
      borough: "Bromley",
      sector:
        "offices_coworking",
    });

    assert.equal(
      body.search_mode,
      "borough",
    );
    assert.equal(
      body.borough,
      "Bromley",
    );
    assert.equal(
      body.postcode,
      null,
    );
    assert.equal(
      body.radius_miles,
      null,
    );
  },
);
