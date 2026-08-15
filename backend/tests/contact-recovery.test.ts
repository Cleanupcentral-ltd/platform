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

function cfEncode(value: string): string {
  const key = 0x5a;
  return [
    key.toString(16).padStart(2, "0"),
    ...[...value].map((character) =>
      (character.charCodeAt(0) ^ key)
        .toString(16)
        .padStart(2, "0")),
  ].join("");
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
  "discovers a target branch page and chooses its phone instead of another office number",
  async () => {
    const requested: string[] = [];
    const recovery = client(
      (async (input) => {
        const url = String(input);
        requested.push(url);

        if (url === "https://example.com/") {
          return html([
            "<h1>Acorn Commercial & Development Division Bromley</h1>",
            '<a href="/branches">Our branches</a>',
          ].join(""));
        }
        if (url === "https://example.com/branches") {
          return html([
            '<a href="/branches/kent">Kent office</a>',
            '<a href="/branches/bromley">Bromley office</a>',
          ].join(""));
        }
        if (url === "https://example.com/branches/bromley") {
          return html([
            "<h1>Bromley office</h1>",
            "<p>Bromley commercial enquiries</p>",
            '<a href="tel:02083155454">020 8315 5454</a>',
            "<p>commercial [at] example [dot] com</p>",
          ].join(""));
        }
        if (url === "https://example.com/branches/kent") {
          return html([
            "<h1>Kent office</h1>",
            '<a href="tel:01634969678">01634 969 678</a>',
          ].join(""));
        }
        return html("missing", 404);
      }) as typeof fetch,
    );

    const result = await recovery.recover(
      "https://example.com/",
      "Acorn Commercial & Development Division Bromley",
      "other_commercial_spaces",
    );

    assert.ok(
      requested.includes(
        "https://example.com/branches/bromley",
      ),
    );
    assert.ok(result.facts.some((fact) =>
      fact.factName === "public_phone" &&
      fact.normalizedContactValue ===
        "02083155454"));
    assert.equal(
      result.facts.some((fact) =>
        fact.factName === "public_phone" &&
        fact.normalizedContactValue ===
          "01634969678"),
      false,
    );
    assert.ok(result.facts.some((fact) =>
      fact.factName === "public_email" &&
      fact.factValue ===
        "commercial@example.com"));
  },
);

test(
  "extracts generic mailto and Cloudflare-style anti-spam email values without executing scripts",
  async () => {
    const encoded = cfEncode(
      "info@example.com",
    );
    const recovery = client(
      (async () => html([
        "<h1>Example Student Accommodation</h1>",
        '<a href="mailto:bookings%40example.com?subject=Enquiry">Email bookings</a>',
        `<span class="__cf_email__" data-cfemail="${encoded}">email protected</span>`,
      ].join(""))) as typeof fetch,
    );

    const result = await recovery.recover(
      "https://example.com/",
      "Example Student Accommodation",
      "university_accommodation",
    );

    const emails = result.facts
      .filter((fact) =>
        fact.factName === "public_email")
      .map((fact) => fact.factValue);

    assert.ok(emails.includes(
      "bookings@example.com",
    ));
    assert.ok(emails.includes(
      "info@example.com",
    ));
  },
);

test(
  "does not choose an arbitrary phone when several locations are listed and none matches the prospect",
  async () => {
    const recovery = client(
      (async () => html([
        "<h1>Example Group Bromley</h1>",
        "<p>Kent office 01634 969 678</p>",
        "<p>Croydon office 020 8123 4567</p>",
      ].join(""))) as typeof fetch,
    );

    const result = await recovery.recover(
      "https://example.com/",
      "Example Group Bromley",
      "other_commercial_spaces",
    );

    assert.equal(
      result.facts.some((fact) =>
        fact.factName === "public_phone"),
      false,
    );
  },
);

test(
  "discovers hire and enquiry pages as contact recovery targets",
  async () => {
    const requested: string[] = [];
    const recovery = client(
      (async (input) => {
        const url = String(input);
        requested.push(url);
        if (url === "https://example.com/") {
          return html([
            "<h1>Example Public Hall</h1>",
            '<a href="/function-room-hire">Function room hire</a>',
          ].join(""));
        }
        if (url === "https://example.com/function-room-hire") {
          return html([
            "<p>Venue hire enquiries</p>",
            '<a href="tel:02086503483">020 8650 3483</a>',
            "<form>",
            '<input name="name">',
            '<input type="email" name="email">',
            '<textarea name="message"></textarea>',
            "</form>",
          ].join(""));
        }
        return html("missing", 404);
      }) as typeof fetch,
    );

    const result = await recovery.recover(
      "https://example.com/",
      "Example Public Hall",
      "community_halls_event_venues",
    );

    assert.ok(requested.includes(
      "https://example.com/function-room-hire",
    ));
    assert.ok(result.facts.some((fact) =>
      fact.factName === "public_phone"));
    assert.ok(result.facts.some((fact) =>
      fact.factName === "contact_form_url" &&
      fact.sourceUrl ===
        "https://example.com/function-room-hire"));
  },
);
