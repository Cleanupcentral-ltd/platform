import assert from "node:assert/strict";
import test from "node:test";

import {
  GoogleRoutesMatrixProvider,
} from "../src/adapters/google/google-routes-matrix.js";

test(
  "sends the approved two-origin traffic-unaware matrix request",
  async () => {
    let requestUrl = "";
    let requestInit:
      RequestInit | undefined;

    const provider =
      new GoogleRoutesMatrixProvider({
        apiKey:
          "private-google-key",

        fetchImpl:
          (async (
            input,
            init,
          ) => {
            requestUrl =
              String(input);
            requestInit = init;

            return new Response(
              JSON.stringify([
                {
                  originIndex: 1,
                  destinationIndex: 0,
                  status: {},
                  condition:
                    "ROUTE_EXISTS",
                  distanceMeters:
                    20_000,
                  duration: "900s",
                },
                {
                  originIndex: 0,
                  destinationIndex: 0,
                  status: {},
                  condition:
                    "ROUTE_EXISTS",
                  distanceMeters:
                    10_000,
                  duration:
                    "600.5s",
                },
              ]),
              {
                status: 200,
                headers: {
                  "Content-Type":
                    "application/json",
                },
              },
            );
          }) as typeof fetch,
      });

    const result =
      await provider.compute({
        origins: [
          "BR1 5HP",
          "RM10 8BE",
        ],

        destinationPostcode:
          "SE1 2AA",
      });

    assert.equal(
      requestUrl,
      "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
    );

    const headers =
      new Headers(
        requestInit?.headers,
      );

    assert.equal(
      headers.get(
        "X-Goog-Api-Key",
      ),
      "private-google-key",
    );

    assert.equal(
      headers.get(
        "X-Goog-FieldMask",
      ),
      "originIndex,destinationIndex,status,condition,distanceMeters,duration",
    );

    const body = JSON.parse(
      String(requestInit?.body),
    ) as {
      readonly origins:
        readonly {
          readonly waypoint: {
            readonly address:
              string;
          };
        }[];

      readonly destinations:
        readonly {
          readonly waypoint: {
            readonly address:
              string;
          };
        }[];

      readonly travelMode:
        string;

      readonly routingPreference:
        string;
    };

    assert.deepEqual(
      body.origins.map(
        (origin) =>
          origin.waypoint
            .address,
      ),
      [
        "BR1 5HP, UK",
        "RM10 8BE, UK",
      ],
    );

    assert.equal(
      body.destinations[0]
        ?.waypoint.address,
      "SE1 2AA, UK",
    );

    assert.equal(
      body.travelMode,
      "DRIVE",
    );

    assert.equal(
      body.routingPreference,
      "TRAFFIC_UNAWARE",
    );

    assert.equal(
      result[1]
        ?.durationSeconds,
      600.5,
    );

    assert.equal(
      JSON.stringify(body)
        .includes(
          "private-google-key",
        ),
      false,
    );
  },
);

test(
  "rejects provider HTTP failures without exposing a response body",
  async () => {
    const provider =
      new GoogleRoutesMatrixProvider({
        apiKey: "test-key",

        fetchImpl:
          (async () =>
            new Response(
              "provider secret",
              {
                status: 503,
              },
            )) as typeof fetch,
      });

    await assert.rejects(
      () =>
        provider.compute({
          origins: [
            "BR1 5HP",
          ],

          destinationPostcode:
            "SE1 2AA",
        }),
      /HTTP 503/,
    );
  },
);
