import assert from "node:assert/strict";
import test from "node:test";

import {
  FirstPartyResearchClient,
  FirstPartyResearchError,
} from "../src/adapters/web/first-party-research.js";

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}

test(
  "upgrades HTTP, retries a temporary failure, inspects approved pages and keeps bounded large-page evidence",
  async () => {
    const requested: string[] = [];
    let homeAttempts = 0;
    const client = new FirstPartyResearchClient({
      timeoutMs: 1_000,
      maximumBytes: 500,
      maximumPages: 6,
      requestRetries: 1,
      async resolveHost() {
        return ["8.8.8.8"];
      },
      fetchFunction: (async (input) => {
        const url = String(input);
        requested.push(url);
        if (url === "https://example.com/") {
          homeAttempts += 1;
          if (homeAttempts === 1) return html("temporary", 503);
          return html([
            "<h1>Example Offices</h1>",
            "<p>Serviced office space for local businesses.</p>",
            '<a href="/about">About</a>',
            '<a href="/contact">Contact</a>',
            '<a href="/privacy">Privacy</a>',
          ].join(""));
        }
        if (url.endsWith("/about")) {
          return html("<h1>About Example Offices</h1><p>Our locations support regular operations.</p>");
        }
        if (url.endsWith("/contact")) {
          return html("<p>Contact hello@example.com</p><form><input name='message'></form>");
        }
        return html(
          "<p>Example Offices Limited. Company number: 01234567.</p>" +
          "x".repeat(2_000),
        );
      }) as typeof fetch,
    });

    const result = await client.research(
      "http://example.com/",
      "Example Offices Ltd",
      "offices_coworking",
    );

    assert.equal(homeAttempts, 2);
    assert.equal(result.canonicalWebsiteUrl, "https://example.com/");
    assert.equal(result.truncatedPageCount, 1);
    assert.equal(result.companyNumberAssertions[0]?.companyNumber, "01234567");
    assert.equal(
      result.companyNumberAssertions[0]?.sourceUrl,
      "https://example.com/privacy",
    );
    assert.ok(result.facts.some((fact) =>
      fact.factName === "business_name" &&
      fact.sourceExcerpt.includes("Example Offices")));
    assert.ok(result.facts.some((fact) =>
      fact.factName === "approved_sector" &&
      fact.factValue === "offices_coworking"));
    assert.ok(result.facts.some((fact) =>
      fact.factName === "public_email" &&
      fact.factValue === "hello@example.com" &&
      fact.contactType === "email"));
    assert.ok(result.facts.some((fact) =>
      fact.factName === "contact_form_url" &&
      fact.sourceUrl === "https://example.com/contact"));
    assert.ok(requested.includes("https://example.com/about"));
    assert.ok(requested.includes("https://example.com/contact"));
    assert.ok(requested.includes("https://example.com/privacy"));
  },
);

test(
  "ignores personal mailbox names and does not verify a mismatched business identity",
  async () => {
    const client = new FirstPartyResearchClient({
      timeoutMs: 1_000,
      maximumBytes: 20_000,
      async resolveHost() {
        return ["8.8.8.8"];
      },
      fetchFunction: (async () => html(
        "<h1>Different Company</h1><p>john.smith@example.com</p>",
      )) as typeof fetch,
    });

    const result = await client.research(
      "https://example.com/",
      "Expected Business",
      "other_commercial_spaces",
    );

    assert.deepEqual(result.facts, []);
    assert.deepEqual(
      result.reviewReasons,
      ["website_identity_not_confirmed"],
    );
  },
);

test(
  "blocks private destinations before requesting them",
  async () => {
    let requested = false;
    const client = new FirstPartyResearchClient({
      timeoutMs: 1_000,
      maximumBytes: 20_000,
      async resolveHost() {
        return ["10.0.0.2"];
      },
      fetchFunction: (async () => {
        requested = true;
        return html("not reached");
      }) as typeof fetch,
    });

    await assert.rejects(
      client.research(
        "http://internal.example/",
        "Internal Example",
        "offices_coworking",
      ),
      (error: unknown) =>
        error instanceof FirstPartyResearchError &&
        error.failure === "unsafe_url",
    );
    assert.equal(requested, false);
  },
);

test(
  "does not automatically verify named or personal-provider email addresses",
  async () => {
    const client = new FirstPartyResearchClient({
      timeoutMs: 1_000,
      maximumBytes: 20_000,
      async resolveHost() {
        return ["8.8.8.8"];
      },
      fetchFunction: (async () => html(
        "<h1>Example Offices</h1><p>Office space. Contact john.smith@example.com or hello@gmail.com.</p>",
      )) as typeof fetch,
    });

    const result = await client.research(
      "https://example.com/",
      "Example Offices",
      "offices_coworking",
    );

    assert.equal(
      result.facts.some((fact) =>
        fact.factName === "public_email"),
      false,
    );
    assert.ok(result.reviewReasons.includes(
      "no_generic_business_contact_found",
    ));
  },
);
