import assert from "node:assert/strict";
import test from "node:test";
import { FirstPartyResearchClient } from "../src/adapters/web/first-party-research.js";

function html(body: string): Response {
  return new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}

test("uses inert application JSON as first-party evidence", async () => {
  const client = new FirstPartyResearchClient({
    timeoutMs: 1_000,
    maximumBytes: 20_000,
    async resolveHost() { return ["8.8.8.8"]; },
    fetchFunction: (async () => html([
      "<html><head>",
      '<script type="application/json">',
      JSON.stringify({ pageProps: { location: {
        name: "Regus - Barking, Jhumat House",
        description: "Flexible office space and coworking in Barking.",
      } } }),
      "</script></head><body>Loading workspace...</body></html>",
    ].join(""))) as typeof fetch,
  });

  const result = await client.research(
    "https://example.com/location",
    "Regus - Barking, Jhumat House",
    "offices_coworking",
  );

  assert.equal(result.reviewReasons.includes("website_identity_not_confirmed"), false);
  assert.ok(result.facts.some((fact) => fact.factName === "business_name"));
  assert.ok(result.facts.some((fact) => fact.factName === "approved_sector"));
});

test("follows a same-origin canonical recovery page", async () => {
  const requested: string[] = [];
  const client = new FirstPartyResearchClient({
    timeoutMs: 1_000,
    maximumBytes: 20_000,
    async resolveHost() { return ["8.8.8.8"]; },
    fetchFunction: (async (input) => {
      const url = String(input);
      requested.push(url);
      if (url === "https://example.com/legacy/1350") {
        return html('<html><head><link rel="canonical" href="/locations/barking"></head><body>Loading workspace...</body></html>');
      }
      return html("<h1>Regus - Barking, Jhumat House</h1><p>Flexible office space and coworking in Barking.</p>");
    }) as typeof fetch,
  });

  const result = await client.research(
    "https://example.com/legacy/1350",
    "Regus - Barking, Jhumat House",
    "offices_coworking",
  );

  assert.ok(requested.includes("https://example.com/locations/barking"));
  assert.equal(result.canonicalWebsiteUrl, "https://example.com/locations/barking");
  assert.ok(result.facts.some((fact) => fact.factName === "business_name"));
  assert.ok(result.facts.some((fact) => fact.factName === "approved_sector"));
});
