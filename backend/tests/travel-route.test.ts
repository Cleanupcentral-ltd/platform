import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";

import type {
  TravelCalculationService,
} from "../src/application/calculate-travel.js";

const calculatedService:
  TravelCalculationService = {
    async calculate() {
      return {
        status: "calculated",
        fee: 10,
        distanceMiles:
          10.12345,
        originPostcode:
          "BR1 5HP",
        pendingReview: false,
        manualReviewReason: null,
        evidence: {
          provider:
            "google-routes",
          destinationPostcode:
            "SE12AA",
          calculatedAt:
            "2026-08-05T12:00:00.000Z",
          routes: [],
        },
      };
    },
  };

test(
  "POST /api/travel/estimate returns only the safe public decision",
  async (context) => {
    const app =
      await buildApp({
        travelCalculationService:
          calculatedService,
      });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "POST",
        url:
          "/api/travel/estimate",
        headers: {
          "content-type":
            "application/json",
        },
        payload: {
          postcode: "SE1 2AA",
        },
      });

    assert.equal(
      response.statusCode,
      200,
    );

    const body =
      response.json();

    assert.deepEqual(
      body.travel,
      {
        status: "calculated",
        fee: 10,
        distanceMiles: 10.12,
        pendingReview: false,
        reason: null,
      },
    );

    assert.equal(
      "originPostcode" in
        body.travel,
      false,
    );

    assert.equal(
      "evidence" in body.travel,
      false,
    );
  },
);

test(
  "POST /api/travel/estimate rejects an invalid postcode",
  async (context) => {
    const app =
      await buildApp({
        travelCalculationService:
          calculatedService,
      });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "POST",
        url:
          "/api/travel/estimate",
        headers: {
          "content-type":
            "application/json",
        },
        payload: {
          postcode: "not valid",
        },
      });

    assert.equal(
      response.statusCode,
      400,
    );
  },
);

test(
  "POST /api/travel/estimate keeps provider failure as a successful manual fallback",
  async (context) => {
    const app =
      await buildApp({
        travelCalculationService: {
          async calculate() {
            return {
              status:
                "manual_review",
              fee: null,
              distanceMiles: null,
              originPostcode: null,
              pendingReview: true,
              manualReviewReason:
                "TRAVEL_PROVIDER_UNAVAILABLE",
              evidence: null,
            };
          },
        },
      });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "POST",
        url:
          "/api/travel/estimate",
        headers: {
          "content-type":
            "application/json",
        },
        payload: {
          postcode: "SE1 2AA",
        },
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.deepEqual(
      response.json().travel,
      {
        status:
          "manual_review",
        fee: null,
        distanceMiles: null,
        pendingReview: true,
        reason:
          "TRAVEL_PROVIDER_UNAVAILABLE",
      },
    );
  },
);
