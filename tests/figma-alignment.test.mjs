import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const APPROVED_PAGE_HASHES = Object.freeze({
  "src/app/Home.tsx":
    "9c38dca3cfeccadfeeb153f40fe911f5e6d6e14440fe10978210bfd494e2aa65",

  "src/app/About.tsx":
    "5e26eca627e03f37bbf25e7a49c2f6fb631cd9bf3a1c545214e4ac7a74d36c45",

  "src/app/CleaningServices.tsx":
    "fb8975c9db41f457b6f161a6e31977b6b57c27ea05b760456d8ff4ca3e02a6bb",

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
expectText(
  updatedHome,
  "Rated 5.0 out of 5 from all Google reviews, as checked in October 2026.",
  "Homepage must omit the review count while retaining the accurate Google rating",
);
assert.equal(
  updatedHome.includes('home.confidence.professional-standards'),
  false,
  "The redundant homepage confidence strip should remain removed",
);
expectText(updatedHome, "Google review", "Homepage testimonials must remain attributed");

const commercialPage = readSource("src/app/CommercialCleaning.tsx");
expectText(
  commercialPage,
  'Reliable Cleaning for <span className="text-[#B08A3C]">Every Working Environment.</span>',
  "Commercial page must use its distinct hero headline",
);
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
 * Cleaning Services: progressive disclosure must remain compact and usable.
 * Keep Wix CMS loading and original residential/Airbnb quote routes intact.
 */
const cleaningServices = readSource("src/app/CleaningServices.tsx");
for (const key of [
  "cleaning-services.standard-clean",
  "cleaning-services.deep-clean",
  "cleaning-services.end-of-tenancy",
  "cleaning-services.airbnb-turnover",
]) {
  expectText(cleaningServices, key, "Missing residential/turnover service: " + key);
}
expectText(cleaningServices, "60287c_1480d1c651dc41c49e26d5272208fccb", "Services hero must use the selected modern bathroom (option 4)");
expectText(cleaningServices, 'photo: "https://static.wixstatic.com/media/60287c_c95ac754a6334a13a80c3105899bdfad~mv2.jpg"', "End of Tenancy card must use the modern living room photograph");
assert.equal(
  (cleaningServices.match(/60287c_c95ac754a6334a13a80c3105899bdfad/g) ?? []).length,
  1,
  "Living room photo must not be reused elsewhere on the Services page",
);
assert.equal(
  (cleaningServices.match(/60287c_1480d1c651dc41c49e26d5272208fccb/g) ?? []).length,
  1,
  "Bathroom photo must only appear as the Services page hero",
);
expectText(cleaningServices, "src={heroImage}", "The selected residential hero must be displayed even when legacy Wix CMS supplies an older hero");
expectText(cleaningServices, "const [expandedService, setExpandedService]", "Accordion must use single-open state");
expectText(cleaningServices, "aria-expanded={expanded}", "Accordion buttons must expose expanded state");
expectText(cleaningServices, "aria-controls={detailId}", "Accordion buttons must link their panels");
expectText(cleaningServices, "hidden={!expanded}", "Collapsed panels must be hidden accessibly");
expectText(
  cleaningServices,
  "setExpandedService(expanded ? null : serviceKey)",
  "Opening a service must close the previously expanded service",
);
expectText(
  cleaningServices,
  'serviceKey === "cleaning-services.commercial-cleaning"',
  "Commercial service card must link to dedicated service page",
);
expectText(
  cleaningServices,
  '"Explore Commercial Cleaning"',
  "Commercial service CTA must describe the information page",
);
expectText(
  cleaningServices,
  "previousServiceDescriptions[serviceKey]",
  "Existing Wix CMS descriptions must retain editorial override priority",
);
for (const userPhoto of [
  "60287c_22a9f12201094c8f87bc625d3a23e68f",
  "60287c_a8da34d879854581b0d3483dbba336c3",
  "60287c_c95ac754a6334a13a80c3105899bdfad",
  "60287c_3db1b40e4bc74791b3a2efc4dd37d4ee",
]) {
  expectText(cleaningServices, userPhoto, "A selected portfolio photo is missing");
}
// Founder Operations Handbook v3: paid extras are distinct from Standard/Deep.
// End of Tenancy expressly includes appliance, cupboard and internal window interiors.
for (const includedTask of [
  "Kitchen, bathroom, bedroom and living-area cleaning",
  "Dusting and sanitising accessible surfaces",
  "Everything included in a Standard Clean",
  "Moderate limescale and grease removal",
  "Inside oven and detailed appliance cleaning",
  "Inside fridge/freezer, cupboards and drawers",
  "Internal windows, frames and ledges",
  "Bed making and linen changes when clean linen is supplied",
  "Damage and missing-item reporting",
]) {
  expectText(cleaningServices, includedTask, "Handbook service inclusion missing: " + includedTask);
}
for (const exclusion of [
  "Oven interiors, fridge interiors, internal windows and grout cleaning are paid add-ons, not part of a Standard Clean.",
  "Oven interiors, fridge interiors, internal windows and grout cleaning are paid add-ons, not part of a Deep Clean.",
  "Full radiator cleaning is also charged separately.",
  "Laundry and consumable restocking are charged separately.",
  "Linen hire is not currently offered.",
  "A deposit return is not guaranteed.",
]) {
  expectText(cleaningServices, exclusion, "Handbook boundary missing: " + exclusion);
}
expectText(
  cleaningServices,
  'border-l-2 border-l-[#B08A3C] bg-[#F1EDE4]',
  "Expanded inclusions must use the approved warm stone surface rather than a white box",
);
assert.equal(
  cleaningServices.includes('bg-white px-5 py-6 sm:px-7'),
  false,
  "Expanded inclusions must not regress to the white background",
);
expectText(
  cleaningServices,
  "{details.noteLabel}: ",
  "Each expanded service should clearly label paid add-ons or exclusions",
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