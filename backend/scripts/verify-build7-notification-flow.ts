import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  WIX_COLLECTIONS,
  WIX_FIELDS,
  type WixCollectionId,
} from "../src/adapters/wix/collections.js";

import {
  createWixContactEnquiryRepository,
} from "../src/adapters/wix/create-wix-contact-enquiry-repository.js";

import {
  createWixQuoteRepositoriesFromGateway,
} from "../src/adapters/wix/create-wix-repositories.js";

import {
  WixApiClient,
} from "../src/adapters/wix/wix-api-client.js";

import {
  loadWixConfig,
} from "../src/adapters/wix/wix-config.js";

import {
  WixDataClient,
} from "../src/adapters/wix/wix-data-client.js";

import type {
  WixDataItem,
} from "../src/adapters/wix/wix-data-types.js";

import {
  buildApp,
} from "../src/app.js";

import type {
  SubmitContactEnquiryRequest,
} from "../src/application/validation/contact-enquiry.js";

import type {
  SubmitQuoteRequest,
} from "../src/application/validation/submit-quote.js";

import {
  normalizeEmail,
} from "../src/domain/normalization.js";

import type {
  ContactEnquiryRecord,
  QuoteRecord,
} from "../src/domain/models.js";

interface PublicSuccessResponse {
  readonly success: true;
  readonly replayed: boolean;
}

interface PublicErrorResponse {
  readonly success: false;
  readonly error: {
    readonly code: string;
  };
}

interface ResendEmail {
  readonly id?: unknown;
  readonly from?: unknown;
  readonly to?: unknown;
  readonly subject?: unknown;
  readonly last_event?: unknown;
}

interface NotificationEvidence {
  readonly historyId: string;
  readonly recordType:
    | "Quote"
    | "Contact Enquiry";
  readonly audience:
    | "Customer"
    | "Internal";
  readonly templateId: string;
  readonly providerMessageId: string;
}

interface CleanupState {
  quote: QuoteRecord | null;
  enquiry: ContactEnquiryRecord | null;
}

const ACCEPTABLE_EMAIL_EVENTS =
  new Set([
    "sent",
    "delivered",
    "opened",
    "clicked",
    "delivery_delayed",
  ]);

const FAILED_EMAIL_EVENTS =
  new Set([
    "bounced",
    "complained",
    "canceled",
    "failed",
    "suppressed",
  ]);

function requiredEnvironment(
  name: string,
): string {
  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `${name} must be configured in backend/.env before Build 7C verification.`,
    );
  }

  return value;
}

function notificationVerificationEmail():
  string {
  const value =
    requiredEnvironment(
      "NOTIFICATION_VERIFICATION_EMAIL",
    );

  assert.match(
    value,
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    "NOTIFICATION_VERIFICATION_EMAIL must be a valid dedicated test inbox.",
  );

  return value.toLowerCase();
}

function internalRecipients():
  readonly string[] {
  const values =
    requiredEnvironment(
      "INTERNAL_NOTIFICATION_EMAILS",
    )
      .split(",")
      .map(
        (value) =>
          value.trim().toLowerCase(),
      )
      .filter(Boolean);

  assert.ok(
    values.length > 0,
    "At least one internal notification recipient is required.",
  );

  return [
    ...new Set(values),
  ];
}

function londonDateAfterDays(
  days: number,
): string {
  const date = new Date(
    Date.now() +
      days * 24 * 60 * 60 * 1_000,
  );

  const parts =
    Object.fromEntries(
      new Intl.DateTimeFormat(
        "en-GB",
        {
          timeZone:
            "Europe/London",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        },
      )
        .formatToParts(date)
        .filter(
          ({ type }) =>
            type !== "literal",
        )
        .map(
          ({ type, value }) => [
            type,
            value,
          ],
        ),
    );

  const year = parts["year"];
  const month = parts["month"];
  const day = parts["day"];

  assert.ok(year);
  assert.ok(month);
  assert.ok(day);

  return `${year}-${month}-${day}`;
}

function verificationPhone(
  token: string,
): string {
  const digits = token
    .split("")
    .map(
      (character) =>
        Number.parseInt(
          character,
          16,
        ) % 10,
    )
    .join("")
    .slice(0, 8)
    .padEnd(8, "0");

  return `070${digits}`;
}

function createQuoteSubmission(
  submissionId: string,
  token: string,
  email: string,
): SubmitQuoteRequest {
  return {
    submissionId,
    schemaVersion: "1.0",

    customer: {
      fullName:
        "Build 7C Verification",
      companyName: "",
      email,
      phone:
        verificationPhone(token),

      declaredCustomerType:
        "New customer",

      preferredContactMethod:
        "Email",

      privacyConsent: true,
      marketingConsent: false,
    },

    property: {
      propertyType: "House",

      address:
        `14 Example Avenue, Verification ${token}, London`,

      postcode: "NW1 1HN",
      bedrooms: 2,
      bathrooms: 1,
      propertyCount: 1,
      propertyStatus: "Vacant",
      parkingDetails: "",
      petsDetails: "",
      accessArrangements: "",
    },

    appointment: {
      preferredDate:
        londonDateAfterDays(30),

      arrivalWindow:
        "08:00–11:00",

      preferredStartDate: "",
      requiredCompletionDate: "",
      sameDay: false,
    },

    service: {
      category:
        "Residential Cleaning",

      serviceType:
        "Standard Clean",

      cleaningScope:
        "Whole Property",

      rooms: {
        Bathroom: 0,
        Bedroom: 0,
        Kitchen: 0,
        "Living Room": 0,
        Hallway: 0,
        Stairs: 0,
      },

      extras: {
        Oven: 0,
        Fridge: 0,
        "Interior Windows": 0,
        "Grout Cleaning": 0,
        Laundry: 0,

        "Standard Consumables Package":
          0,
      },

      currentCondition: "",
      requirements: "",
    },

    safetyWarnings: "",

    additionalNotes:
      "Temporary controlled Build 7C notification verification.",

    attachmentCount: 0,
  };
}

function createContactSubmission(
  submissionId: string,
  email: string,
): SubmitContactEnquiryRequest {
  return {
    submissionId,
    schemaVersion: "1.0",

    fullName:
      "Build 7C Verification",

    email,
    phone: "",

    enquiryType:
      "Cleaning Services",

    preferredContactMethod:
      "Email",

    message:
      "Temporary controlled Build 7C notification verification.",

    privacyConsent: true,
    website: "",
    attachmentCount: 0,
  };
}

function uniqueIds(
  values:
    readonly (string | null | undefined)[],
): string[] {
  return [
    ...new Set(
      values.filter(
        (value): value is string =>
          typeof value === "string" &&
          value.length > 0,
      ),
    ),
  ];
}

async function queryItems(
  dataClient: WixDataClient,
  collectionId: WixCollectionId,
  fieldId: string,
  value: string,
): Promise<readonly WixDataItem[]> {
  const response =
    await dataClient.queryDataItems(
      collectionId,
      {
        filter: {
          [fieldId]: {
            $eq: value,
          },
        },

        paging: {
          limit: 100,
          offset: 0,
        },
      },
      {
        consistentRead: true,
      },
    );

  return response.dataItems;
}

async function removeRecords(
  dataClient: WixDataClient,
  collectionId: WixCollectionId,
  itemIds: readonly string[],
): Promise<void> {
  const ids = uniqueIds(itemIds);

  if (ids.length === 0) {
    return;
  }

  const response =
    await dataClient.bulkRemoveDataItems(
      collectionId,
      ids,
    );

  const failures =
    response.results.filter(
      ({ itemMetadata }) =>
        itemMetadata.success ===
          false ||
        itemMetadata.error !==
          undefined,
    );

  const totalFailures =
    response.bulkActionMetadata
      ?.totalFailures ?? 0;

  const totalSuccesses =
    response.bulkActionMetadata
      ?.totalSuccesses;

  const confirmedByResults =
    response.results.length ===
      ids.length &&
    failures.length === 0;

  const confirmedByMetadata =
    totalSuccesses === ids.length &&
    totalFailures === 0;

  if (
    totalFailures > 0 ||
    failures.length > 0 ||
    (
      !confirmedByResults &&
      !confirmedByMetadata
    )
  ) {
    throw new Error(
      `Cleanup could not be confirmed for ${collectionId}.`,
    );
  }
}

function metadataRecord(
  item: WixDataItem,
): Readonly<
  Record<string, unknown>
> {
  const value =
    item.data[
      WIX_FIELDS.statusHistory
        .metadata
    ];

  assert.equal(
    typeof value,
    "object",
  );
  assert.notEqual(value, null);
  assert.equal(
    Array.isArray(value),
    false,
  );

  return value as
    Readonly<
      Record<string, unknown>
    >;
}

function notificationEvidence(
  items: readonly WixDataItem[],
): readonly NotificationEvidence[] {
  return items
    .filter(
      (item) =>
        item.data[
          WIX_FIELDS.statusHistory
            .changeSource
        ] ===
          "Notification Service",
    )
    .map(
      (item) => {
        assert.equal(
          item.data[
            WIX_FIELDS.statusHistory
              .newStatus
          ],
          "Email Sent",
        );

        const metadata =
          metadataRecord(item);

        const audienceValue =
          metadata["audience"];

        const templateIdValue =
          metadata["templateId"];

        const providerMessageIdValue =
          metadata[
            "providerMessageId"
          ];

        if (
          audienceValue !== "Customer" &&
          audienceValue !== "Internal"
        ) {
          throw new Error(
            "Notification evidence audience must be Customer or Internal.",
          );
        }

        const audience:
          NotificationEvidence[
            "audience"
          ] = audienceValue;

        if (
          typeof templateIdValue !==
          "string"
        ) {
          throw new Error(
            "Notification evidence templateId must be a string.",
          );
        }

        if (
          typeof providerMessageIdValue !==
          "string"
        ) {
          throw new Error(
            "Notification evidence providerMessageId must be a string.",
          );
        }

        const templateId =
          templateIdValue;

        const providerMessageId =
          providerMessageIdValue;

        assert.ok(
          providerMessageId.length > 0,
        );

        const recordTypeValue =
          item.data[
            WIX_FIELDS.statusHistory
              .recordType
          ];

        if (
          recordTypeValue !== "Quote" &&
          recordTypeValue !==
            "Contact Enquiry"
        ) {
          throw new Error(
            "Notification evidence recordType must be Quote or Contact Enquiry.",
          );
        }

        const recordType:
          NotificationEvidence[
            "recordType"
          ] = recordTypeValue;

        return {
          historyId: item.id,
          recordType,
          audience,
          templateId,
          providerMessageId,
        };
      },
    )
    .sort(
      (left, right) =>
        left.templateId.localeCompare(
          right.templateId,
        ),
    );
}

async function queryNotificationEvidence(
  dataClient: WixDataClient,
  state: CleanupState,
): Promise<{
  readonly quote:
    readonly NotificationEvidence[];
  readonly contact:
    readonly NotificationEvidence[];
}> {
  assert.ok(state.quote);
  assert.ok(state.enquiry);

  const quoteHistory =
    await queryItems(
      dataClient,
      WIX_COLLECTIONS.statusHistory,
      WIX_FIELDS.statusHistory.quote,
      state.quote.id,
    );

  const contactHistory =
    await queryItems(
      dataClient,
      WIX_COLLECTIONS.statusHistory,
      WIX_FIELDS.statusHistory
        .contactEnquiry,
      state.enquiry.id,
    );

  return {
    quote:
      notificationEvidence(
        quoteHistory,
      ),

    contact:
      notificationEvidence(
        contactHistory,
      ),
  };
}

function stringArray(
  value: unknown,
): readonly string[] {
  assert.ok(Array.isArray(value));

  for (const item of value) {
    assert.equal(
      typeof item,
      "string",
    );
  }

  return value as
    readonly string[];
}

async function retrieveResendEmail(
  messageId: string,
): Promise<ResendEmail> {
  const apiKey =
    requiredEnvironment(
      "RESEND_API_KEY",
    );

  const baseUrl = (
    process.env[
      "RESEND_API_BASE_URL"
    ]?.trim() ||
    "https://api.resend.com"
  ).replace(/\/+$/, "");

  const response =
    await fetch(
      `${baseUrl}/emails/${encodeURIComponent(
        messageId,
      )}`,
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${apiKey}`,
        },
      },
    );

  const body =
    await response
      .json()
      .catch(() => null);

  if (!response.ok) {
    throw new Error(
      `Resend could not retrieve verification message ${messageId} (HTTP ${response.status}).`,
    );
  }

  assert.equal(
    typeof body,
    "object",
  );

  assert.notEqual(body, null);

  return body as ResendEmail;
}

async function waitForResendEmail(
  evidence:
    NotificationEvidence,
): Promise<ResendEmail> {
  const deadline =
    Date.now() + 30_000;

  let latest:
    ResendEmail | null = null;

  while (Date.now() < deadline) {
    latest =
      await retrieveResendEmail(
        evidence.providerMessageId,
      );

    const event =
      typeof latest.last_event ===
        "string"
        ? latest.last_event
            .toLowerCase()
        : "";

    if (
      FAILED_EMAIL_EVENTS.has(
        event,
      )
    ) {
      throw new Error(
        `Resend reported a failed event for ${evidence.templateId}: ${event}.`,
      );
    }

    if (
      ACCEPTABLE_EMAIL_EVENTS.has(
        event,
      )
    ) {
      return latest;
    }

    await new Promise<void>(
      (resolve) => {
        setTimeout(resolve, 750);
      },
    );
  }

  throw new Error(
    `Resend did not reach a verifiable sent state for ${evidence.templateId}. Last response: ${JSON.stringify(
      latest,
    )}`,
  );
}

function assertProviderMessage(
  evidence:
    NotificationEvidence,
  message:
    ResendEmail,
  expectedReference: string,
  verificationEmail: string,
  internalEmails:
    readonly string[],
): void {
  assert.equal(
    message.id,
    evidence.providerMessageId,
  );

  const from =
    typeof message.from ===
      "string"
      ? message.from.toLowerCase()
      : "";

  const configuredFrom =
    requiredEnvironment(
      "NOTIFICATION_FROM_EMAIL",
    ).toLowerCase();

  assert.ok(
    from.includes(configuredFrom),
    "The provider message did not use the configured sender.",
  );

  const recipients =
    stringArray(
      message.to,
    ).map(
      (value) =>
        value.toLowerCase(),
    );

  if (
    evidence.audience ===
    "Customer"
  ) {
    assert.deepEqual(
      recipients,
      [verificationEmail],
    );
  } else {
    for (
      const expected of
      internalEmails
    ) {
      assert.ok(
        recipients.includes(
          expected,
        ),
        `Internal notification did not include ${expected}.`,
      );
    }
  }

  if (
    typeof message.subject !==
    "string"
  ) {
    throw new Error(
      "The provider message subject must be a string.",
    );
  }

  const subject =
    message.subject;

  assert.ok(
    subject.includes(
      expectedReference,
    ),
    "The provider subject did not include the public reference number.",
  );
}

async function cleanup(
  dataClient: WixDataClient,
  state: CleanupState,
): Promise<void> {
  if (state.quote !== null) {
    const quoteHistory =
      await queryItems(
        dataClient,
        WIX_COLLECTIONS.statusHistory,
        WIX_FIELDS.statusHistory.quote,
        state.quote.id,
      );

    const quoteItems =
      await queryItems(
        dataClient,
        WIX_COLLECTIONS.quoteItems,
        WIX_FIELDS.quoteItems.quote,
        state.quote.id,
      );

    await removeRecords(
      dataClient,
      WIX_COLLECTIONS.statusHistory,
      quoteHistory.map(
        ({ id }) => id,
      ),
    );

    await removeRecords(
      dataClient,
      WIX_COLLECTIONS.quoteItems,
      quoteItems.map(
        ({ id }) => id,
      ),
    );

    await removeRecords(
      dataClient,
      WIX_COLLECTIONS.quotes,
      [state.quote.id],
    );

    await removeRecords(
      dataClient,
      WIX_COLLECTIONS.properties,
      [state.quote.propertyId],
    );

    await removeRecords(
      dataClient,
      WIX_COLLECTIONS.customers,
      [state.quote.customerId],
    );
  }

  if (state.enquiry !== null) {
    const contactHistory =
      await queryItems(
        dataClient,
        WIX_COLLECTIONS.statusHistory,
        WIX_FIELDS.statusHistory
          .contactEnquiry,
        state.enquiry.id,
      );

    await removeRecords(
      dataClient,
      WIX_COLLECTIONS.statusHistory,
      contactHistory.map(
        ({ id }) => id,
      ),
    );

    await removeRecords(
      dataClient,
      WIX_COLLECTIONS.contactEnquiries,
      [state.enquiry.id],
    );
  }
}

async function assertCleanup(
  dataClient: WixDataClient,
  quoteSubmissionId: string,
  contactSubmissionId: string,
  state: CleanupState,
): Promise<void> {
  if (state.quote !== null) {
    assert.equal(
      await dataClient
        .getDataItem(
          WIX_COLLECTIONS.quotes,
          state.quote.id,
        )
        .then(() => true)
        .catch(() => false),
      false,
    );
  }

  if (state.enquiry !== null) {
    assert.equal(
      await dataClient
        .getDataItem(
          WIX_COLLECTIONS
            .contactEnquiries,
          state.enquiry.id,
        )
        .then(() => true)
        .catch(() => false),
      false,
    );
  }

  const quoteMatches =
    await queryItems(
      dataClient,
      WIX_COLLECTIONS.quotes,
      WIX_FIELDS.quotes
        .submissionId,
      quoteSubmissionId,
    );

  const contactMatches =
    await queryItems(
      dataClient,
      WIX_COLLECTIONS
        .contactEnquiries,
      WIX_FIELDS.contactEnquiries
        .submissionId,
      contactSubmissionId,
    );

  assert.deepEqual(
    quoteMatches,
    [],
  );

  assert.deepEqual(
    contactMatches,
    [],
  );
}

async function verifyBuild7Notifications():
  Promise<void> {
  assert.equal(
    process.env[
      "NOTIFICATIONS_ENABLED"
    ],
    "true",
    "Set NOTIFICATIONS_ENABLED=true in backend/.env for Build 7C verification.",
  );

  const verificationEmail =
    notificationVerificationEmail();

  const internalEmails =
    internalRecipients();

  requiredEnvironment(
    "RESEND_API_KEY",
  );

  requiredEnvironment(
    "NOTIFICATION_FROM_EMAIL",
  );

  requiredEnvironment(
    "CUSTOMER_REPLY_TO_EMAIL",
  );

  const wixConfig =
    loadWixConfig();

  const apiClient =
    new WixApiClient(
      wixConfig,
    );

  const dataClient =
    new WixDataClient(
      apiClient,
    );

  const repositories =
    createWixQuoteRepositoriesFromGateway(
      dataClient,
    );

  const contactRepository =
    createWixContactEnquiryRepository();

  const existingCustomers =
    await repositories.customers
      .findByNormalizedEmail(
        normalizeEmail(
          verificationEmail,
        ),
      );

  assert.equal(
    existingCustomers.length,
    0,
    "NOTIFICATION_VERIFICATION_EMAIL must be a dedicated test inbox that is not already stored as a customer.",
  );

  const quoteSubmissionId =
    randomUUID();

  const contactSubmissionId =
    randomUUID();

  const token =
    quoteSubmissionId
      .replaceAll("-", "")
      .slice(0, 12);

  const quoteSubmission =
    createQuoteSubmission(
      quoteSubmissionId,
      token,
      verificationEmail,
    );

  const contactSubmission =
    createContactSubmission(
      contactSubmissionId,
      verificationEmail,
    );

  const state: CleanupState = {
    quote: null,
    enquiry: null,
  };

  const app =
    await buildApp();

  let verificationError:
    unknown = null;

  let closeError:
    unknown = null;

  let cleanupError:
    unknown = null;

  console.log(
    "Running controlled live Build 7 notification verification...",
  );

  console.log(
    "Four transactional emails will be sent: quote customer, quote internal, enquiry customer and enquiry internal.",
  );

  console.log(
    "Temporary Wix records will be removed automatically. Provider email logs remain in Resend.",
  );

  try {
    const quoteResponse =
      await app.inject({
        method: "POST",
        url: "/api/quotes",

        headers: {
          "content-type":
            "application/json",
        },

        payload: {
          submissionId:
            quoteSubmissionId,

          payload:
            quoteSubmission,
        },
      });

    assert.equal(
      quoteResponse.statusCode,
      201,
    );

    const quoteBody =
      quoteResponse.json<
        PublicSuccessResponse
      >();

    assert.equal(
      quoteBody.success,
      true,
    );

    assert.equal(
      quoteBody.replayed,
      false,
    );

    state.quote =
      await repositories.quotes
        .findBySubmissionId(
          quoteSubmissionId,
        );

    assert.ok(state.quote);

    const contactResponse =
      await app.inject({
        method: "POST",

        url:
          "/api/contact-enquiries",

        headers: {
          "content-type":
            "application/json",
        },

        payload: {
          submissionId:
            contactSubmissionId,

          payload:
            contactSubmission,
        },
      });

    assert.equal(
      contactResponse.statusCode,
      201,
    );

    const contactBody =
      contactResponse.json<
        PublicSuccessResponse
      >();

    assert.equal(
      contactBody.success,
      true,
    );

    assert.equal(
      contactBody.replayed,
      false,
    );

    state.enquiry =
      await contactRepository
        .findBySubmissionId(
          contactSubmissionId,
        );

    assert.ok(state.enquiry);

    const evidence =
      await queryNotificationEvidence(
        dataClient,
        state,
      );

    assert.equal(
      evidence.quote.length,
      2,
    );

    assert.equal(
      evidence.contact.length,
      2,
    );

    const allEvidence = [
      ...evidence.quote,
      ...evidence.contact,
    ];

    assert.equal(
      new Set(
        allEvidence.map(
          ({
            providerMessageId,
          }) =>
            providerMessageId,
        ),
      ).size,
      4,
    );

    for (
      const item of
      allEvidence
    ) {
      const message =
        await waitForResendEmail(
          item,
        );

      const reference =
        item.recordType ===
        "Quote"
          ? state.quote
              .quoteNumber
          : state.enquiry
              .enquiryNumber;

      assertProviderMessage(
        item,
        message,
        reference,
        verificationEmail,
        internalEmails,
      );
    }

    console.log(
      "✓ Resend accepted and exposed four distinct transactional messages.",
    );

    console.log(
      "✓ Customer and internal recipients, sender and reference numbers were verified.",
    );

    console.log(
      "✓ Four private Email Sent records were linked to the correct Wix records.",
    );

    const quoteReplay =
      await app.inject({
        method: "POST",
        url: "/api/quotes",

        headers: {
          "content-type":
            "application/json",
        },

        payload: {
          submissionId:
            quoteSubmissionId,

          payload:
            quoteSubmission,
        },
      });

    assert.equal(
      quoteReplay.statusCode,
      200,
    );

    assert.equal(
      quoteReplay.json<
        PublicSuccessResponse
      >().replayed,
      true,
    );

    const contactReplay =
      await app.inject({
        method: "POST",

        url:
          "/api/contact-enquiries",

        headers: {
          "content-type":
            "application/json",
        },

        payload: {
          submissionId:
            contactSubmissionId,

          payload:
            contactSubmission,
        },
      });

    assert.equal(
      contactReplay.statusCode,
      200,
    );

    assert.equal(
      contactReplay.json<
        PublicSuccessResponse
      >().replayed,
      true,
    );

    const afterReplay =
      await queryNotificationEvidence(
        dataClient,
        state,
      );

    assert.deepEqual(
      afterReplay,
      evidence,
    );

    console.log(
      "✓ Identical quote and enquiry retries created no duplicate emails or delivery records.",
    );

    const quoteConflict =
      await app.inject({
        method: "POST",
        url: "/api/quotes",

        headers: {
          "content-type":
            "application/json",
        },

        payload: {
          submissionId:
            quoteSubmissionId,

          payload: {
            ...quoteSubmission,

            additionalNotes:
              "Changed data using the same Build 7C quote reference.",
          },
        },
      });

    assert.equal(
      quoteConflict.statusCode,
      409,
    );

    assert.equal(
      quoteConflict.json<
        PublicErrorResponse
      >().error.code,
      "DUPLICATE_SUBMISSION",
    );

    const contactConflict =
      await app.inject({
        method: "POST",

        url:
          "/api/contact-enquiries",

        headers: {
          "content-type":
            "application/json",
        },

        payload: {
          submissionId:
            contactSubmissionId,

          payload: {
            ...contactSubmission,

            message:
              "Changed data using the same Build 7C enquiry reference.",
          },
        },
      });

    assert.equal(
      contactConflict.statusCode,
      409,
    );

    assert.equal(
      contactConflict.json<
        PublicErrorResponse
      >().error.code,
      "DUPLICATE_SUBMISSION",
    );

    assert.deepEqual(
      await queryNotificationEvidence(
        dataClient,
        state,
      ),
      evidence,
    );

    console.log(
      "✓ Conflicting retries were rejected without sending additional emails.",
    );
  } catch (error) {
    verificationError =
      error;
  }

  try {
    await app.close();
  } catch (error) {
    closeError = error;
  }

  try {
    state.quote ??=
      await repositories.quotes
        .findBySubmissionId(
          quoteSubmissionId,
        );

    state.enquiry ??=
      await contactRepository
        .findBySubmissionId(
          contactSubmissionId,
        );

    await cleanup(
      dataClient,
      state,
    );

    await assertCleanup(
      dataClient,
      quoteSubmissionId,
      contactSubmissionId,
      state,
    );

    console.log(
      "✓ Temporary Wix quote, enquiry, customer, property, items and notification history were removed.",
    );
  } catch (error) {
    cleanupError = error;
  }

  if (
    verificationError !== null
  ) {
    if (
      cleanupError !== null
    ) {
      console.error(
        "Verification failed and cleanup also failed.",
      );

      console.error(
        "Cleanup error:",
        cleanupError,
      );
    }

    throw verificationError;
  }

  if (cleanupError !== null) {
    throw cleanupError;
  }

  if (closeError !== null) {
    throw closeError;
  }

  console.log(
    "Build 7C live notification-flow verification passed.",
  );

  console.log(
    "Confirm the four messages are visible in the configured inboxes before enabling production traffic.",
  );
}

try {
  await verifyBuild7Notifications();
} catch (error) {
  console.error(
    "Build 7C live notification-flow verification failed.",
  );

  console.error(error);

  process.exitCode = 1;
}