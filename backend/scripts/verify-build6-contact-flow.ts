import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  createWixContactEnquiryRepository,
} from "../src/adapters/wix/create-wix-contact-enquiry-repository.js";

import {
  buildApp,
} from "../src/app.js";

import {
  createContactEnquiryPersistenceService,
} from "../src/application/persist-contact-enquiry.js";

import type {
  SubmitContactEnquiryRequest,
} from "../src/application/validation/contact-enquiry.js";

import type {
  ContactEnquiryRepository,
} from "../src/ports/repositories.js";

interface PublicContactSuccessResponse {
  readonly success: true;
  readonly replayed: boolean;
  readonly confirmation: {
    readonly enquiryNumber: string;
    readonly status: string;
    readonly message: string;
    readonly preferredContactMethod:
      string;
    readonly attachmentExpected:
      boolean;
  };
  readonly requestId: string;
}

interface PublicErrorResponse {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
  readonly requestId: string;
}

function assertNoStore(
  response: {
    readonly headers: Readonly<
      Record<
        string,
        string |
          number |
          readonly string[] |
          undefined
      >
    >;
  },
): void {
  const value =
    response.headers[
      "cache-control"
    ];

  assert.equal(
    Array.isArray(value)
      ? value.join(",")
      : String(value),
    "no-store",
  );
}

function createSubmission(
  submissionId: string,
  token: string,
): SubmitContactEnquiryRequest {
  return {
    submissionId,
    schemaVersion: "1.0",
    fullName:
      "Contact Flow Verification",
    email:
      `build6-contact-${token}@example.com`,
    phone: "",
    enquiryType:
      "Cleaning Services",
    preferredContactMethod:
      "Email",
    message:
      "Temporary controlled Build 6 contact enquiry verification.",
    privacyConsent: true,
    website: "",
    attachmentCount: 0,
  };
}

function assertPublicResponseIsSafe(
  value: unknown,
  submission:
    SubmitContactEnquiryRequest,
  storedId: string,
): void {
  const serialised =
    JSON.stringify(value);

  for (
    const privateValue of [
      submission.submissionId,
      submission.email,
      submission.fullName,
      storedId,
    ]
  ) {
    assert.equal(
      serialised.includes(
        privateValue,
      ),
      false,
      `The public response exposed private value: ${privateValue}`,
    );
  }
}

async function removeTemporaryEnquiry(
  repository:
    ContactEnquiryRepository,
  submissionId: string,
): Promise<void> {
  const existing =
    await repository
      .findBySubmissionId(
        submissionId,
      );

  if (existing !== null) {
    await repository.delete(
      existing.id,
    );
  }
}

async function verifyBuild6ContactFlow():
  Promise<void> {
  const submissionId =
    randomUUID();

  const token = submissionId
    .replaceAll("-", "")
    .slice(0, 12);

  const submission =
    createSubmission(
      submissionId,
      token,
    );

  const repository =
    createWixContactEnquiryRepository();

  const persistenceService =
    createContactEnquiryPersistenceService(
      repository,
    );

  const app = await buildApp({
    contactEnquiryPersistenceService:
      persistenceService,
  });

  let verificationError:
    unknown = null;

  let closeError:
    unknown = null;

  let cleanupError:
    unknown = null;

  console.log(
    "Running controlled live Build 6 contact-flow verification...",
  );

  console.log(
    "The temporary Wix enquiry will be removed automatically.",
  );

  try {
    const firstResponse =
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
          payload: submission,
        },
      });

    assert.equal(
      firstResponse.statusCode,
      201,
    );

    assertNoStore(
      firstResponse,
    );

    const firstBody =
      firstResponse.json<
        PublicContactSuccessResponse
      >();

    assert.equal(
      firstBody.success,
      true,
    );

    assert.equal(
      firstBody.replayed,
      false,
    );

    assert.deepEqual(
      Object.keys(
        firstBody,
      ).sort(),
      [
        "confirmation",
        "replayed",
        "requestId",
        "success",
      ],
    );

    assert.deepEqual(
      Object.keys(
        firstBody.confirmation,
      ).sort(),
      [
        "attachmentExpected",
        "enquiryNumber",
        "message",
        "preferredContactMethod",
        "status",
      ],
    );

    const stored =
      await repository
        .findBySubmissionId(
          submissionId,
        );

    assert.ok(
      stored,
      "The contact enquiry should exist in Wix after the first request.",
    );

    assert.equal(
      stored.enquiryNumber,
      firstBody.confirmation
        .enquiryNumber,
    );

    assert.equal(
      stored.email,
      submission.email,
    );

    assert.equal(
      stored.status,
      "New",
    );

    assert.equal(
      stored.submissionSource,
      "Website Contact Form",
    );

    assert.equal(
      firstBody.confirmation
        .attachmentExpected,
      false,
    );

    assertPublicResponseIsSafe(
      firstBody,
      submission,
      stored.id,
    );

    console.log(
      "✓ A new Contact Enquiries record was created and verified.",
    );

    console.log(
      "✓ The public confirmation exposed no internal IDs or customer details.",
    );

    const replayResponse =
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
          payload: submission,
        },
      });

    assert.equal(
      replayResponse.statusCode,
      200,
    );

    assertNoStore(
      replayResponse,
    );

    const replayBody =
      replayResponse.json<
        PublicContactSuccessResponse
      >();

    assert.equal(
      replayBody.success,
      true,
    );

    assert.equal(
      replayBody.replayed,
      true,
    );

    assert.deepEqual(
      replayBody.confirmation,
      firstBody.confirmation,
    );

    assertPublicResponseIsSafe(
      replayBody,
      submission,
      stored.id,
    );

    console.log(
      "✓ An identical retry returned the existing enquiry without another record.",
    );

    const conflictResponse =
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
            ...submission,
            message:
              "Changed information using the same contact submission reference.",
          },
        },
      });

    assert.equal(
      conflictResponse.statusCode,
      409,
    );

    assertNoStore(
      conflictResponse,
    );

    const conflictBody =
      conflictResponse.json<
        PublicErrorResponse
      >();

    assert.equal(
      conflictBody.success,
      false,
    );

    assert.equal(
      conflictBody.error.code,
      "DUPLICATE_SUBMISSION",
    );

    assert.deepEqual(
      Object.keys(
        conflictBody.error,
      ).sort(),
      [
        "code",
        "message",
      ],
    );

    assertPublicResponseIsSafe(
      conflictBody,
      submission,
      stored.id,
    );

    const afterConflict =
      await repository
        .findBySubmissionId(
          submissionId,
        );

    assert.equal(
      afterConflict?.id,
      stored.id,
    );

    console.log(
      "✓ Reusing the submission reference with changed information was rejected safely.",
    );
  } catch (error) {
    verificationError = error;
  }

  try {
    await app.close();
  } catch (error) {
    closeError = error;
  }

  try {
    await removeTemporaryEnquiry(
      repository,
      submissionId,
    );

    const remaining =
      await repository
        .findBySubmissionId(
          submissionId,
        );

    assert.equal(
      remaining,
      null,
    );

    console.log(
      "✓ The temporary Wix Contact Enquiries record was removed.",
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
    "Build 6C live contact-flow verification passed.",
  );
}

try {
  await verifyBuild6ContactFlow();
} catch (error) {
  console.error(
    "Build 6C live contact-flow verification failed.",
  );

  console.error(error);

  process.exitCode = 1;
}
