import assert from "node:assert/strict";
import test from "node:test";

import {
  createContactEnquiryPersistenceService,
} from "../src/application/persist-contact-enquiry.js";

import type {
  SubmitContactEnquiryRequest,
} from "../src/application/validation/contact-enquiry.js";

import {
  ApplicationError,
} from "../src/domain/errors.js";

import type {
  ContactEnquiryRecord,
  CreateContactEnquiryRecord,
} from "../src/domain/models.js";

import type {
  ContactEnquiryRepository,
} from "../src/ports/repositories.js";

const submissionId =
  "11111111-1111-4111-8111-111111111111";

function submission(
  changes: Partial<
    SubmitContactEnquiryRequest
  > = {},
): SubmitContactEnquiryRequest {
  return {
    submissionId,
    schemaVersion: "1.0",
    fullName: "Test Customer",
    email: "customer@example.com",
    phone: "07123 456789",
    enquiryType:
      "Cleaning Services",
    preferredContactMethod:
      "Email",
    message:
      "Please help me understand which cleaning service is most suitable.",
    privacyConsent: true,
    website: "",
    attachmentCount: 0,
    ...changes,
  };
}

function repository() {
  const records = new Map<
    string,
    ContactEnquiryRecord
  >();

  let createCalls = 0;

  const value: ContactEnquiryRepository = {
    async findBySubmissionId(
      requestedSubmissionId,
    ) {
      return (
        [...records.values()].find(
          (record) =>
            record.submissionId ===
            requestedSubmissionId,
        ) ?? null
      );
    },

    async create(
      enquiry:
        CreateContactEnquiryRecord,
      options,
    ) {
      createCalls += 1;

      const id =
        options?.itemId ??
        `contact-${createCalls}`;

      if (records.has(id)) {
        throw new Error(
          "duplicate item",
        );
      }

      const created = {
        id,
        ...enquiry,
      } satisfies ContactEnquiryRecord;

      records.set(id, created);
      return created;
    },

    async delete(enquiryId) {
      records.delete(enquiryId);
    },
  };

  return {
    value,
    records,
    createCalls: () => createCalls,
  };
}

test(
  "creates a contact enquiry with normalized fields",
  async () => {
    const fake = repository();

    const service =
      createContactEnquiryPersistenceService(
        fake.value,
      );

    const result =
      await service.persist(
        submission(),
      );

    assert.equal(
      result.outcome,
      "created",
    );

    if (
      result.outcome !== "created"
    ) {
      return;
    }

    assert.equal(
      result.enquiry.emailNormalized,
      "customer@example.com",
    );
    assert.equal(
      result.enquiry.phoneNormalized,
      "447123456789",
    );
    assert.equal(
      result.enquiry.status,
      "New",
    );
    assert.equal(
      result.enquiry.submissionSource,
      "Website Contact Form",
    );
  },
);

test(
  "replays an identical contact enquiry without creating another record",
  async () => {
    const fake = repository();

    const service =
      createContactEnquiryPersistenceService(
        fake.value,
      );

    const first =
      await service.persist(
        submission(),
      );

    const replay =
      await service.persist(
        submission(),
      );

    assert.equal(
      first.outcome,
      "created",
    );
    assert.equal(
      replay.outcome,
      "replayed",
    );
    assert.equal(
      fake.createCalls(),
      1,
    );
  },
);

test(
  "rejects changed information that reuses a submission ID",
  async () => {
    const fake = repository();

    const service =
      createContactEnquiryPersistenceService(
        fake.value,
      );

    await service.persist(
      submission(),
    );

    await assert.rejects(
      () =>
        service.persist(
          submission({
            message:
              "This is different enquiry information and must not overwrite the first record.",
          }),
        ),
      (error: unknown) =>
        error instanceof
          ApplicationError &&
        error.code ===
          "DUPLICATE_SUBMISSION" &&
        error.statusCode === 409,
    );
  },
);

test(
  "suppresses honeypot submissions without writing to Wix",
  async () => {
    const fake = repository();

    const service =
      createContactEnquiryPersistenceService(
        fake.value,
      );

    const result =
      await service.persist(
        submission({
          website:
            "https://spam.example",
        }),
      );

    assert.equal(
      result.outcome,
      "suppressed",
    );
    assert.equal(
      fake.createCalls(),
      0,
    );
    assert.equal(
      fake.records.size,
      0,
    );
  },
);

test(
  "serializes concurrent identical submissions",
  async () => {
    const fake = repository();

    const service =
      createContactEnquiryPersistenceService(
        fake.value,
      );

    const [first, second] =
      await Promise.all([
        service.persist(submission()),
        service.persist(submission()),
      ]);

    assert.deepEqual(
      [first.outcome, second.outcome]
        .sort(),
      ["created", "replayed"],
    );
    assert.equal(
      fake.createCalls(),
      1,
    );
  },
);
