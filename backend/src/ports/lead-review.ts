import type {
  LeadSector,
} from "./lead-search.js";

import type {
  CompanyEnrichmentRecord,
} from "./company-enrichment.js";

export const LEAD_EVIDENCE_SOURCE_TYPES = [
  "first_party_website",
  "companies_house",
] as const;

export type LeadEvidenceSourceType =
  (typeof LEAD_EVIDENCE_SOURCE_TYPES)[number];

export const LEAD_VERIFICATION_FACTS = [
  "business_name",
  "approved_sector",
  "business_status",
  "trading_address",
  "website_url",
  "public_email",
  "contact_form_url",
  "recurring_cleaning_need",
  "premises_scale",
  "subscriber_type",
  "company_number",
] as const;

export type LeadVerificationFact =
  (typeof LEAD_VERIFICATION_FACTS)[number];

export type LeadVerificationStatus =
  | "unverified"
  | "verified"
  | "rejected";

export interface LeadProspectSummary {
  readonly id: string;
  readonly businessName: string;
  readonly sector: LeadSector;
  readonly primaryPostcode: string | null;
  readonly websiteUrl: string | null;
  readonly createdAt: string;
  readonly viewedAt: string | null;
  readonly evidenceCounts: {
    readonly unverified: number;
    readonly verified: number;
    readonly rejected: number;
  };
  readonly latestAssessment: {
    readonly totalScore: number;
    readonly eligibilityResult:
      | "eligible"
      | "research_required";
    readonly assessedAt: string;
  } | null;
  readonly companyEnrichment?:
    CompanyEnrichmentRecord | null;
}

export interface LeadEvidenceRecord {
  readonly id: string;
  readonly sourceUrl: string;
  readonly sourceType: string;
  readonly fieldName: string;
  readonly fieldValue: string;
  readonly sourceExcerpt: string | null;
  readonly verificationStatus:
    LeadVerificationStatus;
  readonly capturedAt: string;
  readonly verifiedAt: string | null;
  readonly verificationMethod?:
    | "founder_review"
    | "automatic_first_party_company_number"
    | "automatic_first_party_legal_operator"
    | "automatic_first_party_research";
}

export interface LeadContactRecord {
  readonly id: string;
  readonly contactType:
    | "email"
    | "phone"
    | "contact_form";
  readonly contactValue: string;
  readonly normalizedValue: string;
  readonly sourceEvidenceId: string;
  readonly verificationStatus:
    LeadVerificationStatus;
}

export interface LeadAssessmentRecord {
  readonly id: string;
  readonly totalScore: number;
  readonly rulesVersion: string;
  readonly eligibilityResult:
    | "eligible"
    | "research_required";
  readonly scoreBreakdown:
    Readonly<Record<string, unknown>>;
  readonly blockers: readonly string[];
  readonly rationale: string;
  readonly evidenceIds: readonly string[];
  readonly assessedAt: string;
}

export interface LeadProspectReview {
  readonly id: string;
  readonly businessName: string;
  readonly sector: LeadSector;
  readonly primaryPostcode: string | null;
  readonly websiteUrl: string | null;
  readonly companyNumber: string | null;
  readonly createdAt: string;
  readonly hasSearchProvenance: boolean;
  readonly hasActiveSuppression: boolean;
  readonly evidence: readonly LeadEvidenceRecord[];
  readonly contacts: readonly LeadContactRecord[];
  readonly latestAssessment:
    LeadAssessmentRecord | null;
  readonly companyEnrichment?:
    CompanyEnrichmentRecord | null;
}

export interface AddVerifiedLeadEvidenceInput {
  readonly prospectId: string;
  readonly founderId: string;
  readonly sourceType:
    LeadEvidenceSourceType;
  readonly sourceUrl: string;
  readonly factName:
    LeadVerificationFact;
  readonly factValue: string;
  readonly sourceExcerpt: string | null;
  readonly contentSha256: string;
  readonly contactType:
    "email" | "contact_form" | null;
  readonly normalizedContactValue:
    string | null;
}

export interface DecideLeadEvidenceInput {
  readonly prospectId: string;
  readonly evidenceId: string;
  readonly founderId: string;
  readonly decision:
    "verified" | "rejected";
  readonly reviewNote: string | null;
}

export interface SaveLeadAssessmentInput {
  readonly prospectId: string;
  readonly founderId: string;
  readonly totalScore: number;
  readonly rulesVersion: string;
  readonly eligibilityResult:
    | "eligible"
    | "research_required";
  readonly scoreBreakdown:
    Readonly<Record<string, unknown>>;
  readonly blockers: readonly string[];
  readonly rationale: string;
  readonly evidenceIds: readonly string[];
}

export interface CompaniesHouseVerifiedFact {
  readonly factName:
    | "business_name"
    | "business_status"
    | "subscriber_type"
    | "company_number";
  readonly factValue: string;
  readonly sourceExcerpt: string;
  readonly contentSha256: string;
}

export interface RecordCompaniesHouseVerificationInput {
  readonly prospectId: string;
  readonly founderId: string;
  readonly sourceUrl: string;
  readonly facts:
    readonly CompaniesHouseVerifiedFact[];
}

export interface FirstPartyCompanyNumberAssertion {
  readonly sourceUrl: string;
  readonly sourceExcerpt: string;
  readonly contentSha256: string;
}

export interface RecordAutomaticCompaniesHouseVerificationInput
extends RecordCompaniesHouseVerificationInput {
  readonly enrichmentAttemptCount: number;
  readonly firstPartyAssertion:
    FirstPartyCompanyNumberAssertion;
}

export interface FirstPartyLegalOperatorAssertion {
  readonly operatorName: string;
  readonly sourceUrl: string;
  readonly sourceExcerpt: string;
  readonly contentSha256: string;
}

export interface RecordAutomaticLegalOperatorVerificationInput
extends RecordCompaniesHouseVerificationInput {
  readonly enrichmentAttemptCount: number;
  readonly firstPartyAssertion:
    FirstPartyLegalOperatorAssertion;
}

export interface LeadReviewRepository {
  listProspects(
    founderId: string,
    limit: number,
  ): Promise<readonly LeadProspectSummary[]>;

  setProspectViewed(
    founderId: string,
    prospectId: string,
    viewed: boolean,
  ): Promise<string | null>;

  getProspect(
    prospectId: string,
  ): Promise<LeadProspectReview | null>;

  addVerifiedEvidence(
    input: AddVerifiedLeadEvidenceInput,
  ): Promise<string>;

  findProspectByCompanyNumber(
    companyNumber: string,
  ): Promise<{
    readonly id: string;
    readonly businessName: string;
  } | null>;

  recordCompaniesHouseVerification(
    input:
      RecordCompaniesHouseVerificationInput,
  ): Promise<readonly string[]>;

  recordAutomaticCompaniesHouseVerification(
    input:
      RecordAutomaticCompaniesHouseVerificationInput,
  ): Promise<readonly string[]>;

  recordAutomaticLegalOperatorVerification?(
    input:
      RecordAutomaticLegalOperatorVerificationInput,
  ): Promise<readonly string[]>;

  decideEvidence(
    input: DecideLeadEvidenceInput,
  ): Promise<void>;

  saveAssessment(
    input: SaveLeadAssessmentInput,
  ): Promise<LeadAssessmentRecord>;
}
