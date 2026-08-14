import { z } from "zod";

import type {
  ManualOutreachRepository,
} from "../../ports/manual-outreach.js";

import type {
  OutreachActivityRecord,
  RecordOutreachActivityInput,
} from "../../ports/outreach.js";

const activityRowSchema = z.object({
  id: z.string().uuid(),
  activity_type: z.enum([
    "outlook_draft_created",
    "contacted",
    "replied",
    "follow_up_scheduled",
    "outcome",
  ]),
  outcome: z.string().nullable(),
  notes: z.string().nullable(),
  follow_up_at: z.string().nullable(),
  created_at: z.string(),
});

function mapActivity(
  row: z.infer<typeof activityRowSchema>,
): OutreachActivityRecord {
  return {
    id: row.id,
    activityType: row.activity_type,
    outcome: row.outcome,
    notes: row.notes,
    followUpAt: row.follow_up_at,
    createdAt: row.created_at,
  };
}

export interface SupabaseManualOutreachRepositoryOptions {
  readonly supabaseUrl: string;
  readonly secretKey: string;
  readonly timeoutMs: number;
  readonly fetchFunction?: typeof fetch;
}

export class SupabaseManualOutreachRepository
implements ManualOutreachRepository {
  private readonly restUrl: string;
  private readonly secretKey: string;
  private readonly timeoutMs: number;
  private readonly fetchFunction:
    typeof fetch;

  constructor(
    options:
      SupabaseManualOutreachRepositoryOptions,
  ) {
    this.restUrl =
      `${options.supabaseUrl.replace(/\/$/, "")}/rest/v1`;
    this.secretKey = options.secretKey;
    this.timeoutMs = options.timeoutMs;
    this.fetchFunction =
      options.fetchFunction ?? fetch;
  }

  private async request(
    path: string,
    init: RequestInit = {},
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
          `Manual outreach store request failed with status ${response.status}.`,
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
    const response = await this.request(
      path,
      init,
    );
    const result = schema.safeParse(
      await response.json(),
    );
    if (!result.success) {
      throw new Error(
        "Manual outreach store returned an invalid response.",
      );
    }
    return result.data;
  }

  async listActivities(
    prospectId: string,
  ): Promise<readonly OutreachActivityRecord[]> {
    const rows = await this.json(
      `/activities?prospect_id=eq.${encodeURIComponent(prospectId)}&activity_type=in.(contacted,replied,follow_up_scheduled,outcome)&select=id,activity_type,outcome,notes,follow_up_at,created_at&order=created_at.desc,id.desc&limit=100`,
      z.array(activityRowSchema),
    );
    return rows.map(mapActivity);
  }

  async recordActivity(
    input: RecordOutreachActivityInput,
  ): Promise<OutreachActivityRecord> {
    const rows = await this.json(
      "/rpc/record_manual_outreach_activity",
      z.array(activityRowSchema).length(1),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          p_prospect_id: input.prospectId,
          p_founder_id: input.founderId,
          p_activity_type:
            input.activityType,
          p_outcome: input.outcome,
          p_notes: input.notes,
          p_follow_up_at:
            input.followUpAt,
        }),
      },
    );
    return mapActivity(rows[0]!);
  }
}
