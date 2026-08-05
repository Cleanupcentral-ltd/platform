import assert from "node:assert/strict";
import test from "node:test";

import {
  QuoteSubmissionRequestError,
  createQuoteSubmissionId,
  fetchTravelEstimate,
  resolveQuoteApiBaseUrl,
  submitQuoteRequest,
  uploadQuoteAttachments,
} from "../src/app/quoteSubmission.js";

test("resolves configured and local quote API bases", () => {
  assert.equal(
    resolveQuoteApiBaseUrl("https://api.example.com/", {
      hostname: "example.com",
    }),
    "https://api.example.com",
  );

  assert.equal(
    resolveQuoteApiBaseUrl("", {
      hostname: "localhost",
    }),
    "http://127.0.0.1:3001",
  );

  assert.equal(
    resolveQuoteApiBaseUrl("", {
      hostname: "cleanupcentral.com",
    }),
    "",
  );
});

test("requests a safe travel estimate for a postcode", async () => {
  const calls = [];

  const travel =
    await fetchTravelEstimate({
      apiBaseUrl:
        "https://api.example.com/",
      postcode: " SE1 2AA ",

      fetchImpl:
        async (url, options) => {
          calls.push({
            url,
            options,
          });

          return new Response(
            JSON.stringify({
              success: true,
              travel: {
                status:
                  "calculated",
                fee: 10,
                distanceMiles:
                  12.34,
                pendingReview:
                  false,
                reason: null,
              },
              requestId:
                "request-travel-1",
            }),
            {
              status: 200,
              headers: {
                "content-type":
                  "application/json",
              },
            },
          );
        },
    });

  assert.equal(travel.fee, 10);
  assert.equal(calls.length, 1);

  assert.equal(
    calls[0].url,
    "https://api.example.com/api/travel/estimate",
  );

  assert.deepEqual(
    JSON.parse(
      calls[0].options.body,
    ),
    {
      postcode: "SE1 2AA",
    },
  );
});

test("rejects an invalid travel response for manual fallback", async () => {
  await assert.rejects(
    fetchTravelEstimate({
      apiBaseUrl:
        "https://api.example.com",
      postcode: "SE1 2AA",

      fetchImpl:
        async () =>
          new Response(
            JSON.stringify({
              success: true,
              travel: {
                fee: "10",
              },
              requestId:
                "request-travel-2",
            }),
            {
              status: 200,
            },
          ),
    }),
    (error) => {
      assert.ok(
        error instanceof
          QuoteSubmissionRequestError,
      );

      assert.equal(
        error.code,
        "INVALID_TRAVEL_RESPONSE",
      );

      return true;
    },
  );
});

test("uses a secure quote submission UUID", () => {
  const value = createQuoteSubmissionId({
    randomUUID() {
      return "11111111-1111-4111-8111-111111111111";
    },
  });

  assert.equal(
    value,
    "11111111-1111-4111-8111-111111111111",
  );
});

test("submits the required quote envelope", async () => {
  const calls = [];
  const payload = {
    schemaVersion: "1.0",
    quoteCategory: "Residential Cleaning",
  };

  const response = await submitQuoteRequest({
    apiBaseUrl: "https://api.example.com/",
    submissionId:
      "11111111-1111-4111-8111-111111111111",
    payload,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });

      return new Response(
        JSON.stringify({
          success: true,
          replayed: false,
          confirmation: {
            quoteNumber: "CUC-Q-123456",
            message:
              "Your quote request has been received.",
          },
          requestId: "request-1",
        }),
        {
          status: 201,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    },
  });

  assert.equal(response.success, true);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://api.example.com/api/quotes",
  );
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.cache, "no-store");

  assert.deepEqual(
    JSON.parse(calls[0].options.body),
    {
      submissionId:
        "11111111-1111-4111-8111-111111111111",
      payload,
    },
  );
});

test("maps quote API failures to a public-safe error", async () => {
  await assert.rejects(
    submitQuoteRequest({
      apiBaseUrl: "https://api.example.com",
      submissionId:
        "11111111-1111-4111-8111-111111111111",
      payload: {},
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message:
                "The quote submission contains invalid information.",
            },
            requestId: "request-2",
          }),
          {
            status: 400,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
    }),
    (error) => {
      assert.ok(
        error instanceof QuoteSubmissionRequestError,
      );
      assert.equal(error.code, "VALIDATION_ERROR");
      assert.equal(error.status, 400);
      assert.equal(error.requestId, "request-2");
      return true;
    },
  );
});

test("uploads attachments with the required route and headers", async () => {
  const calls = [];
  const file = new Blob(["photo"], {
    type: "image/png",
  });
  Object.defineProperty(file, "name", {
    value: "kitchen photo.png",
  });

  const uploaded = await uploadQuoteAttachments({
    apiBaseUrl: "https://api.example.com/",
    submissionId:
      "11111111-1111-4111-8111-111111111111",
    files: [file],
    cryptoObject: {
      randomUUID() {
        return "22222222-2222-4222-8222-222222222222";
      },
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(
        JSON.stringify({
          success: true,
          replayed: false,
          attachment: {
            attachmentId:
              "22222222-2222-4222-8222-222222222222",
          },
          requestId: "request-3",
        }),
        {
          status: 201,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    },
  });

  assert.equal(uploaded.length, 1);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://api.example.com/api/quotes/11111111-1111-4111-8111-111111111111/attachments/22222222-2222-4222-8222-222222222222",
  );
  assert.equal(calls[0].options.method, "PUT");
  assert.equal(
    calls[0].options.headers["Content-Type"],
    "image/png",
  );
  assert.equal(
    calls[0].options.headers["X-File-Name"],
    "kitchen%20photo.png",
  );
  assert.equal(calls[0].options.body, file);
});
