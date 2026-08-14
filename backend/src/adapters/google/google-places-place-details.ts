import { z } from "zod";

import type {
  GooglePlaceDetailsProvider,
  GooglePlaceDetailsResult,
} from "../../ports/automatic-qualification.js";

type FetchFunction = typeof fetch;

const placeSchema = z.object({
  id: z.string().min(1),
  displayName: z.object({
    text: z.string().min(1),
  }),
  websiteUri:
    z.string().url().optional(),
});

export class GooglePlaceDetailsError extends Error {
  readonly failure:
    | "not_found"
    | "temporarily_unavailable";

  constructor(
    failure:
      | "not_found"
      | "temporarily_unavailable",
  ) {
    super(failure);
    this.name = "GooglePlaceDetailsError";
    this.failure = failure;
  }
}

export interface GooglePlacesPlaceDetailsOptions {
  readonly apiKey: string;
  readonly apiBaseUrl: string;
  readonly timeoutMs: number;
  readonly fetchFunction?: FetchFunction;
}

export class GooglePlacesPlaceDetailsProvider
implements GooglePlaceDetailsProvider {
  private readonly apiKey: string;
  private readonly apiBaseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFunction: FetchFunction;

  constructor(
    options: GooglePlacesPlaceDetailsOptions,
  ) {
    this.apiKey = options.apiKey;
    this.apiBaseUrl =
      options.apiBaseUrl.replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs;
    this.fetchFunction =
      options.fetchFunction ?? fetch;
  }

  async resolve(
    placeId: string,
  ): Promise<GooglePlaceDetailsResult> {
    const controller =
      new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.timeoutMs,
    );

    let response: Response;
    try {
      response = await this.fetchFunction(
        `${this.apiBaseUrl}/places/${encodeURIComponent(placeId)}`,
        {
          method: "GET",
          headers: {
            "content-type":
              "application/json",
            "x-goog-api-key":
              this.apiKey,
            "x-goog-fieldmask":
              "id,displayName,websiteUri",
          },
          signal: controller.signal,
        },
      );
    } catch {
      throw new GooglePlaceDetailsError(
        "temporarily_unavailable",
      );
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 404) {
      throw new GooglePlaceDetailsError(
        "not_found",
      );
    }

    if (!response.ok) {
      throw new GooglePlaceDetailsError(
        "temporarily_unavailable",
      );
    }

    let parsed:
      ReturnType<typeof placeSchema.safeParse>;
    try {
      parsed = placeSchema.safeParse(
        await response.json(),
      );
    } catch {
      throw new GooglePlaceDetailsError(
        "temporarily_unavailable",
      );
    }

    if (!parsed.success) {
      throw new GooglePlaceDetailsError(
        "temporarily_unavailable",
      );
    }

    return {
      placeId: parsed.data.id,
      businessName:
        parsed.data.displayName.text,
      websiteUrl:
        parsed.data.websiteUri ?? null,
    };
  }
}
