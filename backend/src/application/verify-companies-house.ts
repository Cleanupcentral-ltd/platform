import { createHash } from "node:crypto";

import {
  CompaniesHouseProviderError,
  type CompaniesHouseCompanySummary,
  type CompaniesHouseProvider,
} from "../ports/companies-house.js";

import type {
  AutomaticAssessmentResult,
  LeadReviewService,
} from "./review-leads.js";

import type {
  CompaniesHouseVerifiedFact,
  FirstPartyCompanyNumberAssertion,
  FirstPartyLegalOperatorAssertion,
  LeadReviewRepository,
} from "../ports/lead-review.js";

export type CompaniesHouseVerificationFailure =
  | "invalid_query"
  | "company_not_found"
  | "provider_rate_limited"
  | "provider_unavailable"
  | "duplicate_company"
  | "repository_unavailable";

export class CompaniesHouseVerificationError
extends Error {
  readonly failure:
    CompaniesHouseVerificationFailure;

  constructor(
    failure:
      CompaniesHouseVerificationFailure,
  ) {
    super(failure);
    this.name =
      "CompaniesHouseVerificationError";
    this.failure = failure;
  }
}

export interface CompaniesHouseVerificationResult {
  readonly companyName: string;
  readonly companyNumber: string;
  readonly businessStatus:
    "active" | "inactive";
  readonly subscriberType:
    "corporate" | "partnership" |
    "unknown";
  readonly evidenceIds:
    readonly string[];
  readonly automaticAssessment:
    AutomaticAssessmentResult;
}

export interface CompaniesHouseVerificationService {
  search(
    prospectId: string,
    query: string,
  ): Promise<
    readonly CompaniesHouseCompanySummary[]
  >;

  verify(
    founderId: string,
    prospectId: string,
    companyNumber: string,
  ): Promise<
    CompaniesHouseVerificationResult
  >;

  verifyAutomatically(
    actorId: string,
    prospectId: string,
    companyNumber: string,
    enrichmentAttemptCount: number,
    firstPartyAssertion:
      FirstPartyCompanyNumberAssertion,
  ): Promise<
    CompaniesHouseVerificationResult
  >;

  verifyAutomaticallyByLegalOperator?(
    actorId: string,
    prospectId: string,
    enrichmentAttemptCount: number,
    firstPartyAssertion:
      FirstPartyLegalOperatorAssertion,
  ): Promise<
    CompaniesHouseVerificationResult
  >;
}

const CORPORATE_COMPANY_TYPES =
  new Set([
    "ltd",
    "plc",
    "llp",
    "scottish-partnership",
    "private-limited-guarant-nsc",
    "private-limited-guarant-nsc-limited-exemption",
    "charitable-incorporated-organisation",
  ]);

function sha256(value: string): string {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function normalizedLegalName(
  value: string,
): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .trim();
}

function normalizedCompanyNumber(
  value: string,
): string {
  const normalized = value
    .replace(/\s+/g, "")
    .toUpperCase();
  if (!/^[A-Z0-9]{6,12}$/.test(normalized)) {
    throw new CompaniesHouseVerificationError(
      "invalid_query",
    );
  }
  return normalized;
}

function subscriberType(
  companyType: string,
): "corporate" | "partnership" |
  "unknown" {
  if (
    CORPORATE_COMPANY_TYPES.has(
      companyType,
    )
  ) {
    return "corporate";
  }
  if (
    companyType === "limited-partnership"
  ) {
    return "partnership";
  }
  return "unknown";
}

function mapProviderError(
  error: unknown,
): CompaniesHouseVerificationError {
  if (
    error instanceof
      CompaniesHouseProviderError
  ) {
    switch (error.failure) {
      case "not_found":
        return new CompaniesHouseVerificationError(
          "company_not_found",
        );
      case "rate_limited":
        return new CompaniesHouseVerificationError(
          "provider_rate_limited",
        );
      case "unavailable":
      case "invalid_response":
        return new CompaniesHouseVerificationError(
          "provider_unavailable",
        );
    }
  }
  return new CompaniesHouseVerificationError(
    "provider_unavailable",
  );
}

export function createCompaniesHouseVerificationService(
  repository: LeadReviewRepository,
  reviewService:
    Pick<LeadReviewService,
      "getProspect" | "assess">,
  provider: CompaniesHouseProvider,
): CompaniesHouseVerificationService {
  async function verifyCompany(
    founderId: string,
    prospectId: string,
    rawCompanyNumber: string,
    firstPartyAssertion:
      FirstPartyCompanyNumberAssertion | null,
    enrichmentAttemptCount: number | null,
    legalOperatorAssertion:
      FirstPartyLegalOperatorAssertion | null =
        null,
  ): Promise<CompaniesHouseVerificationResult> {
    await reviewService.getProspect(
      prospectId,
    );
    const companyNumber =
      normalizedCompanyNumber(
        rawCompanyNumber,
      );

    let linkedProspect;
    try {
      linkedProspect = await repository
        .findProspectByCompanyNumber(
          companyNumber,
        );
    } catch {
      throw new CompaniesHouseVerificationError(
        "repository_unavailable",
      );
    }
    if (
      linkedProspect !== null &&
      linkedProspect.id !== prospectId
    ) {
      throw new CompaniesHouseVerificationError(
        "duplicate_company",
      );
    }

    let profile;
    try {
      profile = await provider
        .getProfile(companyNumber);
    } catch (error) {
      throw mapProviderError(error);
    }

    const status =
      profile.companyStatus === "active"
        ? "active" as const
        : "inactive" as const;
    const subscriber = subscriberType(
      profile.companyType,
    );
    const excerpt = [
      `Companies House company profile for ${profile.companyName}`,
      `company number ${profile.companyNumber}`,
      `status ${profile.companyStatus}`,
      `type ${profile.companyType}`,
    ].join("; ");
    const values = [
      ["business_name", profile.companyName],
      ["company_number", profile.companyNumber],
      ["business_status", status],
      ["subscriber_type", subscriber],
    ] as const;
    const facts: CompaniesHouseVerifiedFact[] =
      values.map(
        ([factName, factValue]) => ({
          factName,
          factValue,
          sourceExcerpt: excerpt,
          contentSha256: sha256(
            `${profile.officialUrl}\n${factName}\n${factValue}`,
          ),
        }),
      );

    let evidenceIds: readonly string[];
    try {
      if (
        legalOperatorAssertion !== null
      ) {
        if (
          repository
            .recordAutomaticLegalOperatorVerification ===
              undefined
        ) {
          throw new Error(
            "Automatic legal-operator verification is unavailable.",
          );
        }
        evidenceIds =
          await repository
            .recordAutomaticLegalOperatorVerification({
              prospectId,
              founderId,
              sourceUrl:
                profile.officialUrl,
              facts,
              enrichmentAttemptCount:
                enrichmentAttemptCount!,
              firstPartyAssertion:
                legalOperatorAssertion,
            });
      } else if (
        firstPartyAssertion === null
      ) {
        evidenceIds = await repository
          .recordCompaniesHouseVerification({
            prospectId,
            founderId,
            sourceUrl:
              profile.officialUrl,
            facts,
          });
      } else {
        evidenceIds = await repository
          .recordAutomaticCompaniesHouseVerification({
            prospectId,
            founderId,
            sourceUrl:
              profile.officialUrl,
            facts,
            enrichmentAttemptCount:
              enrichmentAttemptCount!,
            firstPartyAssertion,
          });
      }
    } catch {
      throw new CompaniesHouseVerificationError(
        "repository_unavailable",
      );
    }

    let automaticAssessment:
      AutomaticAssessmentResult;
    try {
      automaticAssessment = {
        status: "updated",
        assessment:
          await reviewService.assess(
            founderId,
            prospectId,
          ),
      };
    } catch {
      automaticAssessment = {
        status: "pending",
        assessment: null,
      };
    }

    return {
      companyName: profile.companyName,
      companyNumber: profile.companyNumber,
      businessStatus: status,
      subscriberType: subscriber,
      evidenceIds,
      automaticAssessment,
    };
  }

  return {
    async search(
      prospectId,
      rawQuery,
    ) {
      await reviewService.getProspect(
        prospectId,
      );
      const query = rawQuery
        .replace(/\s+/g, " ")
        .trim();
      if (
        query.length < 2 ||
        query.length > 200
      ) {
        throw new CompaniesHouseVerificationError(
          "invalid_query",
        );
      }

      try {
        return await provider.search(
          query,
          5,
        );
      } catch (error) {
        throw mapProviderError(error);
      }
    },

    async verify(
      founderId,
      prospectId,
      rawCompanyNumber,
    ) {
      return verifyCompany(
        founderId,
        prospectId,
        rawCompanyNumber,
        null,
        null,
      );
    },

    async verifyAutomatically(
      actorId,
      prospectId,
      companyNumber,
      enrichmentAttemptCount,
      firstPartyAssertion,
    ) {
      return verifyCompany(
        actorId,
        prospectId,
        companyNumber,
        firstPartyAssertion,
        enrichmentAttemptCount,
      );
    },

    async verifyAutomaticallyByLegalOperator(
      actorId,
      prospectId,
      enrichmentAttemptCount,
      firstPartyAssertion,
    ) {
      const operatorName =
        firstPartyAssertion
          .operatorName
          .replace(/\s+/g, " ")
          .trim();
      if (
        operatorName.length < 4 ||
        operatorName.length > 120
      ) {
        throw new CompaniesHouseVerificationError(
          "invalid_query",
        );
      }

      let matches:
        readonly CompaniesHouseCompanySummary[];
      try {
        matches =
          await provider.search(
            operatorName,
            5,
          );
      } catch (error) {
        throw mapProviderError(error);
      }

      const normalized =
        normalizedLegalName(
          operatorName,
        );
      const exact = [
        ...new Map(
          matches
            .filter(
              (match) =>
                normalizedLegalName(
                  match.companyName,
                ) === normalized,
            )
            .map(
              (match) => [
                match.companyNumber,
                match,
              ],
            ),
        ).values(),
      ];

      if (exact.length !== 1) {
        throw new CompaniesHouseVerificationError(
          "company_not_found",
        );
      }

      return verifyCompany(
        actorId,
        prospectId,
        exact[0]!.companyNumber,
        null,
        enrichmentAttemptCount,
        firstPartyAssertion,
      );
    },
  };
}
