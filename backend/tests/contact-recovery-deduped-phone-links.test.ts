import assert from "node:assert/strict";
import test from "node:test";

import {
  FirstPartyContactRecoveryClient,
} from "../src/adapters/web/contact-recovery.js";

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}

function client(
  fetchFunction: typeof fetch,
): FirstPartyContactRecoveryClient {
  return new FirstPartyContactRecoveryClient({
    timeoutMs: 1_000,
    maximumBytes: 30_000,
    maximumPages: 8,
    requestRetries: 0,
    async resolveHost() {
      return ["8.8.8.8"];
    },
    fetchFunction,
  });
}

test(
  "treats the same branch phone repeated across pages as one contact rather than an ambiguity",
  async () => {
    const recovery = client(
      (async (input) => {
        const url = String(input);
        if (url === "https://example.com/") {
          return html([
            '<a href="/branches/barnet">Barnet branch</a>',
            '<a href="/branches/barnet/properties">Barnet branch properties</a>',
          ].join(""));
        }
        if (
          url === "https://example.com/branches/barnet" ||
          url === "https://example.com/branches/barnet/properties"
        ) {
          return html([
            "<h1>Winkworth Barnet</h1>",
            "<p>Barnet office 020 8447 5656</p>",
          ].join(""));
        }
        return html("missing", 404);
      }) as typeof fetch,
    );

    const result = await recovery.recover(
      "https://example.com/",
      "Winkworth Barnet Estate Agents",
      "estate_letting_agents",
    );

    const phones = result.facts.filter((fact) =>
      fact.factName === "public_phone");
    assert.equal(phones.length, 1);
    assert.equal(
      phones[0]?.normalizedContactValue,
      "02084475656",
    );
  },
);

test(
  "discovers a contact href even when the surrounding anchor markup is incomplete",
  async () => {
    const requested: string[] = [];
    const recovery = client(
      (async (input) => {
        const url = String(input);
        requested.push(url);
        if (url === "https://example.com/") {
          return html([
            "<h1>Example Hall</h1>",
            '<a class="nav" href="/our-contact-page.html">Contact',
          ].join(""));
        }
        if (url === "https://example.com/our-contact-page.html") {
          return html([
            "<h1>Contact</h1>",
            "<p>Phone 020 8449 6593</p>",
            '<a href="mailto:info@example.com">info@example.com</a>',
          ].join(""));
        }
        return html("missing", 404);
      }) as typeof fetch,
    );

    const result = await recovery.recover(
      "https://example.com/",
      "Example Hall",
      "community_halls_event_venues",
    );

    assert.ok(requested.includes(
      "https://example.com/our-contact-page.html",
    ));
    assert.ok(result.facts.some((fact) =>
      fact.factName === "public_phone" &&
      fact.normalizedContactValue === "02084496593"));
    assert.ok(result.facts.some((fact) =>
      fact.factName === "public_email" &&
      fact.factValue === "info@example.com"));
  },
);
