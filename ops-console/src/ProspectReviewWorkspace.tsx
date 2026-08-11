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
  type ProspectReview,
  type ProspectSummary,
  type VerificationFactName,
  type VerificationSourceType,
} from "./lead-review-api";

interface ProspectReviewWorkspaceProps {
  readonly backendUrl: string;
  readonly accessToken: string;
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
    "approved_sector",
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
  ) {
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      setReview(
        await getProspect(
          backendUrl,
          accessToken,
          prospectId,
        ),
      );
    } catch (caught) {
      setError(messageFrom(caught));
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
      await loadReview(prospectId);
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
      await addVerificationEvidence(
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
        "Verified evidence was saved with its source.",
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
      await decideEvidence(
        backendUrl,
        accessToken,
        review.id,
        evidenceId,
        decision,
      );
      setMessage(
        `Evidence marked ${decision}.`,
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

  return (
    <section className="prospect-review stack">
      <div className="results-summary">
        <div>
          <h2>Verify and score prospects</h2>
          <p>
            Scores use only founder-reviewed evidence. A high score never overrides a blocker.
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
              : `Choose from ${prospects.length} prospects`}
          </option>
          {prospects.map((item) => (
            <option
              key={item.id}
              value={item.id}
            >
              {item.businessName} — {item.primaryPostcode ?? "postcode unknown"} — {item.latestAssessment?.totalScore ?? "not scored"}
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
            <div>
              <h3>{review.businessName}</h3>
              <p>
                {review.primaryPostcode ?? "Postcode unknown"} · {review.hasSearchProvenance ? "search-linked" : "manual capture — search link required"}
              </p>
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
                      ? "Eligible for founder review"
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
              Calculate and save 0–10 assessment
            </button>
          </section>

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
                    {item.verificationStatus}
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
