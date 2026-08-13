import assert from "node:assert/strict";
import test from "node:test";

import {
  SupabaseCompanyEnrichmentRepository,
} from "../src/adapters/supabase/supabase-company-enrichment-repository.js";

test(
  "single-premises repository uses the dedicated RPC boundary",
  async () => {
    let requestedUrl = "";
    let requestBody: Record<string, unknown> = {};
    const evidenceId =
      "44444444-4444-4444-8444-444444444444";

    const repository =
      new SupabaseCompanyEnrichmentRepository({
        supabaseUrl:
          "https://example.supabase.co",
        secretKey: "test-secret",
        timeoutMs: 1_000,
        fetchFunction: (async (
          input,
          init,
        ) => {
          requestedUrl = String(input);
          requestBody = JSON.parse(
            String(init?.body),
          ) as Record<string, unknown>;
          return new Response(
            JSON.stringify([{
              evidence_ids: [evidenceId],
            }]),
            {
              status: 200,
              headers: {
                "content-type":
                  "application/json",
              },
            },
          );
        }) as typeof fetch,
      });

    const result =
      await repository.recordSinglePremises(
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
        1,
        "https://example.com/",
        "Example Offices, BR1 1AA.",
        "a".repeat(64),
      );

    assert.equal(
      requestedUrl.endsWith(
        "/rest/v1/rpc/record_automatic_single_premises",
      ),
      true,
    );
    assert.equal(
      requestBody.p_source_url,
      "https://example.com/",
    );
    assert.deepEqual(result, [evidenceId]);
  },
);
