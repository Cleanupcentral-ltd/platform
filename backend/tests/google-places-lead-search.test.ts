import assert from "node:assert/strict";
import test from "node:test";

import {
  GOOGLE_PLACES_FIELD_MASK,
  GooglePlacesLeadSearchProvider,
} from "../src/adapters/google/google-places-lead-search.js";

test(
  "Google Places search uses the approved sector query and keeps only results within radius",
  async () => {
    let requestUrl = "";
    let requestInit:
      RequestInit | undefined;
    const provider =
      new GooglePlacesLeadSearchProvider({
        apiKey: "private-key",
        apiBaseUrl:
          "https://places.googleapis.com/v1",
        timeoutMs: 1_000,
        fetchFunction:
          (async (input, init) => {
            requestUrl = String(input);
            requestInit = init;
            return Response.json({
              places: [
                {
                  id: "inside-place",
                  displayName: {
                    text: "Nearby Office",
                  },
                  formattedAddress:
                    "1 High Street, Bromley BR1 1AA",
                  postalAddress: {
                    postalCode: "BR1 1AA",
                  },
                  websiteUri:
                    "https://nearby.example/",
                  nationalPhoneNumber:
                    "020 0000 0000",
                  googleMapsUri:
                    "https://maps.google.com/?cid=1",
                  businessStatus:
                    "OPERATIONAL",
                  types: ["office"],
                  location: {
                    latitude: 51.401,
                    longitude: 0,
                  },
                },
                {
                  id: "outside-place",
                  displayName: {
                    text: "Distant Office",
                  },
                  location: {
                    latitude: 52,
                    longitude: 0,
                  },
                },
              ],
            });
          }) as typeof fetch,
      });

    const results =
      await provider.search({
        sector:
          "offices_coworking",
        center: {
          latitude: 51.4,
          longitude: 0,
        },
        radiusMiles: 5,
      });

    assert.equal(
      requestUrl,
      "https://places.googleapis.com/v1/places:searchText",
    );
    const headers =
      new Headers(
        requestInit?.headers,
      );
    assert.equal(
      headers.get("x-goog-api-key"),
      "private-key",
    );
    assert.equal(
      headers.get("x-goog-fieldmask"),
      GOOGLE_PLACES_FIELD_MASK,
    );
    const body = JSON.parse(
      String(requestInit?.body),
    ) as {
      readonly textQuery: string;
      readonly pageSize: number;
      readonly locationBias: {
        readonly circle: {
          readonly radius: number;
        };
      };
    };
    assert.equal(
      body.textQuery,
      "offices and coworking spaces",
    );
    assert.equal(body.pageSize, 20);
    assert.ok(
      body.locationBias.circle.radius >
        8_000,
    );
    assert.equal(results.length, 1);
    assert.equal(
      results[0]?.providerPlaceId,
      "inside-place",
    );
    assert.equal(
      JSON.stringify(body).includes(
        "private-key",
      ),
      false,
    );
  },
);

