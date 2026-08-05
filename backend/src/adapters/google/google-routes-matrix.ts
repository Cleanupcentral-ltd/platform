import { z } from "zod";

import type {
  TravelRouteEvidence,
} from "../../domain/travel.js";

import type {
  TravelRouteMatrixProvider,
  TravelRouteMatrixRequest,
} from "../../ports/travel.js";

const FIELD_MASK = [
  "originIndex",
  "destinationIndex",
  "status",
  "condition",
  "distanceMeters",
  "duration",
].join(",");

const routeElementSchema = z.object({
  originIndex: z
    .number()
    .int()
    .nonnegative(),

  destinationIndex: z
    .number()
    .int()
    .nonnegative(),

  status: z
    .object({
      code: z
        .number()
        .int()
        .optional(),
    })
    .optional(),

  condition: z
    .string()
    .min(1),

  distanceMeters: z
    .number()
    .int()
    .nonnegative()
    .optional(),

  duration: z
    .string()
    .regex(
      /^\d+(?:\.\d+)?s$/,
    )
    .optional(),
});

const routeMatrixSchema =
  z.array(routeElementSchema);

export interface GoogleRoutesMatrixOptions {
  readonly apiKey: string;
  readonly apiBaseUrl?: string;
  readonly timeoutMs?: number;
  readonly fetchImpl?:
    typeof fetch;
}

function durationSeconds(
  value: string | undefined,
): number | null {
  if (value === undefined) {
    return null;
  }

  const seconds = Number(
    value.slice(0, -1),
  );

  return Number.isFinite(seconds)
    ? seconds
    : null;
}

export class GoogleRoutesMatrixProvider
implements TravelRouteMatrixProvider {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl:
    typeof fetch;

  constructor(
    options:
      GoogleRoutesMatrixOptions,
  ) {
    this.apiKey =
      options.apiKey.trim();

    if (
      this.apiKey.length === 0
    ) {
      throw new Error(
        "A Google Routes API key is required.",
      );
    }

    const baseUrl =
      (
        options.apiBaseUrl ??
        "https://routes.googleapis.com"
      ).replace(/\/+$/u, "");

    this.endpoint =
      `${baseUrl}/distanceMatrix/v2:computeRouteMatrix`;

    this.timeoutMs =
      options.timeoutMs ?? 5_000;

    this.fetchImpl =
      options.fetchImpl ??
      globalThis.fetch;
  }

  async compute(
    request:
      TravelRouteMatrixRequest,
  ): Promise<
    readonly TravelRouteEvidence[]
  > {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        this.timeoutMs,
      );

    try {
      const response =
        await this.fetchImpl(
          this.endpoint,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              "X-Goog-Api-Key":
                this.apiKey,

              "X-Goog-FieldMask":
                FIELD_MASK,
            },

            body: JSON.stringify({
              origins:
                request.origins.map(
                  (origin) => ({
                    waypoint: {
                      address:
                        `${origin}, UK`,
                    },
                  }),
                ),

              destinations: [
                {
                  waypoint: {
                    address:
                      `${request.destinationPostcode}, UK`,
                  },
                },
              ],

              travelMode: "DRIVE",

              routingPreference:
                "TRAFFIC_UNAWARE",

              regionCode: "uk",
            }),

            signal:
              controller.signal,
          },
        );

      if (!response.ok) {
        throw new Error(
          `Google Routes returned HTTP ${response.status}.`,
        );
      }

      const result =
        routeMatrixSchema.safeParse(
          await response.json(),
        );

      if (!result.success) {
        throw new Error(
          "Google Routes returned an invalid route matrix.",
        );
      }

      return result.data
        .filter(
          (element) =>
            element.destinationIndex ===
              0 &&
            element.originIndex <
              request.origins.length,
        )
        .map(
          (element) => ({
            originPostcode:
              request.origins[
                element.originIndex
              ] as string,

            condition:
              element.condition,

            providerStatusCode:
              element.status
                ?.code ?? null,

            distanceMeters:
              element
                .distanceMeters ??
              null,

            durationSeconds:
              durationSeconds(
                element.duration,
              ),
          }),
        );
    } finally {
      clearTimeout(timeout);
    }
  }
}
