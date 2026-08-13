import { z } from "zod";

import type {
  AddVerifiedLeadEvidenceInput,
  DecideLeadEvidenceInput,
  LeadAssessmentRecord,
  LeadEvidenceRecord,
  LeadProspectReview,
  LeadProspectSummary,
  LeadReviewRepository,
  RecordAutomaticCompaniesHouseVerificationInput,
  RecordCompaniesHouseVerificationInput,
  SaveLeadAssessmentInput,
} from "../../ports/lead-review.js";

import {
  COMPANY_ENRICHMENT_STATUSES,
  type CompanyEnrichmentRecord,
} from "../../ports/company-enrichment.js";

type FetchFunction = typeof fetch;

const prospectRowSchema = z.object({
  id: z.string().uuid(),
  business_name: z.string(),
  sector: z.enum([
    "short_let_serviced_accommodation",
    "offices_coworking",
    "community_halls_event_venues",
    "estate_letting_agents",
    "university_accommodation",
    "other_commercial_spaces",
  ]),
  primary_postcode:
    z.string().nullable(),
  website_url: z.string().nullable(),
  company_number:
    z.string().nullable(),
  created_at: z.string(),
});

const evidenceRowSchema = z.object({
  id: z.string().uuid(),
  prospect_id: z.string().uuid(),
  source_url: z.string().url(),
  source_type: z.string(),
  field_name: z.string(),
  field_value: z.string(),
  source_excerpt:
    z.string().nullable(),
  verification_status: z.enum([
    "unverified",
    "verified",
    "rejected",
  ]),
  captured_at: z.string(),
  verified_at: z.string().nullable(),
  verification_method: z.enum([
    "founder_review",
    "automatic_first_party_company_number",
    "automatic_first_party_research",
  ]).optional().default("founder_review"),
});

const companyMatchSchema = z.object({
  companyName: z.string(),
  companyNumber: z.string(),
  companyStatus: z.string(),
  companyType: z.string(),
  registeredOfficeAddress: z.object({
    formatted: z.string().nullable(),
    postcode: z.string().nullable(),
  }),
  dateOfCreation: z.string().nullable(),
  officialUrl: z.string().url(),
});

const enrichmentRowSchema = z.object({
  prospect_id: z.string().uuid(),
  status: z.enum(COMPANY_ENRICHMENT_STATUSES),
  discovered_company_number:
    z.string().nullable(),
  source_url: z.string().nullable(),
  candidates: z.array(companyMatchSchema),
  last_error_code: z.string().nullable(),
  attempt_count: z.number().int().min(0),
  last_attempt_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  qualification_state: z.enum([
    "ready_for_outreach",
    "needs_founder_decision",
    "excluded",
    "processing",
  ]).optional(),
  qualification_reasons:
    z.array(z.string()).optional(),
  research_summary:
    z.record(z.string(), z.unknown()).optional(),
  research_completed_at:
    z.string().nullable().optional(),
});

const contactRowSchema = z.object({
  id: z.string().uuid(),
  prospect_id: z.string().uuid(),
  contact_type: z.enum([
    "email",
    "phone",
    "contact_form",
  ]),
  contact_value: z.string(),
  normalized_value: z.string(),
  source_evidence_id: z.string().uuid(),
  verification_status: z.enum([
    "unverified",
    "verified",
    "rejected",
  ]),
});

const assessmentRowSchema = z.object({
  id: z.string().uuid(),
  prospect_id: z.string().uuid(),
  total_score:
    z.number().int().min(0).max(10),
  rules_version: z.string(),
  eligibility_result: z.enum([
    "eligible",
    "research_required",
  ]),
  score_breakdown:
    z.record(z.string(), z.unknown()),
  blockers: z.array(z.string()),
  rationale: z.string(),
  evidence_ids:
    z.array(z.string().uuid()),
  assessed_at: z.string(),
});

const searchProvenanceRowSchema =
  z.object({
    prospect_id: z.string().uuid(),
  });

const suppressionRowSchema = z.object({
  prospect_id:
    z.string().uuid().nullable(),
  normalized_value: z.string(),
});

const evidenceIdResponseSchema =
  z.array(
    z.object({
      evidence_id: z.string().uuid(),
    }),
  ).length(1);

const evidenceIdsResponseSchema =
  z.array(
    z.object({
      evidence_ids:
        z.array(z.string().uuid()),
    }),
  ).length(1);

export interface SupabaseLeadReviewRepositoryOptions {
  readonly supabaseUrl: string;
  readonly secretKey: string;
  readonly timeoutMs: number;
  readonly fetchFunction?: FetchFunction;
  readonly companyEnrichmentEnabled?: boolean;
  readonly automaticQualificationEnabled?:
    boolean;
}

function mapEvidence(
  row: z.infer<typeof evidenceRowSchema>,
): LeadEvidenceRecord {
  return {
    id: row.id,
    sourceUrl: row.source_url,
    sourceType: row.source_type,
    fieldName: row.field_name,
    fieldValue: row.field_value,
    sourceExcerpt:
      row.source_excerpt,
    verificationStatus:
      row.verification_status,
    capturedAt: row.captured_at,
    verifiedAt: row.verified_at,
    verificationMethod:
      row.verification_method,
  };
}

function mapEnrichment(
  row: z.infer<typeof enrichmentRowSchema>,
): CompanyEnrichmentRecord {
  return {
    status: row.status,
    discoveredCompanyNumber:
      row.discovered_company_number,
    sourceUrl: row.source_url,
    candidates: row.candidates,
    lastErrorCode:
      row.last_error_code,
    attemptCount: row.attempt_count,
    lastAttemptAt: row.last_attempt_at,
    completedAt: row.completed_at,
    ...(row.qualification_state === undefined
      ? {}
      : {
          qualificationState:
            row.qualification_state,
        }),
    ...(row.qualification_reasons === undefined
      ? {}
      : {
          qualificationReasons:
            row.qualification_reasons,
        }),
    ...(row.research_summary === undefined
      ? {}
      : {
          researchSummary:
            row.research_summary,
        }),
    ...(row.research_completed_at === undefined
      ? {}
      : {
          researchCompletedAt:
            row.research_completed_at,
        }),
  };
}

function mapAssessment(
  row: z.infer<typeof assessmentRowSchema>,
): LeadAssessmentRecord {
  return {
    id: row.id,
    totalScore: row.total_score,
    rulesVersion: row.rules_version,
    eligibilityResult:
      row.eligibility_result,
    scoreBreakdown:
      row.score_breakdown,
    blockers: row.blockers,
    rationale: row.rationale,
    evidenceIds: row.evidence_ids,
    assessedAt: row.assessed_at,
  };
}

export class SupabaseLeadReviewRepository
implements LeadReviewRepository {
  private readonly restUrl: string;
  private readonly secretKey: string;
  private readonly timeoutMs: number;
  private readonly fetchFunction: FetchFunction;
  private readonly companyEnrichmentEnabled:
    boolean;
  private readonly automaticQualificationEnabled:
    boolean;

  constructor(
    options:
      SupabaseLeadReviewRepositoryOptions,
  ) {
    this.restUrl =
      `${options.supabaseUrl.replace(/\/$/, "")}/rest/v1`;
    this.secretKey = options.secretKey;
    this.timeoutMs = options.timeoutMs;
    this.fetchFunction =
      options.fetchFunction ?? fetch;
    this.companyEnrichmentEnabled =
      options.companyEnrichmentEnabled ?? false;
    this.automaticQualificationEnabled =
      options.automaticQualificationEnabled ?? false;
  }

  private async request(
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const controller =
      new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.timeoutMs,
    );

    try {
      const response =
        await this.fetchFunction(
          `${this.restUrl}${path}`,
          {
            ...init,
            headers: {
              accept: "application/json",
              apikey: this.secretKey,
              authorization:
                `Bearer ${this.secretKey}`,
              "accept-profile":
                "lead_engine",
              "content-profile":
                "lead_engine",
              ...init.headers,
            },
            signal: controller.signal,
          },
        );

      if (!response.ok) {
        throw new Error(
          `Lead review store request failed with status ${response.status}.`,
        );
      }

      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async json<T>(
    path: string,
    schema: z.ZodType<T>,
    init: RequestInit = {},
  ): Promise<T> {
    const response =
      await this.request(path, init);
    const parsed = schema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      throw new Error(
        "Lead review store returned an invalid response.",
      );
    }
    return parsed.data;
  }

  async listProspects(
    limit: number,
  ): Promise<readonly LeadProspectSummary[]> {
    const [prospects, evidence, assessments,
      enrichments] =
      await Promise.all([
        this.json(
          `/prospects?select=id,business_name,sector,primary_postcode,website_url,company_number,created_at&order=created_at.desc,id.desc&limit=${limit}`,
          z.array(prospectRowSchema),
        ),
        this.json(
          `/evidence?select=id,prospect_id,source_url,source_type,field_name,field_value,source_excerpt,verification_status,captured_at,verified_at${this.companyEnrichmentEnabled ? ",verification_method" : ""}&limit=5000`,
          z.array(evidenceRowSchema),
        ),
        this.json(
          "/assessments?select=id,prospect_id,total_score,rules_version,eligibility_result,score_breakdown,blockers,rationale,evidence_ids,assessed_at&order=assessed_at.desc&limit=1000",
          z.array(assessmentRowSchema),
        ),
        this.companyEnrichmentEnabled
          ? this.json(
              `/company_enrichment?select=prospect_id,status,discovered_company_number,source_url,candidates,last_error_code,attempt_count,last_attempt_at,completed_at${this.automaticQualificationEnabled ? ",qualification_state,qualification_reasons,research_summary,research_completed_at" : ""}&limit=5000`,
              z.array(enrichmentRowSchema),
            )
          : Promise.resolve([]),
      ]);

    const latest = new Map<string,
      z.infer<typeof assessmentRowSchema>>();
    for (const item of assessments) {
      if (!latest.has(item.prospect_id)) {
        latest.set(item.prospect_id, item);
      }
    }

    return prospects.map((item) => {
      const prospectEvidence =
        evidence.filter(
          (record) =>
            record.prospect_id === item.id,
        );
      const assessment =
        latest.get(item.id) ?? null;
      const enrichment =
        enrichments.find(
          (record) =>
            record.prospect_id === item.id,
        );
      return {
        id: item.id,
        businessName:
          item.business_name,
        sector: item.sector,
        primaryPostcode:
          item.primary_postcode,
        websiteUrl: item.website_url,
        createdAt: item.created_at,
        evidenceCounts: {
          unverified:
            prospectEvidence.filter(
              (record) =>
                record.verification_status ===
                  "unverified",
            ).length,
          verified:
            prospectEvidence.filter(
              (record) =>
                record.verification_status ===
                  "verified",
            ).length,
          rejected:
            prospectEvidence.filter(
              (record) =>
                record.verification_status ===
                  "rejected",
            ).length,
        },
        latestAssessment:
          assessment === null
            ? null
            : {
                totalScore:
                  assessment.total_score,
                eligibilityResult:
                  assessment
                    .eligibility_result,
                assessedAt:
                  assessment.assessed_at,
              },
        companyEnrichment:
          enrichment === undefined
            ? null
            : mapEnrichment(enrichment),
      };
    });
  }

  async getProspect(
    prospectId: string,
  ): Promise<LeadProspectReview | null> {
    const id = encodeURIComponent(
      prospectId,
    );
    const [prospects, evidence, contacts,
      assessments, provenance, enrichments] =
      await Promise.all([
        this.json(
          `/prospects?id=eq.${id}&select=id,business_name,sector,primary_postcode,website_url,company_number,created_at&limit=1`,
          z.array(prospectRowSchema),
        ),
        this.json(
          `/evidence?prospect_id=eq.${id}&select=id,prospect_id,source_url,source_type,field_name,field_value,source_excerpt,verification_status,captured_at,verified_at${this.companyEnrichmentEnabled ? ",verification_method" : ""}&order=captured_at.desc,id.desc&limit=1000`,
          z.array(evidenceRowSchema),
        ),
        this.json(
          `/contacts?prospect_id=eq.${id}&select=id,prospect_id,contact_type,contact_value,normalized_value,source_evidence_id,verification_status&order=created_at.desc,id.desc&limit=1000`,
          z.array(contactRowSchema),
        ),
        this.json(
          `/assessments?prospect_id=eq.${id}&select=id,prospect_id,total_score,rules_version,eligibility_result,score_breakdown,blockers,rationale,evidence_ids,assessed_at&order=assessed_at.desc&limit=1`,
          z.array(assessmentRowSchema),
        ),
        this.json(
          `/search_run_prospects?prospect_id=eq.${id}&select=prospect_id&limit=1`,
          z.array(searchProvenanceRowSchema),
        ),
        this.companyEnrichmentEnabled
          ? this.json(
              `/company_enrichment?prospect_id=eq.${id}&select=prospect_id,status,discovered_company_number,source_url,candidates,last_error_code,attempt_count,last_attempt_at,completed_at${this.automaticQualificationEnabled ? ",qualification_state,qualification_reasons,research_summary,research_completed_at" : ""}&limit=1`,
              z.array(enrichmentRowSchema),
            )
          : Promise.resolve([]),
      ]);

    const row = prospects[0];
    if (row === undefined) return null;
    const suppressionQueries = [
      `/suppressions?lifted_at=is.null&prospect_id=eq.${id}&select=prospect_id,normalized_value`,
      ...[
        ...new Set(
          contacts.map(
            (item) =>
              item.normalized_value,
          ),
        ),
      ].map((value) =>
        `/suppressions?lifted_at=is.null&normalized_value=eq.${encodeURIComponent(value)}&select=prospect_id,normalized_value&limit=1`,
      ),
    ];
    const suppressions = (
      await Promise.all(
        suppressionQueries.map(
          (path) => this.json(
            path,
            z.array(
              suppressionRowSchema,
            ),
          ),
        ),
      )
    ).flat();
    const normalizedContacts = new Set(
      contacts.map(
        (item) => item.normalized_value,
      ),
    );

    return {
      id: row.id,
      businessName: row.business_name,
      sector: row.sector,
      primaryPostcode:
        row.primary_postcode,
      websiteUrl: row.website_url,
      companyNumber: row.company_number,
      createdAt: row.created_at,
      hasSearchProvenance:
        provenance.length > 0,
      hasActiveSuppression:
        suppressions.some(
          (item) =>
            item.prospect_id === row.id ||
            normalizedContacts.has(
              item.normalized_value,
            ),
        ),
      evidence: evidence.map(
        mapEvidence,
      ),
      contacts: contacts.map((item) => ({
        id: item.id,
        contactType: item.contact_type,
        contactValue: item.contact_value,
        normalizedValue:
          item.normalized_value,
        sourceEvidenceId:
          item.source_evidence_id,
        verificationStatus:
          item.verification_status,
      })),
      latestAssessment:
        assessments[0] === undefined
          ? null
          : mapAssessment(
              assessments[0],
            ),
      companyEnrichment:
        enrichments[0] === undefined
          ? null
          : mapEnrichment(
              enrichments[0],
            ),
    };
  }

  async addVerifiedEvidence(
    input: AddVerifiedLeadEvidenceInput,
  ): Promise<string> {
    const result = await this.json(
      "/rpc/record_verified_lead_evidence",
      evidenceIdResponseSchema,
      {
        method: "POST",
        headers: {
          "content-type":
            "application/json",
        },
        body: JSON.stringify({
          p_prospect_id:
            input.prospectId,
          p_founder_id:
            input.founderId,
          p_source_type:
            input.sourceType,
          p_source_url:
            input.sourceUrl,
          p_field_name:
            input.factName,
          p_field_value:
            input.factValue,
          p_source_excerpt:
            input.sourceExcerpt,
          p_content_sha256:
            input.contentSha256,
          p_contact_type:
            input.contactType,
          p_normalized_contact_value:
            input.normalizedContactValue,
        }),
      },
    );
    return result[0]!.evidence_id;
  }

  async findProspectByCompanyNumber(
    companyNumber: string,
  ): Promise<{
    readonly id: string;
    readonly businessName: string;
  } | null> {
    const result = await this.json(
      `/prospects?company_number=eq.${encodeURIComponent(companyNumber)}&select=id,business_name&limit=1`,
      z.array(z.object({
        id: z.string().uuid(),
        business_name: z.string(),
      })),
    );
    const row = result[0];
    return row === undefined
      ? null
      : {
          id: row.id,
          businessName:
            row.business_name,
        };
  }

  async recordCompaniesHouseVerification(
    input:
      RecordCompaniesHouseVerificationInput,
  ): Promise<readonly string[]> {
    const result = await this.json(
      "/rpc/record_companies_house_verification",
      evidenceIdsResponseSchema,
      {
        method: "POST",
        headers: {
          "content-type":
            "application/json",
        },
        body: JSON.stringify({
          p_prospect_id:
            input.prospectId,
          p_founder_id:
            input.founderId,
          p_source_url:
            input.sourceUrl,
          p_facts: input.facts.map(
            (fact) => ({
              field_name:
                fact.factName,
              field_value:
                fact.factValue,
              source_excerpt:
                fact.sourceExcerpt,
              content_sha256:
                fact.contentSha256,
            }),
          ),
        }),
      },
    );
    return result[0]!.evidence_ids;
  }

  async recordAutomaticCompaniesHouseVerification(
    input:
      RecordAutomaticCompaniesHouseVerificationInput,
  ): Promise<readonly string[]> {
    const result = await this.json(
      "/rpc/record_automatic_companies_house_verification",
      evidenceIdsResponseSchema,
      {
        method: "POST",
        headers: {
          "content-type":
            "application/json",
        },
        body: JSON.stringify({
          p_prospect_id: input.prospectId,
          p_actor_id: input.founderId,
          p_attempt_count:
            input.enrichmentAttemptCount,
          p_website_source_url:
            input.firstPartyAssertion.sourceUrl,
          p_website_source_excerpt:
            input.firstPartyAssertion.sourceExcerpt,
          p_website_content_sha256:
            input.firstPartyAssertion.contentSha256,
          p_companies_house_source_url:
            input.sourceUrl,
          p_facts: input.facts.map(
            (fact) => ({
              field_name: fact.factName,
              field_value: fact.factValue,
              source_excerpt:
                fact.sourceExcerpt,
              content_sha256:
                fact.contentSha256,
            }),
          ),
        }),
      },
    );
    return result[0]!.evidence_ids;
  }

  async decideEvidence(
    input: DecideLeadEvidenceInput,
  ): Promise<void> {
    await this.request(
      "/rpc/review_lead_evidence",
      {
        method: "POST",
        headers: {
          "content-type":
            "application/json",
        },
        body: JSON.stringify({
          p_prospect_id:
            input.prospectId,
          p_evidence_id:
            input.evidenceId,
          p_founder_id:
            input.founderId,
          p_decision: input.decision,
          p_review_note:
            input.reviewNote,
        }),
      },
    );
  }

  async saveAssessment(
    input: SaveLeadAssessmentInput,
  ): Promise<LeadAssessmentRecord> {
    const result = await this.json(
      "/assessments?select=id,prospect_id,total_score,rules_version,eligibility_result,score_breakdown,blockers,rationale,evidence_ids,assessed_at",
      z.array(assessmentRowSchema).length(1),
      {
        method: "POST",
        headers: {
          "content-type":
            "application/json",
          prefer: "return=representation",
        },
        body: JSON.stringify({
          prospect_id:
            input.prospectId,
          total_score:
            input.totalScore,
          rules_version:
            input.rulesVersion,
          eligibility_result:
            input.eligibilityResult,
          score_breakdown:
            input.scoreBreakdown,
          blockers: input.blockers,
          rationale: input.rationale,
          evidence_ids:
            input.evidenceIds,
          assessed_by:
            input.founderId,
        }),
      },
    );
    return mapAssessment(result[0]!);
  }
}
