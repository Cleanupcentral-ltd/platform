import assert from "node:assert/strict";
import test from "node:test";

import {
  createTravelCalculationService,
} from "../src/application/calculate-travel.js";

import type {
  TravelRouteMatrixProvider,
} from "../src/ports/travel.js";

test(
  "calculates from both approved origins and retains evidence",
  async () => {
    let receivedOrigins:
      readonly string[] = [];

    const provider:
      TravelRouteMatrixProvider = {
        async compute(request) {
          receivedOrigins =
            request.origins;

          return [
            {
              originPostcode:
                "BR1 5HP",
              condition:
                "ROUTE_EXISTS",
              providerStatusCode:
                null,
              distanceMeters:
                10_000,
              durationSeconds:
                900,
            },
            {
              originPostcode:
                "RM10 8BE",
              condition:
                "ROUTE_EXISTS",
              providerStatusCode:
                null,
              distanceMeters:
                20_000,
              durationSeconds:
                600,
            },
          ];
        },
      };

    const service =
      createTravelCalculationService({
        enabled: true,
        provider,

        now: () =>
          new Date(
            "2026-08-05T12:00:00.000Z",
          ),
      });

    const result =
      await service.calculate(
        "se1 2aa",
      );

    assert.deepEqual(
      receivedOrigins,
      [
        "BR1 5HP",
        "RM10 8BE",
      ],
    );

    assert.equal(
      result.status,
      "calculated",
    );

    assert.equal(
      result.originPostcode,
      "RM10 8BE",
    );

    assert.equal(
      result.distanceMiles,
      20_000 / 1_609.344,
    );

    assert.equal(
      result.evidence
        ?.destinationPostcode,
      "SE12AA",
    );
  },
);

test(
  "turns provider failures into manual review",
  async () => {
    const service =
      createTravelCalculationService({
        enabled: true,

        provider: {
          async compute() {
            throw new Error(
              "provider details",
            );
          },
        },
      });

    const result =
      await service.calculate(
        "SE1 2AA",
      );

    assert.equal(
      result.manualReviewReason,
      "TRAVEL_PROVIDER_UNAVAILABLE",
    );

    assert.equal(result.fee, null);
    assert.equal(
      result.evidence,
      null,
    );
  },
);

test(
  "keeps the manual fallback when automation is disabled",
  async () => {
    const service =
      createTravelCalculationService({
        enabled: false,
        provider: null,
      });

    const result =
      await service.calculate(
        "SE1 2AA",
      );

    assert.equal(
      result.manualReviewReason,
      "TRAVEL_AUTOMATION_DISABLED",
    );
  },
);
