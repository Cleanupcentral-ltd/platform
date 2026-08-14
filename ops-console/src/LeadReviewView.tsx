import {
  FormEvent,
  useMemo,
  useState,
} from "react";

import {
  LEAD_SECTOR_OPTIONS,
} from "./lead-search-api";

import {
  addVerificationEvidence,
  assessProspect,
  decideEvidence,
  getProspect,
  retryCompanyEnrichment,
  searchCompaniesHouseMatches,
  verifyCompaniesHouseMatch,
  type CompaniesHouseMatch,
  type ProspectReview,
  type ProspectSummary,
  type VerificationFactName,
  type VerificationSourceType,
} from "./lead-review-api";

import {
  recordManualOutreachActivity,
} from "./manual-outreach-api";

import {
  queueClass,
  queueKey,
  queueLabel,
  score,
  sectorLabel,
  type QueueFilter,
} from "./redesign-helpers";

interface LeadReviewViewProps {
  readonly backendUrl: string;
  readonly accessToken: string;
  readonly prospects:
    readonly ProspectSummary[];
  readonly selectedId: string | null;
  readonly setSelectedId: (
    value: string | null,
  ) => void;
  readonly refreshProspects:
    () => Promise<readonly ProspectSummary[]>;
  readonly markViewed: (
    prospectId: string,
  ) => Promise<void>;
  readonly onPrepareOutreach: (
    prospectId: string,
  ) => void;
  readonly onMessage: (
    message: string,
  ) => void;
  readonly onError: (
    message: string,
  ) => void;
}

const FACT_OPTIONS: readonly {
  readonly value: VerificationFactName;
  readonly label: string;
}[] = [
  { value: "business_name", label: "Business identity" },
  { value: "approved_sector", label: "Approved sector" },
  { value: "business_status", label: "Active business status" },
  { value: "trading_address", label: "Trading address" },
  { value: "website_url", label: "Website URL" },
  { value: "public_email", label: "Public business email" },
  { value: "contact_form_url", label: "Public contact form" },
  { value: "recurring_cleaning_need", label: "Recurring-cleaning signal" },
  { value: "premises_scale", label: "Premises or portfolio scale" },
  { value: "subscriber_type", label: "Subscriber type" },
  { value: "company_number", label: "Companies House number" },
];

const CONTROLLED_VALUES:
  Partial<Record<
    VerificationFactName,
    readonly {
      readonly value: string;
      readonly label: string;
    }[]
  >> = {
    approved_sector: LEAD_SECTOR_OPTIONS,
    business_status: [
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" },
    ],
    premises_scale: [
      {
        value: "one_active_premises",
        label: "One active premises",
      },
      {
        value: "multiple_properties_locations_or_units",
        label: "Multiple properties, locations or units",
      },
    ],
    subscriber_type: [
      { value: "unknown", label: "Unknown" },
      { value: "corporate", label: "Corporate subscriber" },
      { value: "sole_trader", label: "Sole trader" },
      { value: "partnership", label: "Partnership" },
    ],
  };

const BLOCKER_LABELS:
  Readonly<Record<string, string>> = {
    missing_verified_identity:
      "Business identity needs first-party or official verification.",
    unverified_approved_sector:
      "The approved sector is not verified.",
    missing_search_provenance:
      "The prospect is not linked to a completed search.",
    active_status_unverified_or_inactive:
      "Active business status is not verified.",
    no_verified_contact_route:
      "No compliant public business contact route is verified.",
    do_not_contact_or_objection:
      "A do-not-contact or objection record blocks outreach.",
    unresolved_subscriber_type:
      "Subscriber type is unresolved.",
    unapproved_email_basis:
      "The available email is not approved for outreach.",
  };

function messageFrom(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The review action could not be completed.";
}

export function LeadReviewView({
  backendUrl,
  accessToken,
  prospects,
  selectedId,
  setSelectedId,
  refreshProspects,
  markViewed,
  onPrepareOutreach,
  onMessage,
  onError,
}: LeadReviewViewProps) {
  const [review, setReview] =
    useState<ProspectReview | null>(null);
  const [queueSearch, setQueueSearch] =
    useState("");
  const [queueFilter, setQueueFilter] =
    useState<QueueFilter>("all");
  const [working, setWorking] =
    useState(false);
  const [companyQuery, setCompanyQuery] =
    useState("");
  const [companyMatches, setCompanyMatches] =
    useState<readonly CompaniesHouseMatch[]>([]);
  const [sourceType, setSourceType] =
    useState<VerificationSourceType>(
      "first_party_website",
    );
  const [factName, setFactName] =
    useState<VerificationFactName>(
      "business_name",
    );
  const [factValue, setFactValue] =
    useState("");

  const visibleProspects = useMemo(() => {
    const query = queueSearch
      .trim()
      .toLowerCase();
    return prospects
      .filter((prospect) => {
        const filterMatches =
          queueFilter === "all" ||
          queueKey(prospect) ===
            queueFilter;
        const searchMatches =
          query === "" ||
          [
            prospect.businessName,
            prospect.primaryPostcode ?? "",
            sectorLabel(prospect.sector),
          ].join(" ")
            .toLowerCase()
            .includes(query);
        return filterMatches && searchMatches;
      })
      .sort((left, right) => {
        const priority = {
          ready: 0,
          review: 1,
          queued: 2,
          processing: 3,
          excluded: 4,
        } as const;
        return (
          priority[queueKey(left)] -
          priority[queueKey(right)]
        );
      });
  }, [prospects, queueFilter, queueSearch]);

  const selectedSummary = selectedId === null
    ? null
    : prospects.find(
        (item) => item.id === selectedId,
      ) ?? null;

  async function loadReview(
    prospectId: string,
  ) {
    setWorking(true);
    try {
      const loaded = await getProspect(
        backendUrl,
        accessToken,
        prospectId,
      );
      setReview(loaded);
      setCompanyQuery(loaded.businessName);
      setCompanyMatches(
        loaded.companyEnrichment
          ?.candidates ?? [],
      );
      await markViewed(prospectId);
    } catch (error) {
      onError(messageFrom(error));
    } finally {
      setWorking(false);
    }
  }

  async function chooseProspect(
    prospectId: string,
  ) {
    setSelectedId(prospectId);
    setReview(null);
    await loadReview(prospectId);
  }

  async function refreshCurrent() {
    if (selectedId === null) return;
    const [loaded] = await Promise.all([
      getProspect(
        backendUrl,
        accessToken,
        selectedId,
      ),
      refreshProspects(),
    ]);
    setReview(loaded);
    setCompanyMatches(
      loaded.companyEnrichment?.candidates ?? [],
    );
  }

  async function retryAutomaticCheck() {
    if (selectedId === null) return;
    setWorking(true);
    try {
      await retryCompanyEnrichment(
        backendUrl,
        accessToken,
        selectedId,
      );
      await refreshCurrent();
      onMessage(
        "Founder-priority automatic check queued.",
      );
    } catch (error) {
      onError(messageFrom(error));
    } finally {
      setWorking(false);
    }
  }

  async function recalculate() {
    if (selectedId === null) return;
    setWorking(true);
    try {
      const result = await assessProspect(
        backendUrl,
        accessToken,
        selectedId,
      );
      await refreshCurrent();
      onMessage(
        `Score recalculated: ${result.totalScore}/10.`,
      );
    } catch (error) {
      onError(messageFrom(error));
    } finally {
      setWorking(false);
    }
  }

  async function decide(
    evidenceId: string,
    decision: "verified" | "rejected",
  ) {
    if (selectedId === null) return;
    setWorking(true);
    try {
      await decideEvidence(
        backendUrl,
        accessToken,
        selectedId,
        evidenceId,
        decision,
      );
      await refreshCurrent();
      onMessage(
        `Evidence marked ${decision}.`,
      );
    } catch (error) {
      onError(messageFrom(error));
    } finally {
      setWorking(false);
    }
  }

  async function submitEvidence(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (selectedId === null) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setWorking(true);
    try {
      await addVerificationEvidence(
        backendUrl,
        accessToken,
        selectedId,
        {
          sourceType,
          sourceUrl:
            String(data.get("sourceUrl") ?? ""),
          factName,
          factValue,
          sourceExcerpt:
            String(
              data.get("sourceExcerpt") ?? "",
            ).trim() || null,
        },
      );
      form.reset();
      setFactValue("");
      await refreshCurrent();
      onMessage(
        "Verified evidence saved and the qualification record refreshed.",
      );
    } catch (error) {
      onError(messageFrom(error));
    } finally {
      setWorking(false);
    }
  }

  async function searchCompaniesHouse(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (selectedId === null) return;
    setWorking(true);
    try {
      setCompanyMatches(
        await searchCompaniesHouseMatches(
          backendUrl,
          accessToken,
          selectedId,
          companyQuery,
        ),
      );
    } catch (error) {
      onError(messageFrom(error));
    } finally {
      setWorking(false);
    }
  }

  async function confirmCompany(
    companyNumber: string,
  ) {
    if (selectedId === null) return;
    setWorking(true);
    try {
      await verifyCompaniesHouseMatch(
        backendUrl,
        accessToken,
        selectedId,
        companyNumber,
      );
      await refreshCurrent();
      onMessage(
        "Companies House match verified.",
      );
    } catch (error) {
      onError(messageFrom(error));
    } finally {
      setWorking(false);
    }
  }

  async function excludeProspect() {
    if (selectedId === null) return;
    setWorking(true);
    try {
      await recordManualOutreachActivity(
        backendUrl,
        accessToken,
        selectedId,
        {
          activityType: "outcome",
          outcome: "do_not_contact",
          notes:
            "Founder excluded prospect in Verify & Score.",
          followUpAt: null,
        },
      );
      await assessProspect(
        backendUrl,
        accessToken,
        selectedId,
      );
      await refreshCurrent();
      onMessage(
        "Prospect excluded and added to the durable do-not-contact record.",
      );
    } catch (error) {
      onError(messageFrom(error));
    } finally {
      setWorking(false);
    }
  }

  const controlled =
    CONTROLLED_VALUES[factName];

  return (
    <section className="le-view">
      <div className="le-view-heading">
        <div>
          <p className="le-overline">
            QUALITY CONTROL
          </p>
          <h2>Verify before outreach.</h2>
          <p>
            Review evidence and resolve blockers. A prospect becomes Ready only when the existing qualification engine confirms it is eligible.
          </p>
        </div>
      </div>

      <div className="le-review-controls">
        <label>
          <span>Search queue</span>
          <input
            value={queueSearch}
            onChange={(event) =>
              setQueueSearch(event.target.value)
            }
            placeholder="Business, postcode or sector"
          />
        </label>
        <label>
          <span>Qualification</span>
          <select
            value={queueFilter}
            onChange={(event) =>
              setQueueFilter(
                event.target.value as
                  QueueFilter,
              )
            }
          >
            <option value="all">All</option>
            <option value="ready">
              Ready for outreach
            </option>
            <option value="review">
              Needs review
            </option>
            <option value="queued">Queued</option>
            <option value="processing">
              Processing
            </option>
            <option value="excluded">
              Excluded
            </option>
          </select>
        </label>
        <button
          type="button"
          className="le-secondary"
          onClick={() =>
            void refreshProspects()
          }
        >
          Refresh
        </button>
      </div>

      <div className="le-review-shell">
        <div className="le-queue-list">
          {visibleProspects.map(
            (prospect, index) => (
              <button
                type="button"
                key={prospect.id}
                className={
                  selectedId === prospect.id
                    ? "le-queue-row is-selected"
                    : "le-queue-row"
                }
                onClick={() =>
                  void chooseProspect(
                    prospect.id,
                  )
                }
              >
                <span className="le-row-index">
                  {String(index + 1)
                    .padStart(2, "0")}
                </span>
                <span className="le-row-copy">
                  <strong>
                    {prospect.businessName}
                  </strong>
                  <small>
                    {prospect.primaryPostcode ??
                      "Postcode pending"}
                    {" · "}
                    {sectorLabel(
                      prospect.sector,
                    )}
                  </small>
                </span>
                <span className="le-row-score">
                  {score(prospect)}/10
                </span>
                <span
                  className={queueClass(prospect)}
                >
                  {queueLabel(prospect)}
                </span>
              </button>
            ),
          )}
        </div>

        <aside className="le-evidence-panel">
          {review === null ? (
            <div className="le-evidence-empty">
              <p className="le-dark-overline">
                EVIDENCE REVIEW
              </p>
              <h3>
                Choose a prospect to inspect.
              </h3>
              <p>
                Seen / Unseen remains a separate Find Prospects state; this panel is only for qualification evidence.
              </p>
            </div>
          ) : (
            <>
              <div className="le-evidence-heading">
                <div>
                  <p className="le-dark-overline">
                    EVIDENCE REVIEW
                  </p>
                  <h3>{review.businessName}</h3>
                  <p>
                    {review.primaryPostcode ??
                      "Postcode pending"}
                    {" · "}
                    {sectorLabel(review.sector)}
                  </p>
                </div>
                <span className="le-score le-score-dark">
                  {review.latestAssessment
                    ?.totalScore ?? 0}
                </span>
              </div>

              {selectedSummary !== null && (
                <div className="le-evidence-statusbar">
                  <span
                    className={
                      queueClass(selectedSummary)
                    }
                  >
                    {queueLabel(selectedSummary)}
                  </span>
                  <span>
                    {review.evidence.filter(
                      (item) =>
                        item.verificationStatus ===
                          "verified",
                    ).length} verified facts
                  </span>
                </div>
              )}

              {review.latestAssessment !== null &&
                review.latestAssessment.blockers.length > 0 && (
                  <div className="le-blocker-panel">
                    <strong>Current blockers</strong>
                    <ul>
                      {review.latestAssessment.blockers.map(
                        (blocker) => (
                          <li key={blocker}>
                            {BLOCKER_LABELS[blocker] ??
                              blocker}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}

              <div className="le-evidence-actions-bar">
                {selectedSummary !== null &&
                  ![
                    "ready",
                    "excluded",
                  ].includes(
                    queueKey(selectedSummary),
                  ) && (
                    <button
                      type="button"
                      className="le-dark-button"
                      disabled={working}
                      onClick={() =>
                        void retryAutomaticCheck()
                      }
                    >
                      Run automatic check
                    </button>
                  )}
                <button
                  type="button"
                  className="le-dark-outline"
                  disabled={working}
                  onClick={() =>
                    void recalculate()
                  }
                >
                  Recalculate score
                </button>
                {selectedSummary !== null &&
                  queueKey(selectedSummary) ===
                    "ready" && (
                    <button
                      type="button"
                      className="le-gold-button"
                      onClick={() =>
                        onPrepareOutreach(
                          selectedSummary.id,
                        )
                      }
                    >
                      Prepare outreach
                    </button>
                  )}
              </div>

              <div className="le-evidence-list">
                {review.evidence.map(
                  (evidence) => (
                    <div
                      className="le-evidence-row"
                      key={evidence.id}
                    >
                      <div>
                        <strong>
                          {evidence.fieldName
                            .replaceAll("_", " ")}
                        </strong>
                        <span>
                          {evidence.fieldValue}
                        </span>
                        <a
                          href={evidence.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View source ↗
                        </a>
                      </div>
                      <div className="le-evidence-row-side">
                        <span
                          className={`le-evidence-state le-evidence-${evidence.verificationStatus}`}
                        >
                          {evidence.verificationStatus}
                        </span>
                        {evidence.verificationStatus ===
                          "unverified" && (
                          <div className="le-mini-actions">
                            <button
                              type="button"
                              disabled={working}
                              onClick={() =>
                                void decide(
                                  evidence.id,
                                  "verified",
                                )
                              }
                            >
                              Verify
                            </button>
                            <button
                              type="button"
                              disabled={working}
                              onClick={() =>
                                void decide(
                                  evidence.id,
                                  "rejected",
                                )
                              }
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>

              <details className="le-dark-details">
                <summary>
                  Add verified evidence manually
                </summary>
                <form
                  className="le-dark-form"
                  onSubmit={submitEvidence}
                >
                  <label>
                    <span>Source type</span>
                    <select
                      value={sourceType}
                      onChange={(event) =>
                        setSourceType(
                          event.target.value as
                            VerificationSourceType,
                        )
                      }
                    >
                      <option value="first_party_website">
                        First-party website
                      </option>
                      <option value="companies_house">
                        Companies House
                      </option>
                    </select>
                  </label>
                  <label>
                    <span>Fact</span>
                    <select
                      value={factName}
                      onChange={(event) => {
                        const next =
                          event.target.value as
                            VerificationFactName;
                        setFactName(next);
                        setFactValue("");
                      }}
                    >
                      {FACT_OPTIONS.map(
                        (item) => (
                          <option
                            key={item.value}
                            value={item.value}
                          >
                            {item.label}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label className="le-span-2">
                    <span>Source URL</span>
                    <input
                      name="sourceUrl"
                      type="url"
                      placeholder="https://"
                      required
                    />
                  </label>
                  <label className="le-span-2">
                    <span>Verified value</span>
                    {controlled === undefined ? (
                      <input
                        value={factValue}
                        onChange={(event) =>
                          setFactValue(
                            event.target.value,
                          )
                        }
                        required
                      />
                    ) : (
                      <select
                        value={factValue}
                        onChange={(event) =>
                          setFactValue(
                            event.target.value,
                          )
                        }
                        required
                      >
                        <option value="">
                          Choose value
                        </option>
                        {controlled.map(
                          (item) => (
                            <option
                              key={item.value}
                              value={item.value}
                            >
                              {item.label}
                            </option>
                          ),
                        )}
                      </select>
                    )}
                  </label>
                  <label className="le-span-2">
                    <span>Supporting text</span>
                    <textarea
                      name="sourceExcerpt"
                      rows={3}
                    />
                  </label>
                  <button
                    type="submit"
                    className="le-gold-button"
                    disabled={working}
                  >
                    Save verified evidence
                  </button>
                </form>
              </details>

              <details className="le-dark-details">
                <summary>
                  Companies House verification
                </summary>
                <form
                  className="le-company-search"
                  onSubmit={searchCompaniesHouse}
                >
                  <input
                    value={companyQuery}
                    onChange={(event) =>
                      setCompanyQuery(
                        event.target.value,
                      )
                    }
                    required
                  />
                  <button
                    type="submit"
                    className="le-dark-outline"
                    disabled={working}
                  >
                    Search
                  </button>
                </form>
                <div className="le-company-matches">
                  {companyMatches.map(
                    (company) => (
                      <div
                        className="le-company-match"
                        key={company.companyNumber}
                      >
                        <div>
                          <strong>
                            {company.companyName}
                          </strong>
                          <span>
                            {company.companyNumber}
                            {" · "}
                            {company.companyStatus}
                          </span>
                          <a
                            href={company.officialUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Official record ↗
                          </a>
                        </div>
                        <button
                          type="button"
                          className="le-dark-outline"
                          disabled={working}
                          onClick={() =>
                            void confirmCompany(
                              company.companyNumber,
                            )
                          }
                        >
                          Confirm match
                        </button>
                      </div>
                    ),
                  )}
                </div>
              </details>

              {selectedSummary !== null &&
                queueKey(selectedSummary) !==
                  "excluded" && (
                  <div className="le-exclude-zone">
                    <div>
                      <strong>Exclude prospect</strong>
                      <p>
                        Adds a durable do-not-contact record. Use only when the prospect should not be contacted.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="le-danger-button"
                      disabled={working}
                      onClick={() =>
                        void excludeProspect()
                      }
                    >
                      Exclude prospect
                    </button>
                  </div>
                )}
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
