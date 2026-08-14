import assert from "node:assert/strict";
import test from "node:test";

import {
  GooglePlaceDetailsError,
  GooglePlacesPlaceDetailsProvider,
} from "../src/adapters/google/google-places-place-details.js";

test(
  "Google Place Details resolves only the transient qualification fields with an explicit field mask",
  async () => {
    let requestUrl = "";
    let requestInit:
      RequestInit | undefined;
    const provider =
      new GooglePlacesPlaceDetailsProvider({
        apiKey: "private-key",
        apiBaseUrl:
          "https://places.googleapis.com/v1",
        timeoutMs: 1_000,
        fetchFunction:
          (async (input, init) => {
            requestUrl = String(input);
            requestInit = init;
            return Response.json({
              id: "place-123",
              displayName: {
                text: "Example Workspace",
              },
              websiteUri:
                "https://example.com/",
            });
          }) as typeof fetch,
      });

    const result = await provider.resolve(
      "place-123",
    );

    assert.equal(
      requestUrl,
      "https://places.googleapis.com/v1/places/place-123",
    );
    const headers = new Headers(
      requestInit?.headers,
    );
    assert.equal(
      headers.get("x-goog-api-key"),
      "private-key",
    );
    assert.equal(
      headers.get("x-goog-fieldmask"),
      "id,displayName,websiteUri",
    );
    assert.deepEqual(result, {
      placeId: "place-123",
      businessName:
        "Example Workspace",
      websiteUrl:
        "https://example.com/",
    });
  },
);

test(
  "Google Place Details maps missing places to a bounded provider error",
  async () => {
    const provider =
      new GooglePlacesPlaceDetailsProvider({
        apiKey: "private-key",
        apiBaseUrl:
          "https://places.googleapis.com/v1",
        timeoutMs: 1_000,
        fetchFunction:
          (async () =>
            new Response(null, {
              status: 404,
            })) as typeof fetch,
      });

    await assert.rejects(
      () => provider.resolve("missing"),
      (error) =>
        error instanceof
          GooglePlaceDetailsError &&
        error.failure === "not_found",
    );
  },
);
