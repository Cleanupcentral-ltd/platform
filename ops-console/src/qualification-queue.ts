import type {
  ProspectSummary,
} from "./lead-review-api";

export type ReviewQueueFilter =
  | "ready_for_outreach"
  | "needs_founder_decision"
  | "excluded"
  | "processing"
  | "exceptions"
  | "pending"
  | "verified"
  | "all";

export function defaultReviewQueueFilter(
  automaticQualificationEnabled: boolean,
  companyEnrichmentEnabled: boolean,
): ReviewQueueFilter {
  if (automaticQualificationEnabled) {
    return "ready_for_outreach";
  }
  return companyEnrichmentEnabled
    ? "exceptions"
    : "all";
}

export function filterProspectQueue(
  prospects: readonly ProspectSummary[],
  queueFilter: ReviewQueueFilter,
  search: string,
  automaticQualificationEnabled: boolean,
  unseenOnly = false,
): readonly ProspectSummary[] {
  const normalizedSearch =
    search.trim().toLowerCase();
  return prospects.filter((item) => {
    if (
      unseenOnly &&
      item.viewedAt !== null
    ) return false;
    const status =
      item.companyEnrichment?.status;
    const filterMatches =
      queueFilter === "all" ||
      (
        automaticQualificationEnabled &&
        item.companyEnrichment
          ?.qualificationState === queueFilter
      ) ||
      (
        !automaticQualificationEnabled &&
        queueFilter === "exceptions" &&
        status !== undefined &&
        [
          "review_required",
          "no_match",
          "duplicate",
          "failed",
        ].includes(status)
      ) ||
      (
        !automaticQualificationEnabled &&
        queueFilter === "pending" &&
        (status === "pending" ||
          status === "processing")
      ) ||
      (
        !automaticQualificationEnabled &&
        queueFilter === "verified" &&
        (status === "auto_verified" ||
          status === "verified_existing")
      );
    if (!filterMatches) return false;
    if (normalizedSearch === "") return true;
    return [
      item.businessName,
      item.primaryPostcode ?? "",
      item.companyEnrichment
        ?.discoveredCompanyNumber ?? "",
    ].some((value) =>
      value.toLowerCase().includes(
        normalizedSearch,
      ));
  });
}
