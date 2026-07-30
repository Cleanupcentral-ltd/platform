import assert from "node:assert/strict";
import test from "node:test";

import {
  WixNotificationDeliveryRecorder,
} from "../src/adapters/wix/wix-notification-delivery-recorder.js";

import type {
  CreateStatusHistoryRecord,
  StatusHistoryRecord,
} from "../src/domain/models.js";

import type {
  StatusHistoryRepository,
} from "../src/ports/repositories.js";

function repository(
  captured:
    CreateStatusHistoryRecord[],
): StatusHistoryRepository {
  return {
    async findByQuoteId() {
      return null;
    },

    async create(history) {
      captured.push(history);

      return {
        id:
          `history-${captured.length}`,

        ...history,
      } satisfies StatusHistoryRecord;
    },

    async delete() {},
  };
}

test(
  "records a successful quote notification without exposing message content",
  async () => {
    const captured:
      CreateStatusHistoryRecord[] = [];

    const recorder =
      new WixNotificationDeliveryRecorder(
        repository(captured),
      );

    await recorder.record({
      recordType: "Quote",
      recordId: "quote-1",

      referenceNumber:
        "CUC-Q-TEST",

      templateId:
        "quote-received-customer",

      audience: "Customer",

      idempotencyKey:
        "quote:test:customer-received",

      status: "Sent",

      providerMessageId:
        "provider-message-1",

      acceptedAt:
        "2026-07-30T10:00:00.000Z",

      errorCode: null,
    });

    assert.equal(
      captured.length,
      1,
    );

    const record =
      captured[0];

    assert.ok(record);

    assert.equal(
      record.quoteId,
      "quote-1",
    );

    assert.equal(
      record.contactEnquiryId,
      null,
    );

    assert.equal(
      record.newStatus,
      "Email Sent",
    );

    assert.equal(
      record.customerVisible,
      false,
    );

    assert.deepEqual(
      record.metadata,
      {
        templateId:
          "quote-received-customer",

        audience: "Customer",

        idempotencyKey:
          "quote:test:customer-received",

        providerMessageId:
          "provider-message-1",

        acceptedAt:
          "2026-07-30T10:00:00.000Z",

        errorCode: null,
      },
    );

    const serialized =
      JSON.stringify(record);

    assert.equal(
      serialized.includes(
        "customer@example.com",
      ),
      false,
    );
  },
);

test(
  "records a failed contact notification against the enquiry",
  async () => {
    const captured:
      CreateStatusHistoryRecord[] = [];

    const recorder =
      new WixNotificationDeliveryRecorder(
        repository(captured),
      );

    await recorder.record({
      recordType:
        "Contact Enquiry",

      recordId: "contact-1",

      referenceNumber:
        "CUC-E-TEST",

      templateId:
        "contact-received-internal",

      audience: "Internal",

      idempotencyKey:
        "contact:test:internal-received",

      status: "Failed",

      providerMessageId: null,
      acceptedAt: null,

      errorCode:
        "RESEND_NETWORK_ERROR",
    });

    const record =
      captured[0];

    assert.ok(record);

    assert.equal(
      record.quoteId,
      null,
    );

    assert.equal(
      record.contactEnquiryId,
      "contact-1",
    );

    assert.equal(
      record.newStatus,
      "Email Failed",
    );

    assert.equal(
      record.metadata?.[
        "errorCode"
      ],
      "RESEND_NETWORK_ERROR",
    );
  },
);
