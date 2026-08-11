import {
  FormEvent,
  useState,
} from "react";

import {
  captureManualLead,
  LEAD_SECTOR_OPTIONS,
  searchLeads,
  type LeadSearchOutcome,
  type LeadSector,
} from "./lead-search-api";

import {
  ProspectReviewWorkspace,
} from "./ProspectReviewWorkspace";

interface LeadSearchWorkspaceProps {
  readonly backendUrl: string;
  readonly accessToken: string;
  readonly onSignOut: () =>
    Promise<void>;
  readonly reviewEnabled?: boolean;
}

function errorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : "The operation could not be completed.";
}

function nullable(value: string):
  string | null {
  const cleaned = value.trim();
  return cleaned.length === 0
    ? null
    : cleaned;
}

export function LeadSearchWorkspace({
  backendUrl,
  accessToken,
  onSignOut,
  reviewEnabled = false,
}: LeadSearchWorkspaceProps) {
  const [postcode, setPostcode] =
    useState("");
  const [radiusMiles, setRadiusMiles] =
    useState("5");
  const [sector, setSector] =
    useState<LeadSector>(
      "short_let_serviced_accommodation",
    );
  const [outcome, setOutcome] =
    useState<LeadSearchOutcome | null>(
      null,
    );
  const [searching, setSearching] =
    useState(false);
  const [searchError, setSearchError] =
    useState<string | null>(null);
  const [manualMessage, setManualMessage] =
    useState<string | null>(null);
  const [manualError, setManualError] =
    useState<string | null>(null);

  async function submitSearch(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSearching(true);
    setSearchError(null);
    setOutcome(null);
    try {
      setOutcome(
        await searchLeads(
          backendUrl,
          accessToken,
          {
            postcode,
            radiusMiles:
              Number(radiusMiles),
            sector,
          },
        ),
      );
    } catch (error) {
      setSearchError(
        errorMessage(error),
      );
    } finally {
      setSearching(false);
    }
  }

  async function submitManual(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const formElement =
      event.currentTarget;
    setManualError(null);
    setManualMessage(null);
    const form = new FormData(
      event.currentTarget,
    );
    const read = (name: string) =>
      String(form.get(name) ?? "");

    try {
      const result =
        await captureManualLead(
          backendUrl,
          accessToken,
          {
            businessName:
              read("businessName"),
            sector:
              read("sector") as
                LeadSector,
            sourceUrl:
              read("sourceUrl"),
            formattedAddress:
              nullable(
                read(
                  "formattedAddress",
                ),
              ),
            primaryPostcode:
              nullable(
                read(
                  "primaryPostcode",
                ),
              ),
            websiteUrl:
              nullable(
                read("websiteUrl"),
              ),
            phone:
              nullable(read("phone")),
            email:
              nullable(read("email")),
            contactFormUrl:
              nullable(
                read(
                  "contactFormUrl",
                ),
              ),
          },
        );
      setManualMessage(
        `${result.businessName} was captured as unverified evidence for founder review.`,
      );
      formElement.reset();
    } catch (error) {
      setManualError(
        errorMessage(error),
      );
    }
  }

  return (
    <div className="workspace stack">
      <div className="workspace-heading">
        <div>
          <p className="success compact">
            Founder access and MFA are verified.
          </p>
          <h2>Find local prospects</h2>
          <p>
            Search public business data by UK postcode, radius and approved pilot sector.
          </p>
        </div>
        <button
          type="button"
          className="secondary sign-out"
          onClick={() => void onSignOut()}
        >
          Sign out
        </button>
      </div>

      <form
        onSubmit={submitSearch}
        className="search-form"
      >
        <label>
          Postcode
          <input
            value={postcode}
            onChange={(event) =>
              setPostcode(
                event.target.value,
              )
            }
            placeholder="BR1 5HP"
            autoComplete="postal-code"
            required
          />
        </label>
        <label>
          Radius in miles
          <input
            type="number"
            min="0.1"
            max="30"
            step="0.1"
            value={radiusMiles}
            onChange={(event) =>
              setRadiusMiles(
                event.target.value,
              )
            }
            required
          />
        </label>
        <label>
          Sector
          <select
            value={sector}
            onChange={(event) =>
              setSector(
                event.target.value as
                  LeadSector,
              )
            }
          >
            {LEAD_SECTOR_OPTIONS.map(
              (option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ),
            )}
          </select>
        </label>
        <button
          type="submit"
          disabled={searching}
        >
          {searching
            ? "Searching…"
            : "Search businesses"}
        </button>
      </form>

      {searchError !== null && (
        <p className="error">
          {searchError}
        </p>
      )}

      {outcome !== null && (
        <section className="results" aria-live="polite">
          <div className="results-summary">
            <h2>Search results</h2>
            <p>
              {outcome.resultCount} found · {outcome.createdCount} new · all evidence unverified
            </p>
          </div>
          {outcome.results.length === 0 ? (
            <p>
              No businesses were returned inside this radius. Try another approved search or use manual capture below.
            </p>
          ) : (
            <div className="result-grid">
              {outcome.results.map(
                (result) => (
                  <article
                    className="result-card"
                    key={
                      `${result.sourceUrl}-${result.businessName}`
                    }
                  >
                    <div>
                      <h3>
                        {result.businessName}
                      </h3>
                      <p>
                        {result.formattedAddress ??
                          result.primaryPostcode ??
                          "Address not returned"}
                      </p>
                    </div>
                    <dl>
                      <div>
                        <dt>Distance</dt>
                        <dd>
                          {result.distanceMiles.toFixed(2)} miles
                        </dd>
                      </div>
                      <div>
                        <dt>Phone</dt>
                        <dd>
                          {result.phone ??
                            "Not returned"}
                        </dd>
                      </div>
                      <div>
                        <dt>Evidence</dt>
                        <dd className="status-unverified">
                          Unverified — review before use
                        </dd>
                      </div>
                    </dl>
                    <div className="result-links">
                      <a
                        href={result.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View source evidence
                      </a>
                      {result.websiteUrl !== null && (
                        <a
                          href={result.websiteUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Business website
                        </a>
                      )}
                    </div>
                  </article>
                ),
              )}
            </div>
          )}
        </section>
      )}

      <details className="manual-capture">
        <summary>
          Add a business from a public source
        </summary>
        <p>
          Manual fallback for a useful business the automated search did not return. A public source URL is required.
        </p>
        <form
          onSubmit={submitManual}
          className="manual-form"
        >
          <label>
            Business name
            <input
              name="businessName"
              required
            />
          </label>
          <label>
            Sector
            <select
              name="sector"
              defaultValue={sector}
            >
              {LEAD_SECTOR_OPTIONS.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="wide-field">
            Public source URL
            <input
              name="sourceUrl"
              type="url"
              placeholder="https://…"
              required
            />
          </label>
          <label className="wide-field">
            Address (optional)
            <input
              name="formattedAddress"
            />
          </label>
          <label>
            Postcode (optional)
            <input
              name="primaryPostcode"
              autoComplete="postal-code"
            />
          </label>
          <label>
            Phone (optional)
            <input
              name="phone"
              type="tel"
            />
          </label>
          <label>
            Public email (optional)
            <input
              name="email"
              type="email"
            />
          </label>
          <label>
            Website (optional)
            <input
              name="websiteUrl"
              type="url"
            />
          </label>
          <label className="wide-field">
            Contact form URL (optional)
            <input
              name="contactFormUrl"
              type="url"
            />
          </label>
          <button
            type="submit"
            className="wide-field"
          >
            Save unverified business
          </button>
        </form>
        {manualMessage !== null && (
          <p className="success">
            {manualMessage}
          </p>
        )}
        {manualError !== null && (
          <p className="error">
            {manualError}
          </p>
        )}
      </details>

      {reviewEnabled && (
        <ProspectReviewWorkspace
          backendUrl={backendUrl}
          accessToken={accessToken}
        />
      )}
    </div>
  );
}
