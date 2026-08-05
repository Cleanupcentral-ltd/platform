import {
  TRAVEL_ORIGIN_POSTCODES,
  travelCalculationForRoutes,
  type TravelCalculation,
  type TravelManualReviewReason,
} from "../domain/travel.js";

import {
  normalizePostcode,
} from "../domain/normalization.js";

import type {
  TravelRouteMatrixProvider,
} from "../ports/travel.js";

export interface TravelCalculationService {
  calculate(
    destinationPostcode: string,
  ): Promise<TravelCalculation>;
}

export interface TravelCalculationOptions {
  readonly enabled: boolean;
  readonly provider:
    TravelRouteMatrixProvider | null;
  readonly now?: () => Date;
}

function manualReview(
  reason:
    TravelManualReviewReason,
): TravelCalculation {
  return {
    status: "manual_review",
    fee: null,
    distanceMiles: null,
    originPostcode: null,
    pendingReview: true,
    manualReviewReason: reason,
    evidence: null,
  };
}

export function createTravelCalculationService(
  options:
    TravelCalculationOptions,
): TravelCalculationService {
  const now =
    options.now ??
    (() => new Date());

  return {
    async calculate(
      destinationPostcode,
    ): Promise<TravelCalculation> {
      if (!options.enabled) {
        return manualReview(
          "TRAVEL_AUTOMATION_DISABLED",
        );
      }

      if (
        options.provider === null
      ) {
        return manualReview(
          "TRAVEL_PROVIDER_NOT_CONFIGURED",
        );
      }

      const normalizedPostcode =
        normalizePostcode(
          destinationPostcode,
        );

      try {
        const routes =
          await options.provider
            .compute({
              origins:
                TRAVEL_ORIGIN_POSTCODES,

              destinationPostcode:
                normalizedPostcode,
            });

        return travelCalculationForRoutes({
          provider: "google-routes",

          destinationPostcode:
            normalizedPostcode,

          calculatedAt:
            now().toISOString(),

          routes,
        });
      } catch {
        return manualReview(
          "TRAVEL_PROVIDER_UNAVAILABLE",
        );
      }
    },
  };
}
