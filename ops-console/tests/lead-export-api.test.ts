import assert from "node:assert/strict";
import test from "node:test";

import {
  downloadLeadExport,
} from "../src/lead-export-api.ts";

test(
  "founder CSV download uses only the MFA bearer token and validates the file",
  async () => {
    let requestUrl = "";
    let requestInit:
      RequestInit | undefined;
    const result =
      await downloadLeadExport(
        "https://backend.example/",
        "founder-aal2-token",
        (async (input, init) => {
          requestUrl = String(input);
          requestInit = init;
          return new Response(
            '"business_name"\r\n"Example"\r\n',
            {
              headers: {
                "content-type":
                  "text/csv; charset=utf-8",
                "content-disposition":
                  'attachment; filename="clean-up-central-leads-2026-08-13.csv"',
              },
            },
          );
        }) as typeof fetch,
      );

    assert.equal(
      requestUrl,
      "https://backend.example/api/ops/leads/export.csv",
    );
    const headers = new Headers(
      requestInit?.headers,
    );
    assert.equal(
      headers.get("authorization"),
      "Bearer founder-aal2-token",
    );
    assert.equal(
      result.filename,
      "clean-up-central-leads-2026-08-13.csv",
    );
    assert.match(
      await result.blob.text(),
      /Example/,
    );
  },
);

test(
  "CSV download rejects an unexpected response type",
  async () => {
    await assert.rejects(
      downloadLeadExport(
        "https://backend.example",
        "founder-aal2-token",
        (async () =>
          Response.json({})) as
          typeof fetch,
      ),
      /unexpected file type/,
    );
  },
);
