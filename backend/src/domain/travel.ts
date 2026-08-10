import {
  travelFeeForDistance,
} from "./pricing.js";

export const TRAVEL_ORIGIN_POSTCODES = [
  "BR1 5HP",
  "RM10 8BE",
] as const;

export const METERS_PER_MILE =
  1_609.344;

export type TravelManualReviewReason =
  | "TRAVEL_AUTOMATION_DISABLED"
  | "TRAVEL_PROVIDER_NOT_CONFIGURED"
  | "TRAVEL_PROVIDER_UNAVAILABLE"
  | "TRAVEL_ROUTE_UNAVAILABLE"
  | "OUTSIDE_AUTOMATIC_SERVICE_AREA";

export interface TravelRouteEvidence {
  readonly originPostcode: string;
  readonly condition: string;
  readonly providerStatusCode:
    number | null;
  readonly distanceMeters:
    number | null;
  readonly durationSeconds:
    number | null;
}

export interface TravelCalculationEvidence {
  readonly provider: "google-routes";
  readonly destinationPostcode:
    string;
  readonly calculatedAt: string;
  readonly routes:
    readonly TravelRouteEvidence[];
}

export interface TravelCalculation {
  readonly status:
    | "calculated"
    | "manual_review";
  readonly fee: number | null;
  readonly distanceMiles:
    number | null;
  readonly originPostcode:
    string | null;
  readonly pendingReview: boolean;
  readonly manualReviewReason:
    TravelManualReviewReason | null;
  readonly evidence:
    TravelCalculationEvidence | null;
}

export function metersToMiles(
  distanceMeters: number,
): number {
  if (
    !Number.isFinite(distanceMeters) ||
    distanceMeters < 0
  ) {
    throw new RangeError(
      "Distance metres must be a non-negative number.",
    );
  }

  return (
    distanceMeters /
    METERS_PER_MILE
  );
}

function originPriority(
  originPostcode: string,
): number {
  const priority =
    TRAVEL_ORIGIN_POSTCODES
      .indexOf(
        originPostcode as
          typeof TRAVEL_ORIGIN_POSTCODES[number],
      );

  return priority === -1
    ? Number.MAX_SAFE_INTEGER
    : priority;
}

export function selectFastestRoute(
  routes:
    readonly TravelRouteEvidence[],
): TravelRouteEvidence | null {
  const usable = routes.filter(
    (route) =>
      route.condition ===
        "ROUTE_EXISTS" &&
      (
        route.providerStatusCode ===
          null ||
        route.providerStatusCode === 0
      ) &&
      route.distanceMeters !== null &&
      Number.isFinite(
        route.distanceMeters,
      ) &&
      route.distanceMeters >= 0 &&
      route.durationSeconds !== null &&
      Number.isFinite(
        route.durationSeconds,
      ) &&
      route.durationSeconds >= 0,
  );

  if (usable.length === 0) {
    return null;
  }

  return usable.reduce(
    (fastest, route) => {
      const routeDuration =
        route.durationSeconds as number;

      const fastestDuration =
        fastest
          .durationSeconds as number;

      if (
        routeDuration <
        fastestDuration
      ) {
        return route;
      }

      if (
        routeDuration >
        fastestDuration
      ) {
        return fastest;
      }

      const routeDistance =
        route.distanceMeters as number;

      const fastestDistance =
        fastest
          .distanceMeters as number;

      if (
        routeDistance <
        fastestDistance
      ) {
        return route;
      }

      if (
        routeDistance ===
          fastestDistance &&
        originPriority(
          route.originPostcode,
        ) <
          originPriority(
            fastest.originPostcode,
          )
      ) {
        return route;
      }

      return fastest;
    },
  );
}

export function travelCalculationForRoutes(
  evidence:
    TravelCalculationEvidence,
): TravelCalculation {
  const route =
    selectFastestRoute(
      evidence.routes,
    );

  if (
    route === null ||
    route.distanceMeters === null
  ) {
    return {
      status: "manual_review",
      fee: null,
      distanceMiles: null,
      originPostcode: null,
      pendingReview: true,
      manualReviewReason:
        "TRAVEL_ROUTE_UNAVAILABLE",
      evidence,
    };
  }

  const distanceMiles =
    metersToMiles(
      route.distanceMeters,
    );

  const feeDecision =
    travelFeeForDistance(
      distanceMiles,
    );

  if (
    feeDecision.manualReview
  ) {
    return {
      status: "manual_review",
      fee: null,
      distanceMiles,
      originPostcode:
        route.originPostcode,
      pendingReview: true,
      manualReviewReason:
        "OUTSIDE_AUTOMATIC_SERVICE_AREA",
      evidence,
    };
  }

  return {
    status: "calculated",
    fee: feeDecision.fee,
    distanceMiles,
    originPostcode:
      route.originPostcode,
    pendingReview: false,
    manualReviewReason: null,
    evidence,
  };
}
