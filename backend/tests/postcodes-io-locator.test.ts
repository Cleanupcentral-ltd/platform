import assert from "node:assert/strict";
import test from "node:test";

import {
  PostcodesIoLocator,
} from "../src/adapters/postcodes-io/postcodes-io-locator.js";

import {
  LeadProviderError,
} from "../src/ports/lead-search.js";

test(
  "Postcodes.io locator normalizes the request and returns provider coordinates",
  async () => {
    let requestUrl = "";
    const locator =
      new PostcodesIoLocator({
        apiBaseUrl:
          "https://api.postcodes.io",
        timeoutMs: 1_000,
        fetchFunction:
          (async (input) => {
            requestUrl = String(input);
            return Response.json({
              status: 200,
              result: {
                postcode: "BR1 5HP",
                latitude: 51.4,
                longitude: 0.02,
              },
            });
          }) as typeof fetch,
      });

    const located =
      await locator.locate(
        " br1 5hp ",
      );

    assert.equal(
      requestUrl,
      "https://api.postcodes.io/postcodes/BR15HP",
    );
    assert.deepEqual(located, {
      postcode: "BR1 5HP",
      coordinates: {
        latitude: 51.4,
        longitude: 0.02,
      },
    });
  },
);

test(
  "Postcodes.io locator distinguishes a missing postcode from provider failure",
  async () => {
    const locator =
      new PostcodesIoLocator({
        apiBaseUrl:
          "https://api.postcodes.io",
        timeoutMs: 1_000,
        fetchFunction:
          (async () =>
            Response.json(
              { status: 404 },
              { status: 404 },
            )) as typeof fetch,
      });

    await assert.rejects(
      locator.locate("ZZ1 1ZZ"),
      (error: unknown) =>
        error instanceof
          LeadProviderError &&
        error.failure ===
          "invalid_postcode",
    );
  },
);

test(
  "bulk-verifies borough membership from admin_district",
  async () => {
    let requestBody = "";
    const locator =
      new PostcodesIoLocator({
        apiBaseUrl:
          "https://api.postcodes.io",
        timeoutMs: 1_000,
        fetchFunction:
          (async (_input, init) => {
            requestBody =
              String(init?.body ?? "");
            return Response.json({
              status: 200,
              result: [
                {
                  query: "BR1 1AA",
                  result: {
                    postcode: "BR1 1AA",
                    admin_district:
                      "Bromley",
                  },
                },
                {
                  query: "SE6 1AA",
                  result: {
                    postcode: "SE6 1AA",
                    admin_district:
                      "Lewisham",
                  },
                },
              ],
            });
          }) as typeof fetch,
      });

    const matched =
      await locator.filterToBorough(
        "Bromley",
        ["BR1 1AA", "SE6 1AA"],
      );

    assert.deepEqual(
      JSON.parse(requestBody),
      {
        postcodes: [
          "BR11AA",
          "SE61AA",
        ],
      },
    );
    assert.deepEqual(
      matched,
      ["BR1 1AA"],
    );
  },
);
