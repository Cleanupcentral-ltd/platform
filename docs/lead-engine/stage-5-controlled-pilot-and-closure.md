# Lead Engine Lite Stage 5 — controlled pilot and closure

## Closure position

Lead Engine Lite can be technically released after the controlled production
checks below. The product must not be described as fully closed until the
privacy and retention decisions, one measured founder pilot, manual fallback
and rollback evidence are recorded.

The initial pilot remains founder-only, one explicit search at a time and
Outlook-draft-only. There is no automatic or bulk sending.

## Production acceptance sequence

### 1. Disabled-state release

- Apply the additive Stage 4.2 canary and Stage 4 Outlook migrations.
- Deploy backend and console with all three new feature flags off:
  `LEAD_AUTOMATIC_QUALIFICATION_V1`, `LEAD_OUTLOOK_DRAFT_V1` and
  `LEAD_EXPORT_V1`.
- Confirm the website, quote generator, enquiry, attachment and notification
  paths remain healthy.
- Confirm unauthenticated, non-founder and non-MFA Lead Engine access is denied.
- Run Supabase security and performance advisors.

### 2. One-business automatic-qualification canary

- Set `LEAD_AUTOMATIC_QUALIFICATION_ROLLOUT=canary`.
- Enable `LEAD_AUTOMATIC_QUALIFICATION_V1`.
- Confirm exactly one business in total is admitted to Stage 4.2, including
  across restarts and repeated scheduler cycles.
- Verify its HTTPS recovery, bounded page research, exact evidence, assessment,
  queue decision and failure/retry history.
- Confirm the remaining businesses have not been admitted.

### 3. Qualification expansion

- Review the canary with the founder.
- Correct any source, classification or queue defect before expansion.
- Only with a separate founder decision, change the rollout from `canary` to
  `all`. This admits existing and newly captured prospects continuously.
- Monitor queue counts, provider failures, retry exhaustion and suppressions.

### 4. One unsent Outlook draft

- Complete the Microsoft and approved-copy configuration in the Stage 4 guide.
- Enable `LEAD_OUTLOOK_DRAFT_V1` only after the qualification canary passes.
- Connect the founder mailbox and inspect the Microsoft consent screen.
- Create one draft for one ready prospect.
- Compare Outlook against the console preview and source evidence.
- Confirm no email was sent and no contacted event was recorded.

Immediately before any live outreach, reverify the
[ICO business-to-business marketing guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/).
As at this release it states that the guidance is under review following the
Data (Use and Access) Act. This reinforces the existing professional-review
gate; the software must not treat the current wording as permanent legal
advice.

### 5. Manual controls and rollback drills

- Record contacted, reply, follow-up and outcome against controlled data.
- Verify a do-not-contact outcome creates an immediate durable suppression.
- Enable `LEAD_EXPORT_V1`, download one founder CSV and confirm it includes the
  prospect reference, status, suppression state and source links without
  spreadsheet formula execution. Confirm one private export-audit row exists.
- Complete one manual research and manual draft fallback without provider
  automation.
- Disable `LEAD_EXPORT_V1` and confirm the export route and console button are
  absent while all stored leads remain available.
- Disable the Outlook flag and confirm the existing Lead Engine remains usable.
- Disable automatic qualification and confirm search and manual review remain
  usable and existing evidence is preserved.

## Release evidence to record

| Area | Required evidence |
| --- | --- |
| Release | Exact commit, PR, migration versions and deploy identifiers |
| Regression | Backend/console tests and public website/quote smoke results |
| Access | Founder MFA success plus unauthenticated and wrong-role denial |
| Database | Migration results, browser-role denial and advisor results |
| Qualification | One-business canary record, sources, queue and retry outcome |
| Outlook | Consent permissions, exact unsent draft and no-contacted proof |
| Compliance | Approved privacy information, lawful basis, wording and retention |
| Fallback | Manual research/draft drill plus audited CSV export result |
| Rollback | All three feature flags disabled without data or suppression loss |
| Commercial | Search, unique, duplicate, ready, review, draft and time baseline |
| Risks/costs | Provider terms, current costs and unresolved decisions |

## Pilot measures

Record at minimum:

- searches run and postcodes/sectors covered;
- unique prospects and duplicates prevented;
- ready, founder-decision, excluded and failed/retry counts;
- founder minutes per draft-ready prospect;
- drafts created, rejected or materially edited;
- only after live outreach approval: sends, replies, meetings, quotes,
  conversions and opt-outs.

Numeric expansion thresholds are deliberately not invented. The founder must
approve them after the first baseline is visible. Until then, the pilot may
continue only within its controlled scope and may not expand automation,
providers or send capability.

## Final closure rule

Close CUC-LEL-001 only when every required row in the evidence table above is
recorded, all critical defects are resolved or explicitly accepted, the
as-built documentation matches production and the founder signs the closure
decision. Outstanding privacy or lawful-basis approval blocks live outreach
and full commercial closure, but it does not block an unsent-draft technical
acceptance test.
