import type {
  LeadSearchResult,
} from "./lead-search-api";

import type {
  ProspectSummary,
} from "./lead-review-api";

export type SearchResultViewFilter =
  | "all"
  | "unseen"
  | "seen";

export interface SearchResultState {
  readonly result: LeadSearchResult;
  readonly prospect: ProspectSummary | null;
  readonly viewState: "unseen" | "seen";
  readonly qualificationLabel: string;
}

function normaliseText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalisePostcode(
  value: string | null,
): string | null {
  return value === null
    ? null
    : value
        .replace(/\s/g, "")
        .toUpperCase();
}

function normaliseWebsite(
  value: string | null,
): string | null {
  if (value === null) return null;
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return value.trim().toLowerCase();
  }
}

export function matchSearchResultToProspect(
  result: LeadSearchResult,
  prospects: readonly ProspectSummary[],
): ProspectSummary | null {
  const name = normaliseText(
    result.businessName,
  );
  const postcode = normalisePostcode(
    result.primaryPostcode,
  );
  const candidates = prospects.filter(
    (prospect) =>
      normaliseText(prospect.businessName) ===
        name &&
      (
        postcode === null ||
        normalisePostcode(
          prospect.primaryPostcode,
        ) === postcode
      ),
  );

  if (candidates.length === 1) {
    return candidates[0]!;
  }

  const website = normaliseWebsite(
    result.websiteUrl,
  );
  if (website !== null) {
    const websiteMatches = candidates.filter(
      (prospect) =>
        normaliseWebsite(
          prospect.websiteUrl,
        ) === website,
    );
    if (websiteMatches.length === 1) {
      return websiteMatches[0]!;
    }
  }

  return null;
}

export function prospectQualificationLabel(
  prospect: ProspectSummary | null,
): string {
  if (prospect === null) {
    return "Automatic verification queued";
  }

  switch (
    prospect.companyEnrichment
      ?.qualificationState
  ) {
    case "ready_for_outreach":
      return "Ready for outreach";
    case "needs_founder_decision":
      return "Needs review";
    case "excluded":
      return "Excluded";
    case "processing":
      return "Processing";
  }

  switch (
    prospect.companyEnrichment?.status
  ) {
    case "pending":
    case "processing":
      return "Processing";
    case "auto_verified":
    case "verified_existing":
      return "Verified";
    case "review_required":
    case "no_match":
    case "duplicate":
    case "failed":
      return "Needs review";
  }

  return prospect.evidenceCounts.verified > 0
    ? "Verified evidence available"
    : "Automatic verification queued";
}

export function buildSearchResultStates(
  results: readonly LeadSearchResult[],
  prospects: readonly ProspectSummary[],
): readonly SearchResultState[] {
  return results.map((result) => {
    const prospect =
      matchSearchResultToProspect(
        result,
        prospects,
      );
    return {
      result,
      prospect,
      viewState:
        prospect?.viewedAt == null
          ? "unseen" as const
          : "seen" as const,
      qualificationLabel:
        prospectQualificationLabel(
          prospect,
        ),
    };
  });
}

export function filterSearchResultStates(
  states: readonly SearchResultState[],
  filter: SearchResultViewFilter,
): readonly SearchResultState[] {
  return filter === "all"
    ? states
    : states.filter(
        (state) =>
          state.viewState === filter,
      );
}
