import type {
  LeadExportRepository,
  LeadExportRow,
} from "../ports/lead-export.js";

export interface LeadExportFile {
  readonly filename: string;
  readonly csv: string;
  readonly rowCount: number;
}

export class LeadExportError
extends Error {
  constructor() {
    super("repository_unavailable");
    this.name = "LeadExportError";
  }
}

export interface LeadExportService {
  createCsv(
    founderId: string,
  ): Promise<LeadExportFile>;
}

const CSV_HEADERS = [
  "prospect_reference",
  "business_name",
  "sector",
  "postcode",
  "website",
  "verified_contact_route",
  "eligibility_result",
  "score_and_version",
  "status",
  "next_follow_up_at",
  "outcome",
  "source_urls",
  "suppression_state",
  "created_at",
] as const;

function protectSpreadsheetFormula(
  value: string,
): string {
  return /^[\t\r\n ]*[=+\-@]/.test(
    value,
  )
    ? `'${value}`
    : value;
}

function csvCell(
  value:
    string | number | boolean | null,
): string {
  const text = protectSpreadsheetFormula(
    value === null
      ? ""
      : String(value),
  );
  return `"${text.replaceAll('"', '""')}"`;
}

function scoreAndVersion(
  row: LeadExportRow,
): string {
  if (
    row.totalScore === null &&
    row.rulesVersion === null
  ) {
    return "";
  }
  return [
    row.totalScore === null
      ? null
      : `${row.totalScore}/10`,
    row.rulesVersion,
  ].filter(
    (value): value is string =>
      value !== null,
  ).join(" · ");
}

export function buildLeadExportCsv(
  rows: readonly LeadExportRow[],
): string {
  const body = rows.map((row) => [
    row.prospectReference,
    row.businessName,
    row.sector,
    row.postcode,
    row.website,
    row.verifiedContactRoute,
    row.eligibilityResult,
    scoreAndVersion(row),
    row.status,
    row.nextFollowUpAt,
    row.outcome,
    row.sourceUrls.join(" | "),
    row.suppressionState,
    row.createdAt,
  ].map(csvCell).join(","));

  return [
    CSV_HEADERS.map(csvCell).join(","),
    ...body,
    "",
  ].join("\r\n");
}

export function createLeadExportService(
  repository: LeadExportRepository,
  now: () => Date = () => new Date(),
): LeadExportService {
  return {
    async createCsv(founderId) {
      let rows:
        readonly LeadExportRow[];
      try {
        rows =
          await repository.createExport(
            founderId,
          );
      } catch {
        throw new LeadExportError();
      }
      const date = now()
        .toISOString()
        .slice(0, 10);
      return {
        filename:
          `clean-up-central-leads-${date}.csv`,
        csv: buildLeadExportCsv(rows),
        rowCount: rows.length,
      };
    },
  };
}
