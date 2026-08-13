import assert from "node:assert/strict";
import test from "node:test";

import {
  SupabaseCompanyEnrichmentRepository,
} from "../src/adapters/supabase/supabase-company-enrichment-repository.js";

test(
  "company enrichment claims a bounded persisted batch through the private schema",
  async () => {
    let requestUrl = "";
    let requestInit: RequestInit | undefined;
    const repository =
      new SupabaseCompanyEnrichmentRepository({
        supabaseUrl:
          "https://project.supabase.co",
        secretKey: "sb_secret_private",
        timeoutMs: 1_000,
        fetchFunction:
          (async (input, init) => {
            requestUrl = String(input);
            requestInit = init;
            return Response.json([{
              prospect_id:
                "11111111-1111-4111-8111-111111111111",
              actor_id:
                "22222222-2222-4222-8222-222222222222",
              business_name:
                "Example Company",
              website_url:
                "https://example.com/",
              company_number: null,
              attempt_count: 1,
            }]);
          }) as typeof fetch,
      });

    const jobs = await repository.claimJobs(
      5,
      180,
    );

    assert.equal(
      requestUrl,
      "https://project.supabase.co/rest/v1/rpc/claim_company_enrichment_jobs",
    );
    assert.equal(jobs.length, 1);
    const headers = new Headers(
      requestInit?.headers,
    );
    assert.equal(
      headers.get("authorization"),
      "Bearer sb_secret_private",
    );
    assert.equal(
      headers.get("content-profile"),
      "lead_engine",
    );
    assert.deepEqual(
      JSON.parse(String(requestInit?.body)),
      {
        p_limit: 5,
        p_lease_seconds: 180,
      },
    );
  },
);

test(
  "company enrichment completion cannot overwrite a superseded claim",
  async () => {
    let requestUrl = "";
    let requestInit: RequestInit | undefined;
    const repository =
      new SupabaseCompanyEnrichmentRepository({
        supabaseUrl:
          "https://project.supabase.co",
        secretKey: "sb_secret_private",
        timeoutMs: 1_000,
        fetchFunction:
          (async (input, init) => {
            requestUrl = String(input);
            requestInit = init;
            return Response.json([]);
          }) as typeof fetch,
      });

    await repository.complete({
      prospectId:
        "11111111-1111-4111-8111-111111111111",
      attemptCount: 2,
      status: "review_required",
      discoveredCompanyNumber: null,
      sourceUrl: null,
      sourceExcerpt: null,
      sourceContentSha256: null,
      candidates: [],
      lastErrorCode: null,
    });

    assert.equal(
      requestUrl,
      "https://project.supabase.co/rest/v1/company_enrichment?prospect_id=eq.11111111-1111-4111-8111-111111111111&status=eq.processing&attempt_count=eq.2",
    );
    assert.equal(requestInit?.method, "PATCH");
    assert.equal(
      new Headers(requestInit?.headers)
        .get("prefer"),
      "return=representation",
    );
  },
);

test(
  "automatic qualification claims only the versioned private queue",
  async () => {
    let requestUrl = "";
    const repository =
      new SupabaseCompanyEnrichmentRepository({
        supabaseUrl:
          "https://project.supabase.co",
        secretKey: "sb_secret_private",
        timeoutMs: 1_000,
        fetchFunction: (async (input) => {
          requestUrl = String(input);
          return Response.json([{
            prospect_id:
              "11111111-1111-4111-8111-111111111111",
            actor_id:
              "22222222-2222-4222-8222-222222222222",
            business_name:
              "Example University Halls",
            sector:
              "university_accommodation",
            website_url:
              "https://example.ac.uk/",
            company_number: null,
            attempt_count: 1,
          }]);
        }) as typeof fetch,
      });

    const jobs = await repository
      .claimQualificationJobs(5, 180);

    assert.equal(
      requestUrl,
      "https://project.supabase.co/rest/v1/rpc/claim_automatic_qualification_jobs",
    );
    assert.equal(
      jobs[0]?.sector,
      "university_accommodation",
    );
  },
);

test(
  "automatic research records exact source evidence through one private RPC",
  async () => {
    let requestUrl = "";
    let requestBody: unknown;
    const repository =
      new SupabaseCompanyEnrichmentRepository({
        supabaseUrl:
          "https://project.supabase.co",
        secretKey: "sb_secret_private",
        timeoutMs: 1_000,
        fetchFunction: (async (input, init) => {
          requestUrl = String(input);
          requestBody = JSON.parse(
            String(init?.body),
          );
          return Response.json([{
            evidence_ids: [
              "33333333-3333-4333-8333-333333333333",
            ],
          }]);
        }) as typeof fetch,
      });

    await repository.recordResearch(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      1,
      [{
        sourceUrl:
          "https://example.com/contact",
        factName: "public_email",
        factValue: "hello@example.com",
        sourceExcerpt:
          "Contact hello@example.com",
        contentSha256: "a".repeat(64),
        contactType: "email",
        normalizedContactValue:
          "hello@example.com",
      }],
    );

    assert.equal(
      requestUrl,
      "https://project.supabase.co/rest/v1/rpc/record_automatic_first_party_research",
    );
    assert.deepEqual(
      (requestBody as {
        p_facts: readonly unknown[];
      }).p_facts,
      [{
        source_url:
          "https://example.com/contact",
        field_name: "public_email",
        field_value: "hello@example.com",
        source_excerpt:
          "Contact hello@example.com",
        content_sha256: "a".repeat(64),
        contact_type: "email",
        normalized_contact_value:
          "hello@example.com",
      }],
    );
  },
);
