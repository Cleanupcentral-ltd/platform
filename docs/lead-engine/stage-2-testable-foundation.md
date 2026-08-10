# Lead Engine Lite — Stage 2 Testable Foundation

Status: **implemented; founder MFA enrolment and live-session verification remain open**

## Scope delivered

- Private `lead_engine` Supabase schema with durable tables for searches, prospects, source evidence, contacts, 0–10 assessments, initial outreach drafts, activity tracking, and do-not-contact suppressions.
- Row-level security forced on all ten tables.
- `anon` and `authenticated` have no persistent schema or table privileges; `service_role` is the backend-only data path.
- A defence-in-depth founder policy requires both `app_metadata.role = founder` and Auth Assurance Level 2.
- Protected `GET /api/ops/leads/health` endpoint validates the Supabase session through `/auth/v1/user`, then verifies issuer, audience, expiry, subject, founder role, non-anonymous status, and MFA (`aal2`).
- Approved Lead Engine feature flags exist and default to `false`.
- The founder-console origin is additive and feature-gated, so enabling the
  temporary console does not replace the public website's existing CORS
  allow-list.
- A separate founder operations console is implemented for
  `app.cleanupcentral.com/ops/leads`; it does not alter the public Wix site.
- The console supports password sign-in, password recovery returning to the
  deployed founder route, TOTP enrolment/challenge, founder-role denial and the
  protected backend readiness check.
- No email sending was added. Lean v1 remains Outlook-draft-only.

## Verified evidence — 10 August 2026

| Acceptance check | Verified result |
|---|---|
| Backend type-check | Passed |
| Backend build | Passed |
| Backend test suite | 208 passed; 0 failed |
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
| Operations console type-check | Passed |
| Operations console unit tests | 8 passed; 0 failed |
| Operations console production build | Passed |
| Operations console production dependency audit | 0 vulnerabilities |
| Temporary founder console deployment | Render commit `29aa064e`; live |

The performance advisor reported only expected informational `unused_index` notices because the new tables contain no production data.

## Open acceptance item

The Supabase project currently has two confirmed password users and exactly one
user with `app_metadata.role = founder`. The founder role is assigned to the
Clean Up Central Outlook account; the earlier Gmail account no longer has it.
No verified MFA factor exists. Password recovery is deployed, but the current
Supabase built-in email rate limit must clear before the founder can set the new
password. Stage 2 cannot be closed until the Clean Up Central founder account
resets the password, enrols MFA and the protected endpoint is verified with the
resulting real `aal2` session.

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
