# Lead Engine Lite — Stage 2 Testable Foundation

Status: **implemented; founder Auth enrolment remains open**

## Scope delivered

- Private `lead_engine` Supabase schema with durable tables for searches, prospects, source evidence, contacts, 0–10 assessments, initial outreach drafts, activity tracking, and do-not-contact suppressions.
- Row-level security forced on all ten tables.
- `anon` and `authenticated` have no persistent schema or table privileges; `service_role` is the backend-only data path.
- A defence-in-depth founder policy requires both `app_metadata.role = founder` and Auth Assurance Level 2.
- Protected `GET /api/ops/leads/health` endpoint validates the Supabase session through `/auth/v1/user`, then verifies issuer, audience, expiry, subject, founder role, non-anonymous status, and MFA (`aal2`).
- Approved Lead Engine feature flags exist and default to `false`.
- No email sending was added. Lean v1 remains Outlook-draft-only.

## Verified evidence — 10 August 2026

| Acceptance check | Verified result |
|---|---|
| Backend type-check | Passed |
| Backend build | Passed |
| Backend test suite | 206 passed; 0 failed |
| Feature flag off | Protected route returns 404 |
| Missing/invalid session | 401 |
| Founder without MFA | 403 `MFA_REQUIRED` |
| Non-founder session | 403 `FORBIDDEN` |
| Founder + MFA test session | 200 |
| RLS negative test | Founder `aal1` saw 0 rows |
| RLS positive test | Founder `aal2` saw the permitted test row |
| Persistent browser privileges | `anon=false`, `authenticated=false` |
| Backend privileges | `service_role=true` |
| RLS coverage | 10/10 tables enabled and forced; 10 founder policies |
| Test-data cleanup | 0 prospect rows after transaction rollback |
| Supabase security advisor | 0 findings |

The performance advisor reported only expected informational `unused_index` notices because the new tables contain no production data.

## Open acceptance item

The Supabase project currently has 0 Auth users, 0 users with the founder role, and 0 verified MFA factors. Stage 2 cannot be closed until the founder account is created, assigned `app_metadata.role = founder`, enrolled in MFA, and the protected endpoint is verified with that real session.

## Safe rollback

1. Keep all five Lead Engine flags set to `false`. This removes the Lead Engine HTTP route and prevents provider or Outlook capabilities from running.
2. If database isolation is required, revoke `service_role` access to the `lead_engine` schema and tables.
3. Preserve all schema data, especially `lead_engine.suppressions`, for audit and do-not-contact continuity.
4. Do not drop the schema as an operational rollback. A destructive removal requires a separate approved data-retention decision.

Emergency database isolation SQL:

```sql
revoke all on all tables in schema lead_engine
from service_role;

revoke usage on schema lead_engine
from service_role;
```
