import type {
  LeadSector,
} from "./lead-search-api";

import type {
  OutreachActivity,
} from "./lead-review-api";

export interface ManualFollowUpItem {
  readonly prospectId: string;
  readonly businessName: string;
  readonly sector: LeadSector;
  readonly primaryPostcode: string | null;
  readonly activities: readonly OutreachActivity[];
}

interface ApiErrorBody {
  readonly error?: {
    readonly message?: unknown;
  };
}

export async function listManualFollowUps(
  backendUrl: string,
  accessToken: string,
  fetchFunction: typeof fetch = fetch,
): Promise<readonly ManualFollowUpItem[]> {
  const response = await fetchFunction(
    `${backendUrl.replace(/\/$/, "")}/api/ops/leads/manual-outreach/follow-ups`,
    {
      method: "GET",
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
      },
      cache: "no-store",
    },
  );

  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    // The status-specific fallback below remains useful.
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

  return (
    parsed as {
      readonly followUps:
        readonly ManualFollowUpItem[];
    }
  ).followUps;
}
