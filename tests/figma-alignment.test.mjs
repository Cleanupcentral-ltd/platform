import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const APPROVED_PAGE_HASHES = Object.freeze({
  "src/app/Home.tsx":
    "14ed51f712a8ca5421920d66ffc9e6a3e5ce95a6d4abfc5b9f25ef1b61ff8674",

  "src/app/About.tsx":
    "5e26eca627e03f37bbf25e7a49c2f6fb631cd9bf3a1c545214e4ac7a74d36c45",

  "src/app/CleaningServices.tsx":
    "d0017033306d44e8ab4a66ca2e336d620284eb08345284f531e618a5c8f37d25",

  "src/app/FAQs.tsx":
    "18c13605eb0a1d03c5300ac83e07be624f319fb8fea890448223a603e9a7feef",

  "src/app/PlaceholderPage.tsx":
    "97ec745b8908a6a80849a9c04aa50d2f5f5ea5eecece946fab347fc0e96ad9a3",

  "src/app/PropertySupport.tsx":
    "3a564ae3a4f6303c7e53cc710d73051da75699f1625a96f02330e222cc648cb1",
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
 * Proposed content-update baseline for PR #68.
 * These deliberate page changes remain fingerprinted for future drift checks.
 * The older quote journey and CMS protections below remain in place.
 * Founder approval is required before this baseline is merged.
 */
const updatedHome = readSource("src/app/Home.tsx");
for (const service of [
  'heading: "Residential Cleaning"',
  'heading: "Commercial Cleaning"',
  'heading: "Airbnb & Short-Let Cleaning"',
  'heading: "Property Support"',
]) {
  expectText(updatedHome, service, "Homepage must retain all four service categories: " + service);
}
expectText(
  updatedHome,
  "const serviceCards = fallbackServiceCards.map(",
  "New homepage service cards must still allow matching Wix CMS overrides",
);
expectText(updatedHome, "Read Google reviews", "Homepage must link to genuine Google reviews");
expectText(updatedHome, "Google review", "Homepage testimonials must remain attributed");

const commercialPage = readSource("src/app/CommercialCleaning.tsx");
expectText(
  commercialPage,
  'const commercialQuote = "/quote?service=commercial-cleaning";',
  "Commercial page must use the existing custom quote journey",
);
for (const section of [
  "Offices and workplaces",
  "Gyms and fitness studios",
  "Coworking spaces",
  "Communal areas",
  "Commercial cleaning FAQs",
]) {
  expectText(commercialPage, section, "Commercial page missing: " + section);
}
const publicRoutes = readSource("scripts/generate-clean-route-entries.mjs");
expectText(
  publicRoutes,
  '"commercial-cleaning"',
  "New commercial page must be included in the existing route-entry build",
);

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

expectText(
  routes,
  '{ path: "/commercial-cleaning", Component: CommercialCleaningPage }',
  "Commercial page must use the existing hash router",
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