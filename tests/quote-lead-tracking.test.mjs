import test from "node:test";
import assert from "node:assert/strict";
import { trackConfirmedQuoteLead } from "../src/app/quoteLeadTracking.js";
import { CONSENT_KEY } from "../src/app/analyticsConsent.js";

const accepted = {
  success: true,
  replayed: false,
  confirmation: {
    quoteNumber: "CUC-Q-000123",
  },
};

const eventInput = {
  response: accepted,
  submissionId: "11111111-1111-4111-8111-111111111111",
  category: "Commercial Cleaning",
};

function environmentWithTag() {
  const events = [];
  const memory = new Map();
  return {
    events,
    gtag: (...args) => events.push(args),
    localStorage: { getItem: (key) => key === CONSENT_KEY ? "accepted" : null },
    sessionStorage: {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => memory.set(key, value),
    },
  };
}

test("tracks one actual confirmed quote through an existing Google tag", () => {
  const environment = environmentWithTag();
  assert.equal(trackConfirmedQuoteLead(eventInput, environment), true);
  assert.deepEqual(environment.events, [[
    "event",
    "cuc_quote_submitted",
    {
      lead_type: "quote_request",
      service_category: "Commercial Cleaning",
    },
  ]]);
  assert.equal(trackConfirmedQuoteLead(eventInput, environment), false);
  assert.equal(environment.events.length, 1);
});

test("never tracks a failed, incomplete or replayed submission", () => {
  const failures = [
    { ...accepted, success: false },
    { ...accepted, replayed: true },
    { ...accepted, confirmation: {} },
    null,
  ];
  const environment = environmentWithTag();
  for (const response of failures) {
    assert.equal(
      trackConfirmedQuoteLead({ ...eventInput, response }, environment),
      false,
    );
  }
  assert.equal(environment.events.length, 0);
});

test("falls back to dataLayer if Google Tag Manager is present without gtag", () => {
  const environment = { dataLayer: [], localStorage: { getItem: () => "accepted" } };
  assert.equal(trackConfirmedQuoteLead(eventInput, environment), true);
  assert.deepEqual(environment.dataLayer, [{
    event: "cuc_quote_submitted",
    lead_type: "quote_request",
    service_category: "Commercial Cleaning",
  }]);
});

test("missing tracking integration does not count a conversion or throw", () => {
  assert.equal(trackConfirmedQuoteLead(eventInput, {}), false);
});

test("analytics errors never interrupt an accepted quote", () => {
  const environment = {
    gtag() { throw new Error("Tag blocked"); },
    localStorage: { getItem: () => "accepted" },
  };
  assert.equal(trackConfirmedQuoteLead(eventInput, environment), false);
});

test("separate accepted submission identifiers can each be counted", () => {
  const environment = environmentWithTag();
  assert.equal(trackConfirmedQuoteLead(eventInput, environment), true);
  assert.equal(trackConfirmedQuoteLead({
    ...eventInput,
    submissionId: "22222222-2222-4222-8222-222222222222",
  }, environment), true);
  assert.equal(environment.events.length, 2);
});


test("never tracks without analytics consent", () => {
  const environment = environmentWithTag();
  environment.localStorage = { getItem: () => "rejected" };
  assert.equal(trackConfirmedQuoteLead(eventInput, environment), false);
  assert.equal(environment.events.length, 0);
});
