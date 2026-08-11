# Lead Engine Lite — Stage 4 Testable Verification and Scoring

Status: **implemented, locally verified and database migration applied; code review, deployment and founder acceptance remain open**

## Stage objective

Give the founder one protected workflow to review persisted prospects, record
atomic facts from first-party websites or official Companies House pages, reject
unusable discovery evidence, and save a transparent versioned 0–10 assessment.
No outreach draft, Outlook integration or send action exists in this stage.

## Approved 0–10 model

The rules version is `cuc-lel-0-10-v1`. Each dimension contributes 0–2 points:

| Dimension | Two-point evidence | Lower result |
| --- | --- | --- |
| Sector and service fit | Approved pilot sector verified from a persistent source | One point for plausible unverified discovery fit; zero for conflicting verified evidence |
| Recurring cleaning need | Direct recurring operational or turnover need recorded from a persistent source | One point for sector-level support; zero without support |
| Portfolio or premises scale | Multiple properties, locations or units verified | One point for one verified active premises; zero when unknown |
| Compliant contactability | Verified public business email linked to persistent evidence and a verified corporate subscriber | One point for a verified public contact form; zero without a compliant verified route |
| Evidence confidence | First-party evidence corroborated by Companies House or a second current source | One point for one first-party source; zero without verified persistent evidence |

The backend calculates the score. The browser cannot submit or override points.
Every saved assessment retains the rules version, dimension explanations,
blockers and the evidence IDs used.

## Qualification blockers

A score never overrides a blocker. The controlled model currently records:

- missing verified business identity;
- unverified approved pilot sector;
- missing postcode-and-radius search provenance;
- inactive or unverified business status;
- no verified contact route;
- active do-not-contact or objection record;
- unresolved subscriber type; and
- unapproved email basis.

The lawful-basis decision remains open, so `unapproved_email_basis` is retained
as a hard blocker in this stage. A prospect can score 10/10 but must remain
`research_required` until that basis is approved through a later controlled
compliance decision. Stage 4 does not manufacture a lawful basis from public
data.

## Delivered controls

- All Stage 4 routes require the existing founder bearer session and verified
  MFA.
- `GET /api/ops/leads/prospects` lists the newest 100 persisted prospects and
  their evidence and assessment summaries.
- `GET /api/ops/leads/prospects/:prospectId` loads the complete review record,
  contact evidence, search provenance, active suppressions and latest score.
- `POST /api/ops/leads/prospects/:prospectId/evidence` records one founder-
  reviewed atomic fact and source.
- `POST /api/ops/leads/prospects/:prospectId/evidence/:evidenceId/decision`
  verifies or rejects supported evidence and its linked contact route
  atomically.
- `POST /api/ops/leads/prospects/:prospectId/assessments` recalculates and saves
  the versioned score without accepting client-supplied scoring data.
- Only HTTPS first-party pages and official Companies House domains can create
  verified evidence. Companies House facts are limited to business identity,
  pilot sector, status, subscriber type and company number.
- Google Places and Stage 3 manual-capture evidence remains `unverified` and
  cannot be promoted directly. The founder must record a new persistent source
  for any fact used in scoring.
- Public email and contact-form records are created or updated in the same
  transaction as their source evidence. Rejection also updates the linked
  contact record atomically.
- Suppressions are checked against the prospect and every persisted contact
  value without a fixed global-row limit.
- Browser roles cannot execute the evidence functions. Only the backend
  `service_role` can execute them.
- `LEAD_COMPANIES_HOUSE_V1=false` is the safe rollout default for the complete
  Stage 4 review-and-scoring workspace.
- Outlook drafting remains explicitly disabled and no drafting route exists.

## Acceptance evidence collected

| Evidence | Result |
| --- | --- |
| Backend TypeScript checks | Passed |
| Full backend automated suite | 231/231 passed |
| Backend production build | Passed |
| Operations-console TypeScript, unit tests and production build | Passed; 14/14 unit tests |
| Stage 4 rollout flag disabled | Review routes return 404 |
| Founder/MFA enforcement | Covered by protected-route tests |
| Server-owned scoring | Client-supplied score is rejected |
| Transparent five-dimension score and blockers | Covered by domain tests |
| Google/provider evidence excluded from verified scoring | Covered by domain, service and database tests |
| Companies House source and fact restrictions | Covered by service and database tests |
| Atomic evidence and contact decisions | Passed in rollback transaction before and after migration |
| Database migration | Applied as `20260811163034_lead_stage_4_review_scoring` |
| Added Stage 4 columns | Six present |
| Browser function privileges | `anon=false`, `authenticated=false` |
| Backend function privilege | `service_role=true` |
| Production assessment rows | 0 |
| Production discovery data after tests | 4 search runs; 46 prospects; 425 evidence rows; 44 contacts |

The migration introduced no new security warning. Supabase still reports the
pre-existing warning that leaked-password protection is disabled:
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
Performance advice contains only unused-index information, including the new
review index before Stage 4 production use.

## Open production acceptance

Stage 4 must not be declared complete until all of the following are evidenced:

1. Review and merge the Stage 4 pull request.
2. Deploy with `LEAD_COMPANIES_HOUSE_V1=false` and verify quote, travel, founder
   authentication, Stage 3 search and manual capture remain healthy.
3. Set `LEAD_COMPANIES_HOUSE_V1=true` for the controlled founder test.
4. Open one persisted prospect and verify the evidence list and source links.
5. Record at least one supported first-party or official Companies House fact.
6. Reject one unsuitable discovery-evidence item and confirm it does not score.
7. Calculate an assessment and confirm the five dimension explanations,
   evidence references and blockers are understandable.
8. Confirm the assessment is persisted, no duplicate prospect is created and no
   Outlook draft or message is produced.
9. Record the founder-console, Render and Supabase evidence, then approve or
   reject Stage 4 closure.

## Manual fallback

Verification is intentionally founder-reviewed. If a provider or business site
is unavailable, leave the prospect as `research_required`, retain the existing
unverified discovery evidence and add a note in the later tracking stage. Do not
guess, scrape another source or convert an unsupported fact into verified data.

## Safe rollback

Set `LEAD_COMPANIES_HOUSE_V1=false`. This removes the Stage 4 review and scoring
routes while leaving Stage 3 search and manual capture available. The additive
database columns, functions and existing lead records may remain dormant; do not
delete prospects, evidence, contacts, assessments or suppressions during
rollback.
