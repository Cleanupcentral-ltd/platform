import assert from "node:assert/strict";
import test from "node:test";

import {
  buildApp,
} from "../src/app.js";

import type {
  SubmissionNotificationService,
} from "../src/application/deliver-notifications.js";

import type {
  ContactEnquiryPersistenceService,
} from "../src/application/persist-contact-enquiry.js";

import type {
  SubmitContactEnquiryRequest,
} from "../src/application/validation/contact-enquiry.js";

import {
  ApplicationError,
} from "../src/domain/errors.js";

const submissionId =
  "11111111-1111-4111-8111-111111111111";

const validPayload = {
  submissionId,
  schemaVersion: "1.0",
  fullName: "Test Customer",
  email: "customer@example.com",
  phone: "07123 456789",
  enquiryType: "Cleaning Services",
  preferredContactMethod: "Email",
  message:
    "Please help me understand which cleaning service is most suitable.",
  privacyConsent: true,
  attachmentCount: 0,
} as const;

function persistedEnquiry(
  submission:
    SubmitContactEnquiryRequest,
) {
  return {
    id: "contact-1",
    enquiryNumber:
      "CUC-E-111111111111",
    submissionId:
      submission.submissionId,
    customerId: null,
    propertyId: null,
    convertedQuoteId: null,
    status: "New" as const,
    fullName: submission.fullName,
    email: submission.email,
    emailNormalized:
      submission.email,
    phone: submission.phone,
    phoneNormalized:
      "447123456789",
    enquiryType:
      submission.enquiryType,
    preferredContactMethod:
      submission.preferredContactMethod,
    message: submission.message,
    hasAttachments:
      submission.attachmentCount > 0,
    attachmentCount:
      submission.attachmentCount,
    submissionSource:
      "Website Contact Form",
    reviewedAt: null,
    respondedAt: null,
    internalNotes: null,
  };
}

function createPersistenceService(
  onPersist?: (
    submission:
      SubmitContactEnquiryRequest,
  ) => void,
): ContactEnquiryPersistenceService {
  return {
    async persist(submission) {
      onPersist?.(submission);

      return {
        outcome: "created",
        enquiry:
          persistedEnquiry(
            submission,
          ),
      };
    },
  };
}

test(
  "POST /api/contact-enquiries persists a complete enquiry and returns a safe confirmation",
  async (context) => {
    let captured:
      SubmitContactEnquiryRequest | null =
      null;

    const app = await buildApp({
      contactEnquiryPersistenceService:
        createPersistenceService(
          (submission) => {
            captured = submission;
          },
        ),
    });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "POST",
        url:
          "/api/contact-enquiries",
        headers: {
          "content-type":
            "application/json",
        },
        payload: {
          submissionId,
          payload: validPayload,
        },
      });

    assert.equal(
      response.statusCode,
      201,
    );
    assert.ok(captured);

    const body = response.json<{
      success: boolean;
      replayed: boolean;
      confirmation: {
        enquiryNumber: string;
        status: string;
      };
      requestId: string;
    }>();

    assert.equal(body.success, true);
    assert.equal(body.replayed, false);
    assert.equal(
      body.confirmation
        .enquiryNumber,
      "CUC-E-111111111111",
    );
    assert.equal(
      body.confirmation.status,
      "New",
    );
    assert.equal(
      typeof body.requestId,
      "string",
    );
    assert.equal(
      response.headers[
        "cache-control"
      ],
      "no-store",
    );

    const serialized =
      response.body;

    assert.equal(
      serialized.includes(
        "customer@example.com",
      ),
      false,
    );
    assert.equal(
      serialized.includes(
        "contact-1",
      ),
      false,
    );
  },
);

test(
  "POST /api/contact-enquiries returns 200 for an identical replay",
  async (context) => {
    const service:
      ContactEnquiryPersistenceService = {
        async persist(submission) {
          return {
            outcome: "replayed",
            enquiry:
              persistedEnquiry(
                submission,
              ),
          };
        },
      };

    const app = await buildApp({
      contactEnquiryPersistenceService:
        service,
    });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "POST",
        url:
          "/api/contact-enquiries",
        headers: {
          "content-type":
            "application/json",
        },
        payload: {
          submissionId,
          payload: validPayload,
        },
      });

    assert.equal(
      response.statusCode,
      200,
    );
    assert.equal(
      response.json<{
        replayed: boolean;
      }>().replayed,
      true,
    );
  },
);

test(
  "POST /api/contact-enquiries safely acknowledges honeypot submissions",
  async (context) => {
    const service:
      ContactEnquiryPersistenceService = {
        async persist(submission) {
          return {
            outcome: "suppressed",
            enquiryNumber:
              "CUC-E-111111111111",
            preferredContactMethod:
              submission
                .preferredContactMethod,
          };
        },
      };

    const app = await buildApp({
      contactEnquiryPersistenceService:
        service,
    });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "POST",
        url:
          "/api/contact-enquiries",
        headers: {
          "content-type":
            "application/json",
        },
        payload: {
          submissionId,
          payload: {
            ...validPayload,
            website:
              "https://spam.example",
          },
        },
      });

    assert.equal(
      response.statusCode,
      201,
    );
    assert.equal(
      response.json<{
        success: boolean;
      }>().success,
      true,
    );
  },
);

test(
  "POST /api/contact-enquiries rejects invalid enquiry data",
  async (context) => {
    const app = await buildApp({
      contactEnquiryPersistenceService:
        createPersistenceService(),
    });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "POST",
        url:
          "/api/contact-enquiries",
        headers: {
          "content-type":
            "application/json",
        },
        payload: {
          submissionId,
          payload: {
            ...validPayload,
            message: "Too short",
          },
        },
      });

    assert.equal(
      response.statusCode,
      400,
    );
    assert.equal(
      response.json<{
        error: { code: string };
      }>().error.code,
      "VALIDATION_ERROR",
    );
  },
);

test(
  "POST /api/contact-enquiries rejects mismatched submission IDs",
  async (context) => {
    const app = await buildApp({
      contactEnquiryPersistenceService:
        createPersistenceService(),
    });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "POST",
        url:
          "/api/contact-enquiries",
        headers: {
          "content-type":
            "application/json",
        },
        payload: {
          submissionId,
          payload: {
            ...validPayload,
            submissionId:
              "22222222-2222-4222-8222-222222222222",
          },
        },
      });

    assert.equal(
      response.statusCode,
      400,
    );
  },
);

test(
  "POST /api/contact-enquiries rejects unexpected envelope fields",
  async (context) => {
    const app = await buildApp({
      contactEnquiryPersistenceService:
        createPersistenceService(),
    });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "POST",
        url:
          "/api/contact-enquiries",
        headers: {
          "content-type":
            "application/json",
        },
        payload: {
          submissionId,
          payload: validPayload,
          internalStatus: "New",
        },
      });

    assert.equal(
      response.statusCode,
      400,
    );
  },
);

test(
  "POST /api/contact-enquiries rejects non-JSON content",
  async (context) => {
    const app = await buildApp({
      contactEnquiryPersistenceService:
        createPersistenceService(),
    });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "POST",
        url:
          "/api/contact-enquiries",
        headers: {
          "content-type":
            "text/plain",
        },
        payload: JSON.stringify({
          submissionId,
          payload: validPayload,
        }),
      });

    assert.equal(
      response.statusCode,
      415,
    );
    assert.equal(
      response.json<{
        error: { code: string };
      }>().error.code,
      "UNSUPPORTED_MEDIA_TYPE",
    );
  },
);

test(
  "POST /api/contact-enquiries rejects an oversized request",
  async (context) => {
    const app = await buildApp({
      contactEnquiryPersistenceService:
        createPersistenceService(),
    });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "POST",
        url:
          "/api/contact-enquiries",
        headers: {
          "content-type":
            "application/json",
        },
        payload: {
          submissionId,
          payload: {
            ...validPayload,
            message:
              "x".repeat(40 * 1024),
          },
        },
      });

    assert.equal(
      response.statusCode,
      413,
    );
    assert.equal(
      response.json<{
        error: { code: string };
      }>().error.code,
      "PAYLOAD_TOO_LARGE",
    );
  },
);

test(
  "POST /api/contact-enquiries rate limits repeated submissions",
  async (context) => {
    const app = await buildApp({
      contactEnquiryPersistenceService:
        createPersistenceService(),
    });

    context.after(
      async () => app.close(),
    );

    for (
      let attempt = 1;
      attempt <= 3;
      attempt += 1
    ) {
      const response =
        await app.inject({
          method: "POST",
          url:
            "/api/contact-enquiries",
          headers: {
            "content-type":
              "application/json",
          },
          payload: {
            submissionId,
            payload: validPayload,
          },
        });

      assert.equal(
        response.statusCode,
        201,
      );
    }

    const blocked =
      await app.inject({
        method: "POST",
        url:
          "/api/contact-enquiries",
        headers: {
          "content-type":
            "application/json",
        },
        payload: {
          submissionId,
          payload: validPayload,
        },
      });

    assert.equal(
      blocked.statusCode,
      429,
    );
    assert.equal(
      blocked.json<{
        error: { code: string };
      }>().error.code,
      "RATE_LIMITED",
    );
  },
);

test(
  "POST /api/contact-enquiries returns a safe duplicate conflict",
  async (context) => {
    const service:
      ContactEnquiryPersistenceService = {
        async persist() {
          throw new ApplicationError({
            code:
              "DUPLICATE_SUBMISSION",
            message:
              "internal contact details",
            statusCode: 409,
          });
        },
      };

    const app = await buildApp({
      contactEnquiryPersistenceService:
        service,
    });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "POST",
        url:
          "/api/contact-enquiries",
        headers: {
          "content-type":
            "application/json",
        },
        payload: {
          submissionId,
          payload: validPayload,
        },
      });

    assert.equal(
      response.statusCode,
      409,
    );
    assert.equal(
      response.json<{
        error: {
          code: string;
          message: string;
        };
      }>().error.code,
      "DUPLICATE_SUBMISSION",
    );
    assert.equal(
      response.body.includes(
        "internal contact details",
      ),
      false,
    );
  },
);


test(
  "POST /api/contact-enquiries still succeeds when notification dispatch throws after persistence",
  async (context) => {
    const notificationService:
      SubmissionNotificationService = {
        async notifyQuote() {
          return {
            attempted: 0,
            sent: 0,
            failed: 0,
            items: [],
          };
        },

        async notifyContactEnquiry() {
          throw new Error(
            "Simulated notification failure",
          );
        },
      };

    const app = await buildApp({
      contactEnquiryPersistenceService:
        createPersistenceService(),

      submissionNotificationService:
        notificationService,
    });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "POST",

        url:
          "/api/contact-enquiries",

        headers: {
          "content-type":
            "application/json",
        },

        payload: {
          submissionId,
          payload: validPayload,
        },
      });

    assert.equal(
      response.statusCode,
      201,
    );

    assert.equal(
      response.json<{
        success: boolean;
      }>().success,
      true,
    );
  },
);
