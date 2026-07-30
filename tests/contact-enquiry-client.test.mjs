import assert from "node:assert/strict";
import test from "node:test";

import {
  ContactEnquiryRequestError,
  contactPayloadFingerprint,
  createContactEnquiryPayload,
  createContactSubmissionId,
  resolveContactApiBaseUrl,
  submitContactEnquiry,
  validateContactForm,
} from "../src/app/contactEnquiry.js";

const validForm = {
  fullName: "Test Customer",
  email: "TEST@example.com",
  phone: "",
  enquiryType: "Cleaning Services",
  preferredContactMethod: "Email",
  message:
    "Please contact me about a regular cleaning service.",
  privacyConsent: true,
  website: "",
};

test(
  "creates and normalises a contact enquiry payload",
  () => {
    const submissionId =
      "11111111-1111-4111-8111-111111111111";

    const payload =
      createContactEnquiryPayload(
        validForm,
        submissionId,
      );

    assert.equal(
      payload.submissionId,
      submissionId,
    );

    assert.equal(
      payload.email,
      "test@example.com",
    );

    assert.equal(
      payload.attachmentCount,
      0,
    );

    assert.equal(
      payload.schemaVersion,
      "1.0",
    );
  },
);

test(
  "validates phone and consent requirements",
  () => {
    const errors =
      validateContactForm({
        ...validForm,
        phone: "",
        preferredContactMethod:
          "WhatsApp",
        privacyConsent: false,
      });

    assert.equal(
      typeof errors.phone,
      "string",
    );

    assert.equal(
      typeof errors.privacyConsent,
      "string",
    );
  },
);

test(
  "keeps identical form data on one retry fingerprint",
  () => {
    const first =
      createContactEnquiryPayload(
        validForm,
        "11111111-1111-4111-8111-111111111111",
      );

    const second =
      createContactEnquiryPayload(
        validForm,
        "22222222-2222-4222-8222-222222222222",
      );

    assert.equal(
      contactPayloadFingerprint(first),
      contactPayloadFingerprint(second),
    );
  },
);

test(
  "resolves configured, local and same-origin API bases",
  () => {
    assert.equal(
      resolveContactApiBaseUrl(
        "https://api.example.com/",
        {
          hostname: "example.com",
        },
      ),
      "https://api.example.com",
    );

    assert.equal(
      resolveContactApiBaseUrl(
        "",
        {
          hostname: "localhost",
        },
      ),
      "http://127.0.0.1:3001",
    );

    assert.equal(
      resolveContactApiBaseUrl(
        "",
        {
          hostname: "cleanupcentral.com",
        },
      ),
      "",
    );
  },
);

test(
  "uses a secure UUID generator",
  () => {
    const value =
      createContactSubmissionId({
        randomUUID() {
          return "33333333-3333-4333-8333-333333333333";
        },
      });

    assert.equal(
      value,
      "33333333-3333-4333-8333-333333333333",
    );
  },
);

test(
  "submits the safe contact envelope",
  async () => {
    const calls = [];

    const response =
      await submitContactEnquiry({
        apiBaseUrl:
          "http://127.0.0.1:3001",
        submissionId:
          "11111111-1111-4111-8111-111111111111",
        payload:
          createContactEnquiryPayload(
            validForm,
            "11111111-1111-4111-8111-111111111111",
          ),
        fetchImpl:
          async (url, options) => {
            calls.push({
              url,
              options,
            });

            return new Response(
              JSON.stringify({
                success: true,
                replayed: false,
                confirmation: {
                  enquiryNumber:
                    "CUC-E-111111111111",
                  status: "New",
                  message:
                    "Your enquiry has been received.",
                  preferredContactMethod:
                    "Email",
                  attachmentExpected:
                    false,
                },
                requestId:
                  "request-1",
              }),
              {
                status: 201,
                headers: {
                  "content-type":
                    "application/json",
                },
              },
            );
          },
      });

    assert.equal(
      response.success,
      true,
    );

    assert.equal(
      calls.length,
      1,
    );

    assert.equal(
      calls[0].url,
      "http://127.0.0.1:3001/api/contact-enquiries",
    );

    assert.equal(
      calls[0].options.cache,
      "no-store",
    );

    const sent = JSON.parse(
      calls[0].options.body,
    );

    assert.equal(
      sent.submissionId,
      sent.payload.submissionId,
    );
  },
);

test(
  "maps server validation issues to public form fields",
  async () => {
    await assert.rejects(
      submitContactEnquiry({
        apiBaseUrl: "",
        submissionId:
          "11111111-1111-4111-8111-111111111111",
        payload:
          createContactEnquiryPayload(
            validForm,
            "11111111-1111-4111-8111-111111111111",
          ),
        fetchImpl:
          async () =>
            new Response(
              JSON.stringify({
                success: false,
                error: {
                  code:
                    "VALIDATION_ERROR",
                  message:
                    "The contact enquiry contains invalid information.",
                  details: {
                    issues: [
                      {
                        field:
                          "payload.email",
                        message:
                          "Enter a valid email address.",
                      },
                    ],
                  },
                },
                requestId:
                  "request-2",
              }),
              {
                status: 400,
                headers: {
                  "content-type":
                    "application/json",
                },
              },
            ),
      }),
      (error) => {
        assert.ok(
          error instanceof
            ContactEnquiryRequestError,
        );

        assert.equal(
          error.code,
          "VALIDATION_ERROR",
        );

        assert.equal(
          error.fieldErrors.email,
          "Enter a valid email address.",
        );

        return true;
      },
    );
  },
);
