import { z } from "zod";

import {
  COMPANY_ENRICHMENT_STATUSES,
  type CompanyEnrichmentJob,
  type CompanyEnrichmentRepository,
  type CompleteCompanyEnrichmentInput,
} from "../../ports/company-enrichment.js";

type FetchFunction = typeof fetch;

const claimedJobSchema = z.object({
  prospect_id: z.string().uuid(),
  actor_id: z.string().uuid(),
  business_name: z.string(),
  website_url: z.string().nullable(),
  company_number: z.string().nullable(),
  attempt_count: z.number().int().min(1),
});

export interface SupabaseCompanyEnrichmentRepositoryOptions {
  readonly supabaseUrl: string;
  readonly secretKey: string;
  readonly timeoutMs: number;
  readonly fetchFunction?: FetchFunction;
}

export class SupabaseCompanyEnrichmentRepository
implements CompanyEnrichmentRepository {
  private readonly restUrl: string;
  private readonly secretKey: string;
  private readonly timeoutMs: number;
  private readonly fetchFunction: FetchFunction;

  constructor(
    options: SupabaseCompanyEnrichmentRepositoryOptions,
  ) {
    this.restUrl =
      `${options.supabaseUrl.replace(/\/$/, "")}/rest/v1`;
    this.secretKey = options.secretKey;
    this.timeoutMs = options.timeoutMs;
    this.fetchFunction = options.fetchFunction ?? fetch;
  }

  private async request(
    path: string,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.timeoutMs,
    );
    try {
      const response = await this.fetchFunction(
        `${this.restUrl}${path}`,
        {
          ...init,
          headers: {
            accept: "application/json",
            apikey: this.secretKey,
            authorization:
              `Bearer ${this.secretKey}`,
            "accept-profile": "lead_engine",
            "content-profile": "lead_engine",
            ...init.headers,
          },
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new Error(
          `Company enrichment store request failed with status ${response.status}.`,
        );
      }
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  async claimJobs(
    limit: number,
    leaseSeconds: number,
  ): Promise<readonly CompanyEnrichmentJob[]> {
    const response = await this.request(
      "/rpc/claim_company_enrichment_jobs",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          p_limit: limit,
          p_lease_seconds: leaseSeconds,
        }),
      },
    );
    const parsed = z.array(claimedJobSchema)
      .safeParse(await response.json());
    if (!parsed.success) {
      throw new Error(
        "Company enrichment store returned invalid claimed jobs.",
      );
    }
    return parsed.data.map((job) => ({
      prospectId: job.prospect_id,
      actorId: job.actor_id,
      businessName: job.business_name,
      websiteUrl: job.website_url,
      companyNumber: job.company_number,
      attemptCount: job.attempt_count,
    }));
  }

  async complete(
    input: CompleteCompanyEnrichmentInput,
  ): Promise<void> {
    if (
      !COMPANY_ENRICHMENT_STATUSES.includes(
        input.status,
      )
    ) {
      throw new Error(
        "Unsupported company enrichment status.",
      );
    }
    const retryAfter =
      input.retryAfterSeconds ?? 0;
    const now = new Date();
    const availableAt = new Date(
      now.getTime() + retryAfter * 1_000,
    );
    await this.request(
      `/company_enrichment?prospect_id=eq.${encodeURIComponent(input.prospectId)}&status=eq.processing&attempt_count=eq.${input.attemptCount}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          prefer: "return=representation",
        },
        body: JSON.stringify({
          status: input.status,
          discovered_company_number:
            input.discoveredCompanyNumber,
          source_url: input.sourceUrl,
          source_excerpt: input.sourceExcerpt,
          source_content_sha256:
            input.sourceContentSha256,
          candidates: input.candidates,
          last_error_code:
            input.lastErrorCode,
          available_at:
            availableAt.toISOString(),
          lease_expires_at: null,
          completed_at:
            input.status === "failed"
              ? null
              : now.toISOString(),
          updated_at: now.toISOString(),
        }),
      },
    );
  }

  async retry(
    prospectId: string,
    actorId: string,
  ): Promise<void> {
    await this.request(
      "/rpc/retry_company_enrichment",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          p_prospect_id: prospectId,
          p_actor_id: actorId,
        }),
      },
    );
  }
}
