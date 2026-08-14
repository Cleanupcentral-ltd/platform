import { z } from "zod";

import {
  LeadProviderError,
  type Coordinates,
  type LeadProviderResult,
  type LeadSearchProvider,
  type LeadSearchProviderInput,
  type LeadSector,
} from "../../ports/lead-search.js";

type FetchFunction = typeof fetch;

const METERS_PER_MILE = 1_609.344;
const EARTH_RADIUS_METERS =
  6_371_000;

export const GOOGLE_PLACES_RESULT_LIMIT =
  20;

export const GOOGLE_PLACES_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.postalAddress",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.googleMapsUri",
  "places.businessStatus",
  "places.types",
  "places.location",
].join(",");

export const SECTOR_SEARCH_TERMS:
  Readonly<Record<LeadSector, string>> = {
    short_let_serviced_accommodation:
      "serviced accommodation and short stay apartments",
    offices_coworking:
      "offices and coworking spaces",
    community_halls_event_venues:
      "community halls and event venues",
    estate_letting_agents:
      "estate agents and letting agents",
    university_accommodation:
      "university accommodation and halls of residence",
    other_commercial_spaces:
      "commercial spaces",
  };

const placeSchema = z.object({
  id: z.string().min(1),
  displayName: z.object({
    text: z.string().min(1),
  }),
  formattedAddress:
    z.string().min(1).optional(),
  postalAddress: z
    .object({
      postalCode:
        z.string().min(1).optional(),
    })
    .optional(),
  websiteUri:
    z.string().url().optional(),
  nationalPhoneNumber:
    z.string().min(1).optional(),
  googleMapsUri:
    z.string().url().optional(),
  businessStatus:
    z.string().min(1).optional(),
  types:
    z.array(z.string()).default([]),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
});

const responseSchema = z.object({
  places:
    z.array(placeSchema).default([]),
});

export interface GooglePlacesLeadSearchOptions {
  readonly apiKey: string;
  readonly apiBaseUrl: string;
  readonly timeoutMs: number;
  readonly fetchFunction?: FetchFunction;
}

function radians(value: number): number {
  return value * Math.PI / 180;
}

export function distanceMeters(
  start: Coordinates,
  end: Coordinates,
): number {
  const latitudeDelta =
    radians(
      end.latitude -
        start.latitude,
    );
  const longitudeDelta =
    radians(
      end.longitude -
        start.longitude,
    );
  const startLatitude =
    radians(start.latitude);
  const endLatitude =
    radians(end.latitude);

  const haversine =
    Math.sin(
      latitudeDelta / 2,
    ) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(
        longitudeDelta / 2,
      ) ** 2;

  return 2 *
    EARTH_RADIUS_METERS *
    Math.asin(
      Math.min(
        1,
        Math.sqrt(haversine),
      ),
    );
}

function mapsUrl(placeId: string): string {
  const url = new URL(
    "https://www.google.com/maps/search/",
  );
  url.searchParams.set(
    "api",
    "1",
  );
  url.searchParams.set(
    "query",
    "Google Place",
  );
  url.searchParams.set(
    "query_place_id",
    placeId,
  );
  return url.toString();
}

export class GooglePlacesLeadSearchProvider
implements LeadSearchProvider {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly fetchFunction: FetchFunction;

  constructor(
    options:
      GooglePlacesLeadSearchOptions,
  ) {
    this.apiKey = options.apiKey;
    this.endpoint =
      `${options.apiBaseUrl.replace(/\/$/, "")}/places:searchText`;
    this.timeoutMs =
      options.timeoutMs;
    this.fetchFunction =
      options.fetchFunction ?? fetch;
  }

  async search(
    input: LeadSearchProviderInput,
  ): Promise<
    readonly LeadProviderResult[]
  > {
    const boroughMode =
      input.mode === "borough";
    const radiusMeters =
      boroughMode
        ? null
        : input.radiusMiles *
          METERS_PER_MILE;
    const controller =
      new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.timeoutMs,
    );

    const textQuery = boroughMode
      ? `${SECTOR_SEARCH_TERMS[input.sector]} in ${input.borough}, London`
      : SECTOR_SEARCH_TERMS[
          input.sector
        ];
    const body = boroughMode
      ? {
          textQuery,
          pageSize:
            GOOGLE_PLACES_RESULT_LIMIT,
          languageCode: "en",
          regionCode: "gb",
        }
      : {
          textQuery,
          pageSize:
            GOOGLE_PLACES_RESULT_LIMIT,
          languageCode: "en",
          regionCode: "gb",
          locationBias: {
            circle: {
              center:
                input.center,
              radius:
                radiusMeters!,
            },
          },
        };

    let response: Response;
    try {
      response =
        await this.fetchFunction(
          this.endpoint,
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json",
              "x-goog-api-key":
                this.apiKey,
              "x-goog-fieldmask":
                GOOGLE_PLACES_FIELD_MASK,
            },
            body: JSON.stringify(body),
            signal:
              controller.signal,
          },
        );
    } catch {
      throw new LeadProviderError(
        "search_provider_unavailable",
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new LeadProviderError(
        "search_provider_unavailable",
      );
    }

    let parsed:
      ReturnType<
        typeof responseSchema.safeParse
      >;
    try {
      parsed =
        responseSchema.safeParse(
          await response.json(),
        );
    } catch {
      throw new LeadProviderError(
        "search_provider_unavailable",
      );
    }

    if (!parsed.success) {
      throw new LeadProviderError(
        "search_provider_unavailable",
      );
    }

    return parsed.data.places
      .map((place) => {
        const distance =
          boroughMode
            ? null
            : distanceMeters(
                input.center,
                place.location,
              );

        return {
          result: {
            providerPlaceId:
              place.id,
            businessName:
              place.displayName.text,
            formattedAddress:
              place.formattedAddress ??
              null,
            primaryPostcode:
              place.postalAddress
                ?.postalCode ?? null,
            websiteUrl:
              place.websiteUri ?? null,
            phone:
              place.nationalPhoneNumber ??
              null,
            sourceUrl:
              place.googleMapsUri ??
              mapsUrl(place.id),
            businessStatus:
              place.businessStatus ??
              null,
            types: place.types,
            coordinates:
              place.location,
            distanceMiles:
              distance === null
                ? null
                : distance /
                  METERS_PER_MILE,
          },
          distance,
        };
      })
      .filter(
        ({ distance }) =>
          distance === null ||
          distance <= radiusMeters!,
      )
      .sort(
        (left, right) => {
          if (
            left.distance !== null &&
            right.distance !== null &&
            left.distance !==
              right.distance
          ) {
            return (
              left.distance -
              right.distance
            );
          }
          return left.result
            .businessName
            .localeCompare(
              right.result
                .businessName,
            );
        },
      )
      .map(({ result }) => result);
  }
}

