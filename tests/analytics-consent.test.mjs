import test from "node:test";
import assert from "node:assert/strict";
import { CONSENT_KEY, readAnalyticsConsent, saveAnalyticsConsent, startAnalytics, stopAnalytics } from "../src/app/analyticsConsent.js";

function mockEnvironment(initial = null) {
  const store = new Map(initial ? [[CONSENT_KEY, initial]] : []);
  const scripts = [];
  const env = {
    localStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value),
    },
    document: {
      head: { appendChild: (script) => scripts.push(script) },
      querySelector: () => null,
      createElement: () => ({}),
    },
  };
  return { env, scripts };
}

test("analytics is never installed without consent", () => {
  const { env, scripts } = mockEnvironment();
  assert.equal(readAnalyticsConsent(env), null);
  assert.equal(startAnalytics(env), false);
  assert.equal(scripts.length, 0);
  saveAnalyticsConsent("rejected", env);
  assert.equal(startAnalytics(env), false);
  assert.equal(scripts.length, 0);
});

test("accepting consent installs one GA4 script", () => {
  const { env, scripts } = mockEnvironment("accepted");
  assert.equal(startAnalytics(env), true);
  assert.equal(scripts.length, 1);
  assert.match(scripts[0].src, /G-2PKXMJZYTW/);
  assert.equal(typeof env.gtag, "function");
  assert.equal(startAnalytics(env), true);
  assert.equal(scripts.length, 1);
});

test("existing gtag is reused without injecting another script", () => {
  const { env, scripts } = mockEnvironment("accepted");
  const calls = [];
  env.gtag = (...args) => calls.push(args);
  assert.equal(startAnalytics(env), true);
  assert.equal(scripts.length, 0);
  assert.equal(calls[0][0], "consent");
});

test("rejecting after consent sends denied consent update", () => {
  const { env } = mockEnvironment("accepted");
  const calls = [];
  env.gtag = (...args) => calls.push(args);
  stopAnalytics(env);
  assert.equal(calls[0][2].analytics_storage, "denied");
});
