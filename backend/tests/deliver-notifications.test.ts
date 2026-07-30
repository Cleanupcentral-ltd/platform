import assert from "node:assert/strict";
import test from "node:test";

import {
  createSubmissionNotificationService,
} from "../src/application/deliver-notifications.js";

import type {
  CreatedContactEnquirySubmission,
  PersistedContactEnquirySubmission,
} from "../src/application/persist-contact-enquiry.js";

import type {
  CreatedQuoteSubmission,
  PersistedQuoteSubmission,
} from "../src/application/persist-quote.js";

import type {
  NotificationBranding,
} from "../src/application/notifications.js";

import type {
  NotificationDelivery,
  NotificationDeliveryReceipt,
  NotificationDeliveryRecord,
  NotificationDeliveryRecorder,
  NotificationDraft,
} from "../src/ports/notifications.js";

const branding:
  NotificationBranding = {
    businessName:
      "Clean Up Central",

    customerReplyTo: {
      email:
        "support@example.com",

      name:
        "Clean Up Central",
    },

    internalRecipients: [
      {
        email:
          "operations@example.com",

        name:
          "Operations",
      },
    ],
  };

function createdQuote():
  CreatedQuoteSubmission {
  return {
    outcome: "created",

    customer: {
      id: "customer-1",
      fullName: "Test Customer",
      companyName: null,
      email:
        "customer@example.com",
      emailNormalized:
        "customer@example.com",
      phone: "07123 456789",
      phoneNormalized:
        "447123456789",
      declaredCustomerType:
        "New customer",
      verificationStatus:
        "Verified New",
      isExistingCustomer: false,
      firstEligibleCleanCompleted:
        false,
      privacyConsent: true,
      marketingConsent: false,
      internalNotes: null,
    },

    property: {
      id: "property-1",
      customerId: "customer-1",
      propertyLabel:
        "14 Example Avenue",
      address:
        "14 Example Avenue, London",
      postcode: "NW1 1HN",
      postcodeNormalized:
        "NW11HN",
      propertyType: "House",
      bedroomCount: 2,
      bathroomCount: 1,
      occupancyStatus:
        "Occupied",
      parkingDetails: null,
      petsDetails: null,
      accessArrangements: null,
      verifiedProperty: false,
      activeProperty: true,
    },

    quote: {
      id: "quote-1",
      submissionId:
        "11111111-1111-4111-8111-111111111111",
      quoteNumber:
        "CUC-Q-111111111111",
      customerId: "customer-1",
      propertyId: "property-1",
      schemaVersion: "1.0",
      pricingVersion:
        "CUC Phase 0 v1.3",
      status: "Submitted",
      category:
        "Residential Cleaning",
      serviceType:
        "Standard Clean",
      cleaningScope:
        "Whole Property",
      declaredCustomerType:
        "New customer",
      verifiedCustomerStatus:
        "Verified New",
      customerStatusMismatch:
        false,
      preferredContactMethod:
        "Email",
      preferredDate:
        "2026-08-15",
      arrivalWindow:
        "08:00–11:00",
      preferredStartDate: null,
      requiredCompletionDate: null,
      sameDay: false,
      arrangement: null,
      frequency: null,
      urgency: null,
      supportServices: [],
      manualReviewRequired: false,
      manualReviewReasons: [],
      estimatedTotal: 93.5,
      requiredUpfrontPercentage:
        30,
      requiredUpfrontAmount:
        28.05,
      remainingBalance: 65.45,
      travelFee: 0,
      travelPending: false,
      distanceMiles: 5,
      provisional: false,
      customerNotes: null,
      rawSubmission: {},
      pricingSnapshot: {},
    },

    quoteItems: [],

    statusHistory: {
      id: "history-1",
      historyLabel:
        "CUC-Q-111111111111 - Submitted",
      quoteId: "quote-1",
      contactEnquiryId: null,
      recordType: "Quote",
      previousStatus: null,
      newStatus: "Submitted",
      changeSource: "Website",
      actorType: "Customer",
      actorId: "customer-1",
      actorName: "Test Customer",
      changeReason:
        "Quote submitted through the website.",
      customerVisible: true,
      notes: null,
      metadata: null,
    },

    createdCustomer: true,
    createdProperty: true,
  };
}

function createdContact():
  CreatedContactEnquirySubmission {
  return {
    outcome: "created",

    enquiry: {
      id: "contact-1",
      enquiryNumber:
        "CUC-E-222222222222",
      submissionId:
        "22222222-2222-4222-8222-222222222222",
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
        "Property Support",
      preferredContactMethod:
        "WhatsApp",
      message:
        "Please contact me about property inspections.",
      hasAttachments: false,
      attachmentCount: 0,
      submissionSource:
        "Website Contact Form",
      reviewedAt: null,
      respondedAt: null,
      internalNotes: null,
    },
  };
}

class FakeDelivery
  implements NotificationDelivery
{
  readonly drafts:
    NotificationDraft[] = [];

  constructor(
    private readonly failTemplate:
      string | null = null,
  ) {}

  async send(
    draft: NotificationDraft,
  ): Promise<NotificationDeliveryReceipt> {
    this.drafts.push(draft);

    if (
      draft.templateId ===
      this.failTemplate
    ) {
      const error =
        new Error(
          "Provider failure",
        ) as Error & {
          code: string;
        };

      error.code =
        "RESEND_TEST_FAILURE";

      throw error;
    }

    return {
      providerMessageId:
        `provider-${draft.templateId}`,

      acceptedAt:
        "2026-07-30T10:00:00.000Z",
    };
  }
}

class FakeRecorder
  implements NotificationDeliveryRecorder
{
  readonly records:
    NotificationDeliveryRecord[] = [];

  constructor(
    private readonly shouldFail =
      false,
  ) {}

  async record(
    record:
      NotificationDeliveryRecord,
  ): Promise<void> {
    if (this.shouldFail) {
      throw new Error(
        "Recorder failure",
      );
    }

    this.records.push(record);
  }
}

test(
  "delivers and records customer and internal quote notifications",
  async () => {
    const delivery =
      new FakeDelivery();

    const recorder =
      new FakeRecorder();

    const service =
      createSubmissionNotificationService({
        branding,
        delivery,
        recorder,
      });

    const report =
      await service.notifyQuote(
        createdQuote(),
      );

    assert.deepEqual(
      {
        attempted:
          report.attempted,

        sent: report.sent,
        failed: report.failed,
      },
      {
        attempted: 2,
        sent: 2,
        failed: 0,
      },
    );

    assert.equal(
      delivery.drafts.length,
      2,
    );

    assert.equal(
      recorder.records.length,
      2,
    );

    assert.deepEqual(
      recorder.records.map(
        ({
          recordType,
          recordId,
          status,
        }) => ({
          recordType,
          recordId,
          status,
        }),
      ),
      [
        {
          recordType: "Quote",
          recordId: "quote-1",
          status: "Sent",
        },
        {
          recordType: "Quote",
          recordId: "quote-1",
          status: "Sent",
        },
      ],
    );
  },
);

test(
  "does not send quote notifications for an identical replay",
  async () => {
    const delivery =
      new FakeDelivery();

    const recorder =
      new FakeRecorder();

    const service =
      createSubmissionNotificationService({
        branding,
        delivery,
        recorder,
      });

    const created =
      createdQuote();

    const replay:
      PersistedQuoteSubmission = {
        outcome: "replayed",
        quote: created.quote,
      };

    const report =
      await service.notifyQuote(
        replay,
      );

    assert.equal(
      report.attempted,
      0,
    );

    assert.equal(
      delivery.drafts.length,
      0,
    );

    assert.equal(
      recorder.records.length,
      0,
    );
  },
);

test(
  "records a failed delivery without rejecting the stored quote",
  async () => {
    const delivery =
      new FakeDelivery(
        "quote-received-internal",
      );

    const recorder =
      new FakeRecorder();

    const service =
      createSubmissionNotificationService({
        branding,
        delivery,
        recorder,
      });

    const report =
      await service.notifyQuote(
        createdQuote(),
      );

    assert.deepEqual(
      {
        attempted:
          report.attempted,

        sent: report.sent,
        failed: report.failed,
      },
      {
        attempted: 2,
        sent: 1,
        failed: 1,
      },
    );

    assert.equal(
      recorder.records[1]
        ?.status,
      "Failed",
    );

    assert.equal(
      recorder.records[1]
        ?.errorCode,
      "RESEND_TEST_FAILURE",
    );
  },
);

test(
  "does not fail a successful send when delivery recording fails",
  async () => {
    const service =
      createSubmissionNotificationService({
        branding,

        delivery:
          new FakeDelivery(),

        recorder:
          new FakeRecorder(true),
      });

    const report =
      await service.notifyQuote(
        createdQuote(),
      );

    assert.equal(report.sent, 2);

    assert.deepEqual(
      report.items.map(
        ({
          deliveryRecorded,
        }) =>
          deliveryRecorded,
      ),
      [false, false],
    );
  },
);

test(
  "delivers and records customer and internal contact notifications",
  async () => {
    const delivery =
      new FakeDelivery();

    const recorder =
      new FakeRecorder();

    const service =
      createSubmissionNotificationService({
        branding,
        delivery,
        recorder,
      });

    const report =
      await service
        .notifyContactEnquiry(
          createdContact(),
        );

    assert.equal(
      report.attempted,
      2,
    );

    assert.equal(
      report.sent,
      2,
    );

    assert.deepEqual(
      recorder.records.map(
        ({ recordType }) =>
          recordType,
      ),
      [
        "Contact Enquiry",
        "Contact Enquiry",
      ],
    );

    assert.deepEqual(
      recorder.records.map(
        ({ recordId }) =>
          recordId,
      ),
      [
        "contact-1",
        "contact-1",
      ],
    );
  },
);

test(
  "does not notify for a suppressed contact enquiry",
  async () => {
    const delivery =
      new FakeDelivery();

    const recorder =
      new FakeRecorder();

    const service =
      createSubmissionNotificationService({
        branding,
        delivery,
        recorder,
      });

    const suppressed:
      PersistedContactEnquirySubmission = {
        outcome: "suppressed",

        enquiryNumber:
          "CUC-E-SUPPRESSED",

        preferredContactMethod:
          "Email",
      };

    const report =
      await service
        .notifyContactEnquiry(
          suppressed,
        );

    assert.equal(
      report.attempted,
      0,
    );

    assert.equal(
      delivery.drafts.length,
      0,
    );

    assert.equal(
      recorder.records.length,
      0,
    );
  },
);
