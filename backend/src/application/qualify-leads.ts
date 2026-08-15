import { createHash } from "node:crypto";

import type {
  ContactRecoveryProvider,
} from "../adapters/web/contact-recovery.js";

import {
  FirstPartyResearchError,
} from "../adapters/web/first-party-research.js";

import {
  LEAD_QUALIFICATION_BLOCKERS,
} from "../domain/lead-assessment.js";

import type {
  AutomaticQualificationJob,
  AutomaticQualificationRepository,
  FirstPartyResearchResult,
  FirstPartyResearchProvider,
  GooglePlaceDetailsProvider,
  QualificationQueueState,
} from "../ports/automatic-qualification.js";

import type {
  CompaniesHouseCompanySummary,
} from "../ports/companies-house.js";

import {
  CompaniesHouseVerificationError,
  type CompaniesHouseVerificationService,
} from "./verify-companies-house.js";

import {
  CharityCommissionVerificationError,
  type CharityCommissionVerificationService,
} from "./verify-charity-commission.js";

import type {
  LeadReviewService,
} from "./review-leads.js";

import type {
  CompanyEnrichmentBatchResult,
  CompanyEnrichmentService,
} from "./enrich-companies.js";

export interface AutomaticQualificationServiceOptions {
  readonly repository:
    AutomaticQualificationRepository;
  readonly firstPartyProvider:
    FirstPartyResearchProvider;
  readonly contactRecoveryProvider?:
    ContactRecoveryProvider;
  readonly googlePlaceDetailsProvider?:
    GooglePlaceDetailsProvider;
  readonly companiesHouseService:
    CompaniesHouseVerificationService;
  readonly charityCommissionService?:
    CharityCommissionVerificationService;
  readonly leadReviewService:
    Pick<LeadReviewService,
      "assess" | "getProspect">;
  readonly batchSize: number;
  readonly leaseSeconds: number;
  readonly activationTotalLimit:
    number | null;
}

type Outcome =
  | "auto"
  | "review"
  | "complete"
  | "failed";

type ContactRecoveryStatus =
  | "not_needed"
  | "recovered"
  | "no_contact_found"
  | "failed";

function unique<T>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}

function uniqueMatches(
  matches: readonly CompaniesHouseCompanySummary[],
): readonly CompaniesHouseCompanySummary[] {
  const results = new Map<string,
    CompaniesHouseCompanySummary>();
  for (const match of matches) {
    results.set(match.companyNumber, match);
  }
  return [...results.values()].slice(0, 5);
}

function retryDelay(errorCode: string): number {
  return errorCode.includes("rate_limited")
    ? 300
    : 60;
}

function sha256(value: string): string {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function normalizedPostcode(value: string): string {
  return value
    .toUpperCase()
    .replace(/\s+/g, "");
}

function normalizedCompanyName(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

function singlePremisesSupport(
  research: FirstPartyResearchResult,
  primaryPostcode: string | null,
): FirstPartyResearchResult["facts"][number] | null {
  if (
    primaryPostcode === null ||
    research.facts.some(
      (fact) => fact.factName === "premises_scale",
    )
  ) return null;

  const postcode = normalizedPostcode(primaryPostcode);
  if (postcode.length < 5) return null;

  const identitySources = new Set(
    research.facts
      .filter(
        (fact) => fact.factName === "business_name",
      )
      .map((fact) => fact.sourceUrl),
  );

  return research.facts.find(
    (fact) =>
      identitySources.has(fact.sourceUrl) &&
      normalizedPostcode(
        fact.sourceExcerpt,
      ).includes(postcode),
  ) ?? null;
}

function isInstitutional(
  research: FirstPartyResearchResult | null,
): boolean {
  return research !== null && [
    "university",
    "public_body",
    "charity",
    "community_organisation",
  ].includes(research.organisationType);
}

function result(
  outcomes: readonly Outcome[],
): CompanyEnrichmentBatchResult {
  return {
    claimedCount: outcomes.length,
    autoVerifiedCount:
      outcomes.filter((item) => item === "auto").length,
    reviewRequiredCount:
      outcomes.filter((item) => item === "review").length,
    completedCount:
      outcomes.filter((item) => item === "complete").length,
    failedCount:
      outcomes.filter((item) => item === "failed").length,
  };
}

export function createAutomaticQualificationService(
  options: AutomaticQualificationServiceOptions,
): CompanyEnrichmentService {
  async function completeFailure(
    job: AutomaticQualificationJob,
    code: string,
  ): Promise<Outcome> {
    const exhausted = job.attemptCount >= 3;
    await options.repository.completeQualification({
      prospectId: job.prospectId,
      attemptCount: job.attemptCount,
      enrichmentStatus: "failed",
      queueState: exhausted
        ? "needs_founder_decision"
        : "processing",
      reasons: [
        exhausted
          ? `${code}_after_retries`
          : `${code}_retry_scheduled`,
      ],
      researchSummary: {},
      discoveredCompanyNumber: null,
      sourceUrl: null,
      sourceExcerpt: null,
      sourceContentSha256: null,
      candidates: [],
      lastErrorCode: code,
      retryAfterSeconds:
        exhausted ? 0 : retryDelay(code),
    });
    return "failed";
  }

  async function processJob(
    job: AutomaticQualificationJob,
  ): Promise<Outcome> {
    let businessName = job.businessName;
    let websiteUrl = job.websiteUrl;
    const googlePlaceId =
      job.googlePlaceId ?? null;

    if (googlePlaceId !== null) {
      if (
        options.googlePlaceDetailsProvider ===
          undefined
      ) {
        return completeFailure(
          job,
          "google_place_details_unavailable",
        );
      }
      try {
        const transientPlace =
          await options.googlePlaceDetailsProvider
            .resolve(googlePlaceId);
        businessName =
          transientPlace.businessName;
        websiteUrl =
          transientPlace.websiteUrl;
      } catch {
        return completeFailure(
          job,
          "google_place_details_unavailable",
        );
      }
    }

    let research: FirstPartyResearchResult | null = null;
    let additionalVerifiedFactCount = 0;
    let recoveredContactFactCount = 0;
    let contactRecoveryStatus:
      ContactRecoveryStatus = "not_needed";
    let contactRecoveryVisitedUrls:
      readonly string[] = [];
    let contactRecoveryTruncatedPageCount = 0;
    const reasons: string[] = [];

    if (websiteUrl === null) {
      reasons.push("no_first_party_website");
    } else {
      try {
        research = await options.firstPartyProvider.research(
          websiteUrl,
          businessName,
          job.sector,
        );
      } catch (error) {
        if (
          error instanceof FirstPartyResearchError &&
          error.failure === "temporarily_unavailable"
        ) {
          return completeFailure(
            job,
            "website_temporarily_unavailable",
          );
        }
        reasons.push(
          error instanceof FirstPartyResearchError
            ? `website_${error.failure}`
            : "website_research_failed",
        );
      }
    }

    if (research !== null) {
      await options.repository.recordResearch(
        job.prospectId,
        job.actorId,
        job.attemptCount,
        research.facts,
      );

      const identityConfirmed =
        research.facts.some((fact) =>
          fact.factName === "business_name");
      const initialContactFound =
        research.facts.some((fact) =>
          fact.contactType !== null);

      if (
        identityConfirmed &&
        !initialContactFound &&
        options.contactRecoveryProvider !==
          undefined
      ) {
        try {
          const recovery =
            await options.contactRecoveryProvider
              .recover(
                research.canonicalWebsiteUrl,
                businessName,
                job.sector,
              );
          contactRecoveryVisitedUrls =
            recovery.visitedUrls;
          contactRecoveryTruncatedPageCount =
            recovery.truncatedPageCount;

          const recoveredContacts =
            recovery.facts.filter((fact) =>
              fact.contactType !== null);
          recoveredContactFactCount =
            recoveredContacts.length;

          if (recoveredContacts.length > 0) {
            await options.repository.recordResearch(
              job.prospectId,
              job.actorId,
              job.attemptCount,
              recoveredContacts,
            );
            contactRecoveryStatus = "recovered";
          } else {
            contactRecoveryStatus =
              "no_contact_found";
          }
        } catch {
          // Contact recovery is a bounded additive pass.
          // It must never restart or fail the core qualification run.
          contactRecoveryStatus = "failed";
        }
      }

      reasons.push(
        ...research.reviewReasons.filter(
          (reason) =>
            reason !==
              "no_generic_business_contact_found" ||
            recoveredContactFactCount === 0,
        ),
      );

      if (
        options.repository
          .recordSinglePremises !== undefined
      ) {
        try {
          const current =
            await options.leadReviewService
              .getProspect(job.prospectId);
          const support = singlePremisesSupport(
            research,
            current.primaryPostcode,
          );
          if (support !== null) {
            const evidenceIds =
              await options.repository
                .recordSinglePremises(
                  job.prospectId,
                  job.actorId,
                  job.attemptCount,
                  support.sourceUrl,
                  support.sourceExcerpt,
                  sha256(
                    `${support.sourceUrl}\npremises_scale\none_active_premises\n${support.sourceExcerpt}`,
                  ),
                );
            if (evidenceIds.length > 0) {
              additionalVerifiedFactCount = 1;
            }
          }
        } catch {
          // Premises verification is additive.
          // The core qualification path must continue safely.
        }
      }
    }

    let enrichmentStatus:
      | "auto_verified"
      | "review_required"
      | "no_match"
      | "duplicate"
      | "verified_existing" =
        job.companyNumber === null
          ? "no_match"
          : "verified_existing";
    let candidates:
      readonly CompaniesHouseCompanySummary[] = [];
    let discoveredCompanyNumber =
      job.companyNumber;

    const assertions =
      research?.companyNumberAssertions ?? [];
    const operatorAssertions =
      research?.legalOperatorAssertions ?? [];
    const charityAssertions =
      research?.charityNumberAssertions ?? [];

    if (
      research?.organisationType ===
        "charity" &&
      charityAssertions.length === 1 &&
      options.charityCommissionService !==
        undefined
    ) {
      try {
        await options
          .charityCommissionService
          .verifyAutomatically(
            job.actorId,
            job.prospectId,
            job.attemptCount,
            charityAssertions[0]!,
          );
        enrichmentStatus =
          "auto_verified";
      } catch (error) {
        if (
          error instanceof
            CharityCommissionVerificationError &&
          [
            "provider_rate_limited",
            "provider_unavailable",
            "repository_unavailable",
          ].includes(error.failure)
        ) {
          return completeFailure(
            job,
            `charity_commission_${error.failure}`,
          );
        }
        reasons.push(
          "charity_number_not_confirmed",
        );
      }
    } else if (
      research?.organisationType ===
        "charity" &&
      charityAssertions.length > 1
    ) {
      reasons.push(
        "multiple_charity_numbers_found",
      );
    }

    if (
      job.companyNumber === null &&
      enrichmentStatus === "no_match" &&
      assertions.length === 1
    ) {
      const assertion = assertions[0]!;
      try {
        await options.companiesHouseService
          .verifyAutomatically(
            job.actorId,
            job.prospectId,
            assertion.companyNumber,
            job.attemptCount,
            {
              sourceUrl: assertion.sourceUrl,
              sourceExcerpt:
                assertion.sourceExcerpt,
              contentSha256:
                assertion.contentSha256,
            },
          );
        enrichmentStatus = "auto_verified";
        discoveredCompanyNumber =
          assertion.companyNumber;
      } catch (error) {
        if (
          error instanceof CompaniesHouseVerificationError &&
          error.failure === "duplicate_company"
        ) {
          enrichmentStatus = "duplicate";
          reasons.push("company_number_already_linked");
        } else if (
          error instanceof CompaniesHouseVerificationError &&
          [
            "provider_rate_limited",
            "provider_unavailable",
            "repository_unavailable",
          ].includes(error.failure)
        ) {
          return completeFailure(
            job,
            `companies_house_${error.failure}`,
          );
        } else {
          reasons.push("website_company_number_not_confirmed");
        }
      }
    } else if (
      job.companyNumber === null &&
      enrichmentStatus === "no_match" &&
      assertions.length > 1
    ) {
      reasons.push("multiple_company_numbers_found");
    }

    if (
      job.companyNumber === null &&
      enrichmentStatus === "no_match" &&
      assertions.length === 0 &&
      operatorAssertions.length === 1 &&
      options.companiesHouseService
        .verifyAutomaticallyByLegalOperator !==
          undefined
    ) {
      try {
        const verified =
          await options.companiesHouseService
            .verifyAutomaticallyByLegalOperator(
              job.actorId,
              job.prospectId,
              job.attemptCount,
              operatorAssertions[0]!,
            );
        enrichmentStatus =
          "auto_verified";
        discoveredCompanyNumber =
          verified.companyNumber;
      } catch (error) {
        if (
          error instanceof
            CompaniesHouseVerificationError &&
          [
            "provider_rate_limited",
            "provider_unavailable",
            "repository_unavailable",
          ].includes(error.failure)
        ) {
          return completeFailure(
            job,
            `companies_house_${error.failure}`,
          );
        }
        reasons.push(
          "legal_operator_not_confirmed",
        );
      }
    } else if (
      job.companyNumber === null &&
      enrichmentStatus === "no_match" &&
      operatorAssertions.length > 1
    ) {
      reasons.push(
        "multiple_legal_operators_found",
      );
    }

    if (
      job.companyNumber === null &&
      enrichmentStatus === "no_match" &&
      !isInstitutional(research)
    ) {
      try {
        candidates = uniqueMatches(
          await options.companiesHouseService.search(
            job.prospectId,
            businessName,
          ),
        );

        const identityAssertion =
          research?.facts.find((fact) =>
            fact.factName === "business_name");
        const normalizedBusinessName =
          normalizedCompanyName(businessName);
        const exactCandidates =
          identityAssertion === undefined
            ? []
            : candidates.filter((candidate) =>
                normalizedCompanyName(
                  candidate.companyName,
                ) === normalizedBusinessName,
              );

        if (
          exactCandidates.length === 1 &&
          options.companiesHouseService
            .verifyAutomaticallyByLegalOperator !==
              undefined
        ) {
          try {
            const verified =
              await options.companiesHouseService
                .verifyAutomaticallyByLegalOperator(
                  job.actorId,
                  job.prospectId,
                  job.attemptCount,
                  {
                    operatorName: businessName,
                    sourceUrl:
                      identityAssertion.sourceUrl,
                    sourceExcerpt:
                      identityAssertion.sourceExcerpt,
                    contentSha256:
                      identityAssertion.contentSha256,
                  },
                );
            enrichmentStatus =
              "auto_verified";
            discoveredCompanyNumber =
              verified.companyNumber;
            candidates = [];
          } catch (error) {
            if (
              error instanceof
                CompaniesHouseVerificationError &&
              error.failure ===
                "duplicate_company"
            ) {
              enrichmentStatus = "duplicate";
              reasons.push(
                "company_number_already_linked",
              );
            } else if (
              error instanceof
                CompaniesHouseVerificationError &&
              [
                "provider_rate_limited",
                "provider_unavailable",
                "repository_unavailable",
              ].includes(error.failure)
            ) {
              return completeFailure(
                job,
                `companies_house_${error.failure}`,
              );
            } else {
              enrichmentStatus =
                "review_required";
              reasons.push(
                "companies_house_match_requires_confirmation",
              );
            }
          }
        } else if (candidates.length > 0) {
          enrichmentStatus = "review_required";
          reasons.push(
            "companies_house_match_requires_confirmation",
          );
        } else {
          reasons.push("no_companies_house_match");
        }
      } catch (error) {
        if (
          error instanceof CompaniesHouseVerificationError &&
          [
            "provider_rate_limited",
            "provider_unavailable",
            "repository_unavailable",
          ].includes(error.failure)
        ) {
          return completeFailure(
            job,
            `companies_house_${error.failure}`,
          );
        }
        reasons.push("companies_house_search_inconclusive");
      }
    }

    let queueState: QualificationQueueState =
      "needs_founder_decision";
    try {
      const assessment = await options.leadReviewService.assess(
        job.actorId,
        job.prospectId,
      );
      const current = await options.leadReviewService.getProspect(
        job.prospectId,
      );
      const verifiedInactive = current.evidence.some(
        (item) =>
          item.verificationStatus === "verified" &&
          item.fieldName === "business_status" &&
          item.fieldValue.trim().toLowerCase() === "inactive",
      );
      if (
        assessment.blockers.includes(
          LEAD_QUALIFICATION_BLOCKERS.suppression,
        ) || verifiedInactive
      ) {
        queueState = "excluded";
      } else if (assessment.eligibilityResult === "eligible") {
        queueState = "ready_for_outreach";
      }
      reasons.push(...assessment.blockers);
    } catch {
      reasons.push("automatic_assessment_pending");
    }

    if (queueState === "ready_for_outreach") {
      reasons.length = 0;
    }
    const assertion = assertions.length === 1
      ? assertions[0]!
      : null;
    await options.repository.completeQualification({
      prospectId: job.prospectId,
      attemptCount: job.attemptCount,
      enrichmentStatus,
      queueState,
      reasons: unique(reasons),
      researchSummary: research === null
        ? {}
        : {
            canonicalWebsiteUrl:
              research.canonicalWebsiteUrl,
            visitedUrls: research.visitedUrls,
            truncatedPageCount:
              research.truncatedPageCount,
            organisationType:
              research.organisationType,
            legalOperatorNames:
              operatorAssertions.map(
                (item) =>
                  item.operatorName,
              ),
            charityNumbers:
              charityAssertions.map(
                (item) =>
                  item.charityNumber,
              ),
            contactRecovery: {
              attempted:
                contactRecoveryStatus !==
                  "not_needed",
              status: contactRecoveryStatus,
              visitedUrls:
                contactRecoveryVisitedUrls,
              truncatedPageCount:
                contactRecoveryTruncatedPageCount,
              recoveredFactCount:
                recoveredContactFactCount,
            },
            verifiedFactCount:
              research.facts.length +
              recoveredContactFactCount +
              additionalVerifiedFactCount,
          },
      discoveredCompanyNumber,
      sourceUrl: assertion?.sourceUrl ?? null,
      sourceExcerpt:
        assertion?.sourceExcerpt ?? null,
      sourceContentSha256:
        assertion?.contentSha256 ?? null,
      candidates,
      lastErrorCode: null,
    });

    if (queueState === "ready_for_outreach") return "auto";
    if (queueState === "excluded") return "complete";
    return "review";
  }

  return {
    async runBatch() {
      await options.repository.activate(
        options.activationTotalLimit,
      );
      const jobs = await options.repository.claimQualificationJobs(
        options.batchSize,
        options.leaseSeconds,
      );
      return result(await Promise.all(
        jobs.map((job) => processJob(job)),
      ));
    },

    async retry(prospectId, actorId) {
      await options.repository.retry(
        prospectId,
        actorId,
      );
    },
  };
}
