import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  listProspects,
  type ProspectSummary,
} from "./lead-review-api";

import {
  formatOutlookCopy,
  getManualOutreachWorkspace,
  previewManualOutreachDraft,
  recordManualOutreachActivity,
  type ManualOutreachPreview,
  type ManualOutreachWorkspace,
} from "./manual-outreach-api";

interface ManualOutreachPanelProps {
  readonly backendUrl: string;
  readonly accessToken: string;
}

function messageFrom(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The operation could not be completed.";
}

function isReadyForOutreach(
  prospect: ProspectSummary,
): boolean {
  return (
    prospect.latestAssessment
      ?.eligibilityResult === "eligible" &&
    prospect.companyEnrichment
      ?.qualificationState ===
        "ready_for_outreach"
  );
}

export function ManualOutreachPanel({
  backendUrl,
  accessToken,
}: ManualOutreachPanelProps) {
  const [prospects, setProspects] =
    useState<readonly ProspectSummary[]>([]);
  const [selectedId, setSelectedId] =
    useState("");
  const [preview, setPreview] =
    useState<ManualOutreachPreview | null>(
      null,
    );
  const [workspace, setWorkspace] =
    useState<ManualOutreachWorkspace | null>(
      null,
    );
  const [working, setWorking] =
    useState(false);
  const [message, setMessage] =
    useState<string | null>(null);
  const [error, setError] =
    useState<string | null>(null);
  const [activityType, setActivityType] =
    useState<
      | "contacted"
      | "replied"
      | "follow_up_scheduled"
      | "outcome"
    >("contacted");
  const [activityOutcome,
    setActivityOutcome] =
      useState("not_now");

  const readyProspects = useMemo(
    () => prospects.filter(
      isReadyForOutreach,
    ),
    [prospects],
  );

  async function refreshProspects() {
    try {
      setProspects(
        await listProspects(
          backendUrl,
          accessToken,
        ),
      );
    } catch (caught) {
      setError(messageFrom(caught));
    }
  }

  async function refreshWorkspace(
    prospectId = selectedId,
  ) {
    if (prospectId === "") {
      setWorkspace(null);
      return;
    }
    try {
      setWorkspace(
        await getManualOutreachWorkspace(
          backendUrl,
          accessToken,
          prospectId,
        ),
      );
    } catch (caught) {
      setError(messageFrom(caught));
    }
  }

  useEffect(() => {
    void refreshProspects();
    // Access token and backend URL are stable for this authenticated view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, backendUrl]);

  async function chooseProspect(
    prospectId: string,
  ) {
    setSelectedId(prospectId);
    setPreview(null);
    setWorkspace(null);
    setMessage(null);
    setError(null);
    if (prospectId !== "") {
      await refreshWorkspace(prospectId);
    }
  }

  async function prepareDraft(
    contactId: string | null = null,
  ) {
    if (selectedId === "") return;
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      setPreview(
        await previewManualOutreachDraft(
          backendUrl,
          accessToken,
          selectedId,
          contactId,
        ),
      );
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setWorking(false);
    }
  }

  async function copyForOutlook() {
    if (preview === null) return;
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      await navigator.clipboard.writeText(
        formatOutlookCopy(preview),
      );
      setMessage(
        "Draft copied for Outlook. Nothing was sent or marked Contacted. Paste it into Outlook, review it and save it as a draft or send it manually when ready.",
      );
    } catch {
      setError(
        "The browser could not copy the draft automatically. Select the recipient, subject and body below and copy them manually.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function submitActivity(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (selectedId === "") return;
    const form = new FormData(
      event.currentTarget,
    );
    const followUpValue = String(
      form.get("followUpAt") ?? "",
    );
    const notes = String(
      form.get("activityNotes") ?? "",
    ).trim();
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      await recordManualOutreachActivity(
        backendUrl,
        accessToken,
        selectedId,
        {
          activityType,
          outcome:
            activityType === "outcome"
              ? activityOutcome
              : null,
          notes: notes || null,
          followUpAt:
            activityType ===
                "follow_up_scheduled" &&
              followUpValue !== ""
              ? new Date(
                  followUpValue,
                ).toISOString()
              : null,
        },
      );
      setMessage(
        activityType === "contacted"
          ? "Manual contact recorded."
          : "Outreach activity recorded.",
      );
      event.currentTarget.reset();
      await Promise.all([
        refreshWorkspace(),
        refreshProspects(),
      ]);
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setWorking(false);
    }
  }

  return (
    <section
      className="review-panel stack outreach-panel"
      id="manual-outreach"
    >
      <div className="results-summary">
        <div>
          <h2>Prepare outreach</h2>
          <p>
            The Lead Engine selects one approved template from verified sector evidence. Copying a draft never sends an email and never records the prospect as Contacted.
          </p>
        </div>
        <button
          type="button"
          className="secondary"
          disabled={working}
          onClick={() =>
            void refreshProspects()
          }
        >
          Refresh
        </button>
      </div>

      <label>
        Ready prospect
        <select
          value={selectedId}
          disabled={working}
          onChange={(event) =>
            void chooseProspect(
              event.target.value,
            )
          }
        >
          <option value="">
            Choose from {readyProspects.length} ready prospects
          </option>
          {readyProspects.map((prospect) => (
            <option
              key={prospect.id}
              value={prospect.id}
            >
              {prospect.businessName} — {prospect.primaryPostcode ?? "postcode unknown"}
            </option>
          ))}
        </select>
      </label>

      {selectedId !== "" &&
        preview === null && (
          <button
            type="button"
            disabled={working}
            onClick={() =>
              void prepareDraft()
            }
          >
            Prepare sector draft
          </button>
        )}

      {message !== null && (
        <p className="success">
          {message}
        </p>
      )}
      {error !== null && (
        <p className="error">
          {error}
        </p>
      )}

      {preview !== null && (
        <div className="draft-preview stack">
          <p className="success compact">
            Template: {preview.sectorLabel}
          </p>
          <label>
            Verified recipient
            <select
              value={preview.contactId}
              disabled={working}
              onChange={(event) =>
                void prepareDraft(
                  event.target.value,
                )
              }
            >
              {preview.availableRecipients.map(
                (recipient) => (
                  <option
                    key={recipient.contactId}
                    value={recipient.contactId}
                  >
                    {recipient.email}
                  </option>
                ),
              )}
            </select>
          </label>
          <div>
            <span className="field-label">
              To
            </span>
            <p>{preview.recipientEmail}</p>
          </div>
          <div>
            <span className="field-label">
              Subject
            </span>
            <p>{preview.subject}</p>
          </div>
          <div>
            <span className="field-label">
              Body
            </span>
            <pre>{preview.body}</pre>
          </div>
          <details>
            <summary>
              Verified evidence used ({preview.evidence.length})
            </summary>
            <ul>
              {preview.evidence.map((item) => (
                <li key={item.id}>
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.factName.replaceAll("_", " ")}: {item.factValue}
                  </a>
                </li>
              ))}
            </ul>
          </details>
          <button
            type="button"
            disabled={working}
            onClick={() =>
              void copyForOutlook()
            }
          >
            Copy for Outlook
          </button>
          <p className="registered-office-note">
            Paste the copied content into Outlook. Saving a draft remains a founder action; the Lead Engine has no email-send connection.
          </p>
        </div>
      )}

      {selectedId !== "" && (
        <form
          className="stack activity-form"
          onSubmit={submitActivity}
        >
          <h3>Log contact or follow-up</h3>
          <p>
            Use this only after something actually happens. Preparing or copying a draft does not change outreach status.
          </p>
          <label>
            Activity
            <select
              value={activityType}
              onChange={(event) =>
                setActivityType(
                  event.target.value as
                    typeof activityType,
                )
              }
            >
              <option value="contacted">
                Email sent manually
              </option>
              <option value="replied">
                Reply received
              </option>
              <option value="follow_up_scheduled">
                Follow-up scheduled
              </option>
              <option value="outcome">
                Record outcome
              </option>
            </select>
          </label>
          {activityType === "outcome" && (
            <label>
              Outcome
              <select
                value={activityOutcome}
                onChange={(event) =>
                  setActivityOutcome(
                    event.target.value,
                  )
                }
              >
                <option value="won">Won</option>
                <option value="lost">Lost</option>
                <option value="not_now">Not now</option>
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
                Follow-up date and time
                <input
                  name="followUpAt"
                  type="datetime-local"
                  required
                />
              </label>
            )}
          <label>
            Note (optional)
            <input
              name="activityNotes"
              maxLength={1000}
            />
          </label>
          <button
            type="submit"
            className="secondary"
            disabled={working}
          >
            Save activity
          </button>
        </form>
      )}

      {workspace !== null &&
        workspace.activities.length > 0 && (
          <details>
            <summary>
              Outreach history ({workspace.activities.length})
            </summary>
            <ul className="activity-list">
              {workspace.activities.map(
                (activity) => (
                  <li key={activity.id}>
                    <strong>
                      {activity.activityType.replaceAll("_", " ")}
                    </strong>
                    {activity.outcome === null
                      ? ""
                      : ` — ${activity.outcome.replaceAll("_", " ")}`}
                    <br />
                    {new Date(
                      activity.createdAt,
                    ).toLocaleString()}
                  </li>
                ),
              )}
            </ul>
          </details>
        )}
    </section>
  );
}
