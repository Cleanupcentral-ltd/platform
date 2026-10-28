import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const quote = readFileSync("src/app/Quote.tsx", "utf8");
const route = readFileSync("src/app/routes.ts", "utf8");
const confirmation = readFileSync("src/app/QuoteThankYou.tsx", "utf8");

test("uses the existing hash router to present a dedicated thank-you URL", () => {
  assert.match(
    route,
    /\{ path: "\/quote\/thank-you", Component: QuoteThankYouPage \}/,
  );
  assert.match(quote, /navigate\("\/quote\/thank-you", \{/);
  assert.match(quote, /state:\s*\{\s*confirmed: true,\s*quoteNumber: response\.confirmation\.quoteNumber/);
});

test("successful navigation occurs only after backend acceptance and required attachment uploads", () => {
  const submitted = quote.indexOf("const response = await submitQuoteRequest({");
  const uploaded = quote.indexOf("await uploadQuoteAttachments({", submitted);
  const tracked = quote.indexOf("trackConfirmedQuoteLead({", submitted);
  const navigated = quote.indexOf('navigate("/quote/thank-you", {', submitted);
  const failed = quote.indexOf("} catch (error) {", submitted);
  assert.ok(submitted > -1 && uploaded > submitted);
  assert.ok(tracked > uploaded);
  assert.ok(navigated > tracked);
  assert.ok(failed > navigated);
});

test("direct navigation without confirmation state redirects to the quote form", () => {
  assert.match(
    confirmation,
    /if \(state\?\.confirmed !== true \|\| !quoteNumber\)/,
  );
  assert.match(
    confirmation,
    /return <Navigate to="\/quote" replace \/>/,
  );
  assert.ok(!confirmation.includes("trackConfirmedQuoteLead"));
  assert.ok(!confirmation.includes("generate_lead"));
});

test("thank-you route never exposes private customer data or quote reference in the URL", () => {
  assert.ok(!quote.includes('navigate(`/quote/thank-you?'));
  assert.ok(!quote.includes("email: data.email"));
  assert.match(
    confirmation,
    /This is confirmation of your enquiry, not a confirmed booking/,
  );
});
