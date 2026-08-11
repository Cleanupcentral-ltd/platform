# Lead Engine Lite — Stage 3 Testable Search

Status: **complete — locally verified and closed through controlled production acceptance on 2026-08-11**

## Stage objective

Give the founder one protected workflow to search for businesses by UK postcode,
radius and approved pilot sector, retain public source evidence, and manually add
a useful result when the provider does not return it. Scoring, qualification,
Companies House enrichment and Outlook drafts remain outside this stage.

## Approved pilot sectors

- Short-let and serviced-accommodation operators
- Offices and coworking spaces
- Community halls and event venues
- Estate and letting agents
- Other commercial spaces

The Google Places search terms are versioned in code as:

| Approved sector | Provider query |
| --- | --- |
| Short-let and serviced accommodation | `serviced accommodation and short stay apartments` |
| Offices and coworking spaces | `offices and coworking spaces` |
| Community halls and event venues | `community halls and event venues` |
| Estate and letting agents | `estate agents and letting agents` |
| Other commercial spaces | `commercial spaces` |

These terms are a testable provider configuration, not a new Clean Up Central
qualification rule. Their commercial usefulness must be checked in the controlled
pilot.

## Delivered controls

- `POST /api/ops/leads/search` requires the existing founder bearer session and
  verified MFA.
- `POST /api/ops/leads/manual` provides the manual fallback and requires a public
  source URL.
- Requests accept only the five approved sectors, a UK postcode and a radius from
  0.1 to 30 miles.
- Postcodes.io supplies the search centre; Google Places Text Search supplies up
  to 20 candidates.
- The backend applies its own Haversine radius check because Google Text Search
  location bias is not an exact boundary.
- Captured evidence contains its public source URL and begins as `unverified`.
- Provider place IDs form the first-stage duplicate key. Manual results use a
  deterministic hash of business name, postcode and website host.
- A single database function atomically stores prospects, evidence, contacts and
  search-run completion.
- Repeated snapshots and contact values are idempotent.
- Browser roles retain no access to the private `lead_engine` schema or capture
  function. Only the backend `service_role` may execute it.
- The Google key and Supabase secret key are backend-only. Neither is placed in
  the operations-console build.
- `LEAD_SEARCH_GOOGLE_V1=true` is enabled for founder-only controlled use. Setting it to `false` remains the immediate safe rollback.

## Acceptance evidence collected

| Evidence | Result |
| --- | --- |
| Backend TypeScript checks | Passed |
| Full backend automated suite | 218/218 passed |
| Operations-console TypeScript, unit tests and production build | Passed; 11/11 unit tests |
| Flag disabled | Search and manual routes return 404 |
| Founder/MFA enforcement | Covered by protected-route tests |
| Exact-radius filtering | Covered by Google adapter test |
| Approved sector mapping and limited field mask | Covered by Google adapter test |
| Public evidence and `unverified` state | Covered by service and route tests |
| Manual fallback with required public URL | Covered by route, service and console API tests |
| Atomic database capture | Passed inside a rollback transaction before migration |
| Database migration | Applied successfully |
| Duplicate provider result, evidence and contact | Passed in rollback transaction |
| Browser function privileges | `anon=false`, `authenticated=false` |
| Backend function privilege | `service_role=true` |
| Controlled production data | 2 completed search runs; 21 prospects; 206 evidence records; 22 contacts |

Supabase security advice contains the pre-existing warning that leaked-password
protection is disabled. The migration introduced no new database security warning.
Performance advice contains only expected unused-index notices immediately after the limited controlled pilot data was created.

## Controlled production acceptance — complete

| Acceptance item | Verified evidence |
| --- | --- |
| Private schema exposure | `lead_engine` exposed to the Supabase Data API while `anon` and `authenticated` retain no schema usage |
| Server credentials | Backend-only Supabase secret and Google Places API (New) key configured in Render |
| Safe-disabled deployment | Merge commit `d5eb12967db4ff06bdf766ffecb65e4c862b99d2` deployed successfully before activation |
| Controlled activation | Render deploy `dep-d9t5io2fngtc73cpnmug` became live with `LEAD_SEARCH_GOOGLE_V1=true` |
| Founder access | Founder account and MFA verified in the deployed operations console |
| Automated search | `BR1 1AA`, 5 miles, estate and letting agents returned 20 in-radius prospects with source links |
| Persisted search | Search run `6c8eb4b4-8450-4e04-91e6-f7961d1505c0` completed with 20 results |
| Evidence state | All 180 provider evidence records from the first run began as `unverified` |
| Duplicate prevention | Repeating the same search created a second run but kept the prospect count at 20 |
| Manual fallback | Community House Halls captured from the London Borough of Bromley public directory |
| Manual persistence | Prospect `74508664-f11c-47cc-a923-22ce65dffa5a`, six source-linked evidence records and two contacts persisted as `unverified` |
| Backend regression | 218/218 tests, TypeScript checks and production build passed |
| Console regression | 11/11 tests, TypeScript checks and production build passed |
| Provider usefulness | Founder approved the controlled Google results as commercially useful enough for the first pilot on 2026-08-11 |

## Stage closure

- Closure status: **complete**
- Closed by: **Amirah**
- Closed on: **2026-08-11**
- Search, evidence capture, exact provider dedupe and manual fallback are accepted.
- Qualification, scoring, Companies House verification and Outlook drafting remain disabled and move to later controlled stages.
- The current results view reports the number of new prospects at run level. Card-level new badges and new-first sorting are a non-blocking usability improvement and are not represented as implemented.

## Manual fallback

If Google Places or postcode lookup is unavailable, the founder can add a business
from a public source URL in the same console. The captured information remains
unverified and must be reviewed before it is used in qualification or outreach.

## Safe rollback

Set `LEAD_SEARCH_GOOGLE_V1=false`. This removes the search and manual-capture
routes and keeps the Stage 2 founder console available. Do not delete prospects,
evidence, contacts or suppressions during rollback. The database migration is
additive and may remain dormant.
