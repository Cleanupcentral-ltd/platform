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

type ContactType = "phone" | "email";

type ContactOutcome =
  | "interested"
  | "not_interested"
  | "no_response"
  | "follow_up_required"
  | "invalid_contact"
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

function contactNotes(
  contactType: ContactType,
  notes: string,
): string {
  const label =
    contactType === "phone"
      ? "Phone"
      : "Email";
  const founderNote = notes.trim();
  return founderNote === ""
    ? label
    : `${label} · ${founderNote}`;
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
  const [contactType, setContactType] =
    useState<ContactType>("email");
  const [contactOutcome, setContactOutcome] =
    useState<ContactOutcome | "">("");
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

    if (contactOutcome === "") {
      onError(
        "Choose an outcome before saving the contact.",
      );
      return;
    }

    const isFollowUp =
      contactOutcome === "follow_up_required";
    const resolvedFollowUp = isFollowUp
      ? (
          followUpAt === ""
            ? null
            : new Date(
                followUpAt,
              ).toISOString()
        )
      : null;

    if (
      isFollowUp &&
      resolvedFollowUp === null
    ) {
      onError(
        "Choose a follow-up date and time before saving the contact.",
      );
      return;
    }

    setWorking(true);
    try {
      await recordManualOutreachActivity(
        backendUrl,
        accessToken,
        prospectId,
        {
          activityType: isFollowUp
            ? "follow_up_scheduled"
            : "outcome",
          outcome: isFollowUp
            ? null
            : contactOutcome,
          notes: contactNotes(
            contactType,
            notes,
          ),
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
      setContactOutcome("");
      setNotes("");
      setFollowUpAt("");
      onActivitySaved();
      onMessage(
        isFollowUp
          ? "Contact logged and follow-up recorded."
          : "Contact logged.",
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
                ? "Close contact form"
                : "Log contact"}
            </button>

            {logOpen && (
              <form
                className="le-activity-form"
                onSubmit={saveActivity}
              >
                <label>
                  <span>Contact type</span>
                  <select
                    value={contactType}
                    onChange={(event) =>
                      setContactType(
                        event.target.value as
                          ContactType,
                      )
                    }
                  >
                    <option value="phone">
                      Phone
                    </option>
                    <option value="email">
                      Email
                    </option>
                  </select>
                </label>

                <label>
                  <span>Outcome</span>
                  <select
                    value={contactOutcome}
                    onChange={(event) => {
                      const next =
                        event.target.value as
                          ContactOutcome | "";
                      setContactOutcome(next);
                      if (
                        next !==
                          "follow_up_required"
                      ) {
                        setFollowUpAt("");
                      }
                    }}
                    required
                  >
                    <option value="" disabled>
                      Select outcome
                    </option>
                    <option value="interested">
                      Interested
                    </option>
                    <option value="not_interested">
                      Not interested
                    </option>
                    <option value="no_response">
                      No answer / No response
                    </option>
                    <option value="follow_up_required">
                      Follow-up required
                    </option>
                    <option value="invalid_contact">
                      Invalid / Wrong contact details
                    </option>
                    <option value="do_not_contact">
                      Do not contact
                    </option>
                  </select>
                </label>

                {contactOutcome ===
                  "follow_up_required" && (
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
                    maxLength={950}
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
                    : "Save contact"}
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
                      {activity.outcome === null
                        ? activity.notes ?? "Recorded"
                        : [
                            activity.outcome
                              .replaceAll("_", " "),
                            activity.notes,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
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
