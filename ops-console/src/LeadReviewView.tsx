import {
  FormEvent,
  useEffect,
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
  groupEvidenceForDisplay,
} from "./evidence-view";

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

import "./verification-footer.css";
import "./evidence-view.css";
import "./evidence-review-layout.css";

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
  { value: "public_phone", label: "Public business phone" },
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

const COMPANY_TYPE_LABELS:
  Readonly<Record<string, string>> = {
    ltd: "Private limited company",
    plc: "Public limited company",
    llp: "Limited liability partnership",
    "private-limited-guarant-nsc":
      "Private company limited by guarantee",
    "private-limited-guarant-nsc-limited-exemption":
      "Private company limited by guarantee",
  };

function messageFrom(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The review action could not be completed.";
}

function sourceLabel(value: string): string {
  try {
    return new URL(value).hostname
      .replace(/^www\./, "");
  } catch {
    return "Source";
  }
}

function companyTypeLabel(
  value: string | null,
): string | null {
  if (value === null) return null;
  return COMPANY_TYPE_LABELS[value] ??
    value.replaceAll("-", " ");
}

function titleCase(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase());
}

export function LeadReviewView({
  backendUrl,
  accessToken,
  prospects,
  selectedId,
  setSelectedId,
  refreshProspects,
  markViewed,
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

  const evidenceGroups = useMemo(
    () => review === null
      ? []
      : groupEvidenceForDisplay(
          review.evidence,
        ),
    [review],
  );

  const detailedEvidenceGroups = useMemo(
    () => evidenceGroups.filter((group) =>
      ![
        "website_url",
        "public_phone",
        "google_place_id",
        "company_number",
      ].includes(
        group.representative.fieldName,
      )),
    [evidenceGroups],
  );

  const verifiedWebsite = useMemo(
    () => evidenceGroups.find((group) =>
      group.status === "verified" &&
      group.representative.fieldName ===
        "website_url") ?? null,
    [evidenceGroups],
  );

  const verifiedPhone = useMemo(() => {
    if (review === null) return null;
    return review.contacts.find((contact) =>
      contact.contactType === "phone" &&
      contact.verificationStatus === "verified") ??
      null;
  }, [review]);

  const mapEvidence = useMemo(() => {
    if (review === null) return null;
    return review.evidence.find((item) =>
      item.sourceType === "google_places" &&
      item.fieldName === "google_place_id") ??
      null;
  }, [review]);

  const companiesHouseEvidence = useMemo(() => {
    if (review === null) return [];
    return review.evidence.filter((item) =>
      item.sourceType === "companies_house" &&
      item.verificationStatus === "verified");
  }, [review]);

  const companiesHouseNumber = useMemo(
    () => companiesHouseEvidence.find((item) =>
      item.fieldName === "company_number") ?? null,
    [companiesHouseEvidence],
  );

  const companiesHouseName = useMemo(
    () => companiesHouseEvidence.find((item) =>
      item.fieldName === "business_name")
      ?.fieldValue ?? null,
    [companiesHouseEvidence],
  );

  const companiesHouseStatus = useMemo(
    () => companiesHouseEvidence.find((item) =>
      item.fieldName === "business_status")
      ?.fieldValue ?? null,
    [companiesHouseEvidence],
  );

  const companiesHouseSubscriber = useMemo(
    () => companiesHouseEvidence.find((item) =>
      item.fieldName === "subscriber_type")
      ?.fieldValue ?? null,
    [companiesHouseEvidence],
  );

  const verifiedCompanyMatch = useMemo(() => {
    if (companiesHouseNumber === null) {
      return null;
    }
    return companyMatches.find((company) =>
      company.companyNumber ===
        companiesHouseNumber.fieldValue) ?? null;
  }, [companiesHouseNumber, companyMatches]);

  const verifiedFactCount = useMemo(
    () => evidenceGroups.filter(
      (group) => group.status === "verified",
    ).length,
    [evidenceGroups],
  );

  const selectedSummary = selectedId === null
    ? null
    : prospects.find(
        (item) => item.id === selectedId,
      ) ?? null;
  const selectedQueue = selectedSummary === null
    ? null
    : queueKey(selectedSummary);

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

  useEffect(() => {
    if (selectedId === null) {
      setReview(null);
      return;
    }
    if (review?.id === selectedId) {
      return;
    }
    void loadReview(selectedId);
    // The authenticated URL/token and callbacks are stable for this view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function chooseProspect(
    prospectId: string,
  ) {
    setSelectedId(prospectId);
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

  const companySearch = (
    <>
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
    </>
  );

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
                  chooseProspect(
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

        <div
          className={
            selectedSummary === null
              ? "le-evidence-column"
              : "le-evidence-column has-selection"
          }
        >
          {selectedSummary !== null && (
            <div className="le-mobile-selected-prospect">
              <span className="le-row-copy">
                <strong>
                  {selectedSummary.businessName}
                </strong>
                <small>
                  {selectedSummary.primaryPostcode ??
                    "Postcode pending"}
                  {" · "}
                  {sectorLabel(
                    selectedSummary.sector,
                  )}
                </small>
              </span>
              <span className="le-row-score">
                {score(selectedSummary)}/10
              </span>
              <span
                className={
                  queueClass(selectedSummary)
                }
              >
                {queueLabel(selectedSummary)}
              </span>
            </div>
          )}

          <aside
            className="le-evidence-panel"
            id="lead-evidence-review"
          >
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
                      {verifiedFactCount} verified facts
                    </span>
                  </div>
                )}

                <section className="le-evidence-quick-block">
                  <p className="le-evidence-section-title">
                    VERIFIED EVIDENCE
                  </p>
                  <div className="le-evidence-quick-list">
                    <div>
                      <span>Business website</span>
                      {verifiedWebsite === null ? (
                        <strong>Not verified</strong>
                      ) : (
                        <a
                          href={
                            verifiedWebsite
                              .representative
                              .sourceUrl
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          Source ↗
                        </a>
                      )}
                    </div>
                    <div>
                      <span>Public contact number</span>
                      <strong>
                        {verifiedPhone?.contactValue ??
                          "Not verified"}
                      </strong>
                    </div>
                    <div>
                      <span>Location source</span>
                      {mapEvidence === null ? (
                        <strong>No map source</strong>
                      ) : (
                        <a
                          href={mapEvidence.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Map ↗
                        </a>
                      )}
                    </div>
                  </div>
                </section>

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

                <section className="le-company-assist">
                  <p className="le-evidence-section-title">
                    COMPANIES HOUSE ASSIST
                  </p>

                  {companiesHouseNumber !== null ? (
                    <>
                      <p className="le-company-assist-copy">
                        Automatically confirmed against Companies House.
                      </p>
                      <div className="le-company-confirmed-card">
                        <div>
                          <strong>
                            {companiesHouseName ??
                              review.businessName}
                          </strong>
                          <span>
                            {companiesHouseStatus === null
                              ? "Status verified"
                              : titleCase(
                                  companiesHouseStatus,
                                )}
                            {" · "}
                            {companyTypeLabel(
                              verifiedCompanyMatch
                                ?.companyType ?? null,
                            ) ??
                              (companiesHouseSubscriber ===
                                null
                                ? "Companies House record"
                                : `${titleCase(
                                    companiesHouseSubscriber,
                                  )} subscriber`)}
                          </span>
                          <small>
                            Company number: {companiesHouseNumber.fieldValue}
                          </small>
                          {verifiedCompanyMatch
                            ?.registeredOfficeAddress
                            .formatted !== null &&
                            verifiedCompanyMatch
                              ?.registeredOfficeAddress
                              .formatted !== undefined && (
                              <small>
                                Registered office: {verifiedCompanyMatch.registeredOfficeAddress.formatted}
                              </small>
                            )}
                          <a
                            href={
                              companiesHouseNumber
                                .sourceUrl
                            }
                            target="_blank"
                            rel="noreferrer"
                          >
                            Official record ↗
                          </a>
                        </div>
                        <span className="le-company-verified-badge">
                          VERIFIED
                        </span>
                      </div>
                      <details className="le-company-assist-search">
                        <summary>
                          Check a different Companies House match
                        </summary>
                        {companySearch}
                      </details>
                    </>
                  ) : (
                    <>
                      <p className="le-company-assist-copy">
                        No Companies House match has been confirmed yet. Search the official register when company verification is appropriate for this organisation.
                      </p>
                      {companySearch}
                    </>
                  )}
                </section>

                {detailedEvidenceGroups.length > 0 && (
                  <section className="le-detailed-evidence">
                    <p className="le-evidence-section-title">
                      OTHER EVIDENCE
                    </p>
                    <div className="le-evidence-list">
                      {detailedEvidenceGroups.map(
                        (group) => (
                          <div
                            className="le-evidence-row"
                            key={group.key}
                          >
                            <div>
                              <strong>{group.label}</strong>
                              <span>{group.value}</span>
                              <div className="le-evidence-source-stack">
                                <a
                                  href={group.representative.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  View source ↗
                                </a>
                                {group.sources.length > 1 && (
                                  <details className="le-evidence-source-details">
                                    <summary>
                                      {group.sources.length} evidence sources
                                    </summary>
                                    <div>
                                      {group.sources.map(
                                        (source) => (
                                          <a
                                            key={source.id}
                                            href={source.sourceUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                          >
                                            {sourceLabel(
                                              source.sourceUrl,
                                            )} ↗
                                          </a>
                                        ),
                                      )}
                                    </div>
                                  </details>
                                )}
                              </div>
                            </div>
                            <div className="le-evidence-row-side">
                              <span
                                className={`le-evidence-state le-evidence-${group.status}`}
                              >
                                {group.status}
                              </span>
                              {group.status ===
                                "unverified" && (
                                <div className="le-mini-actions">
                                  <button
                                    type="button"
                                    disabled={working}
                                    onClick={() =>
                                      void decide(
                                        group.representative.id,
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
                                        group.representative.id,
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
                  </section>
                )}

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

                {selectedSummary !== null &&
                  selectedQueue !== "ready" && (
                    <div
                      className={`le-verification-footer le-verification-footer-${selectedQueue}`}
                    >
                      <div className="le-verification-footer-copy">
                        <span>VERIFICATION STATUS</span>
                        <strong>
                          {selectedQueue === "review" &&
                            "Verification Unresolved"}
                          {selectedQueue === "queued" &&
                            "Awaiting Verification"}
                          {selectedQueue === "processing" &&
                            "Verification in progress"}
                          {selectedQueue === "excluded" &&
                            "Excluded"}
                        </strong>
                        {selectedQueue === "excluded" && (
                          <p>
                            This prospect is excluded from outreach. No verification action is available.
                          </p>
                        )}
                      </div>

                      {(selectedQueue === "review" ||
                        selectedQueue === "queued") && (
                        <div className="le-verification-footer-actions">
                          <button
                            type="button"
                            className="le-dark-button"
                            disabled={working}
                            onClick={() =>
                              void retryAutomaticCheck()
                            }
                          >
                            {selectedQueue === "review"
                              ? "Retry automatic check"
                              : "Run automatic check now"}
                          </button>
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
                    </div>
                  )}
              </>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
