import assert from "node:assert/strict";
import test from "node:test";

import {
  NotificationProviderError,
  ResendNotificationDelivery,
} from "../src/adapters/resend/resend-notification-delivery.js";

import type {
  NotificationDraft,
} from "../src/ports/notifications.js";

const draft:
  NotificationDraft = {
    templateId:
      "quote-received-customer",

    audience: "Customer",

    idempotencyKey:
      "quote:submission:customer-received",

    referenceNumber:
      "CUC-Q-TEST",

    to: [
      {
        email:
          "customer@example.com",

        name:
          "Test Customer",
      },
    ],

    replyTo: {
      email:
        "support@example.com",

      name:
        "Clean Up Central",
    },

    subject:
      "Quote received",

    text:
      "Your quote was received.",

    html:
      "<p>Your quote was received.</p>",
  };

function delivery(
  fetch:
    typeof globalThis.fetch,

  options: {
    readonly retryDelaysMs?:
      readonly number[];
  } = {},
): ResendNotificationDelivery {
  return new ResendNotificationDelivery({
    apiKey:
      "test-resend-key",

    apiBaseUrl:
      "https://api.resend.test",

    from: {
      email:
        "notifications@example.com",

      name:
        "Clean Up Central",
    },

    fetch,

    retryDelaysMs:
      options.retryDelaysMs ??
      [0],

    wait:
      async () => {},

    now:
      () =>
        new Date(
          "2026-07-30T10:00:00.000Z",
        ),
  });
}

test(
  "sends the notification through Resend with an idempotency key",
  async () => {
    const requests:
      {
        readonly input:
          string | URL | Request;
        readonly init?:
          RequestInit;
      }[] = [];

    const client =
      delivery(
        async (input, init) => {
          requests.push(
  init === undefined
    ? {
        input,
      }
    : {
        input,
        init,
      },
);

          return Response.json(
            {
              id:
                "email-message-1",
            },
            {
              status: 200,
            },
          );
        },
      );

    const receipt =
      await client.send(draft);

    assert.deepEqual(
      receipt,
      {
        providerMessageId:
          "email-message-1",

        acceptedAt:
          "2026-07-30T10:00:00.000Z",
      },
    );

    assert.equal(
      requests.length,
      1,
    );

    const request =
      requests[0];

    assert.ok(request);

    assert.equal(
      String(request.input),
      "https://api.resend.test/emails",
    );

    assert.equal(
      request.init?.method,
      "POST",
    );

    const headers =
      new Headers(
        request.init?.headers,
      );

    assert.equal(
      headers.get(
        "Authorization",
      ),
      "Bearer test-resend-key",
    );

    assert.equal(
      headers.get(
        "Idempotency-Key",
      ),
      draft.idempotencyKey,
    );

    const body =
      JSON.parse(
        String(
          request.init?.body,
        ),
      ) as {
        readonly from: string;
        readonly to:
          readonly string[];
        readonly reply_to:
          string;
        readonly subject: string;
        readonly text: string;
        readonly html: string;
      };

    assert.deepEqual(
      body,
      {
        from:
          "Clean Up Central <notifications@example.com>",

        to: [
          "Test Customer <customer@example.com>",
        ],

        reply_to:
          "Clean Up Central <support@example.com>",

        subject:
          draft.subject,

        text:
          draft.text,

        html:
          draft.html,
      },
    );
  },
);

test(
  "retries transient provider failures using the same idempotency key",
  async () => {
    const keys: string[] = [];

    let attempt = 0;

    const client =
      delivery(
        async (_input, init) => {
          keys.push(
            new Headers(
              init?.headers,
            ).get(
              "Idempotency-Key",
            ) ?? "",
          );

          attempt += 1;

          if (attempt === 1) {
            return Response.json(
              {
                name:
                  "internal_server_error",
              },
              {
                status: 500,
              },
            );
          }

          return Response.json(
            {
              id:
                "email-message-2",
            },
            {
              status: 200,
            },
          );
        },
        {
          retryDelaysMs:
            [0, 1],
        },
      );

    const receipt =
      await client.send(draft);

    assert.equal(
      receipt.providerMessageId,
      "email-message-2",
    );

    assert.deepEqual(
      keys,
      [
        draft.idempotencyKey,
        draft.idempotencyKey,
      ],
    );
  },
);

test(
  "retries concurrent idempotent requests safely",
  async () => {
    let attempt = 0;

    const client =
      delivery(
        async () => {
          attempt += 1;

          if (attempt === 1) {
            return Response.json(
              {
                name:
                  "concurrent_idempotent_requests",
              },
              {
                status: 409,
              },
            );
          }

          return Response.json(
            {
              id:
                "email-message-3",
            },
            {
              status: 200,
            },
          );
        },
        {
          retryDelaysMs:
            [0, 1],
        },
      );

    const receipt =
      await client.send(draft);

    assert.equal(
      receipt.providerMessageId,
      "email-message-3",
    );

    assert.equal(attempt, 2);
  },
);

test(
  "does not retry a permanent provider rejection",
  async () => {
    let attempt = 0;

    const client =
      delivery(
        async () => {
          attempt += 1;

          return Response.json(
            {
              name:
                "validation_error",

              message:
                "Invalid sender",
            },
            {
              status: 422,
            },
          );
        },
        {
          retryDelaysMs:
            [0, 1, 2],
        },
      );

    await assert.rejects(
      () => client.send(draft),

      (
        error: unknown,
      ) => {
        assert.ok(
          error instanceof
            NotificationProviderError,
        );

        assert.equal(
          error.code,
          "RESEND_VALIDATION_ERROR",
        );

        assert.equal(
          error.statusCode,
          422,
        );

        return true;
      },
    );

    assert.equal(attempt, 1);
  },
);

test(
  "rejects an invalid success response",
  async () => {
    const client =
      delivery(
        async () =>
          Response.json(
            {},
            {
              status: 200,
            },
          ),
      );

    await assert.rejects(
      () => client.send(draft),

      (
        error: unknown,
      ) => {
        assert.ok(
          error instanceof
            NotificationProviderError,
        );

        assert.equal(
          error.code,
          "RESEND_INVALID_RESPONSE",
        );

        return true;
      },
    );
  },
);

test(
  "retries network failures and returns a safe provider error",
  async () => {
    let attempt = 0;

    const client =
      delivery(
        async () => {
          attempt += 1;

          throw new Error(
            "Private network details",
          );
        },
        {
          retryDelaysMs:
            [0, 1],
        },
      );

    await assert.rejects(
      () => client.send(draft),

      (
        error: unknown,
      ) => {
        assert.ok(
          error instanceof
            NotificationProviderError,
        );

        assert.equal(
          error.code,
          "RESEND_NETWORK_ERROR",
        );

        assert.equal(
          error.message.includes(
            "Private network details",
          ),
          false,
        );

        return true;
      },
    );

    assert.equal(attempt, 2);
  },
);

test(
  "rejects an invalid idempotency key before making a request",
  async () => {
    let called = false;

    const client =
      delivery(
        async () => {
          called = true;

          return Response.json({
            id: "unexpected",
          });
        },
      );

    await assert.rejects(
      () =>
        client.send({
          ...draft,
          idempotencyKey: "",
        }),

      (
        error: unknown,
      ) => {
        assert.ok(
          error instanceof
            NotificationProviderError,
        );

        assert.equal(
          error.code,
          "INVALID_NOTIFICATION_IDEMPOTENCY_KEY",
        );

        return true;
      },
    );

    assert.equal(called, false);
  },
);
