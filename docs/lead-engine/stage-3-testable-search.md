# Lead Engine Lite — Stage 3 Testable Search

Status: **implemented and locally verified; controlled production verification remains open**

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
- `LEAD_SEARCH_GOOGLE_V1=false` remains the safe production default.

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
| Test data in production | 0 search runs; 0 prospects |

Supabase security advice contains the pre-existing warning that leaked-password
protection is disabled. The migration introduced no new database security warning.
Performance advice contains only expected unused-index notices while the Stage 2
tables remain empty.

## Open production acceptance

Stage 3 must not be declared complete until all of the following are evidenced:

1. Add `lead_engine` to the Supabase Data API exposed schemas without granting
   `anon` or `authenticated` schema access.
2. Add the backend-only `SUPABASE_SECRET_KEY` and a Google key restricted to
   Places API (New) to the Render backend service.
3. Deploy the reviewed code while `LEAD_SEARCH_GOOGLE_V1=false` and verify the
   quote, travel and Stage 2 founder flows remain healthy.
4. Enable `LEAD_SEARCH_GOOGLE_V1=true` for a controlled founder test.
5. Complete one automated search and verify the returned source links, exact
   radius, unverified evidence and persisted search run.
6. Complete one manual capture and verify its source evidence is persisted.
7. Confirm a repeated provider result does not create a duplicate prospect.
8. Record Render, Supabase and founder-console evidence, then decide whether the
   provider terms are useful enough for the first pilot.

## Manual fallback

If Google Places or postcode lookup is unavailable, the founder can add a business
from a public source URL in the same console. The captured information remains
unverified and must be reviewed before it is used in qualification or outreach.

## Safe rollback

Set `LEAD_SEARCH_GOOGLE_V1=false`. This removes the search and manual-capture
routes and keeps the Stage 2 founder console available. Do not delete prospects,
evidence, contacts or suppressions during rollback. The database migration is
additive and may remain dormant.
