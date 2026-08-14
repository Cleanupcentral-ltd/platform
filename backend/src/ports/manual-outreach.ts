import type {
  LeadSector,
} from "./lead-search.js";

import type {
  OutreachActivityRecord,
  RecordOutreachActivityInput,
} from "./outreach.js";

export interface ManualOutreachFollowUp {
  readonly prospectId: string;
  readonly businessName: string;
  readonly sector: LeadSector;
  readonly primaryPostcode: string | null;
  readonly activities:
    readonly OutreachActivityRecord[];
}

export interface ManualOutreachRepository {
  listActivities(
    prospectId: string,
  ): Promise<readonly OutreachActivityRecord[]>;

  listFollowUps?(
    limit: number,
  ): Promise<readonly ManualOutreachFollowUp[]>;

  recordManualActivity(
    input: RecordOutreachActivityInput,
  ): Promise<OutreachActivityRecord>;
}
