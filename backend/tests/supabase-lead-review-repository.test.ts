import assert from "node:assert/strict";
import test from "node:test";

import {
  SupabaseLeadReviewRepository,
} from "../src/adapters/supabase/supabase-lead-review-repository.js";

test(
  "Supabase lead review uses the private schema and secret key for atomic evidence capture",
  async () => {
    let requestUrl = "";
    let requestInit:
      RequestInit | undefined;
    const repository =
      new SupabaseLeadReviewRepository({
        supabaseUrl:
          "https://project.supabase.co",
        secretKey: "sb_secret_private",
        timeoutMs: 1_000,
        fetchFunction:
          (async (input, init) => {
            requestUrl = String(input);
            requestInit = init;
            return Response.json([{
              evidence_id:
                "33333333-3333-4333-8333-333333333333",
            }]);
          }) as typeof fetch,
      });

    const evidenceId =
      await repository
        .addVerifiedEvidence({
          prospectId:
            "11111111-1111-4111-8111-111111111111",
          founderId:
            "22222222-2222-4222-8222-222222222222",
          sourceType:
            "first_party_website",
          sourceUrl:
            "https://example.com/contact",
          factName: "public_email",
          factValue:
            "hello@example.com",
          sourceExcerpt: null,
          contentSha256:
            "a".repeat(64),
          contactType: "email",
          normalizedContactValue:
            "hello@example.com",
        });

    assert.equal(
      requestUrl,
      "https://project.supabase.co/rest/v1/rpc/record_verified_lead_evidence",
    );
    const headers = new Headers(
      requestInit?.headers,
    );
    assert.equal(
      headers.get("apikey"),
      "sb_secret_private",
    );
    assert.equal(
      headers.get("authorization"),
      "Bearer sb_secret_private",
    );
    assert.equal(
      headers.get("content-profile"),
      "lead_engine",
    );
    assert.equal(
      evidenceId,
      "33333333-3333-4333-8333-333333333333",
    );
    const body = JSON.parse(
      String(requestInit?.body),
    );
    assert.equal(
      body.p_founder_id,
      "22222222-2222-4222-8222-222222222222",
    );
    assert.equal(
      body.p_contact_type,
      "email",
    );
  },
);

test(
  "Supabase lead review records founder-confirmed Companies House facts through one atomic RPC",
  async () => {
    let requestUrl = "";
    let requestInit:
      RequestInit | undefined;
    const repository =
      new SupabaseLeadReviewRepository({
        supabaseUrl:
          "https://project.supabase.co",
        secretKey: "sb_secret_private",
        timeoutMs: 1_000,
        fetchFunction:
          (async (input, init) => {
            requestUrl = String(input);
            requestInit = init;
            return Response.json([{
              evidence_ids: [
                "33333333-3333-4333-8333-333333333333",
              ],
            }]);
          }) as typeof fetch,
      });

    const evidenceIds =
      await repository
        .recordCompaniesHouseVerification({
          prospectId:
            "11111111-1111-4111-8111-111111111111",
          founderId:
            "22222222-2222-4222-8222-222222222222",
          sourceUrl:
            "https://find-and-update.company-information.service.gov.uk/company/01234567",
          facts: [{
            factName:
              "company_number",
            factValue: "01234567",
            sourceExcerpt:
              "Official profile",
            contentSha256:
              "a".repeat(64),
          }],
        });

    assert.equal(
      requestUrl,
      "https://project.supabase.co/rest/v1/rpc/record_companies_house_verification",
    );
    const body = JSON.parse(
      String(requestInit?.body),
    );
    assert.equal(
      body.p_facts[0].field_name,
      "company_number",
    );
    assert.deepEqual(
      evidenceIds,
      [
        "33333333-3333-4333-8333-333333333333",
      ],
    );
  },
);
