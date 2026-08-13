# Lead Engine Lite Stage 4.1 — automatic company enrichment

## Approved outcome

Reduce founder administration by checking captured prospects in the background while preserving an explicit founder exception queue and the existing manual Companies House workflow.

The only automatic acceptance path is one labelled UK company number found on the prospect's captured first-party HTTPS website and confirmed by a fresh Companies House company-profile response. Company-name search results, fuzzy matches and multiple company numbers are never accepted automatically.

## Included

- A persisted, retryable enrichment job for every prospect.
- Background processing in small, lease-protected batches.
- Safe, bounded inspection of the captured first-party website and up to two same-origin legal, privacy, terms, company, about or contact pages.
- Automatic verification only when exactly one labelled company number is found.
- Fresh Companies House profile lookup before evidence is committed.
- Atomic first-party and official evidence capture with the verification method recorded as `automatic_first_party_company_number`.
- Automatic assessment recalculation after successful verification.
- Prepared Companies House name-search candidates for founder review when no exact first-party number can be accepted.
- A searchable console queue with pending, exception, verified and all-prospect views.
- Manual retry and the existing manual Companies House search and confirmation workflow.
- Duplicate protection when a Companies House number is already linked to another prospect.

## Safety and scope boundaries

- No company-name or fuzzy match is automatically accepted.
- Unlabelled numbers do not qualify as company numbers.
- More than one labelled company number forces founder review.
- Website requests allow only public HTTPS destinations, recheck redirects, reject credentials and non-standard ports, limit response size and content type, and inspect at most three pages.
- Companies House registered-office data is not treated as a trading or cleaning address.
- SIC codes do not set the approved sector.
- A verified company identity does not remove contact, lawful-basis, sector, scale or other qualification blockers.
- Outlook drafting and sending remain disabled.
- Disabling the rollout flag restores the current manual-only interface without removing saved evidence or queue history.

## Configuration and rollout order

Apply the additive migration before enabling the rollout flag. Deploying the code with the flag disabled is backward compatible with the current Stage 4 database.

```text
LEAD_COMPANIES_HOUSE_V1=true
LEAD_AUTO_COMPANY_ENRICHMENT_V1=false
LEAD_COMPANY_ENRICHMENT_INTERVAL_MS=60000
LEAD_COMPANY_ENRICHMENT_BATCH_SIZE=5
LEAD_COMPANY_ENRICHMENT_LEASE_SECONDS=180
LEAD_WEBSITE_LOOKUP_TIMEOUT_MS=5000
LEAD_WEBSITE_LOOKUP_MAX_BYTES=524288
```

Controlled production sequence:

1. Merge and deploy the code with `LEAD_AUTO_COMPANY_ENRICHMENT_V1=false`.
2. Apply `20260813095600_automate_company_enrichment.sql`.
3. Confirm the existing Stage 4 review, scoring and manual Companies House workflow still operate.
4. Set `LEAD_AUTO_COMPANY_ENRICHMENT_V1=true` and redeploy.
5. Confirm health reports `automaticCompanyEnrichment: true`.
6. Verify one exact-number success, one founder-review candidate, one no-match result, one retry and one duplicate result in production.

Rollback is to set `LEAD_AUTO_COMPANY_ENRICHMENT_V1=false` and redeploy. The additive queue and evidence history remain intact.

## Acceptance criteria

1. Existing prospects are backfilled into a persisted queue without deleting or overwriting prospect data.
2. New prospects are queued automatically and have an accountable founder actor before processing.
3. Concurrent workers cannot process the same current lease.
4. One labelled first-party company number can be automatically verified only after the backend refetches the official profile.
5. Zero, multiple, unlabelled or unsafe-source numbers are never automatically accepted.
6. Name-search candidates remain unverified until founder confirmation.
7. Every automatic fact is visibly distinguishable from founder-reviewed evidence.
8. Duplicate company numbers record no new verification evidence.
9. Provider or website failure is persisted, bounded and retryable; manual verification remains available.
10. The founder can search the queue by business name, postcode or company number and filter by action state.
11. Existing Stage 3 search, manual capture, Stage 4 scoring and manual Companies House verification do not regress.
12. Outlook drafting and sending remain unavailable.

## Verification evidence

Evidence must be recorded against the exact commit proposed for release. Required checks are:

- Backend source and test type-check: passed locally.
- Backend production build: passed locally.
- Full backend test suite: 256 passed, 0 failed.
- Founder console type-check: passed locally.
- Founder console unit tests: 18 passed, 0 failed.
- Founder console production build: passed locally.
- Static migration review: passed; PostgreSQL's parser accepted all 27 statements, and the claim query uses `FOR UPDATE SKIP LOCKED`, a partial queue index, RLS, least-privilege grants and attempt-bound completion.
- The production migration list was checked and confirms this additive migration has not yet been applied.
- Database advisory checks after applying the migration: pending.
- Founder production acceptance for the five controlled cases in rollout step 6: pending.

This stage is not complete until the migration, rollout flag and production acceptance evidence have all been verified.
