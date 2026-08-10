import type {
  TravelRouteEvidence,
} from "../domain/travel.js";

export interface TravelRouteMatrixRequest {
  readonly origins:
    readonly string[];
  readonly destinationPostcode:
    string;
}

export interface TravelRouteMatrixProvider {
  compute(
    request:
      TravelRouteMatrixRequest,
  ): Promise<
    readonly TravelRouteEvidence[]
  >;
}
