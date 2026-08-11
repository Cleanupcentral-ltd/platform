export const LEAD_SECTOR_OPTIONS = [
  {
    value:
      "short_let_serviced_accommodation",
    label:
      "Short-let and serviced accommodation",
  },
  {
    value: "offices_coworking",
    label:
      "Offices and coworking spaces",
  },
  {
    value:
      "community_halls_event_venues",
    label:
      "Community halls and event venues",
  },
  {
    value: "estate_letting_agents",
    label:
      "Estate and letting agents",
  },
  {
    value:
      "university_accommodation",
    label:
      "University accommodation",
  },
  {
    value:
      "other_commercial_spaces",
    label:
      "Other commercial spaces",
  },
] as const;

export type LeadSector =
  (typeof LEAD_SECTOR_OPTIONS)[number]["value"];

export const ALL_LEAD_SECTORS =
  "all_approved_sectors" as const;

export const LEAD_SEARCH_SECTOR_OPTIONS = [
  {
    value: ALL_LEAD_SECTORS,
    label: "All approved sectors",
  },
  ...LEAD_SECTOR_OPTIONS,
] as const;

export type LeadSearchSector =
  (typeof LEAD_SEARCH_SECTOR_OPTIONS)[number]["value"];

export interface LeadSearchResult {
  readonly businessName: string;
  readonly formattedAddress: string | null;
  readonly primaryPostcode: string | null;
  readonly websiteUrl: string | null;
  readonly phone: string | null;
  readonly sourceUrl: string;
  readonly distanceMiles: number;
  readonly evidenceStatus:
    "unverified";
}

export interface LeadSearchOutcome {
  readonly searchRunId: string;
  readonly postcode: string;
  readonly sector: LeadSector;
  readonly radiusMiles: number;
  readonly resultCount: number;
  readonly createdCount: number;
  readonly results:
    readonly LeadSearchResult[];
}

export interface LeadSearchInput {
  readonly postcode: string;
  readonly radiusMiles: number;
  readonly sector: LeadSector;
}

export interface LeadSearchSelectionInput {
  readonly postcode: string;
  readonly radiusMiles: number;
  readonly sector: LeadSearchSector;
}

export interface LeadSearchViewOutcome {
  readonly resultCount: number;
  readonly createdCount: number;
  readonly results:
    readonly LeadSearchResult[];
}

export interface ManualLeadInput {
  readonly businessName: string;
  readonly sector: LeadSector;
  readonly sourceUrl: string;
  readonly formattedAddress: string | null;
  readonly primaryPostcode: string | null;
  readonly websiteUrl: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly contactFormUrl: string | null;
}

interface ApiErrorBody {
  readonly error?: {
    readonly message?: unknown;
  };
}

async function requestJson<T>(
  url: string,
  accessToken: string,
  body: unknown,
  fetchFunction: typeof fetch,
): Promise<T> {
  const response =
    await fetchFunction(url, {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    // The status message below remains useful.
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

export async function searchLeads(
  backendUrl: string,
  accessToken: string,
  input: LeadSearchInput,
  fetchFunction: typeof fetch = fetch,
): Promise<LeadSearchOutcome> {
  const response =
    await requestJson<{
      readonly success: true;
      readonly search:
        LeadSearchOutcome;
    }>(
      `${backendUrl.replace(/\/$/, "")}/api/ops/leads/search`,
      accessToken,
      input,
      fetchFunction,
    );
  return response.search;
}

export async function searchLeadSelection(
  backendUrl: string,
  accessToken: string,
  input: LeadSearchSelectionInput,
  fetchFunction: typeof fetch = fetch,
): Promise<LeadSearchViewOutcome> {
  if (input.sector !== ALL_LEAD_SECTORS) {
    return searchLeads(
      backendUrl,
      accessToken,
      {
        ...input,
        sector: input.sector,
      },
      fetchFunction,
    );
  }

  const outcomes = await Promise.all(
    LEAD_SECTOR_OPTIONS.map(
      ({ value }) =>
        searchLeads(
          backendUrl,
          accessToken,
          {
            postcode: input.postcode,
            radiusMiles:
              input.radiusMiles,
            sector: value,
          },
          fetchFunction,
        ),
    ),
  );
  const uniqueResults =
    new Map<string, LeadSearchResult>();

  for (const outcome of outcomes) {
    for (const result of outcome.results) {
      if (!uniqueResults.has(
        result.sourceUrl,
      )) {
        uniqueResults.set(
          result.sourceUrl,
          result,
        );
      }
    }
  }

  return {
    resultCount: uniqueResults.size,
    createdCount: outcomes.reduce(
      (total, outcome) =>
        total + outcome.createdCount,
      0,
    ),
    results: [...uniqueResults.values()],
  };
}

export async function captureManualLead(
  backendUrl: string,
  accessToken: string,
  input: ManualLeadInput,
  fetchFunction: typeof fetch = fetch,
): Promise<{
  readonly resultCount: number;
  readonly createdCount: number;
  readonly businessName: string;
  readonly evidenceStatus:
    "unverified";
}> {
  const response =
    await requestJson<{
      readonly success: true;
      readonly manualCapture: {
        readonly resultCount: number;
        readonly createdCount: number;
        readonly businessName: string;
        readonly evidenceStatus:
          "unverified";
      };
    }>(
      `${backendUrl.replace(/\/$/, "")}/api/ops/leads/manual`,
      accessToken,
      input,
      fetchFunction,
    );
  return response.manualCapture;
}

