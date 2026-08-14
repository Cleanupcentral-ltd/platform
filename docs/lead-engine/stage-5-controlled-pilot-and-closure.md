# Lead Engine Lite Stage 5 — controlled pilot and closure

## Closure position

Lead Engine Lite can be technically released after the controlled production checks below. The product must not be described as fully closed until the privacy and retention decisions, one measured founder pilot, manual fallback and rollback evidence are recorded.

The initial pilot remains founder-only. There is no automatic or bulk sending. Microsoft Graph draft creation is deferred; the production outreach path prepares an evidence-bound sector template for the founder to copy into Outlook manually.

Google Places discovery remains intentionally paused until the compliant founder experience is restored in the frontend redesign. That pause is an accepted closure boundary, not an incomplete Stage 5 storage workaround.

## Production acceptance sequence

### 1. Disabled-state release

- Apply the additive Stage 4.2 canary and Stage 4 outreach migrations.
- Deploy backend and console with automatic qualification, direct Outlook Graph drafting and CSV export disabled initially.
- Confirm the website, quote generator, enquiry, attachment and notification paths remain healthy.
- Confirm unauthenticated, non-founder and non-MFA Lead Engine access is denied.
- Run Supabase security and performance advisors.

### 2. One-business automatic-qualification canary

- Set `LEAD_AUTOMATIC_QUALIFICATION_ROLLOUT=canary`.
- Enable `LEAD_AUTOMATIC_QUALIFICATION_V1`.
- Confirm exactly one business in total is admitted to Stage 4.2, including across restarts and repeated scheduler cycles.
- Verify its HTTPS recovery, bounded page research, exact evidence, assessment, queue decision and failure/retry history.
- Confirm the remaining businesses have not been admitted.

### 3. Qualification expansion

- Review the canary with the founder.
- Correct any source, classification or queue defect before expansion.
- Only with a separate founder decision, change the rollout from `canary` to `all`.
- Monitor queue counts, provider failures, retry exhaustion and suppressions.

### 4. One founder-reviewed manual Outlook draft

- Keep `LEAD_OUTLOOK_DRAFT_V1=false`; Microsoft Graph registration is not required for this acceptance path.
- Confirm the public Privacy Notice and approved opt-out configuration are present.
- Choose one genuinely `ready_for_outreach` prospect.
- Prepare the sector-specific v2 outreach preview.
- Confirm the selected template matches verified `approved_sector` evidence and the recipient is a verified generic first-party business email.
- Use **Copy for Outlook**.
- Confirm the Lead Engine reports that nothing was sent and does not record `contacted`.
- Paste the copied recipient, subject and body into Outlook and save one unsent draft manually.
- Compare the Outlook draft with the Lead Engine preview.

Preparing, copying or saving the draft is not a contacted event. A founder records **Email sent manually** only after the message has actually been sent.

Immediately before any live outreach, reverify the current ICO business-to-business marketing guidance. The software must not treat a release-time legal summary as permanent legal advice.

### 5. Manual controls and rollback drills

- After an actual controlled contact, verify the founder can record contacted, reply, follow-up and outcome without an Outlook Graph draft record.
- Verify a do-not-contact outcome creates an immediate durable suppression.
- Enable `LEAD_EXPORT_V1`, download one founder CSV and confirm it includes the prospect reference, status, suppression state and source links without spreadsheet formula execution. Confirm one private export-audit row exists.
- Complete one manual research/draft fallback without provider automation.
- Disable `LEAD_EXPORT_V1` and confirm the export route and console button are absent while all stored leads remain available.
- Keep direct Outlook Graph drafting disabled and confirm manual outreach preparation remains usable.
- Disable automatic qualification and confirm existing evidence is preserved.

## Release evidence to record

| Area | Required evidence |
| --- | --- |
| Release | Exact commit, PR, migration versions and deploy identifiers |
| Regression | Backend/console tests and public website/quote smoke results |
| Access | Founder MFA success plus unauthenticated and wrong-role denial |
| Database | Migration results, browser-role denial and advisor results |
| Qualification | Controlled qualification evidence, sources, queue and retry outcome |
| Outreach | Exact sector preview, manual Outlook draft, no-send and no-contacted proof |
| Compliance | Approved privacy information, lawful basis, wording and retention |
| Fallback | Manual research/draft drill plus audited CSV export result |
| Rollback | Direct Outlook and export disabled without data or suppression loss |
| Commercial | Search, unique, duplicate, ready, review, draft and time baseline |
| Risks/costs | Provider terms, current costs and unresolved decisions |

## Pilot measures

Record at minimum:

- searches run and postcodes/sectors covered;
- unique prospects and duplicates prevented;
- ready, founder-decision, excluded and failed/retry counts;
- founder minutes per draft-ready prospect;
- drafts prepared, rejected or materially edited;
- only after live outreach approval: sends, replies, meetings, quotes, conversions and opt-outs.

Numeric expansion thresholds are deliberately not invented. The founder must approve them after the first baseline is visible. Until then, the pilot may not expand automation, providers or send capability without a separate decision.

## Final closure rule

Close CUC-LEL-001 only when every required row in the evidence table above is recorded, all critical defects are resolved or explicitly accepted, the as-built documentation matches production and the founder signs the closure decision.

The following are accepted post-Stage-5 items rather than closure blockers:

- direct Microsoft Graph draft creation, which remains disabled until a suitable Microsoft Entra/Microsoft 365 registration exists; and
- restoration of Google Places search usability, which remains paused until the compliant frontend redesign provides the required transient/on-demand experience and attribution.
