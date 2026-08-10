import assert from "node:assert/strict";
import test from "node:test";

import {
  METERS_PER_MILE,
  selectFastestRoute,
  travelCalculationForRoutes,
  type TravelCalculationEvidence,
  type TravelRouteEvidence,
} from "../src/domain/travel.js";

function route(
  originPostcode: string,
  distanceMeters: number | null,
  durationSeconds:
    number | null = 600,
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
        : durationSeconds,
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
  "selects the faster valid route even when it has more miles",
  () => {
    const selected =
      selectFastestRoute([
        route(
          "BR1 5HP",
          12 * METERS_PER_MILE,
          3_000,
        ),
        route(
          "RM10 8BE",
          15.41 * METERS_PER_MILE,
          2_700,
        ),
      ]);

    assert.equal(
      selected?.originPostcode,
      "RM10 8BE",
    );
  },
);

test(
  "charges for the mileage of the selected fastest route",
  () => {
    const result =
      travelCalculationForRoutes(
        evidence([
          route(
            "BR1 5HP",
            9 * METERS_PER_MILE,
            3_000,
          ),
          route(
            "RM10 8BE",
            15.41 * METERS_PER_MILE,
            2_700,
          ),
        ]),
      );

    assert.equal(
      result.originPostcode,
      "RM10 8BE",
    );

    assert.equal(result.fee, 10);
    assert.equal(
      result.distanceMiles,
      15.41,
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
  "uses shorter distance as an equal-duration tie-break",
  () => {
    const selected =
      selectFastestRoute([
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
  "uses approved origin order as a stable equal-route tie-break",
  () => {
    const selected =
      selectFastestRoute([
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
  "requires duration evidence before selecting a route",
  () => {
    const result =
      travelCalculationForRoutes(
        evidence([
          route(
            "BR1 5HP",
            10_000,
            null,
          ),
        ]),
      );

    assert.equal(
      result.manualReviewReason,
      "TRAVEL_ROUTE_UNAVAILABLE",
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
