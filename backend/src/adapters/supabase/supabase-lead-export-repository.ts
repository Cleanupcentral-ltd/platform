import { z } from "zod";

import type {
  LeadExportRepository,
  LeadExportRow,
} from "../../ports/lead-export.js";

type FetchFunction = typeof fetch;

const exportRowSchema = z.object({
  prospect_reference: z.string().uuid(),
  business_name: z.string(),
  sector: z.string(),
  postcode: z.string().nullable(),
  website: z.string().nullable(),
  verified_contact_route:
    z.string().nullable(),
  eligibility_result:
    z.string().nullable(),
  total_score:
    z.number().int().nullable(),
  rules_version: z.string().nullable(),
  status: z.string(),
  next_follow_up_at:
    z.string().nullable(),
  outcome: z.string().nullable(),
  source_urls:
    z.array(z.string().url()),
  suppression_state: z.boolean(),
  created_at: z.string(),
});

function mapRow(
  row: z.infer<typeof exportRowSchema>,
): LeadExportRow {
  return {
    prospectReference:
      row.prospect_reference,
    businessName: row.business_name,
    sector: row.sector,
    postcode: row.postcode,
    website: row.website,
    verifiedContactRoute:
      row.verified_contact_route,
    eligibilityResult:
      row.eligibility_result,
    totalScore: row.total_score,
    rulesVersion: row.rules_version,
    status: row.status,
    nextFollowUpAt:
      row.next_follow_up_at,
    outcome: row.outcome,
    sourceUrls: row.source_urls,
    suppressionState:
      row.suppression_state,
    createdAt: row.created_at,
  };
}

export interface SupabaseLeadExportRepositoryOptions {
  readonly supabaseUrl: string;
  readonly secretKey: string;
  readonly timeoutMs: number;
  readonly fetchFunction?: FetchFunction;
}

export class SupabaseLeadExportRepository
implements LeadExportRepository {
  private readonly restUrl: string;
  private readonly secretKey: string;
  private readonly timeoutMs: number;
  private readonly fetchFunction:
    FetchFunction;

  constructor(
    options:
      SupabaseLeadExportRepositoryOptions,
  ) {
    this.restUrl =
      `${options.supabaseUrl.replace(/\/$/, "")}/rest/v1`;
    this.secretKey = options.secretKey;
    this.timeoutMs = options.timeoutMs;
    this.fetchFunction =
      options.fetchFunction ?? fetch;
  }

  async createExport(
    founderId: string,
  ): Promise<readonly LeadExportRow[]> {
    const controller =
      new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.timeoutMs,
    );
    try {
      const response =
        await this.fetchFunction(
          `${this.restUrl}/rpc/create_lead_export`,
          {
            method: "POST",
            headers: {
              accept: "application/json",
              apikey: this.secretKey,
              authorization:
                `Bearer ${this.secretKey}`,
              "content-profile":
                "lead_engine",
              "accept-profile":
                "lead_engine",
              "content-type":
                "application/json",
            },
            body: JSON.stringify({
              p_founder_id: founderId,
            }),
            signal: controller.signal,
          },
        );
      if (!response.ok) {
        throw new Error(
          `Lead export store request failed with status ${response.status}.`,
        );
      }
      const parsed = z.array(
        exportRowSchema,
      ).safeParse(
        await response.json(),
      );
      if (!parsed.success) {
        throw new Error(
          "Lead export store returned an invalid response.",
        );
      }
      return parsed.data.map(mapRow);
    } finally {
      clearTimeout(timeout);
    }
  }
}
