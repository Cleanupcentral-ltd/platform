import { createHash } from "node:crypto";

import {
  calculateLeadAssessment,
} from "../domain/lead-assessment.js";

import type {
  LeadAssessmentRecord,
  LeadEvidenceSourceType,
  LeadProspectReview,
  LeadProspectSummary,
  LeadReviewRepository,
  LeadVerificationFact,
} from "../ports/lead-review.js";

export type LeadReviewFailure =
  | "not_found"
  | "invalid_evidence"
  | "repository_unavailable";

export class LeadReviewError extends Error {
  readonly failure: LeadReviewFailure;

  constructor(failure: LeadReviewFailure) {
    super(failure);
    this.name = "LeadReviewError";
    this.failure = failure;
  }
}

export interface AddLeadEvidenceInput {
  readonly sourceType:
    LeadEvidenceSourceType;
  readonly sourceUrl: string;
  readonly factName:
    LeadVerificationFact;
  readonly factValue: string;
  readonly sourceExcerpt: string | null;
}

export interface DecideLeadEvidenceRequest {
  readonly decision:
    "verified" | "rejected";
  readonly reviewNote: string | null;
}

export interface LeadReviewService {
  listProspects(): Promise<
    readonly LeadProspectSummary[]
  >;

  getProspect(
    prospectId: string,
  ): Promise<LeadProspectReview>;

  addEvidence(
    founderId: string,
    prospectId: string,
    input: AddLeadEvidenceInput,
  ): Promise<{ readonly evidenceId: string }>;

  decideEvidence(
    founderId: string,
    prospectId: string,
    evidenceId: string,
    input: DecideLeadEvidenceRequest,
  ): Promise<void>;

  assess(
    founderId: string,
    prospectId: string,
  ): Promise<LeadAssessmentRecord>;
}

const CONTROLLED_FACT_VALUES:
  Readonly<Record<string, readonly string[]>> = {
    approved_sector: [
      "short_let_serviced_accommodation",
      "offices_coworking",
      "community_halls_event_venues",
      "estate_letting_agents",
      "university_accommodation",
      "other_commercial_spaces",
    ],
    business_status: [
      "active",
      "inactive",
    ],
    premises_scale: [
      "one_active_premises",
      "multiple_properties_locations_or_units",
    ],
    subscriber_type: [
      "unknown",
      "corporate",
      "sole_trader",
      "partnership",
    ],
  };

const COMPANIES_HOUSE_FACTS =
  new Set<LeadVerificationFact>([
    "business_name",
    "approved_sector",
    "business_status",
    "subscriber_type",
    "company_number",
  ]);

const COMPANIES_HOUSE_HOSTS =
  new Set([
    "find-and-update.company-information.service.gov.uk",
    "api.company-information.service.gov.uk",
  ]);

function sha256(value: string): string {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function normalizedUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new LeadReviewError(
      "invalid_evidence",
    );
  }
  url.hash = "";
  return url.toString();
}

function normalizeFactValue(
  factName: LeadVerificationFact,
  rawValue: string,
): string {
  const value = rawValue.trim();
  if (value.length === 0) {
    throw new LeadReviewError(
      "invalid_evidence",
    );
  }

  const controlled =
    CONTROLLED_FACT_VALUES[factName];
  if (
    controlled !== undefined &&
    !controlled.includes(value)
  ) {
    throw new LeadReviewError(
      "invalid_evidence",
    );
  }

  if (factName === "public_email") {
    const email = value.toLowerCase();
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email,
      )
    ) {
      throw new LeadReviewError(
        "invalid_evidence",
      );
    }
    return email;
  }

  if (
    factName === "website_url" ||
    factName === "contact_form_url"
  ) {
    return normalizedUrl(value);
  }

  return value;
}

export function createLeadReviewService(
  repository: LeadReviewRepository,
): LeadReviewService {
  async function prospect(
    prospectId: string,
  ): Promise<LeadProspectReview> {
    let result;
    try {
      result =
        await repository.getProspect(
          prospectId,
        );
    } catch {
      throw new LeadReviewError(
        "repository_unavailable",
      );
    }

    if (result === null) {
      throw new LeadReviewError(
        "not_found",
      );
    }

    return result;
  }

  return {
    async listProspects() {
      try {
        return await repository
          .listProspects(100);
      } catch {
        throw new LeadReviewError(
          "repository_unavailable",
        );
      }
    },

    getProspect: prospect,

    async addEvidence(
      founderId,
      prospectId,
      input,
    ) {
      await prospect(prospectId);
      const sourceUrl =
        normalizedUrl(input.sourceUrl);
      const sourceHost =
        new URL(sourceUrl).hostname;
      if (
        input.sourceType ===
          "companies_house" &&
        (
          !COMPANIES_HOUSE_FACTS.has(
            input.factName,
          ) ||
          !COMPANIES_HOUSE_HOSTS.has(
            sourceHost,
          )
        )
      ) {
        throw new LeadReviewError(
          "invalid_evidence",
        );
      }
      const factValue =
        normalizeFactValue(
          input.factName,
          input.factValue,
        );
      const contactType =
        input.factName === "public_email"
          ? "email" as const
          : input.factName ===
              "contact_form_url"
            ? "contact_form" as const
            : null;
      const normalizedContactValue =
        contactType === null
          ? null
          : factValue.toLowerCase();

      try {
        const evidenceId =
          await repository
            .addVerifiedEvidence({
              prospectId,
              founderId,
              sourceType:
                input.sourceType,
              sourceUrl,
              factName:
                input.factName,
              factValue,
              sourceExcerpt:
                input.sourceExcerpt,
              contentSha256:
                sha256(
                  `${sourceUrl}\n${input.factName}\n${factValue}`,
                ),
              contactType,
              normalizedContactValue,
            });
        return { evidenceId };
      } catch {
        throw new LeadReviewError(
          "repository_unavailable",
        );
      }
    },

    async decideEvidence(
      founderId,
      prospectId,
      evidenceId,
      input,
    ) {
      const current =
        await prospect(prospectId);
      if (
        !current.evidence.some(
          (item) =>
            item.id === evidenceId,
        )
      ) {
        throw new LeadReviewError(
          "not_found",
        );
      }

      try {
        await repository.decideEvidence({
          prospectId,
          evidenceId,
          founderId,
          decision: input.decision,
          reviewNote:
            input.reviewNote,
        });
      } catch {
        throw new LeadReviewError(
          "repository_unavailable",
        );
      }
    },

    async assess(
      founderId,
      prospectId,
    ) {
      const current =
        await prospect(prospectId);
      const calculated =
        calculateLeadAssessment(
          current,
        );
      try {
        return await repository
          .saveAssessment({
            prospectId,
            founderId,
            totalScore:
              calculated.totalScore,
            rulesVersion:
              calculated.rulesVersion,
            eligibilityResult:
              calculated.eligibilityResult,
            scoreBreakdown:
              calculated.scoreBreakdown,
            blockers:
              calculated.blockers,
            rationale:
              calculated.rationale,
            evidenceIds:
              calculated.evidenceIds,
          });
      } catch {
        throw new LeadReviewError(
          "repository_unavailable",
        );
      }
    },
  };
}
