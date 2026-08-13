export const OUTREACH_TEMPLATE_ID =
  "initial_outreach_v1";

export type OutreachDraftStatus =
  | "pending"
  | "drafted"
  | "failed"
  | "contacted"
  | "replied"
  | "closed";

export interface OutreachDraftRecord {
  readonly id: string;
  readonly prospectId: string;
  readonly contactId: string;
  readonly recipientEmail: string;
  readonly subject: string;
  readonly body: string;
  readonly templateId: string;
  readonly previewSha256: string;
  readonly evidenceIds: readonly string[];
  readonly status: OutreachDraftStatus;
  readonly outlookDraftId: string | null;
  readonly outlookWebUrl: string | null;
  readonly lastErrorCode: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface OutreachActivityRecord {
  readonly id: string;
  readonly activityType:
    | "outlook_draft_created"
    | "contacted"
    | "replied"
    | "follow_up_scheduled"
    | "outcome";
  readonly outcome: string | null;
  readonly notes: string | null;
  readonly followUpAt: string | null;
  readonly createdAt: string;
}

export interface PrepareOutreachDraftInput {
  readonly prospectId: string;
  readonly founderId: string;
  readonly contactId: string;
  readonly recipientEmail: string;
  readonly subject: string;
  readonly body: string;
  readonly templateId: string;
  readonly previewSha256: string;
  readonly evidenceIds: readonly string[];
}

export interface RecordOutreachActivityInput {
  readonly prospectId: string;
  readonly founderId: string;
  readonly activityType:
    | "contacted"
    | "replied"
    | "follow_up_scheduled"
    | "outcome";
  readonly outcome: string | null;
  readonly notes: string | null;
  readonly followUpAt: string | null;
}

export interface OutreachRepository {
  getLatestDraft(
    prospectId: string,
  ): Promise<OutreachDraftRecord | null>;

  listActivities(
    prospectId: string,
  ): Promise<readonly OutreachActivityRecord[]>;

  prepareDraft(
    input: PrepareOutreachDraftInput,
  ): Promise<OutreachDraftRecord>;

  markDrafted(
    draftId: string,
    founderId: string,
    outlookDraftId: string,
    outlookWebUrl: string | null,
  ): Promise<OutreachDraftRecord>;

  markDraftFailed(
    draftId: string,
    errorCode: string,
  ): Promise<void>;

  recordActivity(
    input: RecordOutreachActivityInput,
  ): Promise<OutreachActivityRecord>;
}

export interface OutlookConnectionStatus {
  readonly connected: boolean;
  readonly mailboxEmail: string | null;
  readonly connectedAt: string | null;
}

export interface OutlookDraftGateway {
  connectionStatus(
    founderId: string,
  ): Promise<OutlookConnectionStatus>;

  createAuthorizationUrl(
    founderId: string,
  ): Promise<string>;

  completeAuthorization(
    code: string,
    state: string,
  ): Promise<void>;

  createOrRecoverDraft(input: {
    readonly founderId: string;
    readonly internalDraftId: string;
    readonly recipientEmail: string;
    readonly subject: string;
    readonly body: string;
  }): Promise<{
    readonly outlookDraftId: string;
    readonly outlookWebUrl: string | null;
  }>;
}
