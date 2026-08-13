export interface LeadExportRow {
  readonly prospectReference: string;
  readonly businessName: string;
  readonly sector: string;
  readonly postcode: string | null;
  readonly website: string | null;
  readonly verifiedContactRoute:
    string | null;
  readonly eligibilityResult:
    string | null;
  readonly totalScore: number | null;
  readonly rulesVersion: string | null;
  readonly status: string;
  readonly nextFollowUpAt:
    string | null;
  readonly outcome: string | null;
  readonly sourceUrls:
    readonly string[];
  readonly suppressionState: boolean;
  readonly createdAt: string;
}

export interface LeadExportRepository {
  createExport(
    founderId: string,
  ): Promise<readonly LeadExportRow[]>;
}
