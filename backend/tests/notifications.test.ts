import assert from "node:assert/strict";
import test from "node:test";

import {
  createContactEnquiryNotificationPlan,
  createQuoteNotificationPlan,
  type NotificationBranding,
} from "../src/application/notifications.js";

import type {
  ContactEnquiryNotificationSource,
  QuoteNotificationSource,
} from "../src/application/notifications.js";

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

function createdQuote(
  overrides: {
    readonly estimatedTotal?:
      number | null;
    readonly provisional?: boolean;
    readonly manualReviewRequired?:
      boolean;
    readonly customerName?: string;
    readonly customerNotes?:
      string | null;
  } = {},
): Extract<
  QuoteNotificationSource,
  { readonly outcome: "created" }
> {
  const estimatedTotal =
    overrides.estimatedTotal ===
      undefined
      ? 93.5
      : overrides.estimatedTotal;

  const provisional =
    overrides.provisional ?? false;

  const manualReviewRequired =
    overrides.manualReviewRequired ??
    false;

  const customerName =
    overrides.customerName ??
    "Test Customer";

  return {
    outcome: "created",

    customer: {
      id: "customer-record-id",
      fullName: customerName,
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
      id: "property-record-id",
      customerId:
        "customer-record-id",
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
      id: "quote-record-id",
      submissionId:
        "11111111-1111-4111-8111-111111111111",
      quoteNumber:
        "CUC-Q-111111111111",
      customerId:
        "customer-record-id",
      propertyId:
        "property-record-id",
      schemaVersion: "1.0",
      pricingVersion:
        "CUC Phase 0 v1.3",
      status:
        manualReviewRequired
          ? "In Review"
          : "Submitted",
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
      manualReviewRequired,
      manualReviewReasons:
        manualReviewRequired
          ? ["INTERNAL_REVIEW_CODE"]
          : [],
      estimatedTotal,
      requiredUpfrontPercentage:
        estimatedTotal === null
          ? null
          : 30,
      requiredUpfrontAmount:
        estimatedTotal === null
          ? null
          : 28.05,
      remainingBalance:
        estimatedTotal === null
          ? null
          : 65.45,
      travelFee: 0,
      travelPending: false,
      distanceMiles: 5,
      provisional,
      customerNotes:
        overrides.customerNotes ??
        "Please call before arrival.",
      rawSubmission: {
        privateField:
          "must-not-appear",
      },
      pricingSnapshot: {
        internalPricingRule:
          "must-not-appear",
      },
    },

  };
}

function createdContact(
  overrides: {
    readonly fullName?: string;
    readonly message?: string;
  } = {},
): Extract<
  ContactEnquiryNotificationSource,
  { readonly outcome: "created" }
> {
  return {
    outcome: "created",

    enquiry: {
      id: "contact-record-id",
      enquiryNumber:
        "CUC-E-222222222222",
      submissionId:
        "22222222-2222-4222-8222-222222222222",
      customerId: null,
      propertyId: null,
      convertedQuoteId: null,
      status: "New",
      fullName:
        overrides.fullName ??
        "Test Customer",
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
        overrides.message ??
        "Please contact me about regular property inspections.",
      hasAttachments: false,
      attachmentCount: 0,
      submissionSource:
        "Website Contact Form",
      reviewedAt: null,
      respondedAt: null,
      internalNotes:
        "Private internal note.",
    },
  };
}

test(
  "creates separate customer and internal quote drafts only after a new quote is stored",
  () => {
    const plan =
      createQuoteNotificationPlan(
        createdQuote(),
        branding,
      );

    assert.ok(plan.customer);
    assert.ok(plan.internal);

    assert.equal(
      plan.customer.templateId,
      "quote-received-customer",
    );

    assert.equal(
      plan.internal.templateId,
      "quote-received-internal",
    );

    assert.deepEqual(
      plan.customer.to,
      [
        {
          email:
            "customer@example.com",
          name: "Test Customer",
        },
      ],
    );

    assert.deepEqual(
      plan.internal.to,
      branding.internalRecipients,
    );
  },
);

test(
  "keeps internal quote data out of the customer confirmation",
  () => {
    const plan =
      createQuoteNotificationPlan(
        createdQuote({
          manualReviewRequired: true,
        }),
        branding,
      );

    assert.ok(plan.customer);
    assert.ok(plan.internal);

    for (const privateValue of [
      "quote-record-id",
      "customer-record-id",
      "property-record-id",
      "INTERNAL_REVIEW_CODE",
      "must-not-appear",
      "14 Example Avenue",
      "07123 456789",
    ]) {
      assert.equal(
        plan.customer.text.includes(
          privateValue,
        ),
        false,
      );

      assert.equal(
        plan.customer.html.includes(
          privateValue,
        ),
        false,
      );
    }

    assert.match(
      plan.customer.text,
      /Status: Under review/,
    );

    assert.match(
      plan.internal.text,
      /14 Example Avenue, London/,
    );
  },
);

test(
  "uses tailored-quote wording when no instant estimate exists",
  () => {
    const plan =
      createQuoteNotificationPlan(
        createdQuote({
          estimatedTotal: null,
          manualReviewRequired: true,
        }),
        branding,
      );

    assert.ok(plan.customer);

    assert.match(
      plan.customer.text,
      /prepare a tailored quote/,
    );

    assert.equal(
      plan.customer.text.includes("£"),
      false,
    );
  },
);

test(
  "marks provisional quote totals clearly",
  () => {
    const plan =
      createQuoteNotificationPlan(
        createdQuote({
          provisional: true,
        }),
        branding,
      );

    assert.ok(plan.customer);

    assert.match(
      plan.customer.text,
      /subject to review/,
    );
  },
);

test(
  "does not plan quote notifications for a replay",
  () => {
    const created = createdQuote();

    const replay:
      QuoteNotificationSource = {
        outcome: "replayed",
        quote: created.quote,
      };

    assert.deepEqual(
      createQuoteNotificationPlan(
        replay,
        branding,
      ),
      {
        customer: null,
        internal: null,
      },
    );
  },
);

test(
  "creates customer and internal contact-enquiry drafts after storage",
  () => {
    const plan =
      createContactEnquiryNotificationPlan(
        createdContact(),
        branding,
      );

    assert.ok(plan.customer);
    assert.ok(plan.internal);

    assert.equal(
      plan.customer.referenceNumber,
      "CUC-E-222222222222",
    );

    assert.match(
      plan.customer.text,
      /Preferred contact: WhatsApp/,
    );

    assert.equal(
      plan.customer.text.includes(
        "regular property inspections",
      ),
      false,
    );

    assert.match(
      plan.internal.text,
      /regular property inspections/,
    );
  },
);

test(
  "does not notify for replayed or suppressed contact enquiries",
  () => {
    const created = createdContact();

    const replay:
      ContactEnquiryNotificationSource = {
        outcome: "replayed",
        enquiry: created.enquiry,
      };

    const suppressed:
      ContactEnquiryNotificationSource = {
        outcome: "suppressed",
        enquiryNumber:
          "CUC-E-SUPPRESSED",
      };

    for (const result of [
      replay,
      suppressed,
    ]) {
      assert.deepEqual(
        createContactEnquiryNotificationPlan(
          result,
          branding,
        ),
        {
          customer: null,
          internal: null,
        },
      );
    }
  },
);

test(
  "escapes customer-controlled text in HTML notifications",
  () => {
    const unsafeName =
      '<img src=x onerror="alert(1)">';

    const unsafeMessage =
      "<script>alert('x')</script>";

    const quotePlan =
      createQuoteNotificationPlan(
        createdQuote({
          customerName: unsafeName,
          customerNotes:
            unsafeMessage,
        }),
        branding,
      );

    const contactPlan =
      createContactEnquiryNotificationPlan(
        createdContact({
          fullName: unsafeName,
          message: unsafeMessage,
        }),
        branding,
      );

    assert.ok(quotePlan.customer);
    assert.ok(quotePlan.internal);
    assert.ok(contactPlan.customer);
    assert.ok(contactPlan.internal);

    for (const draft of [
      quotePlan.customer,
      quotePlan.internal,
      contactPlan.customer,
      contactPlan.internal,
    ]) {
      assert.equal(
        draft.html.includes("<script>"),
        false,
      );

      assert.equal(
        draft.html.includes("<img src=x"),
        false,
      );
    }

    assert.match(
      contactPlan.internal.html,
      /&lt;script&gt;/,
    );
  },
);

test(
  "creates stable and distinct notification idempotency keys",
  () => {
    const quotePlan =
      createQuoteNotificationPlan(
        createdQuote(),
        branding,
      );

    const contactPlan =
      createContactEnquiryNotificationPlan(
        createdContact(),
        branding,
      );

    assert.ok(quotePlan.customer);
    assert.ok(quotePlan.internal);
    assert.ok(contactPlan.customer);
    assert.ok(contactPlan.internal);

    const keys = new Set([
      quotePlan.customer
        .idempotencyKey,
      quotePlan.internal
        .idempotencyKey,
      contactPlan.customer
        .idempotencyKey,
      contactPlan.internal
        .idempotencyKey,
    ]);

    assert.equal(keys.size, 4);
  },
);

test(
  "still plans a customer confirmation when internal recipients are not configured",
  () => {
    const plan =
      createQuoteNotificationPlan(
        createdQuote(),
        {
          ...branding,
          internalRecipients: [],
        },
      );

    assert.ok(plan.customer);
    assert.equal(plan.internal, null);
  },
);
