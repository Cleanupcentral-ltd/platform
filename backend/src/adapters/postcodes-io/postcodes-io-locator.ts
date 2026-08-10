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
      postcode
        .trim()
        .replace(/\s/g, "")
        .toUpperCase();

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
}

