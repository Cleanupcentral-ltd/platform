# Lead Engine Lite Stage 4 — Companies House-assisted verification

## Outcome

Reduce founder research time without allowing an automated company match, sector assignment or outreach decision.

The console searches the official Companies House API for up to five candidates. The founder must compare the candidate name, number, status, type and registered-office details, then confirm one exact match. Confirmation fetches the official company profile again on the backend and atomically records verified evidence before recalculating the prospect assessment.

## Included

- Founder- and MFA-protected Companies House search.
- Maximum five official candidates per search.
- Founder confirmation of one exact company number.
- Server-side refetch of the selected profile; browser-supplied company facts are rejected.
- Atomic verified evidence for business name, company number, active/inactive status and conservative subscriber type.
- Duplicate warning when the company number is already linked to another prospect.
- Automatic assessment recalculation after successful evidence capture.
- Manual evidence entry remains available when the API is unavailable or no match is returned.

## Deliberate exclusions

- No automatic match acceptance.
- No automatic prospect import from Companies House.
- No approved-sector inference from SIC codes.
- No assumption that a registered office is the trading or cleaning location.
- No Outlook drafting or sending.
- No eligibility override; every existing blocker continues to apply.

## Conservative status and subscriber rules

- Only Companies House status `active` is recorded as active. Every other returned status is recorded as inactive so the system fails closed.
- `ltd`, `plc`, `llp` and `scottish-partnership` are recorded as corporate subscribers.
- `limited-partnership` is recorded as a partnership.
- Every other company type is recorded as unknown and retains the subscriber-type blocker.

These classifications follow current ICO business-to-business marketing guidance. The permanent `unapproved_email_basis` blocker remains in the 0–10 model, so this phase cannot make outreach eligible by itself.

## Configuration

The existing `LEAD_COMPANIES_HOUSE_V1=true` flag continues to control Stage 4 review and scoring. Assisted verification is exposed only when the backend also has:

```text
COMPANIES_HOUSE_API_KEY=<server-side API key>
```

Optional defaults:

```text
COMPANIES_HOUSE_API_BASE_URL=https://api.company-information.service.gov.uk
COMPANIES_HOUSE_TIMEOUT_MS=8000
```

The API key is server-side only and must never be added to the console.

## Acceptance criteria

1. Health reports `companiesHouseVerification: true` only when the provider is configured.
2. An authenticated founder can search by the selected prospect's business name or a company number.
3. Search returns no more than five candidates and does not persist evidence.
4. The console labels the address as registered-office matching context only.
5. Confirmation sends only the selected company number from the browser.
6. The backend refetches that profile, records exactly four verified facts atomically and appends a new assessment version.
7. A company number linked to another prospect returns a duplicate warning and records nothing.
8. SIC codes do not create approved-sector evidence.
9. Provider failure leaves manual verification available.
10. Outlook drafting remains disabled.

## Automated evidence

- Backend type-check: passed.
- Backend build: passed.
- Backend test suite: 245 passed, 0 failed.
- Founder console type-check: passed.
- Founder console unit tests: 17 passed, 0 failed.
- Founder console production build: passed.

Production migration, provider configuration and founder acceptance remain required before this phase can be closed.

## Authoritative references

- Companies House API authentication: <https://developer-specs.company-information.service.gov.uk/guides/authorisation>
- Companies House company search: <https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference/search/search-companies>
- Companies House company profile: <https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference/company-profile/company-profile>
- Companies House rate limits: <https://developer-specs.company-information.service.gov.uk/guides/rateLimiting>
- ICO business-to-business marketing: <https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/>
