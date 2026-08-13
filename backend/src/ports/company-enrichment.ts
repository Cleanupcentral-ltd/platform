import type {
  CompaniesHouseCompanySummary,
} from "./companies-house.js";

export const COMPANY_ENRICHMENT_STATUSES = [
  "pending",
  "processing",
  "auto_verified",
  "review_required",
  "no_match",
  "duplicate",
  "failed",
  "verified_existing",
] as const;

export type CompanyEnrichmentStatus =
  (typeof COMPANY_ENRICHMENT_STATUSES)[number];

export interface CompanyEnrichmentJob {
  readonly prospectId: string;
  readonly actorId: string;
  readonly businessName: string;
  readonly websiteUrl: string | null;
  readonly companyNumber: string | null;
  readonly attemptCount: number;
}

export interface CompanyEnrichmentRecord {
  readonly status: CompanyEnrichmentStatus;
  readonly discoveredCompanyNumber:
    string | null;
  readonly sourceUrl: string | null;
  readonly candidates:
    readonly CompaniesHouseCompanySummary[];
  readonly lastErrorCode: string | null;
  readonly attemptCount: number;
  readonly lastAttemptAt: string | null;
  readonly completedAt: string | null;
}

export interface CompleteCompanyEnrichmentInput {
  readonly prospectId: string;
  readonly attemptCount: number;
  readonly status: Exclude<
    CompanyEnrichmentStatus,
    "pending" | "processing"
  >;
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

export interface CompanyEnrichmentRepository {
  claimJobs(
    limit: number,
    leaseSeconds: number,
  ): Promise<readonly CompanyEnrichmentJob[]>;

  complete(
    input: CompleteCompanyEnrichmentInput,
  ): Promise<void>;

  retry(
    prospectId: string,
    actorId: string,
  ): Promise<void>;
}

export interface FirstPartyCompanyNumberEvidence {
  readonly companyNumbers:
    readonly string[];
  readonly sourceUrl: string;
  readonly sourceExcerpt: string;
  readonly contentSha256: string;
}

export interface FirstPartyCompanyNumberProvider {
  find(
    websiteUrl: string,
  ): Promise<FirstPartyCompanyNumberEvidence | null>;
}
