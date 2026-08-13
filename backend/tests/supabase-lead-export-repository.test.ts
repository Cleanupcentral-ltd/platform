import assert from "node:assert/strict";
import test from "node:test";

import {
  SupabaseLeadExportRepository,
} from "../src/adapters/supabase/supabase-lead-export-repository.js";

test(
  "lead exports use the private service-role RPC and map rows",
  async () => {
    let requestUrl = "";
    let requestInit:
      RequestInit | undefined;
    const repository =
      new SupabaseLeadExportRepository({
        supabaseUrl:
          "https://project.supabase.co/",
        secretKey:
          "sb_secret_private",
        timeoutMs: 1_000,
        fetchFunction:
          (async (input, init) => {
            requestUrl = String(input);
            requestInit = init;
            return Response.json([{
              prospect_reference:
                "11111111-1111-4111-8111-111111111111",
              business_name:
                "Example Workspace",
              sector:
                "offices_coworking",
              postcode: "BR1 1AA",
              website:
                "https://example.com/",
              verified_contact_route:
                "hello@example.com",
              eligibility_result:
                "eligible",
              total_score: 8,
              rules_version:
                "rules-v1",
              status:
                "ready_for_outreach",
              next_follow_up_at: null,
              outcome: null,
              source_urls: [
                "https://example.com/about",
              ],
              suppression_state: false,
              created_at:
                "2026-08-13T10:00:00.000Z",
            }]);
          }) as typeof fetch,
      });

    const rows =
      await repository.createExport(
        "22222222-2222-4222-8222-222222222222",
      );
    assert.equal(
      requestUrl,
      "https://project.supabase.co/rest/v1/rpc/create_lead_export",
    );
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
        p_founder_id:
          "22222222-2222-4222-8222-222222222222",
      },
    );
    assert.equal(
      rows[0]?.businessName,
      "Example Workspace",
    );
  },
);
