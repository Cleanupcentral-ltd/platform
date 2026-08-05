import assert from "node:assert/strict";
import test from "node:test";

import {
  METERS_PER_MILE,
  selectShortestRoute,
  travelCalculationForRoutes,
  type TravelCalculationEvidence,
  type TravelRouteEvidence,
} from "../src/domain/travel.js";

function route(
  originPostcode: string,
  distanceMeters: number | null,
): TravelRouteEvidence {
  return {
    originPostcode,
    condition:
      distanceMeters === null
        ? "ROUTE_NOT_FOUND"
        : "ROUTE_EXISTS",
    providerStatusCode:
      distanceMeters === null
        ? 5
        : null,
    distanceMeters,
    durationSeconds:
      distanceMeters === null
        ? null
        : 600,
  };
}

function evidence(
  routes:
    readonly TravelRouteEvidence[],
): TravelCalculationEvidence {
  return {
    provider: "google-routes",
    destinationPostcode:
      "SE12AA",
    calculatedAt:
      "2026-08-05T12:00:00.000Z",
    routes,
  };
}

test(
  "selects the shorter valid route regardless of response order",
  () => {
    const selected =
      selectShortestRoute([
        route("RM10 8BE", 20_000),
        route("BR1 5HP", 10_000),
      ]);

    assert.equal(
      selected?.originPostcode,
      "BR1 5HP",
    );
  },
);

test(
  "keeps travel fee boundaries inclusive without rounding provider distance",
  () => {
    const atTen =
      travelCalculationForRoutes(
        evidence([
          route(
            "BR1 5HP",
            10 * METERS_PER_MILE,
          ),
        ]),
      );

    const overTen =
      travelCalculationForRoutes(
        evidence([
          route(
            "BR1 5HP",
            (
              10 *
              METERS_PER_MILE
            ) + 0.01,
          ),
        ]),
      );

    assert.equal(atTen.fee, 0);
    assert.equal(overTen.fee, 10);
  },
);

test(
  "uses approved origin order as a stable equal-distance tie-break",
  () => {
    const selected =
      selectShortestRoute([
        route("RM10 8BE", 10_000),
        route("BR1 5HP", 10_000),
      ]);

    assert.equal(
      selected?.originPostcode,
      "BR1 5HP",
    );
  },
);

test(
  "uses manual review beyond thirty miles",
  () => {
    const result =
      travelCalculationForRoutes(
        evidence([
          route(
            "RM10 8BE",
            31 * METERS_PER_MILE,
          ),
        ]),
      );

    assert.equal(
      result.status,
      "manual_review",
    );

    assert.equal(
      result.manualReviewReason,
      "OUTSIDE_AUTOMATIC_SERVICE_AREA",
    );

    assert.equal(result.fee, null);
  },
);

test(
  "uses manual review when no valid route exists",
  () => {
    const result =
      travelCalculationForRoutes(
        evidence([
          route("BR1 5HP", null),
          route("RM10 8BE", null),
        ]),
      );

    assert.equal(
      result.manualReviewReason,
      "TRAVEL_ROUTE_UNAVAILABLE",
    );
  },
);
