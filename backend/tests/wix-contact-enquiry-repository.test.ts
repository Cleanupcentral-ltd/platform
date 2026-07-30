import assert from "node:assert/strict";
import test from "node:test";

import {
  WixContactEnquiryRepository,
} from "../src/adapters/wix/repositories/wix-contact-enquiry-repository.js";

import {
  WIX_COLLECTIONS,
} from "../src/adapters/wix/collections.js";

import {
  createWixDataGateway,
} from "./support/create-wix-data-gateway.js";

const wixItem = {
  id: "contact-1",
  data: {
    enquiryNumber:
      "CUC-E-111111111111",
    submissionId:
      "11111111-1111-4111-8111-111111111111",
    customer: null,
    property: null,
    convertedQuote: null,
    status: "New",
    fullName: "Test Customer",
    email: "customer@example.com",
    emailNormalized:
      "customer@example.com",
    phone: "07123 456789",
    phoneNormalized:
      "447123456789",
    enquiryType:
      "Cleaning Services",
    preferredContactMethod:
      "Email",
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
  },
};

test(
  "queries contact enquiries by submission ID",
  async () => {
    let capturedCollection = "";
    let capturedQuery: unknown;

    const gateway =
      createWixDataGateway({
        async queryDataItems(
          collectionId,
          query,
        ) {
          capturedCollection =
            collectionId;
          capturedQuery = query;

          return {
            dataItems: [wixItem],
            pagingMetadata: {
              count: 1,
              offset: 0,
              total: 1,
            },
          };
        },
      });

    const repository =
      new WixContactEnquiryRepository(
        gateway,
      );

    const result =
      await repository
        .findBySubmissionId(
          "11111111-1111-4111-8111-111111111111",
        );

    assert.equal(
      capturedCollection,
      WIX_COLLECTIONS
        .contactEnquiries,
    );

    assert.deepEqual(
      capturedQuery,
      {
        filter: {
          submissionId: {
            $eq:
              "11111111-1111-4111-8111-111111111111",
          },
        },
        paging: {
          limit: 2,
          offset: 0,
        },
      },
    );

    assert.equal(
      result?.enquiryNumber,
      "CUC-E-111111111111",
    );
  },
);

test(
  "creates a contact enquiry using audited Wix field IDs",
  async () => {
    let capturedData: Readonly<
      Record<string, unknown>
    > = {};
    let capturedItemId:
      string | undefined;

    const gateway =
      createWixDataGateway({
        async insertDataItem(
          _collectionId,
          data,
          itemId,
        ) {
          capturedData = data;
          capturedItemId = itemId;

          return {
            dataItem: wixItem,
          };
        },
      });

    const repository =
      new WixContactEnquiryRepository(
        gateway,
      );

    await repository.create(
      {
        enquiryNumber:
          "CUC-E-111111111111",
        submissionId:
          "11111111-1111-4111-8111-111111111111",
        customerId: null,
        propertyId: null,
        convertedQuoteId: null,
        status: "New",
        fullName: "Test Customer",
        email:
          "customer@example.com",
        emailNormalized:
          "customer@example.com",
        phone: "07123 456789",
        phoneNormalized:
          "447123456789",
        enquiryType:
          "Cleaning Services",
        preferredContactMethod:
          "Email",
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
      },
      {
        itemId: "contact-1",
      },
    );

    assert.equal(
      capturedItemId,
      "contact-1",
    );
    assert.equal(
      capturedData["submissionId"],
      "11111111-1111-4111-8111-111111111111",
    );
    assert.equal(
      capturedData["status"],
      "New",
    );
  },
);

test(
  "maps an email-only enquiry with empty phone fields",
  async () => {
    const gateway =
      createWixDataGateway({
        async queryDataItems() {
          return {
            dataItems: [
              {
                ...wixItem,
                data: {
                  ...wixItem.data,
                  phone: "",
                  phoneNormalized: "",
                },
              },
            ],
          };
        },
      });

    const repository =
      new WixContactEnquiryRepository(
        gateway,
      );

    const result =
      await repository
        .findBySubmissionId(
          "11111111-1111-4111-8111-111111111111",
        );

    assert.equal(result?.phone, "");
    assert.equal(
      result?.phoneNormalized,
      "",
    );
  },
);
