import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTACT_ENQUIRY_POLICY,
  submitContactEnquirySchema,
} from "../src/application/validation/contact-enquiry.js";

function validSubmission() {
  return {
    submissionId:
      "11111111-1111-4111-8111-111111111111",
    schemaVersion: "1.0",
    fullName: "Test Customer",
    email: "Customer@Example.com",
    phone: "",
    enquiryType:
      "Cleaning Services",
    preferredContactMethod:
      "Email",
    message:
      "Please help me understand which cleaning service is most suitable.",
    privacyConsent: true,
    attachmentCount: 0,
  };
}

test(
  "accepts and normalises a valid contact enquiry",
  () => {
    const result =
      submitContactEnquirySchema
        .safeParse(
          validSubmission(),
        );

    assert.equal(
      result.success,
      true,
    );

    if (!result.success) {
      return;
    }

    assert.equal(
      result.data.email,
      "customer@example.com",
    );
  },
);

test(
  "rejects unexpected contact fields",
  () => {
    const result =
      submitContactEnquirySchema
        .safeParse({
          ...validSubmission(),
          internalStatus: "Closed",
        });

    assert.equal(
      result.success,
      false,
    );
  },
);

test(
  "requires privacy consent",
  () => {
    const result =
      submitContactEnquirySchema
        .safeParse({
          ...validSubmission(),
          privacyConsent: false,
        });

    assert.equal(
      result.success,
      false,
    );
  },
);

test(
  "requires a phone number for Phone contact",
  () => {
    const result =
      submitContactEnquirySchema
        .safeParse({
          ...validSubmission(),
          preferredContactMethod:
            "Phone",
        });

    assert.equal(
      result.success,
      false,
    );
  },
);

test(
  "requires a phone number for WhatsApp contact",
  () => {
    const result =
      submitContactEnquirySchema
        .safeParse({
          ...validSubmission(),
          preferredContactMethod:
            "WhatsApp",
        });

    assert.equal(
      result.success,
      false,
    );
  },
);

test(
  "accepts a valid phone number when requested",
  () => {
    const result =
      submitContactEnquirySchema
        .safeParse({
          ...validSubmission(),
          phone: "+44 7123 456789",
          preferredContactMethod:
            "WhatsApp",
        });

    assert.equal(
      result.success,
      true,
    );
  },
);

test(
  "rejects malformed phone numbers",
  () => {
    const result =
      submitContactEnquirySchema
        .safeParse({
          ...validSubmission(),
          phone: "call-me-now",
        });

    assert.equal(
      result.success,
      false,
    );
  },
);

test(
  "rejects more than one contact attachment",
  () => {
    const result =
      submitContactEnquirySchema
        .safeParse({
          ...validSubmission(),
          attachmentCount:
            CONTACT_ENQUIRY_POLICY
              .maxAttachments + 1,
        });

    assert.equal(
      result.success,
      false,
    );
  },
);

test(
  "rejects unsupported control characters",
  () => {
    const result =
      submitContactEnquirySchema
        .safeParse({
          ...validSubmission(),
          fullName:
            "Test\u0000Customer",
        });

    assert.equal(
      result.success,
      false,
    );
  },
);

test(
  "accepts an empty spam honeypot field",
  () => {
    const result =
      submitContactEnquirySchema
        .safeParse({
          ...validSubmission(),
          website: "",
        });

    assert.equal(
      result.success,
      true,
    );
  },
);

test(
  "retains a populated honeypot for silent suppression",
  () => {
    const result =
      submitContactEnquirySchema
        .safeParse({
          ...validSubmission(),
          website:
            "https://spam.example",
        });

    assert.equal(
      result.success,
      true,
    );

    if (!result.success) {
      return;
    }

    assert.equal(
      result.data.website,
      "https://spam.example",
    );
  },
);
