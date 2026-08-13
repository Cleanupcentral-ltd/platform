# Lead Engine Lite Stages 4 and 5 — release manifest

## Release title

`Lead Engine Stage 4 Outlook drafts and controlled closure`

## Intended branch

`agent/lead-engine-stage-4-outlook-drafts`

## Source and test files

- `backend/src/adapters/microsoft/microsoft-graph-outlook.ts`
- `backend/src/adapters/supabase/supabase-outlook-connection-repository.ts`
- `backend/src/adapters/supabase/supabase-outreach-repository.ts`
- `backend/src/adapters/supabase/supabase-company-enrichment-repository.ts`
- `backend/src/application/outreach.ts`
- `backend/src/application/qualify-leads.ts`
- `backend/src/config/env.ts`
- `backend/src/domain/business-email.ts`
- `backend/src/domain/lead-assessment.ts`
- `backend/src/http/routes/lead-engine.ts`
- `backend/src/ports/automatic-qualification.ts`
- `backend/src/ports/outreach.ts`
- `backend/src/app.ts`
- `backend/tests/lead-assessment.test.ts`
- `backend/tests/lead-engine-route.test.ts`
- `backend/tests/microsoft-graph-outlook.test.ts`
- `backend/tests/outreach.test.ts`
- `backend/tests/qualify-leads.test.ts`
- `backend/tests/supabase-company-enrichment-repository.test.ts`
- `ops-console/src/LeadEngineFoundation.tsx`
- `ops-console/src/LeadSearchWorkspace.tsx`
- `ops-console/src/ProspectReviewWorkspace.tsx`
- `ops-console/src/lead-review-api.ts`
- `ops-console/src/styles.css`
- `ops-console/tests/lead-review-api.test.ts`
- `ops-console/README.md`

## Database files

- `supabase/migrations/20260813180000_controlled_automatic_qualification_rollout.sql`
- `supabase/migrations/20260813181000_outlook_draft_workflow.sql`
- `supabase/tests/controlled_automatic_qualification_rollout.sql`
- `supabase/tests/outlook_draft_workflow.sql`

## Documentation files

- `docs/lead-engine/stage-4-2-automatic-qualification.md`
- `docs/lead-engine/stage-4-outlook-drafts-and-tracking.md`
- `docs/lead-engine/stage-5-controlled-pilot-and-closure.md`
- `docs/lead-engine/stage-4-5-release-manifest.md`

Generated `backend/dist`, `ops-console/dist`, dependency directories and local
environment files are not part of the intended commit.

## Validation

- Backend tests: 283 passed, 0 failed.
- Backend type-check: passed.
- Backend production build: passed.
- Founder console unit tests: 24 passed, 0 failed.
- Founder console type-check: passed.
- Founder console production build: passed.
- Focused Outlook/canary safety tests: passed.
- Both migrations parsed and executed against the real production schema inside
  transactions that were rolled back.
- Both database acceptance suites passed inside the same rolled-back method.
- Browser source and bundle scan found no backend secret-variable references or
  Outlook send endpoint.
- No production migration, feature enablement, Outlook connection, draft or
  send occurred.

## Draft pull-request body

### What changed

- limits Stage 4.2 activation to one business in total while rollout is in
  canary mode;
- adds founder-reviewed, evidence-bound Outlook draft creation and outreach
  activity tracking;
- requests only delegated `Mail.ReadWrite` and rejects `Mail.Send`;
- adds first-party generic-mailbox, suppression, stale-preview, idempotency,
  immutable-copy and durable do-not-contact controls;
- adds the console preview, approval, draft link and activity journey; and
- documents controlled rollout, rollback and project-closure evidence.

### Why

The previous Stage 4.2 switch admitted every existing prospect immediately and
the Lead Engine still lacked its approved Outlook draft and outcome workflow.
This release makes the first production check truly one-business-only and
completes the draft-only Stage 4 boundary without adding send capability.

### Impact

Both features remain disabled by default. Existing website, quote, enquiry,
attachment and notification paths are unchanged. The database changes are
additive. A founder and MFA session is required for all console actions.

### Validation

283 backend tests, the complete console test command, both type checks and both
production builds pass. Both migrations and database suites pass against the
production schema under rollback.
