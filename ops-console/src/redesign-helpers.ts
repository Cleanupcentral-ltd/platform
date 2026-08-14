import {
  LEAD_SECTOR_OPTIONS,
  type LeadSector,
} from "./lead-search-api";

import type {
  ProspectSummary,
} from "./lead-review-api";

import type {
  ManualFollowUpItem,
} from "./manual-follow-ups-api";

export type QueueFilter =
  | "all"
  | "ready"
  | "review"
  | "queued"
  | "processing"
  | "excluded";

export type FollowUpFilter =
  | "all"
  | "due_today"
  | "overdue"
  | "upcoming"
  | "awaiting_reply"
  | "replied"
  | "revisit_later";

const SECTOR_LABELS = new Map<LeadSector, string>(
  LEAD_SECTOR_OPTIONS.map(
    (item) => [item.value, item.label],
  ),
);

export function sectorLabel(
  sector: LeadSector,
): string {
  return SECTOR_LABELS.get(sector) ?? sector;
}

export function queueKey(
  prospect: ProspectSummary,
): Exclude<QueueFilter, "all"> {
  switch (
    prospect.companyEnrichment?.qualificationState
  ) {
    case "ready_for_outreach":
      return "ready";
    case "needs_founder_decision":
      return "review";
    case "excluded":
      return "excluded";
    case "processing":
      return prospect.companyEnrichment
        ?.status === "pending"
        ? "queued"
        : "processing";
  }

  switch (prospect.companyEnrichment?.status) {
    case "pending":
      return "queued";
    case "processing":
      return "processing";
    case "review_required":
    case "no_match":
    case "duplicate":
    case "failed":
      return "review";
    case "auto_verified":
    case "verified_existing":
      return prospect.latestAssessment
        ?.eligibilityResult === "eligible"
        ? "ready"
        : "review";
    default:
      return "queued";
  }
}

export function queueLabel(
  prospect: ProspectSummary,
): string {
  switch (queueKey(prospect)) {
    case "ready":
      return "Ready for outreach";
    case "review":
      return "Needs review";
    case "queued":
      return "Queued";
    case "processing":
      return "Processing";
    case "excluded":
      return "Excluded";
  }
}

export function queueClass(
  prospect: ProspectSummary,
): string {
  return `le-status le-status-${queueKey(prospect)}`;
}

export function score(
  prospect: ProspectSummary | null,
): number {
  return prospect?.latestAssessment
    ?.totalScore ?? 0;
}

function activityTime(value: string): number {
  return new Date(value).getTime();
}

function localDateKey(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1)
      .padStart(2, "0"),
    String(value.getDate())
      .padStart(2, "0"),
  ].join("-");
}

export function latestActivity(
  item: ManualFollowUpItem,
) {
  return [...item.activities]
    .sort(
      (left, right) =>
        activityTime(right.createdAt) -
        activityTime(left.createdAt),
    )[0] ?? null;
}

export function latestFollowUp(
  item: ManualFollowUpItem,
) {
  return item.activities
    .filter(
      (activity) =>
        activity.activityType ===
          "follow_up_scheduled" &&
        activity.followUpAt !== null,
    )
    .sort(
      (left, right) =>
        activityTime(right.createdAt) -
        activityTime(left.createdAt),
    )[0] ?? null;
}

function latestOfType(
  item: ManualFollowUpItem,
  type: "contacted" | "replied",
) {
  return item.activities
    .filter(
      (activity) =>
        activity.activityType === type,
    )
    .sort(
      (left, right) =>
        activityTime(right.createdAt) -
        activityTime(left.createdAt),
    )[0] ?? null;
}

export function isAwaitingReply(
  item: ManualFollowUpItem,
): boolean {
  const contacted = latestOfType(
    item,
    "contacted",
  );
  if (contacted === null) return false;
  const replied = latestOfType(
    item,
    "replied",
  );
  return replied === null ||
    activityTime(replied.createdAt) <
      activityTime(contacted.createdAt);
}

export function isReplied(
  item: ManualFollowUpItem,
): boolean {
  const replied = latestOfType(
    item,
    "replied",
  );
  if (replied === null) return false;
  const contacted = latestOfType(
    item,
    "contacted",
  );
  return contacted === null ||
    activityTime(replied.createdAt) >=
      activityTime(contacted.createdAt);
}

export function isRevisitLater(
  item: ManualFollowUpItem,
): boolean {
  const latestOutcome = item.activities
    .filter(
      (activity) =>
        activity.activityType === "outcome",
    )
    .sort(
      (left, right) =>
        activityTime(right.createdAt) -
        activityTime(left.createdAt),
    )[0] ?? null;
  return latestOutcome?.outcome === "not_now";
}

export function matchesFollowUpFilter(
  item: ManualFollowUpItem,
  filter: FollowUpFilter,
  now = new Date(),
): boolean {
  if (filter === "all") return true;
  if (filter === "awaiting_reply") {
    return isAwaitingReply(item);
  }
  if (filter === "replied") {
    return isReplied(item);
  }
  if (filter === "revisit_later") {
    return isRevisitLater(item);
  }

  const followUp = latestFollowUp(item);
  if (
    followUp === null ||
    followUp.followUpAt === null
  ) {
    return false;
  }

  const due = new Date(followUp.followUpAt);
  const today = localDateKey(now);
  const dueKey = localDateKey(due);

  if (filter === "due_today") {
    return dueKey === today;
  }
  if (filter === "overdue") {
    return due.getTime() < now.getTime() &&
      dueKey !== today;
  }
  return due.getTime() > now.getTime() &&
    dueKey !== today;
}

export function followUpLabel(
  item: ManualFollowUpItem,
): string {
  const followUp = latestFollowUp(item);
  if (
    followUp === null ||
    followUp.followUpAt === null
  ) {
    if (isReplied(item)) return "Replied";
    if (isRevisitLater(item)) {
      return "Revisit later";
    }
    return isAwaitingReply(item)
      ? "Awaiting reply"
      : "No follow-up scheduled";
  }

  return new Date(
    followUp.followUpAt,
  ).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function latestActivityLabel(
  item: ManualFollowUpItem,
): string {
  const activity = latestActivity(item);
  if (activity === null) {
    return "No activity recorded";
  }
  const action = activity.activityType
    .replaceAll("_", " ");
  const date = new Date(
    activity.createdAt,
  ).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
  return `${action} · ${date}`;
}
