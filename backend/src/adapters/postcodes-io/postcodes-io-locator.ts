import { z } from "zod";

import {
  LeadProviderError,
  type LocatedPostcode,
  type PostcodeLocator,
} from "../../ports/lead-search.js";

type FetchFunction = typeof fetch;

const responseSchema = z.object({
  status: z.literal(200),
  result: z.object({
    postcode: z.string().min(5),
    latitude: z.number(),
    longitude: z.number(),
  }),
});

const bulkResponseSchema = z.object({
  status: z.literal(200),
  result: z.array(z.object({
    query: z.string(),
    result: z.object({
      postcode: z.string().min(5),
      admin_district:
        z.string().nullable(),
    }).nullable(),
  })),
});

function normalizedPostcode(
  value: string,
): string {
  return value
    .trim()
    .replace(/\s/g, "")
    .toUpperCase();
}

export interface PostcodesIoLocatorOptions {
  readonly apiBaseUrl: string;
  readonly timeoutMs: number;
  readonly fetchFunction?: FetchFunction;
}

export class PostcodesIoLocator
implements PostcodeLocator {
  private readonly apiBaseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFunction: FetchFunction;

  constructor(
    options: PostcodesIoLocatorOptions,
  ) {
    this.apiBaseUrl =
      options.apiBaseUrl.replace(
        /\/$/,
        "",
      );
    this.timeoutMs =
      options.timeoutMs;
    this.fetchFunction =
      options.fetchFunction ?? fetch;
  }

  async locate(
    postcode: string,
  ): Promise<LocatedPostcode> {
    const normalizedInput =
      normalizedPostcode(postcode);

    const controller =
      new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.timeoutMs,
    );

    let response: Response;
    try {
      response =
        await this.fetchFunction(
          `${this.apiBaseUrl}/postcodes/${encodeURIComponent(normalizedInput)}`,
          {
            method: "GET",
            headers: {
              accept:
                "application/json",
            },
            signal:
              controller.signal,
          },
        );
    } catch {
      throw new LeadProviderError(
        "postcode_provider_unavailable",
      );
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 404) {
      throw new LeadProviderError(
        "invalid_postcode",
      );
    }

    if (!response.ok) {
      throw new LeadProviderError(
        "postcode_provider_unavailable",
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
        "postcode_provider_unavailable",
      );
    }

    if (!parsed.success) {
      throw new LeadProviderError(
        "postcode_provider_unavailable",
      );
    }

    return {
      postcode:
        parsed.data.result.postcode,
      coordinates: {
        latitude:
          parsed.data.result.latitude,
        longitude:
          parsed.data.result.longitude,
      },
    };
  }

  async filterToBorough(
    borough: string,
    postcodes: readonly string[],
  ): Promise<readonly string[]> {
    const unique = [
      ...new Set(
        postcodes
          .map(normalizedPostcode)
          .filter(Boolean),
      ),
    ];
    if (unique.length === 0) {
      return [];
    }
    if (unique.length > 100) {
      throw new LeadProviderError(
        "postcode_provider_unavailable",
      );
    }

    const controller =
      new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.timeoutMs,
    );

    let response: Response;
    try {
      response =
        await this.fetchFunction(
          `${this.apiBaseUrl}/postcodes`,
          {
            method: "POST",
            headers: {
              accept:
                "application/json",
              "content-type":
                "application/json",
            },
            body: JSON.stringify({
              postcodes: unique,
            }),
            signal:
              controller.signal,
          },
        );
    } catch {
      throw new LeadProviderError(
        "postcode_provider_unavailable",
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new LeadProviderError(
        "postcode_provider_unavailable",
      );
    }

    let parsed:
      ReturnType<
        typeof bulkResponseSchema.safeParse
      >;
    try {
      parsed =
        bulkResponseSchema.safeParse(
          await response.json(),
        );
    } catch {
      throw new LeadProviderError(
        "postcode_provider_unavailable",
      );
    }

    if (!parsed.success) {
      throw new LeadProviderError(
        "postcode_provider_unavailable",
      );
    }

    const wanted =
      borough.trim().toLowerCase();
    return parsed.data.result
      .filter(
        (item) =>
          item.result !== null &&
          item.result.admin_district
            ?.trim()
            .toLowerCase() === wanted,
      )
      .map(
        (item) =>
          item.result!.postcode,
      );
  }
}

