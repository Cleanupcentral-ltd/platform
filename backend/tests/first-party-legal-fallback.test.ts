import assert from "node:assert/strict";
import test from "node:test";

import {
  FirstPartyResearchClient,
} from "../src/adapters/web/first-party-research.js";

function html(
  body: string,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...headers,
    },
  });
}

test(
  "probes bounded same-origin legal fallbacks when a company number is not linked from the homepage",
  async () => {
    const requested: string[] = [];

    const client = new FirstPartyResearchClient({
      timeoutMs: 1_000,
      maximumBytes: 20_000,
      maximumPages: 6,
      requestRetries: 0,
      async resolveHost() {
        return ["8.8.8.8"];
      },
      fetchFunction: (async (input) => {
        const url = String(input);
        requested.push(url);

        if (url === "https://example.com/") {
          return html([
            "<h1>Example Hall</h1>",
            "<p>Community hall and venue hire.</p>",
            "<p>bookings@example.com</p>",
          ].join(""));
        }

        if (
          url ===
          "https://example.com/website-terms-and-conditions"
        ) {
          return html([
            "<h1>Website terms</h1>",
            "<p>Example Hall is operated by Example Hall UK Limited.</p>",
            "<p>Registered in England. Company number: 06793389.</p>",
          ].join(""));
        }

        return html("<h1>Not found</h1>", 404);
      }) as typeof fetch,
    });

    const result = await client.research(
      "https://example.com/",
      "Example Hall",
      "community_halls_event_venues",
    );

    assert.ok(
      requested.includes(
        "https://example.com/website-terms-and-conditions",
      ),
    );
    assert.equal(
      result.companyNumberAssertions[0]
        ?.companyNumber,
      "06793389",
    );
    assert.ok(
      result.visitedUrls.includes(
        "https://example.com/website-terms-and-conditions",
      ),
    );
  },
);
