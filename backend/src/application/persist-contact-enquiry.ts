import {
  ApplicationError,
} from "../domain/errors.js";

import type {
  ContactEnquiryRecord,
  CreateContactEnquiryRecord,
} from "../domain/models.js";

import {
  normalizeEmail,
  normalizePhone,
} from "../domain/normalization.js";

import type {
  ContactEnquiryRepository,
} from "../ports/repositories.js";

import type {
  SubmitContactEnquiryRequest,
} from "./validation/contact-enquiry.js";

export interface CreatedContactEnquirySubmission {
  readonly outcome: "created";
  readonly enquiry: ContactEnquiryRecord;
}

export interface ReplayedContactEnquirySubmission {
  readonly outcome: "replayed";
  readonly enquiry: ContactEnquiryRecord;
}

export interface SuppressedContactEnquirySubmission {
  readonly outcome: "suppressed";
  readonly enquiryNumber: string;
  readonly preferredContactMethod:
    SubmitContactEnquiryRequest[
      "preferredContactMethod"
    ];
}

export type PersistedContactEnquirySubmission =
  | CreatedContactEnquirySubmission
  | ReplayedContactEnquirySubmission
  | SuppressedContactEnquirySubmission;

export interface ContactEnquiryPersistenceService {
  persist(
    submission:
      SubmitContactEnquiryRequest,
  ): Promise<PersistedContactEnquirySubmission>;
}

export interface ContactEnquiryPersistenceOptions {
  readonly createEnquiryNumber?: (
    submissionId: string,
  ) => string;

  readonly createEnquiryId?: (
    submissionId: string,
  ) => string;

  readonly duplicatePollDelaysMs?:
    readonly number[];

  readonly wait?: (
    milliseconds: number,
  ) => Promise<void>;
}

function defaultEnquiryNumber(
  submissionId: string,
): string {
  const compactId = submissionId
    .replaceAll("-", "")
    .slice(0, 12)
    .toUpperCase();

  return `CUC-E-${compactId}`;
}

function defaultEnquiryId(
  submissionId: string,
): string {
  return `contact-${submissionId}`;
}

function defaultWait(
  milliseconds: number,
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function sameSubmission(
  enquiry: ContactEnquiryRecord,
  submission: SubmitContactEnquiryRequest,
): boolean {
  return (
    enquiry.fullName ===
      submission.fullName &&
    enquiry.emailNormalized ===
      normalizeEmail(
        submission.email,
      ) &&
    enquiry.phoneNormalized ===
      normalizePhone(
        submission.phone,
      ) &&
    enquiry.enquiryType ===
      submission.enquiryType &&
    enquiry.preferredContactMethod ===
      submission.preferredContactMethod &&
    enquiry.message ===
      submission.message &&
    enquiry.attachmentCount ===
      submission.attachmentCount &&
    enquiry.hasAttachments ===
      (submission.attachmentCount > 0)
  );
}

function duplicateSubmissionError(
  submissionId: string,
  enquiryId: string,
): ApplicationError {
  return new ApplicationError({
    code: "DUPLICATE_SUBMISSION",
    message:
      "This submission ID has already been used for different contact enquiry information.",
    statusCode: 409,
    details: {
      submissionId,
      enquiryId,
    },
  });
}

function storageError(
  cause: unknown,
): ApplicationError {
  return new ApplicationError({
    code: "STORAGE_ERROR",
    message:
      "The contact enquiry could not be stored.",
    statusCode: 502,
    cause,
  });
}

function enquiryRecord(
  submission: SubmitContactEnquiryRequest,
  enquiryNumber: string,
): CreateContactEnquiryRecord {
  return {
    enquiryNumber,
    submissionId:
      submission.submissionId,
    customerId: null,
    propertyId: null,
    convertedQuoteId: null,
    status: "New",
    fullName: submission.fullName,
    email: submission.email,
    emailNormalized:
      normalizeEmail(
        submission.email,
      ),
    phone: submission.phone,
    phoneNormalized:
      normalizePhone(
        submission.phone,
      ),
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
    internalNotes:
      "Privacy consent confirmed by website submission.",
  };
}

async function findReplay(
  repository: ContactEnquiryRepository,
  submission: SubmitContactEnquiryRequest,
): Promise<ReplayedContactEnquirySubmission | null> {
  const existing =
    await repository.findBySubmissionId(
      submission.submissionId,
    );

  if (existing === null) {
    return null;
  }

  if (
    !sameSubmission(
      existing,
      submission,
    )
  ) {
    throw duplicateSubmissionError(
      submission.submissionId,
      existing.id,
    );
  }

  return {
    outcome: "replayed",
    enquiry: existing,
  };
}

export function createContactEnquiryPersistenceService(
  repository: ContactEnquiryRepository,
  options:
    ContactEnquiryPersistenceOptions = {},
): ContactEnquiryPersistenceService {
  const createEnquiryNumber =
    options.createEnquiryNumber ??
    defaultEnquiryNumber;

  const createEnquiryId =
    options.createEnquiryId ??
    defaultEnquiryId;

  const pollDelays =
    options.duplicatePollDelaysMs ??
    [50, 100, 200, 400];

  const wait =
    options.wait ?? defaultWait;

  const inFlight = new Map<
    string,
    Promise<PersistedContactEnquirySubmission>
  >();

  const persistUnlocked = async (
    submission:
      SubmitContactEnquiryRequest,
  ): Promise<PersistedContactEnquirySubmission> => {
    const enquiryNumber =
      createEnquiryNumber(
        submission.submissionId,
      );

    const replay =
      await findReplay(
        repository,
        submission,
      );

    if (replay !== null) {
      return replay;
    }

    try {
      const enquiry =
        await repository.create(
          enquiryRecord(
            submission,
            enquiryNumber,
          ),
          {
            itemId: createEnquiryId(
              submission.submissionId,
            ),
          },
        );

      return {
        outcome: "created",
        enquiry,
      };
    } catch (error) {
      for (const delay of [0, ...pollDelays]) {
        if (delay > 0) {
          await wait(delay);
        }

        const existing =
          await findReplay(
            repository,
            submission,
          );

        if (existing !== null) {
          return existing;
        }
      }

      if (
        error instanceof
          ApplicationError
      ) {
        throw error;
      }

      throw storageError(error);
    }
  };

  return {
    async persist(
      submission,
    ): Promise<PersistedContactEnquirySubmission> {
      if (submission.website.length > 0) {
        return {
          outcome: "suppressed",
          enquiryNumber:
            createEnquiryNumber(
              submission.submissionId,
            ),
          preferredContactMethod:
            submission.preferredContactMethod,
        };
      }

      const running =
        inFlight.get(
          submission.submissionId,
        );

      if (running !== undefined) {
        const completed =
          await running;

        if (
          completed.outcome ===
          "suppressed"
        ) {
          return completed;
        }

        if (
          !sameSubmission(
            completed.enquiry,
            submission,
          )
        ) {
          throw duplicateSubmissionError(
            submission.submissionId,
            completed.enquiry.id,
          );
        }

        return {
          outcome: "replayed",
          enquiry:
            completed.enquiry,
        };
      }

      const operation =
        persistUnlocked(submission);

      inFlight.set(
        submission.submissionId,
        operation,
      );

      try {
        return await operation;
      } finally {
        if (
          inFlight.get(
            submission.submissionId,
          ) === operation
        ) {
          inFlight.delete(
            submission.submissionId,
          );
        }
      }
    },
  };
}
