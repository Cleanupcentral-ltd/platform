import type {
  LeadSector,
} from "./lead-search-api";

export type VerificationStatus =
  | "unverified"
  | "verified"
  | "rejected";

export type VerificationSourceType =
  | "first_party_website"
  | "companies_house";

export type VerificationFactName =
  | "business_name"
  | "approved_sector"
  | "business_status"
  | "trading_address"
  | "website_url"
  | "public_email"
  | "contact_form_url"
  | "recurring_cleaning_need"
  | "premises_scale"
  | "subscriber_type"
  | "company_number";

export type CompanyEnrichmentStatus =
  | "pending"
  | "processing"
  | "auto_verified"
  | "review_required"
  | "no_match"
  | "duplicate"
  | "failed"
  | "verified_existing";

export interface ProspectSummary {
  readonly id: string;
  readonly businessName: string;
  readonly sector: LeadSector;
  readonly primaryPostcode: string | null;
  readonly websiteUrl: string | null;
  readonly createdAt: string;
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

export interface ProspectEvidence {
  readonly id: string;
  readonly sourceUrl: string;
  readonly sourceType: string;
  readonly fieldName: string;
  readonly fieldValue: string;
  readonly sourceExcerpt: string | null;
  readonly verificationStatus:
    VerificationStatus;
  readonly capturedAt: string;
  readonly verifiedAt: string | null;
  readonly verificationMethod?:
    | "founder_review"
    | "automatic_first_party_company_number";
}

export interface ProspectAssessment {
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

export interface AutomaticAssessmentResult {
  readonly status: "updated" | "pending";
  readonly assessment:
    ProspectAssessment | null;
}

export interface VerificationSaveResult {
  readonly evidenceId: string;
  readonly automaticAssessment:
    AutomaticAssessmentResult;
}

export interface CompaniesHouseMatch {
  readonly companyName: string;
  readonly companyNumber: string;
  readonly companyStatus: string;
  readonly companyType: string;
  readonly registeredOfficeAddress: {
    readonly formatted: string | null;
    readonly postcode: string | null;
  };
  readonly dateOfCreation: string | null;
  readonly officialUrl: string;
}

export interface CompanyEnrichmentRecord {
  readonly status: CompanyEnrichmentStatus;
  readonly discoveredCompanyNumber:
    string | null;
  readonly sourceUrl: string | null;
  readonly candidates:
    readonly CompaniesHouseMatch[];
  readonly lastErrorCode: string | null;
  readonly attemptCount: number;
  readonly lastAttemptAt: string | null;
  readonly completedAt: string | null;
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

export interface ProspectReview {
  readonly id: string;
  readonly businessName: string;
  readonly sector: LeadSector;
  readonly primaryPostcode: string | null;
  readonly websiteUrl: string | null;
  readonly companyNumber: string | null;
  readonly createdAt: string;
  readonly hasSearchProvenance: boolean;
  readonly hasActiveSuppression: boolean;
  readonly evidence:
    readonly ProspectEvidence[];
  readonly contacts: readonly {
    readonly id: string;
    readonly contactType: string;
    readonly contactValue: string;
    readonly sourceEvidenceId: string;
    readonly verificationStatus:
      VerificationStatus;
  }[];
  readonly latestAssessment:
    ProspectAssessment | null;
  readonly companyEnrichment?:
    CompanyEnrichmentRecord | null;
}

export interface AddVerificationEvidenceInput {
  readonly sourceType:
    VerificationSourceType;
  readonly sourceUrl: string;
  readonly factName:
    VerificationFactName;
  readonly factValue: string;
  readonly sourceExcerpt: string | null;
}

interface ApiErrorBody {
  readonly error?: {
    readonly message?: unknown;
  };
}

async function requestJson<T>(
  url: string,
  accessToken: string,
  init: RequestInit,
  fetchFunction: typeof fetch,
): Promise<T> {
  const response =
    await fetchFunction(url, {
      ...init,
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
        ...init.headers,
      },
      cache: "no-store",
    });

  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    // The status-specific message below remains useful.
  }

  if (!response.ok) {
    const message =
      typeof (
        parsed as ApiErrorBody | null
      )?.error?.message === "string"
        ? (
            parsed as ApiErrorBody
          ).error!.message as string
        : `The request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return parsed as T;
}

function baseUrl(
  backendUrl: string,
): string {
  return backendUrl.replace(/\/$/, "");
}

export async function listProspects(
  backendUrl: string,
  accessToken: string,
  fetchFunction: typeof fetch = fetch,
): Promise<readonly ProspectSummary[]> {
  const response =
    await requestJson<{
      readonly prospects:
        readonly ProspectSummary[];
    }>(
      `${baseUrl(backendUrl)}/api/ops/leads/prospects`,
      accessToken,
      { method: "GET" },
      fetchFunction,
    );
  return response.prospects;
}

export async function getProspect(
  backendUrl: string,
  accessToken: string,
  prospectId: string,
  fetchFunction: typeof fetch = fetch,
): Promise<ProspectReview> {
  const response =
    await requestJson<{
      readonly prospect:
        ProspectReview;
    }>(
      `${baseUrl(backendUrl)}/api/ops/leads/prospects/${encodeURIComponent(prospectId)}`,
      accessToken,
      { method: "GET" },
      fetchFunction,
    );
  return response.prospect;
}

export async function addVerificationEvidence(
  backendUrl: string,
  accessToken: string,
  prospectId: string,
  input: AddVerificationEvidenceInput,
  fetchFunction: typeof fetch = fetch,
): Promise<VerificationSaveResult> {
  const response =
    await requestJson<{
      readonly verification: {
        readonly evidenceId: string;
        readonly automaticAssessment:
          AutomaticAssessmentResult;
      };
    }>(
      `${baseUrl(backendUrl)}/api/ops/leads/prospects/${encodeURIComponent(prospectId)}/evidence`,
      accessToken,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(input),
      },
      fetchFunction,
    );
  return response.verification;
}

export async function decideEvidence(
  backendUrl: string,
  accessToken: string,
  prospectId: string,
  evidenceId: string,
  decision: "verified" | "rejected",
  fetchFunction: typeof fetch = fetch,
): Promise<AutomaticAssessmentResult> {
  const response = await requestJson<{
    readonly automaticAssessment:
      AutomaticAssessmentResult;
  }>(
    `${baseUrl(backendUrl)}/api/ops/leads/prospects/${encodeURIComponent(prospectId)}/evidence/${encodeURIComponent(evidenceId)}/decision`,
    accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        decision,
        reviewNote: null,
      }),
    },
    fetchFunction,
  );
  return response.automaticAssessment;
}

export async function assessProspect(
  backendUrl: string,
  accessToken: string,
  prospectId: string,
  fetchFunction: typeof fetch = fetch,
): Promise<ProspectAssessment> {
  const response =
    await requestJson<{
      readonly assessment:
        ProspectAssessment;
    }>(
      `${baseUrl(backendUrl)}/api/ops/leads/prospects/${encodeURIComponent(prospectId)}/assessments`,
      accessToken,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: "{}",
      },
      fetchFunction,
    );
  return response.assessment;
}

export async function searchCompaniesHouseMatches(
  backendUrl: string,
  accessToken: string,
  prospectId: string,
  query: string,
  fetchFunction: typeof fetch = fetch,
): Promise<readonly CompaniesHouseMatch[]> {
  const response = await requestJson<{
    readonly matches:
      readonly CompaniesHouseMatch[];
  }>(
    `${baseUrl(backendUrl)}/api/ops/leads/prospects/${encodeURIComponent(prospectId)}/companies-house/matches?q=${encodeURIComponent(query)}`,
    accessToken,
    { method: "GET" },
    fetchFunction,
  );
  return response.matches;
}

export async function verifyCompaniesHouseMatch(
  backendUrl: string,
  accessToken: string,
  prospectId: string,
  companyNumber: string,
  fetchFunction: typeof fetch = fetch,
): Promise<CompaniesHouseVerificationResult> {
  const response = await requestJson<{
    readonly verification:
      CompaniesHouseVerificationResult;
  }>(
    `${baseUrl(backendUrl)}/api/ops/leads/prospects/${encodeURIComponent(prospectId)}/companies-house/verification`,
    accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        companyNumber,
      }),
    },
    fetchFunction,
  );
  return response.verification;
}

export async function retryCompanyEnrichment(
  backendUrl: string,
  accessToken: string,
  prospectId: string,
  fetchFunction: typeof fetch = fetch,
): Promise<void> {
  await requestJson(
    `${baseUrl(backendUrl)}/api/ops/leads/prospects/${encodeURIComponent(prospectId)}/company-enrichment/retry`,
    accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{}",
    },
    fetchFunction,
  );
}
