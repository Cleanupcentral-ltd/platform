import assert from "node:assert/strict";
import test from "node:test";

import {
  SupabaseLeadSearchRepository,
} from "../src/adapters/supabase/supabase-lead-search-repository.js";

import type {
  CapturedLeadResult,
} from "../src/ports/lead-search.js";

const PROSPECT_ID =
  "11111111-1111-4111-8111-111111111111";

function response() {
  return new Response(
    JSON.stringify([
      {
        result_count: 1,
        created_count: 1,
        created_prospect_ids: [
          PROSPECT_ID,
        ],
      },
    ]),
    {
      status: 200,
      headers: {
        "content-type":
          "application/json",
      },
    },
  );
}

test(
  "Google rich discovery content never crosses the Supabase capture request boundary",
  async () => {
    let capturedBody: unknown = null;
    const repository =
      new SupabaseLeadSearchRepository({
        supabaseUrl:
          "https://example.supabase.co",
        secretKey: "test-secret",
        timeoutMs: 1_000,
        fetchFunction: async (
          _input,
          init,
        ) => {
          capturedBody = JSON.parse(
            String(init?.body ?? "null"),
          );
          return response();
        },
      });

    const richGoogleResult:
      CapturedLeadResult = {
        dedupeKey:
          "google_places:ChIJ-test-place",
        businessName:
          "Rich Google Business Name",
        websiteUrl:
          "https://google-returned.example/",
        primaryPostcode: "BR1 1AA",
        sourceRank: 1,
        evidence: [
          {
            sourceUrl:
              "https://maps.google.com/rich-result",
            sourceType: "google_places",
            fieldName: "business_name",
            fieldValue:
              "Rich Google Business Name",
            sourceExcerpt:
              "Rich Google Business Name — Google address",
            contentSha256: "a".repeat(64),
            contactType: null,
            normalizedContactValue: null,
          },
          {
            sourceUrl:
              "https://maps.google.com/rich-result",
            sourceType: "google_places",
            fieldName: "phone",
            fieldValue: "020 7000 0000",
            sourceExcerpt:
              "Rich Google Business Name — Google address",
            contentSha256: "b".repeat(64),
            contactType: "phone",
            normalizedContactValue:
              "02070000000",
          },
        ],
      };

    await repository.completeSearch({
      searchRunId:
        "22222222-2222-4222-8222-222222222222",
      sector: "offices_coworking",
      results: [richGoogleResult],
    });

    assert.deepEqual(capturedBody, {
      p_search_run_id:
        "22222222-2222-4222-8222-222222222222",
      p_sector: "offices_coworking",
      p_results: [
        {
          dedupe_key:
            "google_places:ChIJ-test-place",
          business_name:
            "Pending verification",
          website_url: null,
          primary_postcode: null,
          source_rank: null,
          evidence: [],
        },
      ],
    });

    const serialized =
      JSON.stringify(capturedBody);
    for (const prohibited of [
      "Rich Google Business Name",
      "google-returned.example",
      "BR1 1AA",
      "020 7000 0000",
      "maps.google.com/rich-result",
    ]) {
      assert.equal(
        serialized.includes(prohibited),
        false,
        `${prohibited} leaked into the persistence request`,
      );
    }
  },
);
