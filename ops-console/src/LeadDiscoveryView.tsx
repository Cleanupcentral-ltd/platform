import {
  FormEvent,
  useMemo,
  useState,
} from "react";

import {
  ALL_LEAD_SECTORS,
  captureManualLead,
  LEAD_SEARCH_SECTOR_OPTIONS,
  LEAD_SECTOR_OPTIONS,
  LONDON_BOROUGH_OPTIONS,
  searchLeadSelection,
  type LeadSearchResult,
  type LeadSearchSector,
  type LeadSector,
} from "./lead-search-api";

import {
  matchSearchResultToProspect,
  prospectQualificationLabel,
} from "./search-result-state";

import type {
  ProspectSummary,
} from "./lead-review-api";

import {
  queueClass,
  queueKey,
  score,
} from "./redesign-helpers";

interface LeadDiscoveryViewProps {
  readonly backendUrl: string;
  readonly accessToken: string;
  readonly prospects:
    readonly ProspectSummary[];
  readonly refreshProspects:
    () => Promise<readonly ProspectSummary[]>;
  readonly onOpenProspect: (
    prospectId: string,
    ready: boolean,
  ) => void;
  readonly onMessage: (
    message: string,
  ) => void;
  readonly onError: (
    message: string,
  ) => void;
}

type ResultFilter =
  | "all"
  | "unseen"
  | "seen";

function messageFrom(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The search could not be completed.";
}

function resultProspectId(
  result: LeadSearchResult,
): string | null {
  return (
    result as LeadSearchResult & {
      readonly prospectId?: string;
    }
  ).prospectId ?? null;
}

function nullable(value: FormDataEntryValue | null):
  string | null {
  const cleaned = String(value ?? "").trim();
  return cleaned === "" ? null : cleaned;
}

export function LeadDiscoveryView({
  backendUrl,
  accessToken,
  prospects,
  refreshProspects,
  onOpenProspect,
  onMessage,
  onError,
}: LeadDiscoveryViewProps) {
  const [searchMode, setSearchMode] =
    useState<"postcode" | "borough">(
      "borough",
    );
  const [postcode, setPostcode] =
    useState("");
  const [borough, setBorough] =
    useState("Bromley");
  const [radiusMiles, setRadiusMiles] =
    useState("5");
  const [sector, setSector] =
    useState<LeadSearchSector>(
      ALL_LEAD_SECTORS,
    );
  const [results, setResults] =
    useState<readonly LeadSearchResult[]>([]);
  const [resultFilter, setResultFilter] =
    useState<ResultFilter>("all");
  const [searching, setSearching] =
    useState(false);
  const [hasSearched, setHasSearched] =
    useState(false);
  const [manualWorking, setManualWorking] =
    useState(false);

  const resultRows = useMemo(
    () => results.map((result) => {
      const directId = resultProspectId(result);
      const prospect = directId === null
        ? matchSearchResultToProspect(
            result,
            prospects,
          )
        : prospects.find(
            (item) => item.id === directId,
          ) ?? null;
      const viewState =
        prospect?.viewedAt == null
          ? "unseen" as const
          : "seen" as const;
      return {
        result,
        prospect,
        prospectId:
          directId ?? prospect?.id ?? null,
        viewState,
      };
    }).filter(
      (row) =>
        resultFilter === "all" ||
        row.viewState === resultFilter,
    ),
    [results, prospects, resultFilter],
  );

  const unseenCount = useMemo(
    () => results.filter((result) => {
      const directId = resultProspectId(result);
      const prospect = directId === null
        ? matchSearchResultToProspect(
            result,
            prospects,
          )
        : prospects.find(
            (item) => item.id === directId,
          ) ?? null;
      return prospect?.viewedAt == null;
    }).length,
    [results, prospects],
  );

  async function submitSearch(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSearching(true);
    setResultFilter("all");
    try {
      const outcome = await searchLeadSelection(
        backendUrl,
        accessToken,
        searchMode === "borough"
          ? {
              mode: "borough",
              borough,
              sector,
            }
          : {
              mode: "postcode",
              postcode,
              radiusMiles:
                Number(radiusMiles),
              sector,
            },
      );
      setResults(outcome.results);
      setHasSearched(true);
      await refreshProspects();
      onMessage(
        `${outcome.resultCount} businesses found · ${outcome.createdCount} new prospects added for automatic verification.`,
      );
    } catch (error) {
      onError(messageFrom(error));
    } finally {
      setSearching(false);
    }
  }

  async function submitManual(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setManualWorking(true);
    try {
      const result = await captureManualLead(
        backendUrl,
        accessToken,
        {
          businessName:
            String(
              data.get("businessName") ?? "",
            ),
          sector:
            String(
              data.get("sector") ?? "",
            ) as LeadSector,
          sourceUrl:
            String(
              data.get("sourceUrl") ?? "",
            ),
          formattedAddress:
            nullable(
              data.get("formattedAddress"),
            ),
          primaryPostcode:
            nullable(
              data.get("primaryPostcode"),
            ),
          websiteUrl:
            nullable(data.get("websiteUrl")),
          phone: nullable(data.get("phone")),
          email: nullable(data.get("email")),
          contactFormUrl:
            nullable(
              data.get("contactFormUrl"),
            ),
        },
      );
      form.reset();
      await refreshProspects();
      onMessage(
        `${result.businessName} was captured for verification.`,
      );
    } catch (error) {
      onError(messageFrom(error));
    } finally {
      setManualWorking(false);
    }
  }

  return (
    <section className="le-view">
      <div className="le-view-heading">
        <div>
          <p className="le-overline">
            PROSPECT DISCOVERY
          </p>
          <h2>
            Find local businesses worth reviewing.
          </h2>
          <p>
            Search public business data by postcode or London borough. New results enter the existing automatic verification journey in the background.
          </p>
        </div>
      </div>

      <form
        className="le-search-panel"
        onSubmit={submitSearch}
      >
        <label>
          <span>Search by</span>
          <select
            value={searchMode}
            onChange={(event) =>
              setSearchMode(
                event.target.value as
                  "postcode" | "borough",
              )
            }
          >
            <option value="postcode">
              Postcode
            </option>
            <option value="borough">
              Borough
            </option>
          </select>
        </label>

        {searchMode === "postcode" ? (
          <>
            <label>
              <span>UK postcode</span>
              <input
                value={postcode}
                onChange={(event) =>
                  setPostcode(event.target.value)
                }
                placeholder="BR1 1AA"
                autoComplete="postal-code"
                required
              />
            </label>
            <label>
              <span>Radius</span>
              <select
                value={radiusMiles}
                onChange={(event) =>
                  setRadiusMiles(
                    event.target.value,
                  )
                }
              >
                {[1, 2, 3, 5, 10, 15, 20, 30]
                  .map((value) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {value} miles
                    </option>
                  ))}
              </select>
            </label>
          </>
        ) : (
          <label className="le-location-wide">
            <span>London borough</span>
            <select
              value={borough}
              onChange={(event) =>
                setBorough(event.target.value)
              }
            >
              {LONDON_BOROUGH_OPTIONS.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ),
              )}
            </select>
          </label>
        )}

        <label className="le-sector-wide">
          <span>Sector</span>
          <select
            value={sector}
            onChange={(event) =>
              setSector(
                event.target.value as
                  LeadSearchSector,
              )
            }
          >
            {LEAD_SEARCH_SECTOR_OPTIONS.map(
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

        <button
          type="submit"
          className="le-primary"
          disabled={searching}
        >
          {searching
            ? "Searching…"
            : "Search businesses"}
        </button>
      </form>

      {hasSearched && (
        <div className="le-google-results">
          <div className="le-results-toolbar">
            <div className="le-view-filters">
              <button
                type="button"
                className={
                  resultFilter === "all"
                    ? "is-active"
                    : ""
                }
                onClick={() =>
                  setResultFilter("all")
                }
              >
                All ({results.length})
              </button>
              <button
                type="button"
                className={
                  resultFilter === "unseen"
                    ? "is-active"
                    : ""
                }
                onClick={() =>
                  setResultFilter("unseen")
                }
              >
                Unseen ({unseenCount})
              </button>
              <button
                type="button"
                className={
                  resultFilter === "seen"
                    ? "is-active"
                    : ""
                }
                onClick={() =>
                  setResultFilter("seen")
                }
              >
                Seen ({results.length - unseenCount})
              </button>
            </div>
            <span
              className="le-google-attribution"
              translate="no"
            >
              Google Maps
            </span>
          </div>

          {resultRows.length === 0 ? (
            <div className="le-empty-state">
              No results match this viewed-state filter.
            </div>
          ) : (
            <div className="le-result-grid">
              {resultRows.map((row, index) => {
                const ready =
                  row.prospect !== null &&
                  queueKey(row.prospect) ===
                    "ready";
                return (
                  <article
                    className="le-result-card"
                    key={`${row.result.sourceUrl}-${index}`}
                  >
                    <div className="le-result-top">
                      <div>
                        {row.viewState ===
                          "unseen" && (
                            <span className="le-new-badge">
                              NEW
                            </span>
                          )}
                        <h3>
                          {row.result.businessName}
                        </h3>
                      </div>
                      <span className="le-score">
                        {score(row.prospect)}
                      </span>
                    </div>

                    <p className="le-result-address">
                      {row.result.formattedAddress ??
                        row.result.primaryPostcode ??
                        "Address not returned"}
                    </p>

                    <div className="le-result-links">
                      {row.result.phone !== null && (
                        <a
                          href={`tel:${row.result.phone.replace(/\s/g, "")}`}
                        >
                          {row.result.phone}
                        </a>
                      )}
                      {row.result.websiteUrl !== null && (
                        <a
                          href={row.result.websiteUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Website ↗
                        </a>
                      )}
                      <a
                        href={row.result.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Google Maps ↗
                      </a>
                    </div>

                    <div className="le-result-meta">
                      <span>
                        {row.result.distanceMiles ===
                          null
                          ? "Borough match"
                          : `${row.result.distanceMiles.toFixed(2)} mi`}
                      </span>
                      <span
                        className={
                          row.viewState === "unseen"
                            ? "le-unseen-text"
                            : ""
                        }
                      >
                        {row.viewState === "unseen"
                          ? "Unseen"
                          : "Seen"}
                      </span>
                    </div>

                    <div className="le-result-footer">
                      <span
                        className={
                          row.prospect === null
                            ? "le-status le-status-queued"
                            : queueClass(
                                row.prospect,
                              )
                        }
                      >
                        {row.prospect === null
                          ? "Queued"
                          : prospectQualificationLabel(
                              row.prospect,
                            )}
                      </span>
                      {row.prospectId !== null && (
                        <button
                          type="button"
                          className="le-text-action"
                          onClick={() =>
                            onOpenProspect(
                              row.prospectId!,
                              ready,
                            )
                          }
                        >
                          {ready
                            ? "Prepare outreach →"
                            : "Inspect →"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      <details className="le-founder-utility">
        <summary>
          Add a prospect manually
        </summary>
        <form
          className="le-manual-form"
          onSubmit={submitManual}
        >
          <label>
            <span>Business name</span>
            <input
              name="businessName"
              required
            />
          </label>
          <label>
            <span>Sector</span>
            <select
              name="sector"
              defaultValue={
                LEAD_SECTOR_OPTIONS[0].value
              }
            >
              {LEAD_SECTOR_OPTIONS.map(
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
            <span>Public source URL</span>
            <input
              name="sourceUrl"
              type="url"
              placeholder="https://"
              required
            />
          </label>
          <label>
            <span>Postcode</span>
            <input
              name="primaryPostcode"
            />
          </label>
          <label>
            <span>Public website</span>
            <input
              name="websiteUrl"
              type="url"
              placeholder="https://"
            />
          </label>
          <label className="le-span-2">
            <span>Address</span>
            <input name="formattedAddress" />
          </label>
          <label>
            <span>Phone</span>
            <input name="phone" />
          </label>
          <label>
            <span>Generic email</span>
            <input
              name="email"
              type="email"
            />
          </label>
          <label className="le-span-2">
            <span>Contact form URL</span>
            <input
              name="contactFormUrl"
              type="url"
              placeholder="https://"
            />
          </label>
          <button
            type="submit"
            className="le-secondary"
            disabled={manualWorking}
          >
            {manualWorking
              ? "Adding…"
              : "Add prospect"}
          </button>
        </form>
      </details>
    </section>
  );
}
