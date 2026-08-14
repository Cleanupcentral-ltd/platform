import { createHash } from "node:crypto";

import {
  CharityCommissionProviderError,
  type CharityCommissionProvider,
} from "../ports/charity-commission.js";

import type {
  CharityCommissionVerifiedFact,
  FirstPartyCharityNumberAssertion,
  LeadReviewRepository,
} from "../ports/lead-review.js";

export type CharityCommissionVerificationFailure =
  | "charity_not_found"
  | "provider_rate_limited"
  | "provider_unavailable"
  | "repository_unavailable";

export class CharityCommissionVerificationError
extends Error {
  readonly failure:
    CharityCommissionVerificationFailure;

  constructor(
    failure:
      CharityCommissionVerificationFailure,
  ) {
    super(failure);
    this.name =
      "CharityCommissionVerificationError";
    this.failure = failure;
  }
}

export interface CharityCommissionVerificationResult {
  readonly charityName: string;
  readonly charityNumber: string;
  readonly businessStatus:
    "active" | "inactive";
  readonly evidenceIds:
    readonly string[];
}

export interface CharityCommissionVerificationService {
  verifyAutomatically(
    actorId: string,
    prospectId: string,
    enrichmentAttemptCount: number,
    firstPartyAssertion:
      FirstPartyCharityNumberAssertion,
  ): Promise<
    CharityCommissionVerificationResult
  >;
}

function sha256(value: string): string {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function registeredStatus(
  value: string,
  dateOfRemoval: string | null,
): "active" | "inactive" {
  const normalizedStatus =
    value.trim().toLowerCase();
  return (
    ["r", "registered"].includes(
      normalizedStatus,
    ) &&
    (
      dateOfRemoval === null ||
      dateOfRemoval.trim().length === 0
    )
  )
    ? "active"
    : "inactive";
}

function mapProviderError(
  error: unknown,
):
  CharityCommissionVerificationError {
  if (
    error instanceof
      CharityCommissionProviderError
  ) {
    if (error.failure === "not_found") {
      return new CharityCommissionVerificationError(
        "charity_not_found",
      );
    }
    if (
      error.failure === "rate_limited"
    ) {
      return new CharityCommissionVerificationError(
        "provider_rate_limited",
      );
    }
  }
  return new CharityCommissionVerificationError(
    "provider_unavailable",
  );
}

export function createCharityCommissionVerificationService(
  repository:
    Pick<
      LeadReviewRepository,
      "recordAutomaticCharityCommissionVerification"
    >,
  provider:
    CharityCommissionProvider,
): CharityCommissionVerificationService {
  return {
    async verifyAutomatically(
      actorId,
      prospectId,
      enrichmentAttemptCount,
      firstPartyAssertion,
    ) {
      const charityNumber =
        firstPartyAssertion
          .charityNumber
          .replace(/\s+/g, "");
      if (
        !/^\d{6,7}$/.test(
          charityNumber,
        )
      ) {
        throw new CharityCommissionVerificationError(
          "charity_not_found",
        );
      }

      let charity;
      try {
        charity =
          await provider
            .getByRegisteredNumber(
              charityNumber,
              0,
            );
      } catch (error) {
        throw mapProviderError(error);
      }

      if (
        charity.registeredCharityNumber !==
          charityNumber
      ) {
        throw new CharityCommissionVerificationError(
          "charity_not_found",
        );
      }

      const businessStatus =
        registeredStatus(
          charity.registrationStatus,
          charity.dateOfRemoval,
        );
      const officialExcerpt =
        [
          "Charity Commission register",
          `charity ${charity.registeredCharityNumber}`,
          charity.charityName,
          `status ${charity.registrationStatus}`,
        ].join(" — ");

      const facts:
        readonly CharityCommissionVerifiedFact[] =
      [
        {
          factName:
            "registered_charity_name",
          factValue:
            charity.charityName,
          sourceExcerpt:
            officialExcerpt,
          contentSha256: sha256(
            `${charity.officialUrl}\nregistered_charity_name\n${charity.charityName}\n${officialExcerpt}`,
          ),
        },
        {
          factName:
            "charity_number",
          factValue:
            charityNumber,
          sourceExcerpt:
            officialExcerpt,
          contentSha256: sha256(
            `${charity.officialUrl}\ncharity_number\n${charityNumber}\n${officialExcerpt}`,
          ),
        },
        {
          factName:
            "business_status",
          factValue:
            businessStatus,
          sourceExcerpt:
            officialExcerpt,
          contentSha256: sha256(
            `${charity.officialUrl}\nbusiness_status\n${businessStatus}\n${officialExcerpt}`,
          ),
        },
      ];

      const record =
        repository
          .recordAutomaticCharityCommissionVerification;
      if (record === undefined) {
        throw new CharityCommissionVerificationError(
          "repository_unavailable",
        );
      }

      let evidenceIds:
        readonly string[];
      try {
        evidenceIds =
          await record.call(
            repository,
            {
              prospectId,
              founderId: actorId,
              sourceUrl:
                charity.officialUrl,
              facts,
              enrichmentAttemptCount,
              firstPartyAssertion,
            },
          );
      } catch {
        throw new CharityCommissionVerificationError(
          "repository_unavailable",
        );
      }

      return {
        charityName:
          charity.charityName,
        charityNumber,
        businessStatus,
        evidenceIds,
      };
    },
  };
}
