import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const APPROVED_PAGE_HASHES = Object.freeze({
  "src/app/Home.tsx":
    "df634a6a6e411fdcc7c92798931433739aaa13a68d7b1fc33928e62041a152c1",

  "src/app/About.tsx":
    "7d509720d349561df48fd6c3fee5a2aeafd9d20807d2a974dfb1a74da8255094",

  "src/app/CleaningServices.tsx":
    "bae12137027858a96cb2041d3b6a30deb36bdc8efc44c5e3babef76c2d38f59c",

  "src/app/FAQs.tsx":
    "1182c58cd148c8c3d3aa477d90cf701c27ebd0d1361caaa83e2e1d12bc40a5d7",

  "src/app/PlaceholderPage.tsx":
    "97ec745b8908a6a80849a9c04aa50d2f5f5ea5eecece946fab347fc0e96ad9a3",

  "src/app/PropertySupport.tsx":
    "89684063e9e89c8a1ab33efe161a2b8dbaca9aeece735bdfeb9239ffcd08a876",
});

const readSource = (file) => readFileSync(file, "utf8");

const digest = (file) =>
  createHash("sha256")
    .update(readFileSync(file))
    .digest("hex");

const escapeRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function expectText(source, text, message) {
  assert.ok(source.includes(text), message);
}

function expectPattern(source, pattern, message) {
  assert.match(source, pattern, message);
}

/*
 * Preserve the approved CMS-integrated page implementations.
 */
for (const [file, approvedDigest] of Object.entries(
  APPROVED_PAGE_HASHES,
)) {
  assert.equal(
    digest(file),
    approvedDigest,
    `${file} drifted from the approved Wix/Figma-aligned source`,
  );
}

/*
 * Quote journey regression checks.
 */
const quote = readSource("src/app/Quote.tsx");

expectPattern(
  quote,
  /<Stepper\s+stage=\{stageForStep\(step\)\}\s*\/>/,
  "Quote stepper must remain connected to the current journey stage",
);

expectPattern(
  quote,
  /onDrop=\{\s*\(?\s*event\s*\)?\s*=>/,
  "Quote upload area must retain its drop handler",
);

const quoteRouteChecks = [
  [
    /"standard-clean"\s*:\s*\{[\s\S]*?category:\s*"Residential Cleaning"[\s\S]*?serviceType:\s*"Standard Clean"[\s\S]*?step:\s*"cleaningService"/,
    "Standard Clean deep links must open service selection with the service preselected",
  ],
  [
    /"deep-clean"\s*:\s*\{[\s\S]*?category:\s*"Residential Cleaning"[\s\S]*?serviceType:\s*"Deep Clean"[\s\S]*?step:\s*"cleaningService"/,
    "Deep Clean deep links must open service selection with the service preselected",
  ],
  [
    /"end-of-tenancy"\s*:\s*\{[\s\S]*?category:\s*"Residential Cleaning"[\s\S]*?serviceType:\s*"End of Tenancy"[\s\S]*?step:\s*"cleaningService"/,
    "End of Tenancy deep links must open service selection with the service preselected",
  ],
  [
    /"property-support"\s*:\s*\{[\s\S]*?category:\s*"Property Support"[\s\S]*?step:\s*"supportServices"/,
    "Property Support deep links must open the support-service selection screen",
  ],
];

for (const [pattern, message] of quoteRouteChecks) {
  expectPattern(quote, pattern, message);
}

expectPattern(
  quote,
  /function\s+Heading\s*\(\s*\{\s*title\s*,\s*copy\s*\}/,
  "Quote headings must render only the stage title and supporting copy",
);

expectPattern(
  quote,
  /if\s*\(\s*customQuote\s*\)\s*return\s*<CustomQuoteSummary\b/,
  "Custom-price journeys must use the dedicated review screen",
);

expectText(
  quote,
  "<Eyebrow>Custom Quote Required</Eyebrow>",
  "Custom review must retain the approved eyebrow",
);

expectText(
  quote,
  ">CUSTOM QUOTE REQUIRED</h1>",
  "Custom review must retain the approved title",
);

expectPattern(
  quote,
  /<FileText\b(?=[^>]*className="text-\[#B08A3C\]")(?=[^>]*size=\{26\})[^>]*\/>/,
  "Custom review must retain the request-summary icon",
);

for (const message of [
  "End of Tenancy services are priced individually",
  "Commercial Cleaning requires a tailored quote",
  "Your Property Support request will be reviewed",
]) {
  expectText(
    quote,
    message,
    `Missing custom-quote message: ${message}`,
  );
}

/*
 * Navigation regression check.
 */
const routes = readSource("src/app/routes.ts");

expectPattern(
  routes,
  /window\.scrollTo\(\{\s*top:\s*0,\s*left:\s*0,\s*behavior:\s*"auto"\s*\}\)/,
  "Internal navigation must reset the destination page to the top",
);

/*
 * CMS-backed Contact page checks.
 */
const contact = readSource("src/app/Contact.tsx");

for (const key of [
  "contact.phone",
  "contact.email",
  "contact.hours_monday_saturday",
  "contact.hours_sunday",
]) {
  expectPattern(
    contact,
    new RegExp(
      `useSiteSetting\\(\\s*["']${escapeRegExp(
        key,
      )}["']\\s*,?\\s*\\)`,
    ),
    `Contact page must remain connected to ${key}`,
  );
}

expectText(
  contact,
  "Questions, answered simply.",
  "Contact page must retain its FAQ fallback heading",
);

expectText(
  contact,
  "06:00–20:00",
  "Contact page must retain the Monday–Saturday hours fallback",
);

expectText(
  contact,
  "14:00–20:00",
  "Contact page must retain the Sunday hours fallback",
);

console.log(
  "Regression tests passed: approved pages, quote routing/summary/uploads, navigation and CMS-backed contact structure.",
);