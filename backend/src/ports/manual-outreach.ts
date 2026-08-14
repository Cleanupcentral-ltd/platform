import type {
  OutreachActivityRecord,
  RecordOutreachActivityInput,
} from "./outreach.js";

export interface ManualOutreachRepository {
  listActivities(
    prospectId: string,
  ): Promise<readonly OutreachActivityRecord[]>;

  recordActivity(
    input: RecordOutreachActivityInput,
  ): Promise<OutreachActivityRecord>;
}
