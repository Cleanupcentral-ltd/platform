import assert from "node:assert/strict";
import test from "node:test";

import { ApplicationError } from "../src/domain/errors.js";
import { WixApiClient } from "../src/adapters/wix/wix-api-client.js";
import type { WixConfig } from "../src/adapters/wix/wix-config.js";

const testConfig: WixConfig = {
  apiKey:
    "test-api-key-that-is-long-enough",
  siteId:
    "11111111-1111-4111-8111-111111111111",
  baseUrl: "https://www.wixapis.com",
};

test(
  "Wix API client sends server-side authentication headers",
  async () => {
    let receivedUrl = "";
    let receivedInit: RequestInit | undefined;

    const fakeFetch: typeof fetch = async (
      input,
      init,
    ) => {
      receivedUrl = String(input);
      receivedInit = init;

      return new Response(
        JSON.stringify({
          ok: true,
        }),
        {
          status: 200,
          headers: {
            "Content-Type":
              "application/json",
          },
        },
      );
    };

    const client = new WixApiClient(
      testConfig,
      fakeFetch,
    );

    const response =
      await client.post<{ ok: boolean }>(
        "/test-endpoint",
        {
          hello: "world",
        },
      );

    assert.deepEqual(response, {
      ok: true,
    });

    assert.equal(
      receivedUrl,
      "https://www.wixapis.com/test-endpoint",
    );

    assert.ok(receivedInit);

    const headers = new Headers(
      receivedInit.headers,
    );

    assert.equal(
      headers.get("Authorization"),
      testConfig.apiKey,
    );

    assert.equal(
      headers.get("wix-site-id"),
      testConfig.siteId,
    );

    assert.equal(
      headers.get("Content-Type"),
      "application/json",
    );

    assert.equal(
      receivedInit.body,
      JSON.stringify({
        hello: "world",
      }),
    );
  },
);

test(
  "Wix API client converts Wix failures into application errors",
  async () => {
    const fakeFetch: typeof fetch =
      async () =>
        new Response(
          JSON.stringify({
            message: "Forbidden",
          }),
          {
            status: 403,
            headers: {
              "Content-Type":
                "application/json",
            },
          },
        );

    const client = new WixApiClient(
      testConfig,
      fakeFetch,
    );

    await assert.rejects(
      () => client.get("/forbidden"),
      (error: unknown) => {
        assert.ok(
          error instanceof ApplicationError,
        );

        assert.equal(
          error.code,
          "STORAGE_ERROR",
        );

        assert.equal(
          error.statusCode,
          502,
        );

        assert.deepEqual(error.details, {
          upstreamStatus: 403,
          upstreamPayload: {
            message: "Forbidden",
          },
        });

        return true;
      },
    );
  },
);