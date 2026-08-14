import { z } from "zod";

import type {
  ManualOutreachFollowUp,
  ManualOutreachRepository,
} from "../../ports/manual-outreach.js";

import type {
  OutreachActivityRecord,
  OutreachDraftRecord,
  OutreachRepository,
  PrepareOutreachDraftInput,
  RecordOutreachActivityInput,
} from "../../ports/outreach.js";

type FetchFunction = typeof fetch;

const draftRowSchema = z.object({
  id: z.string().uuid(),
  prospect_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  recipient_email: z.string().email(),
  subject: z.string(),
  body: z.string(),
  template_id: z.string(),
  preview_sha256: z.string().regex(
    /^[0-9a-f]{64}$/,
  ),
  evidence_ids: z.array(
    z.string().uuid(),
  ).default([]),
  status: z.enum([
    "pending",
    "drafted",
    "failed",
    "contacted",
    "replied",
    "closed",
  ]),
  outlook_draft_id:
    z.string().nullable(),
  outlook_web_url:
    z.string().url().nullable(),
  last_error_code:
    z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

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

const followUpActivityRowSchema =
  activityRowSchema.extend({
    prospect_id: z.string().uuid(),
  });

const followUpProspectRowSchema = z.object({
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
  primary_postcode: z.string().nullable(),
});

function mapDraft(
  row: z.infer<typeof draftRowSchema>,
): OutreachDraftRecord {
  return {
    id: row.id,
    prospectId: row.prospect_id,
    contactId: row.contact_id,
    recipientEmail:
      row.recipient_email,
    subject: row.subject,
    body: row.body,
    templateId: row.template_id,
    previewSha256:
      row.preview_sha256,
    evidenceIds: row.evidence_ids,
    status: row.status,
    outlookDraftId:
      row.outlook_draft_id,
    outlookWebUrl:
      row.outlook_web_url,
    lastErrorCode:
      row.last_error_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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

export interface SupabaseOutreachRepositoryOptions {
  readonly supabaseUrl: string;
  readonly secretKey: string;
  readonly timeoutMs: number;
  readonly fetchFunction?: FetchFunction;
}

export class SupabaseOutreachRepository
implements OutreachRepository,
  ManualOutreachRepository {
  private readonly restUrl: string;
  private readonly secretKey: string;
  private readonly timeoutMs: number;
  private readonly fetchFunction: FetchFunction;

  constructor(
    options: SupabaseOutreachRepositoryOptions,
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
          `Outreach store request failed with status ${response.status}.`,
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
        "Outreach store returned an invalid response.",
      );
    }
    return result.data;
  }

  async getLatestDraft(
    prospectId: string,
  ): Promise<OutreachDraftRecord | null> {
    const rows = await this.json(
      `/rpc/get_latest_outreach_draft?p_prospect_id=${encodeURIComponent(prospectId)}`,
      z.array(draftRowSchema).max(1),
      { method: "GET" },
    );
    return rows[0] === undefined
      ? null
      : mapDraft(rows[0]);
  }

  async listActivities(
    prospectId: string,
  ): Promise<readonly OutreachActivityRecord[]> {
    const rows = await this.json(
      `/activities?prospect_id=eq.${encodeURIComponent(prospectId)}&activity_type=in.(outlook_draft_created,contacted,replied,follow_up_scheduled,outcome)&select=id,activity_type,outcome,notes,follow_up_at,created_at&order=created_at.desc,id.desc&limit=100`,
      z.array(activityRowSchema),
    );
    return rows.map(mapActivity);
  }

  async listFollowUps(
    limit: number,
  ): Promise<readonly ManualOutreachFollowUp[]> {
    const boundedLimit = Math.max(
      1,
      Math.min(limit, 1_000),
    );
    const [activities, prospects] =
      await Promise.all([
        this.json(
          `/activities?activity_type=in.(contacted,replied,follow_up_scheduled,outcome)&select=id,prospect_id,activity_type,outcome,notes,follow_up_at,created_at&order=created_at.desc,id.desc&limit=${boundedLimit}`,
          z.array(followUpActivityRowSchema),
        ),
        this.json(
          "/prospects?select=id,business_name,sector,primary_postcode&order=created_at.desc,id.desc&limit=1000",
          z.array(followUpProspectRowSchema),
        ),
      ]);

    const activitiesByProspect =
      new Map<string, OutreachActivityRecord[]>();
    for (const row of activities) {
      const existing =
        activitiesByProspect.get(
          row.prospect_id,
        ) ?? [];
      existing.push(mapActivity(row));
      activitiesByProspect.set(
        row.prospect_id,
        existing,
      );
    }

    return prospects.flatMap((prospect) => {
      const prospectActivities =
        activitiesByProspect.get(prospect.id);
      if (
        prospectActivities === undefined ||
        prospectActivities.length === 0
      ) {
        return [];
      }
      return [{
        prospectId: prospect.id,
        businessName:
          prospect.business_name,
        sector: prospect.sector,
        primaryPostcode:
          prospect.primary_postcode,
        activities: prospectActivities,
      }];
    });
  }

  async prepareDraft(
    input: PrepareOutreachDraftInput,
  ): Promise<OutreachDraftRecord> {
    const rows = await this.json(
      "/rpc/prepare_outlook_draft",
      z.array(draftRowSchema).length(1),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          p_prospect_id: input.prospectId,
          p_founder_id: input.founderId,
          p_contact_id: input.contactId,
          p_recipient_email:
            input.recipientEmail,
          p_subject: input.subject,
          p_body: input.body,
          p_template_id:
            input.templateId,
          p_preview_sha256:
            input.previewSha256,
          p_evidence_ids:
            input.evidenceIds,
        }),
      },
    );
    return mapDraft(rows[0]!);
  }

  async markDrafted(
    draftId: string,
    founderId: string,
    outlookDraftId: string,
    outlookWebUrl: string | null,
  ): Promise<OutreachDraftRecord> {
    const rows = await this.json(
      "/rpc/mark_outlook_draft_created",
      z.array(draftRowSchema).length(1),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          p_draft_id: draftId,
          p_founder_id: founderId,
          p_outlook_draft_id:
            outlookDraftId,
          p_outlook_web_url:
            outlookWebUrl,
        }),
      },
    );
    return mapDraft(rows[0]!);
  }

  async markDraftFailed(
    draftId: string,
    errorCode: string,
  ): Promise<void> {
    await this.request(
      `/outreach_drafts?id=eq.${encodeURIComponent(draftId)}&status=in.(pending,failed)`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          status: "failed",
          last_error_code: errorCode,
          updated_at:
            new Date().toISOString(),
        }),
      },
    );
  }

  async recordActivity(
    input: RecordOutreachActivityInput,
  ): Promise<OutreachActivityRecord> {
    const rows = await this.json(
      "/rpc/record_outreach_activity",
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

  async recordManualActivity(
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
