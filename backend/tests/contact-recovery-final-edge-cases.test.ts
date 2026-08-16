import assert from "node:assert/strict";
import test from "node:test";

import {
  FirstPartyContactRecoveryClient,
} from "../src/adapters/web/contact-recovery.js";

function html(
  body: string,
  status = 200,
): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}

function client(
  fetchFunction: typeof fetch,
  maximumBytes = 30_000,
): FirstPartyContactRecoveryClient {
  return new FirstPartyContactRecoveryClient({
    timeoutMs: 1_000,
    maximumBytes,
    maximumPages: 8,
    requestRetries: 0,
    async resolveHost() {
      return ["8.8.8.8"];
    },
    fetchFunction,
  });
}

test(
  "tries legacy .html contact fallbacks when the homepage does not expose a discoverable contact link",
  async () => {
    const requested: string[] = [];
    const recovery = client(
      (async (input) => {
        const url = String(input);
        requested.push(url);
        if (url === "https://example.com/") {
          return html("<h1>Example Church Hall</h1>");
        }
        if (url === "https://example.com/contact.html") {
          return html([
            "<h1>Contact</h1>",
            '<a href="tel:02081234567">020 8123 4567</a>',
            '<a href="mailto:info@example.com">info@example.com</a>',
          ].join(""));
        }
        return html("missing", 404);
      }) as typeof fetch,
    );

    const result = await recovery.recover(
      "https://example.com/",
      "Example Church Hall",
      "community_halls_event_venues",
    );

    assert.ok(requested.includes(
      "https://example.com/contact.html",
    ));
    assert.ok(result.facts.some((fact) =>
      fact.factName === "public_email" &&
      fact.factValue === "info@example.com"));
    assert.ok(result.facts.some((fact) =>
      fact.factName === "public_phone" &&
      fact.normalizedContactValue === "02081234567"));
  },
);

test(
  "uses one extra bounded read window for contact details late in a large first-party page",
  async () => {
    const lateContact = [
      "x".repeat(35_000),
      '<a href="tel:02081234567">020 8123 4567</a>',
      '<a href="mailto:info@example.com">info@example.com</a>',
    ].join("");
    const recovery = client(
      (async (input) =>
        String(input) === "https://example.com/"
          ? html(lateContact)
          : html("missing", 404)) as typeof fetch,
      30_000,
    );

    const result = await recovery.recover(
      "https://example.com/",
      "Example Estate Agents",
      "estate_letting_agents",
    );

    assert.equal(result.truncatedPageCount, 0);
    assert.ok(result.facts.some((fact) =>
      fact.factName === "public_email" &&
      fact.factValue === "info@example.com"));
    assert.ok(result.facts.some((fact) =>
      fact.factName === "public_phone" &&
      fact.normalizedContactValue === "02081234567"));
  },
);

test(
  "keeps the expanded contact recovery read capped at one MiB",
  async () => {
    const beyondCap = [
      "x".repeat(1_050_000),
      '<a href="mailto:info@example.com">info@example.com</a>',
    ].join("");
    const recovery = client(
      (async (input) =>
        String(input) === "https://example.com/"
          ? html(beyondCap)
          : html("missing", 404)) as typeof fetch,
      600_000,
    );

    const result = await recovery.recover(
      "https://example.com/",
      "Example Estate Agents",
      "estate_letting_agents",
    );

    assert.equal(result.truncatedPageCount, 1);
    assert.equal(
      result.facts.some((fact) =>
        fact.factName === "public_email" &&
        fact.factValue === "info@example.com"),
      false,
    );
  },
);
