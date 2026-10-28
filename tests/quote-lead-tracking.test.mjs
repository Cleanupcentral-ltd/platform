import test from "node:test";
import assert from "node:assert/strict";
import { trackConfirmedQuoteLead } from "../src/app/quoteLeadTracking.js";

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
    "generate_lead",
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
  const environment = { dataLayer: [] };
  assert.equal(trackConfirmedQuoteLead(eventInput, environment), true);
  assert.deepEqual(environment.dataLayer, [{
    event: "generate_lead",
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
