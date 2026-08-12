import { z } from "zod";

import type {
  CaptureLeadResultsInput,
  CaptureLeadResultsOutcome,
  LeadSearchRepository,
  StartLeadSearchInput,
} from "../../ports/lead-search.js";

type FetchFunction = typeof fetch;

const startResponseSchema =
  z.array(
    z.object({
      id: z.string().uuid(),
    }),
  ).length(1);

const captureResponseSchema =
  z.array(
    z.object({
      result_count:
        z.number().int().min(0),
      created_count:
        z.number().int().min(0),
      created_prospect_ids:
        z.array(z.string().uuid()),
    }),
  ).length(1);

export interface SupabaseLeadSearchRepositoryOptions {
  readonly supabaseUrl: string;
  readonly secretKey: string;
  readonly timeoutMs: number;
  readonly fetchFunction?: FetchFunction;
}

export class SupabaseLeadSearchRepository
implements LeadSearchRepository {
  private readonly restUrl: string;
  private readonly secretKey: string;
  private readonly timeoutMs: number;
  private readonly fetchFunction: FetchFunction;

  constructor(
    options:
      SupabaseLeadSearchRepositoryOptions,
  ) {
    this.restUrl =
      `${options.supabaseUrl.replace(/\/$/, "")}/rest/v1`;
    this.secretKey =
      options.secretKey;
    this.timeoutMs =
      options.timeoutMs;
    this.fetchFunction =
      options.fetchFunction ?? fetch;
  }

  private async request(
    path: string,
    init: RequestInit,
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
              accept:
                "application/json",
              apikey:
                this.secretKey,
              "accept-profile":
                "lead_engine",
              "content-profile":
                "lead_engine",
              ...init.headers,
            },
            signal:
              controller.signal,
          },
        );

      if (!response.ok) {
        throw new Error(
          `Lead store request failed with status ${response.status}.`,
        );
      }

      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  async startSearch(
    input: StartLeadSearchInput,
  ): Promise<string> {
    const response =
      await this.request(
        "/search_runs?select=id",
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
            prefer:
              "return=representation",
          },
          body: JSON.stringify({
            postcode:
              input.postcode,
            radius_miles:
              input.radiusMiles,
            sector: input.sector,
            status: "running",
            created_by:
              input.founderId,
          }),
        },
      );

    const parsed =
      startResponseSchema.safeParse(
        await response.json(),
      );

    if (!parsed.success) {
      throw new Error(
        "Lead store returned an invalid search-run response.",
      );
    }

    return parsed.data[0]!.id;
  }

  async completeSearch(
    input: CaptureLeadResultsInput,
  ): Promise<CaptureLeadResultsOutcome> {
    const response =
      await this.request(
        "/rpc/capture_lead_results",
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
          },
          body: JSON.stringify({
            p_search_run_id:
              input.searchRunId,
            p_sector: input.sector,
            p_results:
              input.results.map(
                (result) => ({
                  dedupe_key:
                    result.dedupeKey,
                  business_name:
                    result.businessName,
                  website_url:
                    result.websiteUrl,
                  primary_postcode:
                    result.primaryPostcode,
                  source_rank:
                    result.sourceRank,
                  evidence:
                    result.evidence.map(
                      (evidence) => ({
                        source_url:
                          evidence.sourceUrl,
                        source_type:
                          evidence.sourceType,
                        field_name:
                          evidence.fieldName,
                        field_value:
                          evidence.fieldValue,
                        source_excerpt:
                          evidence.sourceExcerpt,
                        content_sha256:
                          evidence.contentSha256,
                        contact_type:
                          evidence.contactType,
                        normalized_contact_value:
                          evidence.normalizedContactValue,
                      }),
                    ),
                }),
              ),
          }),
        },
      );

    const parsed =
      captureResponseSchema.safeParse(
        await response.json(),
      );

    if (!parsed.success) {
      throw new Error(
        "Lead store returned an invalid capture response.",
      );
    }

    return {
      resultCount:
        parsed.data[0]!
          .result_count,
      createdCount:
        parsed.data[0]!
          .created_count,
      createdProspectIds:
        parsed.data[0]!
          .created_prospect_ids,
    };
  }

  async failSearch(
    searchRunId: string,
  ): Promise<void> {
    await this.request(
      `/search_runs?id=eq.${encodeURIComponent(searchRunId)}&status=eq.running`,
      {
        method: "PATCH",
        headers: {
          "content-type":
            "application/json",
          prefer: "return=minimal",
        },
        body: JSON.stringify({
          status: "failed",
          completed_at:
            new Date().toISOString(),
        }),
      },
    );
  }
}

