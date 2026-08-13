import {
  FormEvent,
  useEffect,
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
  listProspects,
  retryCompanyEnrichment,
  searchCompaniesHouseMatches,
  updateProspectViewState,
  verifyCompaniesHouseMatch,
  type CompaniesHouseMatch,
  type ProspectReview,
  type ProspectSummary,
  type VerificationFactName,
  type VerificationSourceType,
} from "./lead-review-api";

import {
  defaultReviewQueueFilter,
  filterProspectQueue,
  type ReviewQueueFilter,
} from "./qualification-queue";

interface ProspectReviewWorkspaceProps {
  readonly backendUrl: string;
  readonly accessToken: string;
  readonly companiesHouseEnabled?:
    boolean;
  readonly companyEnrichmentEnabled?:
    boolean;
  readonly automaticQualificationEnabled?:
    boolean;
}

const FACT_OPTIONS: readonly {
  readonly value: VerificationFactName;
  readonly label: string;
}[] = [
  { value: "business_name", label: "Business identity" },
  { value: "approved_sector", label: "Approved pilot sector" },
  { value: "business_status", label: "Active business status" },
  { value: "trading_address", label: "Trading address" },
  { value: "website_url", label: "Website URL" },
  { value: "public_email", label: "Public business email" },
  { value: "contact_form_url", label: "Public contact form" },
  { value: "recurring_cleaning_need", label: "Recurring cleaning-need signal" },
  { value: "premises_scale", label: "Premises or portfolio scale" },
  { value: "subscriber_type", label: "Subscriber type" },
  { value: "company_number", label: "Companies House number" },
];

const COMPANIES_HOUSE_FACTS =
  new Set<VerificationFactName>([
    "business_name",
    "business_status",
    "subscriber_type",
    "company_number",
  ]);

const CONTROLLED_VALUES:
  Partial<Record<
    VerificationFactName,
    readonly { readonly value: string; readonly label: string }[]
  >> = {
    approved_sector:
      LEAD_SECTOR_OPTIONS,
    business_status: [
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" },
    ],
    premises_scale: [
      { value: "one_active_premises", label: "One active premises" },
      {
        value: "multiple_properties_locations_or_units",
        label: "Multiple properties, locations or units",
      },
    ],
    subscriber_type: [
      { value: "unknown", label: "Unknown — blocks eligibility" },
      { value: "corporate", label: "Corporate subscriber" },
      { value: "sole_trader", label: "Sole trader" },
      { value: "partnership", label: "Partnership" },
    ],
  };

const BLOCKER_LABELS:
  Readonly<Record<string, string>> = {
    missing_verified_identity:
      "Business identity needs first-party or Companies House verification.",
    unverified_approved_sector:
      "The approved pilot sector is not verified.",
    missing_search_provenance:
      "The prospect is not linked to a postcode-and-radius search.",
    active_status_unverified_or_inactive:
      "Active business status is not verified.",
    no_verified_contact_route:
      "No compliant public email or contact form is verified.",
    do_not_contact_or_objection:
      "A do-not-contact or objection record blocks the prospect.",
    unresolved_subscriber_type:
      "Subscriber type is unresolved.",
  unapproved_email_basis:
      "The email basis is not approved for this subscriber type.",
  };

const ENRICHMENT_LABELS = {
  pending: "Automatic check queued",
  processing: "Automatic check running",
  auto_verified: "Automatically verified",
  review_required: "Founder match review needed",
  no_match: "No Companies House match",
  duplicate: "Possible duplicate",
  failed: "Automatic check failed",
  verified_existing: "Company already verified",
} as const;

const QUALIFICATION_LABELS = {
  ready_for_outreach: "Ready for outreach",
  needs_founder_decision: "Needs founder decision",
  excluded: "Excluded",
  processing: "Processing",
} as const;

function messageFrom(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The operation could not be completed.";
}

function dimensionEntries(
  review: ProspectReview,
): readonly {
  readonly name: string;
  readonly points: number;
  readonly explanation: string;
}[] {
  const breakdown =
    review.latestAssessment
      ?.scoreBreakdown ?? {};
  return Object.entries(breakdown)
    .map(([name, value]) => {
      if (
        typeof value !== "object" ||
        value === null
      ) return null;
      const points =
        "points" in value &&
        typeof value.points === "number"
          ? value.points
          : null;
      const explanation =
        "explanation" in value &&
        typeof value.explanation === "string"
          ? value.explanation
          : null;
      return points === null ||
        explanation === null
        ? null
        : { name, points, explanation };
    })
    .filter((item): item is {
      readonly name: string;
      readonly points: number;
      readonly explanation: string;
    } => item !== null);
}

export function ProspectReviewWorkspace({
  backendUrl,
  accessToken,
  companiesHouseEnabled = false,
  companyEnrichmentEnabled = false,
  automaticQualificationEnabled = false,
}: ProspectReviewWorkspaceProps) {
  const [prospects, setProspects] =
    useState<readonly ProspectSummary[]>([]);
  const [selectedId, setSelectedId] =
    useState("");
  const [review, setReview] =
    useState<ProspectReview | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [working, setWorking] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);
  const [message, setMessage] =
    useState<string | null>(null);
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
  const [companyQuery, setCompanyQuery] =
    useState("");
  const [companyMatches, setCompanyMatches] =
    useState<
      readonly CompaniesHouseMatch[]
    >([]);
  const [companySearchComplete,
    setCompanySearchComplete] =
      useState(false);
  const [queueSearch, setQueueSearch] =
    useState("");
  const [queueFilter, setQueueFilter] =
    useState<ReviewQueueFilter>(
      defaultReviewQueueFilter(
        automaticQualificationEnabled,
        companyEnrichmentEnabled,
      ),
    );
  const [unseenOnly, setUnseenOnly] =
    useState(false);

  async function refreshQueue() {
    setLoading(true);
    setError(null);
    try {
      const result = await listProspects(
        backendUrl,
        accessToken,
      );
      setProspects(result);
      if (
        selectedId !== "" &&
        !result.some(
          (item) => item.id === selectedId,
        )
      ) {
        setSelectedId("");
        setReview(null);
      }
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setLoading(false);
    }
  }

  async function loadReview(
    prospectId: string,
  ): Promise<boolean> {
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      const loaded = await getProspect(
          backendUrl,
          accessToken,
          prospectId,
        );
      setReview(loaded);
      setCompanyQuery(
        loaded.businessName,
      );
      const prepared =
        loaded.companyEnrichment?.status ===
          "review_required"
          ? loaded.companyEnrichment.candidates
          : [];
      setCompanyMatches(prepared);
      setCompanySearchComplete(
        loaded.companyEnrichment?.status ===
          "no_match" ||
        prepared.length > 0,
      );
      return true;
    } catch (caught) {
      setError(messageFrom(caught));
      return false;
    } finally {
      setWorking(false);
    }
  }

  useEffect(() => {
    void refreshQueue();
    // The token and URL are stable for this authenticated view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, backendUrl]);

  async function chooseProspect(
    prospectId: string,
  ) {
    setSelectedId(prospectId);
    setReview(null);
    if (prospectId !== "") {
      const loaded =
        await loadReview(prospectId);
      const current = prospects.find(
        (item) => item.id === prospectId,
      );
      if (
        loaded &&
        current?.viewedAt === null
      ) {
        setWorking(true);
        try {
          const viewedAt =
            await updateProspectViewState(
              backendUrl,
              accessToken,
              prospectId,
              true,
            );
          setProspects((items) =>
            items.map((item) =>
              item.id === prospectId
                ? { ...item, viewedAt }
                : item,
            ),
          );
        } catch (caught) {
          setError(messageFrom(caught));
        } finally {
          setWorking(false);
        }
      }
    }
  }

  async function markSelectedAsUnseen() {
    if (selectedId === "") return;
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      await updateProspectViewState(
        backendUrl,
        accessToken,
        selectedId,
        false,
      );
      setProspects((items) =>
        items.map((item) =>
          item.id === selectedId
            ? { ...item, viewedAt: null }
            : item,
        ),
      );
      setMessage(
        "This prospect is marked Unseen and will appear in the Unseen-only queue.",
      );
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setWorking(false);
    }
  }

  async function submitEvidence(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (review === null) return;
    const form = new FormData(
      event.currentTarget,
    );
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      const result = await addVerificationEvidence(
        backendUrl,
        accessToken,
        review.id,
        {
          sourceType,
          sourceUrl:
            String(form.get("sourceUrl") ?? ""),
          factName,
          factValue,
          sourceExcerpt:
            String(
              form.get("sourceExcerpt") ?? "",
            ).trim() || null,
        },
      );
      setMessage(
        result.automaticAssessment.status ===
          "updated"
          ? "Verified evidence was saved and the assessment updated automatically."
          : "Verified evidence was saved. Automatic assessment is pending; use the manual recalculation fallback.",
      );
      setFactValue("");
      event.currentTarget.reset();
      await Promise.all([
        loadReview(review.id),
        refreshQueue(),
      ]);
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setWorking(false);
    }
  }

  async function applyDecision(
    evidenceId: string,
    decision: "verified" | "rejected",
  ) {
    if (review === null) return;
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      const result = await decideEvidence(
        backendUrl,
        accessToken,
        review.id,
        evidenceId,
        decision,
      );
      setMessage(
        result.status === "updated"
          ? `Evidence marked ${decision} and the assessment updated automatically.`
          : `Evidence marked ${decision}. Automatic assessment is pending; use the manual recalculation fallback.`,
      );
      await Promise.all([
        loadReview(review.id),
        refreshQueue(),
      ]);
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setWorking(false);
    }
  }

  async function assess() {
    if (review === null) return;
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      const result = await assessProspect(
        backendUrl,
        accessToken,
        review.id,
      );
      setMessage(
        `Assessment saved: ${result.totalScore}/10 — ${result.eligibilityResult === "eligible" ? "eligible" : "research required"}.`,
      );
      await Promise.all([
        loadReview(review.id),
        refreshQueue(),
      ]);
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setWorking(false);
    }
  }

  async function searchCompaniesHouse(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (review === null) return;
    setWorking(true);
    setError(null);
    setMessage(null);
    setCompanySearchComplete(false);
    try {
      setCompanyMatches(
        await searchCompaniesHouseMatches(
          backendUrl,
          accessToken,
          review.id,
          companyQuery,
        ),
      );
      setCompanySearchComplete(true);
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setWorking(false);
    }
  }

  async function confirmCompaniesHouse(
    companyNumber: string,
  ) {
    if (review === null) return;
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      const result =
        await verifyCompaniesHouseMatch(
          backendUrl,
          accessToken,
          review.id,
          companyNumber,
        );
      setMessage(
        result.automaticAssessment.status ===
          "updated"
          ? `${result.companyName} was confirmed from Companies House and the assessment updated automatically.`
          : `${result.companyName} was confirmed from Companies House. Automatic assessment is pending; use the manual recalculation fallback.`,
      );
      await Promise.all([
        loadReview(review.id),
        refreshQueue(),
      ]);
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setWorking(false);
    }
  }

  async function retryAutomaticCheck() {
    if (review === null) return;
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      await retryCompanyEnrichment(
        backendUrl,
        accessToken,
        review.id,
      );
      setMessage(
        "The automatic company check was queued. It will run in the background; manual verification remains available.",
      );
      await Promise.all([
        loadReview(review.id),
        refreshQueue(),
      ]);
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setWorking(false);
    }
  }

  const controlledValues =
    CONTROLLED_VALUES[factName];
  const visibleFactOptions =
    sourceType === "companies_house"
      ? FACT_OPTIONS.filter((item) =>
          COMPANIES_HOUSE_FACTS.has(
            item.value,
          ),
        )
      : FACT_OPTIONS;
  const filteredProspects = filterProspectQueue(
    prospects,
    queueFilter,
    queueSearch,
    automaticQualificationEnabled,
    unseenOnly,
  );
  const unseenCount = prospects.filter(
    (item) => item.viewedAt === null,
  ).length;
  const selectedProspect = prospects.find(
    (item) => item.id === selectedId,
  );

  return (
    <section
      className="prospect-review stack"
      id="prospect-review"
    >
      <div className="results-summary">
        <div>
          <h2>Verify and score prospects</h2>
          <p>
            {automaticQualificationEnabled
              ? "Automatic research checks bounded first-party and official evidence, calculates the 0–10 score and routes only exceptions for founder review. A high score never overrides a blocker."
              : "Scores are calculated when prospects are captured and update after verified evidence changes. Automatic verification is restricted to one labelled company number on the prospect's first-party website; every other match requires founder review, and a high score never overrides a blocker."}
          </p>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => void refreshQueue()}
          disabled={loading || working}
        >
          Refresh prospects
        </button>
      </div>

      <p className="notice">
        Outlook drafting remains disabled in this stage.
      </p>

      <div className="review-queue-controls">
        {companyEnrichmentEnabled && (
          <>
            <label>
            Find a prospect
            <input
              type="search"
              value={queueSearch}
              placeholder="Business, postcode or company number"
              onChange={(event) =>
                setQueueSearch(event.target.value)
              }
            />
            </label>
            <label>
            Review queue
            <select
              value={queueFilter}
              onChange={(event) =>
                setQueueFilter(
                  event.target.value as
                    typeof queueFilter,
                )
              }
            >
              {automaticQualificationEnabled ? (
                <>
                  <option value="ready_for_outreach">
                    Ready for outreach
                  </option>
                  <option value="needs_founder_decision">
                    Needs founder decision
                  </option>
                  <option value="excluded">
                    Excluded
                  </option>
                  <option value="processing">
                    Processing
                  </option>
                </>
              ) : (
                <>
                  <option value="exceptions">
                    Needs founder review
                  </option>
                  <option value="pending">
                    Automatic checks pending
                  </option>
                  <option value="verified">
                    Company verified
                  </option>
                </>
              )}
              <option value="all">
                All prospects
              </option>
            </select>
            </label>
          </>
        )}
        <label className="unseen-toggle">
          <input
            type="checkbox"
            checked={unseenOnly}
            onChange={(event) =>
              setUnseenOnly(
                event.target.checked,
              )
            }
          />
          <span>
            Unseen only ({unseenCount})
          </span>
        </label>
      </div>

      <label>
        Prospect to review
        <select
          value={selectedId}
          disabled={loading || working}
          onChange={(event) =>
            void chooseProspect(
              event.target.value,
            )
          }
        >
          <option value="">
            {loading
              ? "Loading prospects…"
              : `Choose from ${filteredProspects.length} prospects`}
          </option>
          {filteredProspects.map((item) => (
            <option
              key={item.id}
              value={item.id}
            >
              {item.viewedAt === null ? "NEW — " : ""}{item.businessName} — {item.primaryPostcode ?? "postcode unknown"} — {item.latestAssessment?.totalScore ?? "not scored"} — {item.companyEnrichment === null || item.companyEnrichment === undefined
                ? "not queued"
                : item.companyEnrichment.qualificationState === undefined
                  ? ENRICHMENT_LABELS[item.companyEnrichment.status]
                  : QUALIFICATION_LABELS[item.companyEnrichment.qualificationState]}
            </option>
          ))}
        </select>
      </label>

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

      {review !== null && (
        <div className="review-layout">
          <section className="review-panel stack">
            <div className="prospect-heading">
              <div>
                <h3>{review.businessName}</h3>
                <p>
                  {review.primaryPostcode ?? "Postcode unknown"} · {review.hasSearchProvenance ? "search-linked" : "manual capture — search link required"}
                </p>
              </div>
              {selectedProspect?.viewedAt != null && (
                <button
                  type="button"
                  className="secondary small-button"
                  onClick={() =>
                    void markSelectedAsUnseen()
                  }
                  disabled={working}
                >
                  Mark as unseen
                </button>
              )}
            </div>

            {review.latestAssessment === null ? (
              <p>No assessment has been saved.</p>
            ) : (
              <div className="assessment-summary stack">
                <div className="score-line">
                  <strong>
                    {review.latestAssessment.totalScore}/10
                  </strong>
                  <span className={
                    review.latestAssessment
                      .eligibilityResult === "eligible"
                      ? "status-verified"
                      : "status-unverified"
                  }>
                    {review.latestAssessment
                      .eligibilityResult === "eligible"
                      ? "Ready for outreach"
                      : "Research required"}
                  </span>
                </div>
                <p>
                  {review.latestAssessment.rationale}
                </p>
                {dimensionEntries(review).map(
                  (item) => (
                    <div
                      className="dimension-row"
                      key={item.name}
                    >
                      <strong>{item.points}/2</strong>
                      <span>
                        {item.explanation}
                      </span>
                    </div>
                  ),
                )}
                {review.latestAssessment.blockers.length > 0 && (
                  <ul className="blocker-list">
                    {review.latestAssessment.blockers.map(
                      (blocker) => (
                        <li key={blocker}>
                          {BLOCKER_LABELS[blocker] ?? blocker}
                        </li>
                      ),
                    )}
                  </ul>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => void assess()}
              disabled={working}
            >
              {review.latestAssessment === null
                ? "Calculate and save 0–10 assessment"
                : "Recalculate 0–10 assessment"}
            </button>
          </section>

          <div className="stack">
            {companiesHouseEnabled && (
              <section className="review-panel stack">
                <h3>
                  Companies House-assisted verification
                </h3>
                <p>
                  The engine checks labelled first-party company numbers automatically. Name-search candidates are prepared here for founder confirmation and are never auto-accepted.
                </p>
                {review.companyEnrichment !== null &&
                  review.companyEnrichment !== undefined && (
                    <div className="enrichment-summary">
                      <strong>
                        {review.companyEnrichment
                          .qualificationState === undefined
                          ? ENRICHMENT_LABELS[
                              review.companyEnrichment.status
                            ]
                          : QUALIFICATION_LABELS[
                              review.companyEnrichment
                                .qualificationState
                            ]}
                      </strong>
                      {review.companyEnrichment
                        .qualificationReasons !== undefined &&
                        review.companyEnrichment
                          .qualificationReasons.length > 0 && (
                          <span>
                            {review.companyEnrichment
                              .qualificationReasons
                              .map((reason) =>
                                reason.replaceAll("_", " "))
                              .join(" · ")}
                          </span>
                        )}
                      {review.companyEnrichment
                        .discoveredCompanyNumber !== null && (
                          <span>
                            Company number {review.companyEnrichment.discoveredCompanyNumber}
                          </span>
                        )}
                      {review.companyEnrichment
                        .sourceUrl !== null && (
                          <a
                            href={review.companyEnrichment.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open first-party source
                          </a>
                        )}
                      {["failed", "no_match", "duplicate"]
                        .includes(
                          review.companyEnrichment.status,
                        ) && (
                          <button
                            type="button"
                            className="secondary"
                            disabled={working}
                            onClick={() =>
                              void retryAutomaticCheck()
                            }
                          >
                            Retry automatic check
                          </button>
                        )}
                    </div>
                  )}
                <form
                  className="stack"
                  onSubmit={searchCompaniesHouse}
                >
                  <label>
                    Company name or number
                    <input
                      value={companyQuery}
                      onChange={(event) =>
                        setCompanyQuery(
                          event.target.value,
                        )
                      }
                      minLength={2}
                      maxLength={200}
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={working}
                  >
                    Search Companies House
                  </button>
                </form>

                {companySearchComplete &&
                  companyMatches.length === 0 && (
                    <p>
                      No Companies House matches were returned. Use the manual verification form below or retry after correcting the prospect website.
                    </p>
                  )}

                {companyMatches.length > 0 && (
                  <div className="company-match-list">
                    {companyMatches.map(
                      (match) => (
                        <article
                          className="company-match"
                          key={
                            match.companyNumber
                          }
                        >
                          <div>
                            <strong>
                              {match.companyName}
                            </strong>
                            <p>
                              {match.companyNumber} · {match.companyStatus} · {match.companyType}
                            </p>
                            <p>
                              Registered office: {match.registeredOfficeAddress.formatted ?? "not returned"}
                            </p>
                            <a
                              href={
                                match.officialUrl
                              }
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open official record
                            </a>
                          </div>
                          <button
                            type="button"
                            disabled={working}
                            onClick={() =>
                              void confirmCompaniesHouse(
                                match.companyNumber,
                              )
                            }
                          >
                            Confirm this exact company
                          </button>
                        </article>
                      ),
                    )}
                  </div>
                )}

                <p className="registered-office-note">
                  Registered-office details are shown only for matching. They are not saved as the trading address, and SIC codes do not set the prospect sector.
                </p>
              </section>
            )}

            <section className="review-panel stack">
              <h3>Add verified evidence</h3>
            <p>
              Review one public page, then record only the atomic fact you can support.
            </p>
            <form
              className="stack"
              onSubmit={submitEvidence}
            >
              <label>
                Source
                <select
                  value={sourceType}
                  onChange={(event) => {
                    const next =
                      event.target.value as
                        VerificationSourceType;
                    setSourceType(next);
                    if (
                      next ===
                        "companies_house" &&
                      !COMPANIES_HOUSE_FACTS
                        .has(factName)
                    ) {
                      setFactName(
                        "business_name",
                      );
                      setFactValue("");
                    }
                  }}
                >
                  <option value="first_party_website">
                    Prospect's own website
                  </option>
                  <option value="companies_house">
                    Companies House
                  </option>
                </select>
              </label>
              <label>
                Source URL
                <input
                  name="sourceUrl"
                  type="url"
                  placeholder="https://…"
                  required
                />
              </label>
              <label>
                Fact
                <select
                  value={factName}
                  onChange={(event) => {
                    const next =
                      event.target.value as
                        VerificationFactName;
                    setFactName(next);
                    setFactValue(
                      CONTROLLED_VALUES[next]
                        ?.[0]?.value ?? "",
                    );
                  }}
                >
                  {visibleFactOptions.map((item) => (
                    <option
                      key={item.value}
                      value={item.value}
                    >
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Verified value
                {controlledValues === undefined ? (
                  <input
                    value={factValue}
                    type={
                      factName === "public_email"
                        ? "email"
                        : factName === "website_url" ||
                            factName === "contact_form_url"
                          ? "url"
                          : "text"
                    }
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
                      Choose verified value
                    </option>
                    {controlledValues.map(
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
              <label>
                Short source note (optional)
                <input
                  name="sourceExcerpt"
                  maxLength={500}
                />
              </label>
              <button
                type="submit"
                disabled={working}
              >
                Save verified evidence
              </button>
            </form>
            </section>
          </div>
        </div>
      )}

      {review !== null && (
        <section className="stack">
          <h3>
            Evidence ({review.evidence.length})
          </h3>
          <div className="evidence-list">
            {review.evidence.map((item) => (
              <article
                className="evidence-item"
                key={item.id}
              >
                <div>
                  <strong>
                    {item.fieldName.replaceAll("_", " ")}
                  </strong>
                  <p>{item.fieldValue}</p>
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open source
                  </a>
                </div>
                <div className="evidence-actions">
                  <span className={`status-${item.verificationStatus}`}>
                    {item.verificationMethod ===
                      "automatic_first_party_company_number"
                      ? "automatically verified"
                      : item.verificationMethod ===
                          "automatic_first_party_research"
                        ? "automatically researched"
                        : item.verificationStatus}
                  </span>
                  {(
                    item.sourceType ===
                      "first_party_website" ||
                    item.sourceType ===
                      "companies_house"
                  ) && (
                    <button
                      type="button"
                      className="secondary small-button"
                      disabled={working}
                      onClick={() =>
                        void applyDecision(
                          item.id,
                          "verified",
                        )
                      }
                    >
                      Verify
                    </button>
                  )}
                  <button
                    type="button"
                    className="danger small-button"
                    disabled={working}
                    onClick={() =>
                      void applyDecision(
                        item.id,
                        "rejected",
                      )
                    }
                  >
                    Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
