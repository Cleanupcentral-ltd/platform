import assert from "node:assert/strict";
import test from "node:test";

import {
  FirstPartyContactRecoveryClient,
} from "../src/adapters/web/contact-recovery.js";

import {
  isGenericBusinessEmail,
} from "../src/domain/business-email.js";

import {
  extractPublicPhones,
} from "../src/domain/public-phone.js";

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
): FirstPartyContactRecoveryClient {
  return new FirstPartyContactRecoveryClient({
    timeoutMs: 1_000,
    maximumBytes: 60_000,
    maximumPages: 8,
    requestRetries: 0,
    async resolveHost() {
      return ["8.8.8.8"];
    },
    fetchFunction,
  });
}

test(
  "accepts public role mailboxes observed on venue and accommodation sites",
  () => {
    assert.equal(
      isGenericBusinessEmail(
        "spa@mytimeactive.co.uk",
      ),
      true,
    );
    assert.equal(
      isGenericBusinessEmail(
        "accommodation@gold.ac.uk",
      ),
      true,
    );
    assert.equal(
      isGenericBusinessEmail(
        "lettings@goatleyhirst.com",
      ),
      true,
    );
  },
);

test(
  "recovers a venue role email directly from first-party visible text",
  async () => {
    const recovery = client(
      (async () => html([
        "<h1>Beckenham Public Hall</h1>",
        "<p>We are open for bookings. Email us at spa@mytimeactive.co.uk.</p>",
      ].join(""))) as typeof fetch,
    );

    const result = await recovery.recover(
      "https://mytimeactive.co.uk/locations/beckenham-public-hall",
      "Beckenham Public Hall",
      "community_halls_event_venues",
    );

    assert.ok(result.facts.some((fact) =>
      fact.factName === "public_email" &&
      fact.factValue ===
        "spa@mytimeactive.co.uk"));
  },
);

test(
  "recovers contact details from bounded first-party structured JSON without executing JavaScript",
  async () => {
    const recovery = client(
      (async () => html([
        "<h1>Goatley Hirst</h1>",
        '<script type="application/ld+json">',
        JSON.stringify({
          "@type": "RealEstateAgent",
          name: "Goatley Hirst",
          email: "sales@example.com",
          telephone: "020 8464 8705",
          address: {
            addressLocality: "Bromley",
          },
        }),
        "</script>",
      ].join(""))) as typeof fetch,
    );

    const result = await recovery.recover(
      "https://example.com/",
      "Goatley Hirst Estate Agents in Bromley",
      "estate_letting_agents",
    );

    assert.ok(result.facts.some((fact) =>
      fact.factName === "public_email" &&
      fact.factValue === "sales@example.com"));
    assert.ok(result.facts.some((fact) =>
      fact.factName === "public_phone" &&
      fact.normalizedContactValue ===
        "02084648705"));
  },
);

test(
  "decodes Joomla-style first-party anti-spam email assembly without executing the script",
  async () => {
    const recovery = client(
      (async () => html([
        "<h1>Example College</h1>",
        "<script>",
        "var addy123 = 'info' + '&#64;' + 'example' + '&#46;' + 'ac' + '&#46;' + 'uk';",
        "document.write(addy123);",
        "</script>",
      ].join(""))) as typeof fetch,
    );

    const result = await recovery.recover(
      "https://example.ac.uk/",
      "Example College",
      "university_accommodation",
    );

    assert.ok(result.facts.some((fact) =>
      fact.factName === "public_email" &&
      fact.factValue === "info@example.ac.uk"));
  },
);

test(
  "branch-aware recovery can inspect a multi-location directory while normal extraction remains conservative",
  async () => {
    const directory = [
      "<h1>Find your nearest branch</h1>",
      "<p>Barking branch, 74 Station Parade, Barking. Sales 02031513975.</p>",
      "<p>Atherstone branch, 6A Church Street, Atherstone. Sales 01827425138.</p>",
    ].join("");
    const text = directory.replace(/<[^>]+>/g, " ");

    assert.equal(
      extractPublicPhones(directory, text).length,
      0,
    );
    assert.ok(
      extractPublicPhones(
        directory,
        text,
        { allowConflictingLocations: true },
      ).length >= 2,
    );

    const recovery = client(
      (async (input) => {
        const url = String(input);
        if (url === "https://example.com/") {
          return html([
            "<h1>Bairstow Eves Barking</h1>",
            '<a href="/location-directory/">Our branches</a>',
          ].join(""));
        }
        if (url === "https://example.com/location-directory/") {
          return html(directory);
        }
        return html("missing", 404);
      }) as typeof fetch,
    );

    const result = await recovery.recover(
      "https://example.com/",
      "Bairstow Eves Sales and Letting Agents Barking",
      "estate_letting_agents",
    );

    assert.ok(result.facts.some((fact) =>
      fact.factName === "public_phone" &&
      fact.normalizedContactValue ===
        "02031513975"));
    assert.equal(
      result.facts.some((fact) =>
        fact.factName === "public_phone" &&
        fact.normalizedContactValue ===
          "01827425138"),
      false,
    );
  },
);

test(
  "does not spend contact-recovery budget on property tag pages",
  async () => {
    const requested: string[] = [];
    const recovery = client(
      (async (input) => {
        const url = String(input);
        requested.push(url);
        if (url === "https://example.com/") {
          return html([
            "<h1>Example Estate Agents Bromley</h1>",
            '<a href="/bromley/sales/tag-bungalow">Bungalows</a>',
            '<a href="/bromley-estate-agents">Bromley branch</a>',
          ].join(""));
        }
        if (url === "https://example.com/bromley-estate-agents") {
          return html(
            "<p>Bromley branch: 020 8464 8705</p>",
          );
        }
        return html("missing", 404);
      }) as typeof fetch,
    );

    await recovery.recover(
      "https://example.com/",
      "Example Estate Agents Bromley",
      "estate_letting_agents",
    );

    assert.equal(
      requested.includes(
        "https://example.com/bromley/sales/tag-bungalow",
      ),
      false,
    );
  },
);
