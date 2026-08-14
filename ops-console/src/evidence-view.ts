import type {
  ProspectEvidence,
  VerificationStatus,
} from "./lead-review-api";

export interface EvidenceViewGroup {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly status: VerificationStatus;
  readonly representative: ProspectEvidence;
  readonly sources: readonly ProspectEvidence[];
}

const FACT_LABELS:
  Readonly<Record<string, string>> = {
    business_name: "Business identity",
    approved_sector: "Approved sector",
    business_status: "Business status",
    trading_address: "Trading address",
    website_url: "Website",
    public_email: "Public business email",
    contact_form_url: "Public contact form",
    recurring_cleaning_need:
      "Recurring-cleaning signal",
    premises_scale:
      "Premises / portfolio scale",
    subscriber_type: "Subscriber type",
    company_number: "Companies House number",
    organisation_type: "Organisation type",
    registered_charity_name:
      "Registered charity name",
    charity_number: "Charity number",
    google_place_id: "Google Place ID",
  };

function canonicalUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [
      ...url.searchParams.keys(),
    ]) {
      if (
        key.toLowerCase().startsWith("utm_") ||
        key.toLowerCase() === "gclid" ||
        key.toLowerCase() === "fbclid"
      ) {
        url.searchParams.delete(key);
      }
    }
    return url.toString();
  } catch {
    return value.trim();
  }
}

function normalizedValue(
  evidence: ProspectEvidence,
): string {
  if (evidence.fieldName === "company_number") {
    return evidence.fieldValue
      .replace(/\s+/g, "")
      .toUpperCase();
  }
  if (
    evidence.fieldName === "website_url" ||
    evidence.fieldName === "contact_form_url"
  ) {
    return canonicalUrl(evidence.fieldValue)
      .toLowerCase();
  }
  return evidence.fieldValue
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function statusRank(
  status: VerificationStatus,
): number {
  if (status === "verified") return 3;
  if (status === "unverified") return 2;
  return 1;
}

function contactRouteScore(
  evidence: ProspectEvidence,
): number {
  if (evidence.fieldName !== "contact_form_url") {
    return 0;
  }
  let score = 0;
  try {
    const url = new URL(evidence.fieldValue);
    if (
      /(?:contact|get-in-touch|enquir|inquir)/i
        .test(url.pathname)
    ) score += 5;
    if (
      /(?:privacy|terms|cookie|legal|about)/i
        .test(url.pathname)
    ) score -= 5;
  } catch {
    score -= 10;
  }
  if (
    evidence.sourceExcerpt?.startsWith(
      "Verified contact form v2:",
    )
  ) score += 10;
  return score;
}

function preferred(
  left: ProspectEvidence,
  right: ProspectEvidence,
): ProspectEvidence {
  const statusDifference =
    statusRank(right.verificationStatus) -
    statusRank(left.verificationStatus);
  if (statusDifference !== 0) {
    return statusDifference > 0
      ? right
      : left;
  }

  const contactDifference =
    contactRouteScore(right) -
    contactRouteScore(left);
  if (contactDifference !== 0) {
    return contactDifference > 0
      ? right
      : left;
  }

  return new Date(right.capturedAt).getTime() >
    new Date(left.capturedAt).getTime()
    ? right
    : left;
}

function groupKey(
  evidence: ProspectEvidence,
): string {
  if (evidence.fieldName === "contact_form_url") {
    return "contact_form_url";
  }
  return `${evidence.fieldName}\n${normalizedValue(evidence)}`;
}

export function evidenceLabel(
  fieldName: string,
): string {
  return FACT_LABELS[fieldName] ??
    fieldName.replaceAll("_", " ");
}

export function groupEvidenceForDisplay(
  evidence: readonly ProspectEvidence[],
): readonly EvidenceViewGroup[] {
  const grouped =
    new Map<string, ProspectEvidence[]>();

  for (const item of evidence) {
    const key = groupKey(item);
    const group = grouped.get(key) ?? [];
    group.push(item);
    grouped.set(key, group);
  }

  return [...grouped.entries()]
    .map(([key, sources]) => {
      const representative =
        sources.reduce(preferred);
      const sameStatusSources = sources.filter(
        (item) =>
          item.verificationStatus ===
            representative.verificationStatus,
      );
      const uniqueSources = [
        ...new Map(
          sameStatusSources.map((item) => [
            canonicalUrl(item.sourceUrl),
            item,
          ]),
        ).values(),
      ];
      return {
        key,
        label:
          evidenceLabel(
            representative.fieldName,
          ),
        value: representative.fieldValue,
        status:
          representative.verificationStatus,
        representative,
        sources:
          uniqueSources.length === 0
            ? [representative]
            : uniqueSources,
      };
    })
    .sort((left, right) => {
      const priority = [
        "business_name",
        "company_number",
        "business_status",
        "organisation_type",
        "approved_sector",
        "subscriber_type",
        "website_url",
        "public_email",
        "contact_form_url",
        "premises_scale",
        "recurring_cleaning_need",
      ];
      const leftIndex = priority.indexOf(
        left.representative.fieldName,
      );
      const rightIndex = priority.indexOf(
        right.representative.fieldName,
      );
      const normalizedLeft =
        leftIndex === -1
          ? priority.length
          : leftIndex;
      const normalizedRight =
        rightIndex === -1
          ? priority.length
          : rightIndex;
      return normalizedLeft - normalizedRight ||
        left.label.localeCompare(right.label) ||
        left.value.localeCompare(right.value);
    });
}
