import assert from "node:assert/strict";
import test from "node:test";

import {
  FirstPartyCompanyNumberClient,
  FirstPartyLookupError,
} from "../src/adapters/web/first-party-company-number.js";

function html(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}

test(
  "finds one labelled company number on a same-origin legal page",
  async () => {
    const requested: string[] = [];
    const client =
      new FirstPartyCompanyNumberClient({
        timeoutMs: 1_000,
        maximumBytes: 20_000,
        fetchFunction:
          (async (input) => {
            const url = String(input);
            requested.push(url);
            return url.endsWith("/privacy")
              ? html(
                  "<footer>Registered in England and Wales. Company number: 01234567</footer>",
                )
              : html(
                  '<a href="/privacy">Privacy policy</a>',
                );
          }) as typeof fetch,
        async resolveHost() {
          return ["8.8.8.8"];
        },
      });

    const evidence = await client.find(
      "https://example.com/",
    );

    assert.deepEqual(
      evidence?.companyNumbers,
      ["01234567"],
    );
    assert.equal(
      evidence?.sourceUrl,
      "https://example.com/privacy",
    );
    assert.match(
      evidence?.contentSha256 ?? "",
      /^[0-9a-f]{64}$/,
    );
    assert.deepEqual(requested, [
      "https://example.com/",
      "https://example.com/privacy",
    ]);
  },
);

test(
  "does not accept an unlabelled number from page text",
  async () => {
    const client =
      new FirstPartyCompanyNumberClient({
        timeoutMs: 1_000,
        maximumBytes: 20_000,
        fetchFunction:
          (async () => html(
            "Call 01234567 for information.",
          )) as typeof fetch,
        async resolveHost() {
          return ["8.8.8.8"];
        },
      });

    assert.equal(
      await client.find(
        "https://example.com/",
      ),
      null,
    );
  },
);

test(
  "blocks private network destinations before any website request",
  async () => {
    let requested = false;
    const client =
      new FirstPartyCompanyNumberClient({
        timeoutMs: 1_000,
        maximumBytes: 20_000,
        fetchFunction:
          (async () => {
            requested = true;
            return html("not reached");
          }) as typeof fetch,
        async resolveHost() {
          return ["10.0.0.8"];
        },
      });

    await assert.rejects(
      client.find("https://internal.example/"),
      (error: unknown) =>
        error instanceof FirstPartyLookupError &&
        error.failure === "unsafe_url",
    );
    assert.equal(requested, false);
  },
);
