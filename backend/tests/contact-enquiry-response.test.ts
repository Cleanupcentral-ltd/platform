import assert from "node:assert/strict";
import test from "node:test";

import {
  createPublicContactEnquiryResponse,
} from "../src/http/responses/contact-enquiry-response.js";

const enquiry = {
  id: "internal-contact-id",
  enquiryNumber:
    "CUC-E-111111111111",
  submissionId:
    "11111111-1111-4111-8111-111111111111",
  customerId: null,
  propertyId: null,
  convertedQuoteId: null,
  status: "New" as const,
  fullName: "Test Customer",
  email: "customer@example.com",
  emailNormalized:
    "customer@example.com",
  phone: "07123 456789",
  phoneNormalized:
    "447123456789",
  enquiryType: "Cleaning Services",
  preferredContactMethod:
    "Email" as const,
  message:
    "Please help me understand which cleaning service is most suitable.",
  hasAttachments: false,
  attachmentCount: 0,
  submissionSource:
    "Website Contact Form",
  reviewedAt: null,
  respondedAt: null,
  internalNotes:
    "Privacy consent confirmed by website submission.",
};

test(
  "returns only customer-facing contact confirmation data",
  () => {
    const response =
      createPublicContactEnquiryResponse(
        {
          outcome: "created",
          enquiry,
        },
        "request-1",
      );

    assert.equal(
      response.success,
      true,
    );
    assert.equal(
      response.replayed,
      false,
    );
    assert.equal(
      response.confirmation
        .enquiryNumber,
      "CUC-E-111111111111",
    );

    const serialized =
      JSON.stringify(response);

    for (const privateValue of [
      "internal-contact-id",
      "customer@example.com",
      "07123 456789",
      "internalNotes",
      "submissionId",
    ]) {
      assert.equal(
        serialized.includes(
          privateValue,
        ),
        false,
      );
    }
  },
);
