import type {
  CompaniesHouseCompanySummary,
} from "./companies-house.js";

import type {
  LeadSector,
} from "./lead-search.js";

export const QUALIFICATION_QUEUE_STATES = [
  "ready_for_outreach",
  "needs_founder_decision",
  "excluded",
  "processing",
] as const;

export type QualificationQueueState =
  (typeof QUALIFICATION_QUEUE_STATES)[number];

export interface AutomaticQualificationJob {
  readonly prospectId: string;
  readonly actorId: string;
  readonly businessName: string;
  readonly sector: LeadSector;
  readonly websiteUrl: string | null;
  readonly companyNumber: string | null;
  readonly attemptCount: number;
}

export type AutomaticResearchFactName =
  | "business_name"
  | "approved_sector"
  | "business_status"
  | "public_email"
  | "contact_form_url"
  | "recurring_cleaning_need"
  | "premises_scale"
  | "subscriber_type"
  | "organisation_type"
  | "website_url";

export interface AutomaticResearchFact {
  readonly sourceUrl: string;
  readonly factName: AutomaticResearchFactName;
  readonly factValue: string;
  readonly sourceExcerpt: string;
  readonly contentSha256: string;
  readonly contactType:
    | "email"
    | "contact_form"
    | null;
  readonly normalizedContactValue:
    string | null;
}

export interface FirstPartyResearchResult {
  readonly canonicalWebsiteUrl: string;
  readonly companyNumberAssertions:
    readonly {
      readonly companyNumber: string;
      readonly sourceUrl: string;
      readonly sourceExcerpt: string;
      readonly contentSha256: string;
    }[];
  readonly facts: readonly AutomaticResearchFact[];
  readonly visitedUrls: readonly string[];
  readonly truncatedPageCount: number;
  readonly organisationType:
    | "commercial"
    | "university"
    | "public_body"
    | "charity"
    | "community_organisation"
    | "unknown";
  readonly reviewReasons: readonly string[];
}

export interface FirstPartyResearchProvider {
  research(
    websiteUrl: string,
    businessName: string,
    sector: LeadSector,
  ): Promise<FirstPartyResearchResult>;
}

export interface CompleteAutomaticQualificationInput {
  readonly prospectId: string;
  readonly attemptCount: number;
  readonly enrichmentStatus:
    | "auto_verified"
    | "review_required"
    | "no_match"
    | "duplicate"
    | "failed"
    | "verified_existing";
  readonly queueState: QualificationQueueState;
  readonly reasons: readonly string[];
  readonly researchSummary:
    Readonly<Record<string, unknown>>;
  readonly discoveredCompanyNumber:
    string | null;
  readonly sourceUrl: string | null;
  readonly sourceExcerpt: string | null;
  readonly sourceContentSha256:
    string | null;
  readonly candidates:
    readonly CompaniesHouseCompanySummary[];
  readonly lastErrorCode: string | null;
  readonly retryAfterSeconds?: number;
}

export interface AutomaticQualificationRepository {
  activate(
    totalLimit: number | null,
  ): Promise<number>;

  claimQualificationJobs(
    limit: number,
    leaseSeconds: number,
  ): Promise<readonly AutomaticQualificationJob[]>;

  recordResearch(
    prospectId: string,
    actorId: string,
    attemptCount: number,
    facts: readonly AutomaticResearchFact[],
  ): Promise<readonly string[]>;

  recordSinglePremises?(
    prospectId: string,
    actorId: string,
    attemptCount: number,
    sourceUrl: string,
    sourceExcerpt: string,
    contentSha256: string,
  ): Promise<readonly string[]>;

  completeQualification(
    input: CompleteAutomaticQualificationInput,
  ): Promise<void>;

  retry(
    prospectId: string,
    actorId: string,
  ): Promise<void>;
}
