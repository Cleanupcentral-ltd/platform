import type {
  LeadSector,
} from "./lead-search-api";

import type {
  OutreachActivity,
} from "./lead-review-api";

export interface ManualOutreachPreview {
  readonly prospectId: string;
  readonly businessName: string;
  readonly sector: LeadSector;
  readonly sectorLabel: string;
  readonly templateId: string;
  readonly contactId: string;
  readonly recipientEmail: string;
  readonly availableRecipients: readonly {
    readonly contactId: string;
    readonly email: string;
  }[];
  readonly subject: string;
  readonly body: string;
  readonly evidence: readonly {
    readonly id: string;
    readonly factName: string;
    readonly factValue: string;
    readonly sourceUrl: string;
  }[];
  readonly previewSha256: string;
}

export interface ManualOutreachWorkspace {
  readonly activities:
    readonly OutreachActivity[];
}

interface ApiErrorBody {
  readonly error?: {
    readonly message?: unknown;
  };
}

function baseUrl(
  backendUrl: string,
): string {
  return backendUrl.replace(/\/$/, "");
}

async function requestJson<T>(
  url: string,
  accessToken: string,
  init: RequestInit,
  fetchFunction: typeof fetch,
): Promise<T> {
  const response = await fetchFunction(
    url,
    {
      ...init,
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
        ...init.headers,
      },
      cache: "no-store",
    },
  );

  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    // The status-specific fallback remains useful.
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

export async function getManualOutreachWorkspace(
  backendUrl: string,
  accessToken: string,
  prospectId: string,
  fetchFunction: typeof fetch = fetch,
): Promise<ManualOutreachWorkspace> {
  const response = await requestJson<{
    readonly outreach:
      ManualOutreachWorkspace;
  }>(
    `${baseUrl(backendUrl)}/api/ops/leads/prospects/${encodeURIComponent(prospectId)}/manual-outreach`,
    accessToken,
    { method: "GET" },
    fetchFunction,
  );
  return response.outreach;
}

export async function previewManualOutreachDraft(
  backendUrl: string,
  accessToken: string,
  prospectId: string,
  contactId: string | null,
  fetchFunction: typeof fetch = fetch,
): Promise<ManualOutreachPreview> {
  const response = await requestJson<{
    readonly preview:
      ManualOutreachPreview;
    readonly sent: boolean;
  }>(
    `${baseUrl(backendUrl)}/api/ops/leads/prospects/${encodeURIComponent(prospectId)}/manual-outreach-preview`,
    accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({ contactId }),
    },
    fetchFunction,
  );
  if (response.sent) {
    throw new Error(
      "The manual outreach endpoint returned an unsupported sent state.",
    );
  }
  return response.preview;
}

export async function recordManualOutreachActivity(
  backendUrl: string,
  accessToken: string,
  prospectId: string,
  input: {
    readonly activityType:
      | "contacted"
      | "replied"
      | "follow_up_scheduled"
      | "outcome";
    readonly outcome: string | null;
    readonly notes: string | null;
    readonly followUpAt: string | null;
  },
  fetchFunction: typeof fetch = fetch,
): Promise<OutreachActivity> {
  const response = await requestJson<{
    readonly activity:
      OutreachActivity;
  }>(
    `${baseUrl(backendUrl)}/api/ops/leads/prospects/${encodeURIComponent(prospectId)}/manual-outreach-activities`,
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
  return response.activity;
}

export function formatOutlookCopy(
  preview: Pick<
    ManualOutreachPreview,
    "recipientEmail" | "subject" | "body"
  >,
): string {
  return [
    `To: ${preview.recipientEmail}`,
    `Subject: ${preview.subject}`,
    "",
    preview.body,
  ].join("\n");
}
