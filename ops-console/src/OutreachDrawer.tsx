import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  getManualOutreachWorkspace,
  previewManualOutreachDraft,
  recordManualOutreachActivity,
  type ManualOutreachPreview,
  type ManualOutreachWorkspace,
} from "./manual-outreach-api";

interface OutreachDrawerProps {
  readonly backendUrl: string;
  readonly accessToken: string;
  readonly prospectId: string;
  readonly onClose: () => void;
  readonly onActivitySaved: () => void;
  readonly onMessage: (
    message: string,
  ) => void;
  readonly onError: (
    message: string,
  ) => void;
}

type ActivityType =
  | "contacted"
  | "replied"
  | "follow_up_scheduled"
  | "outcome";

type ActivityOutcome =
  | "won"
  | "lost"
  | "not_now"
  | "not_interested"
  | "do_not_contact";

function messageFrom(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The outreach action could not be completed.";
}

function copyText(
  preview: ManualOutreachPreview,
  subject: string,
  body: string,
): string {
  return [
    `To: ${preview.recipientEmail}`,
    `Subject: ${subject}`,
    "",
    body,
  ].join("\n");
}

export function OutreachDrawer({
  backendUrl,
  accessToken,
  prospectId,
  onClose,
  onActivitySaved,
  onMessage,
  onError,
}: OutreachDrawerProps) {
  const [preview, setPreview] =
    useState<ManualOutreachPreview | null>(
      null,
    );
  const [workspace, setWorkspace] =
    useState<ManualOutreachWorkspace | null>(
      null,
    );
  const [subject, setSubject] =
    useState("");
  const [body, setBody] =
    useState("");
  const [composeOpen, setComposeOpen] =
    useState(false);
  const [logOpen, setLogOpen] =
    useState(false);
  const [activityType, setActivityType] =
    useState<ActivityType>("contacted");
  const [activityOutcome, setActivityOutcome] =
    useState<ActivityOutcome>("not_now");
  const [notes, setNotes] =
    useState("");
  const [followUpAt, setFollowUpAt] =
    useState("");
  const [working, setWorking] =
    useState(false);

  async function load() {
    setWorking(true);
    try {
      const [nextPreview, nextWorkspace] =
        await Promise.all([
          previewManualOutreachDraft(
            backendUrl,
            accessToken,
            prospectId,
            null,
          ),
          getManualOutreachWorkspace(
            backendUrl,
            accessToken,
            prospectId,
          ),
        ]);
      setPreview(nextPreview);
      setWorkspace(nextWorkspace);
      setSubject(nextPreview.subject);
      setBody(nextPreview.body);
    } catch (error) {
      onError(messageFrom(error));
    } finally {
      setWorking(false);
    }
  }

  useEffect(() => {
    void load();
    // The selected prospect is the drawer identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospectId]);

  async function copyDraft() {
    if (preview === null) return;
    try {
      await navigator.clipboard.writeText(
        copyText(preview, subject, body),
      );
      onMessage(
        "Email draft copied. Nothing was sent and no contact activity was recorded.",
      );
    } catch {
      onError(
        "The browser could not copy the draft automatically. Select the recipient, subject and message and copy them manually.",
      );
    }
  }

  async function saveActivity(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setWorking(true);
    try {
      const resolvedFollowUp =
        activityType ===
          "follow_up_scheduled"
          ? (
              followUpAt === ""
                ? null
                : new Date(
                    followUpAt,
                  ).toISOString()
            )
          : null;

      if (
        activityType ===
          "follow_up_scheduled" &&
        resolvedFollowUp === null
      ) {
        onError(
          "Choose a follow-up date and time before saving the follow-up.",
        );
        return;
      }

      await recordManualOutreachActivity(
        backendUrl,
        accessToken,
        prospectId,
        {
          activityType,
          outcome:
            activityType === "outcome"
              ? activityOutcome
              : null,
          notes:
            notes.trim() === ""
              ? null
              : notes.trim(),
          followUpAt: resolvedFollowUp,
        },
      );

      setWorkspace(
        await getManualOutreachWorkspace(
          backendUrl,
          accessToken,
          prospectId,
        ),
      );
      setNotes("");
      setFollowUpAt("");
      onActivitySaved();
      onMessage(
        activityType ===
          "follow_up_scheduled"
          ? "Follow-up recorded."
          : "Outreach activity recorded.",
      );
    } catch (error) {
      onError(messageFrom(error));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div
      className="le-drawer-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <aside
        className={
          composeOpen
            ? "le-outreach-drawer le-outreach-drawer-wide"
            : "le-outreach-drawer"
        }
        aria-label="Outreach workspace"
      >
        <div className="le-drawer-header">
          <div>
            <p className="le-dark-kicker">
              OUTREACH
            </p>
            <h2>
              {preview?.businessName ??
                "Preparing outreach…"}
            </h2>
            {preview !== null && (
              <p>{preview.sectorLabel}</p>
            )}
          </div>
          <button
            type="button"
            className="le-icon-button le-icon-button-dark"
            onClick={onClose}
            aria-label="Close outreach panel"
          >
            ×
          </button>
        </div>

        {working && preview === null ? (
          <p className="le-drawer-loading">
            Loading verified outreach details…
          </p>
        ) : preview === null ? (
          <p className="le-drawer-loading">
            This prospect does not currently have an eligible outreach preview.
          </p>
        ) : (
          <>
            <div className="le-recipient-card">
              <span>Verified recipient</span>
              <strong>
                {preview.recipientEmail}
              </strong>
              <small>
                First-party generic business email
              </small>
            </div>

            <button
              type="button"
              className="le-drawer-action"
              onClick={() =>
                setComposeOpen((value) => !value)
              }
            >
              {composeOpen
                ? "Hide email draft"
                : "Prepare email draft"}
            </button>

            {composeOpen && (
              <div className="le-compose-panel">
                <label>
                  <span>Subject</span>
                  <input
                    value={subject}
                    onChange={(event) =>
                      setSubject(
                        event.target.value,
                      )
                    }
                  />
                </label>
                <label>
                  <span>Message</span>
                  <textarea
                    rows={18}
                    value={body}
                    onChange={(event) =>
                      setBody(
                        event.target.value,
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  className="le-gold-button"
                  onClick={() => void copyDraft()}
                >
                  Copy Email Draft
                </button>
                <p className="le-drawer-note">
                  Copy only. The Lead Engine does not send this email or mark the prospect contacted.
                </p>
              </div>
            )}

            <button
              type="button"
              className="le-drawer-action le-drawer-action-secondary"
              onClick={() =>
                setLogOpen((value) => !value)
              }
            >
              {logOpen
                ? "Close activity form"
                : "Log contact / activity"}
            </button>

            {logOpen && (
              <form
                className="le-activity-form"
                onSubmit={saveActivity}
              >
                <label>
                  <span>Activity</span>
                  <select
                    value={activityType}
                    onChange={(event) =>
                      setActivityType(
                        event.target.value as
                          ActivityType,
                      )
                    }
                  >
                    <option value="contacted">
                      Contacted
                    </option>
                    <option value="replied">
                      Replied
                    </option>
                    <option value="follow_up_scheduled">
                      Follow-up scheduled
                    </option>
                    <option value="outcome">
                      Outcome
                    </option>
                  </select>
                </label>

                {activityType === "outcome" && (
                  <label>
                    <span>Outcome</span>
                    <select
                      value={activityOutcome}
                      onChange={(event) =>
                        setActivityOutcome(
                          event.target.value as
                            ActivityOutcome,
                        )
                      }
                    >
                      <option value="won">Won</option>
                      <option value="lost">Lost</option>
                      <option value="not_now">
                        Not now / revisit later
                      </option>
                      <option value="not_interested">
                        Not interested
                      </option>
                      <option value="do_not_contact">
                        Do not contact
                      </option>
                    </select>
                  </label>
                )}

                {activityType ===
                  "follow_up_scheduled" && (
                    <label>
                      <span>Follow-up date</span>
                      <input
                        type="datetime-local"
                        value={followUpAt}
                        onChange={(event) =>
                          setFollowUpAt(
                            event.target.value,
                          )
                        }
                        required
                      />
                    </label>
                  )}

                <label>
                  <span>Notes</span>
                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(event) =>
                      setNotes(
                        event.target.value,
                      )
                    }
                    placeholder="Optional founder note"
                  />
                </label>

                <button
                  type="submit"
                  className="le-gold-button"
                  disabled={working}
                >
                  {working
                    ? "Saving…"
                    : "Save activity"}
                </button>
              </form>
            )}

            <div className="le-activity-history">
              <div className="le-history-heading">
                <span>Recent activity</span>
                <span>
                  {workspace?.activities.length ?? 0}
                </span>
              </div>
              {workspace?.activities.length === 0 && (
                <p>No outreach activity recorded yet.</p>
              )}
              {workspace?.activities.slice(0, 8)
                .map((activity) => (
                  <div
                    className="le-history-row"
                    key={activity.id}
                  >
                    <strong>
                      {activity.activityType
                        .replaceAll("_", " ")}
                    </strong>
                    <span>
                      {activity.outcome ??
                        activity.notes ??
                        "Recorded"}
                    </span>
                    <small>
                      {new Date(
                        activity.createdAt,
                      ).toLocaleString(
                        "en-GB",
                        {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </small>
                  </div>
                ))}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
