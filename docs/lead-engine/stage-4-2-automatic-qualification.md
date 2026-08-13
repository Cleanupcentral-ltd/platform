# Lead Engine Lite Stage 4.2 — automatic qualification

## Approved outcome

After a postcode, radius and approved-sector search, Lead Engine Lite researches captured prospects in the background and places each record into one founder work queue:

- `ready_for_outreach` — the evidence and compliance gates are satisfied for founder draft approval;
- `needs_founder_decision` — a source, identity, contact, organisation or legal classification remains ambiguous;
- `excluded` — an active suppression or verified inactive status blocks the prospect; or
- `processing` — bounded research is queued or a transient retry is pending.

The default console view is **Ready for outreach**. Outlook drafting and all sending remain disabled in this stage.

## Founder journey

`Search → automatic research → approve draft`

Exceptions follow:

`Search → automatic research → review exception → approve draft`

The founder should normally open a record only when sources conflict, the organisation or subscriber type is unclear, no reliable public contact route exists, the Companies House match is ambiguous, or a suppression/legal blocker requires a decision.

## Included

- A separate `LEAD_AUTOMATIC_QUALIFICATION_V1` rollout flag, disabled by default.
- Reuse of the existing private, lease-protected enrichment queue; no browser receives Supabase service credentials or provider keys.
- Idempotent Stage 4.2 activation that queues existing and newly captured prospects without deleting evidence.
- Safe HTTP-to-HTTPS upgrade attempts. Plain HTTP content is never accepted as verified evidence.
- Public-network DNS checks before each request and redirect; credentials, private/local destinations and non-standard ports are rejected.
- One immediate retry for transient HTTP/network failures plus persisted background retries, with at most three job attempts.
- Bounded streaming reads. A page larger than the byte limit is truncated and inspected rather than rejected in full.
- At most six same-origin pages: the home page plus bounded About, Contact, Legal, Terms, Privacy or Imprint links.
- Deterministic, source-linked extraction of:
  - business identity;
  - the searched approved sector;
  - labelled company numbers;
  - published generic business mailboxes;
  - public contact forms;
  - explicit multiple-location/property/unit signals; and
  - explicit recurring operational/turnover signals.
- Exact source URL, supporting excerpt, SHA-256 fingerprint and database capture time for every accepted fact.
- Organisation-appropriate handling:
  - one labelled company number is checked against Companies House before automatic company verification;
  - `.gov.uk` and `.ac.uk` institutional identities may be verified from their official first-party domains;
  - charity and community-organisation signals do not force a Companies House match, but unclear subscriber status remains a founder decision;
  - name-search Companies House candidates are never auto-accepted.
- Automatic 0–10 assessment recalculation after evidence capture.
- Conditional outreach eligibility for a verified corporate subscriber with a verified generic business email or public contact form and no active suppression.
- Do-not-contact and objection records override score and all positive evidence.
- Manual evidence capture, manual Companies House verification, manual retry and all existing Stage 3/4 paths remain available.

## Transparent evidence rules

The researcher is deterministic; it does not generate facts with an AI model.

- Identity requires the normalized business name or a documented high-overlap token match on the first-party site.
- Sector evidence must match the sector used for the search and one of the controlled sector phrases in the backend.
- Automatic email capture accepts only published role mailboxes such as `info`, `hello`, `office`, `enquiries`, `bookings`, `events`, `sales` or `support`. Named/personal mailboxes are not automatically verified.
- Contact forms are recorded but never submitted.
- Scale requires explicit multiple-location, portfolio, property, site, venue or managed-unit wording.
- Companies House numbers must be labelled on the first-party site; zero, multiple, unlabelled, conflicting or duplicate numbers remain exceptions.
- A charity/community classification without a sufficiently clear subscriber type remains `needs_founder_decision`.
- A high 0–10 score never overrides an assessment blocker.

## Queue decision rules

`ready_for_outreach` requires all of:

1. verified identity;
2. verified searched sector;
3. search provenance;
4. verified active status;
5. a verified generic public business email or contact form;
6. verified corporate subscriber status; and
7. no active business, email, domain, phone or prospect suppression.

`excluded` is assigned when a suppression/objection is active or the organisation is verified inactive. Missing or conflicting evidence is not silently excluded; it is sent to `needs_founder_decision`.

`ready_for_outreach` authorises only the next internal founder-review step. It does not create or send an email.

## Configuration and controlled rollout

```text
LEAD_COMPANIES_HOUSE_V1=true
LEAD_AUTO_COMPANY_ENRICHMENT_V1=true
LEAD_AUTOMATIC_QUALIFICATION_V1=false
LEAD_COMPANY_ENRICHMENT_INTERVAL_MS=60000
LEAD_COMPANY_ENRICHMENT_BATCH_SIZE=5
LEAD_COMPANY_ENRICHMENT_LEASE_SECONDS=180
LEAD_WEBSITE_LOOKUP_TIMEOUT_MS=5000
LEAD_WEBSITE_LOOKUP_MAX_BYTES=524288
LEAD_WEBSITE_RESEARCH_MAX_PAGES=6
LEAD_WEBSITE_REQUEST_RETRIES=1
```

Rollout order:

1. Merge and deploy the code with `LEAD_AUTOMATIC_QUALIFICATION_V1=false`.
2. Apply `20260813143000_automatic_qualification.sql`.
3. Verify Stage 4.1 and manual review still work with Stage 4.2 disabled.
4. Set `LEAD_AUTOMATIC_QUALIFICATION_V1=true` and redeploy the backend.
5. Confirm protected health reports `automaticQualification: true`.
6. Confirm the founder console defaults to **Ready for outreach**.
7. Run controlled production cases for ready, founder decision, excluded, processing/retry, institutional verification and duplicate protection.

Rollback is to set `LEAD_AUTOMATIC_QUALIFICATION_V1=false` and redeploy. The additive columns, evidence and queue history remain; Stage 4.1 continues using its existing flag and worker.

## Acceptance criteria

1. Search capture remains fast and returns while qualification continues in the background.
2. Existing and new prospects enter the persisted queue exactly once per Stage 4.2 version.
3. Concurrent workers cannot claim the same active lease.
4. HTTP websites are tried only through their HTTPS equivalent.
5. Transient failures retry; permanent unsafe or invalid sources fail closed to founder decision.
6. Oversized pages are read only to the configured byte limit and marked truncated.
7. No more than six approved same-origin pages are inspected.
8. Every automatically verified fact has an HTTPS source, excerpt, fingerprint, capture time and automatic verification method.
9. Personal email addresses are never automatically promoted to a verified outreach contact.
10. Companies House is mandatory for the existing exact-company path but not for verified institutional/public identities.
11. Ambiguous Companies House candidates remain founder decisions.
12. Suppression always produces `excluded`, regardless of score.
13. The four queues are available and **Ready for outreach** is the default.
14. Stage 3 search, deduplication, manual capture, Stage 4 scoring, Stage 4.1 Companies House assistance and manual retry do not regress.
15. Outlook drafting and sending remain disabled.

## Verification evidence

Evidence must be recorded against the exact release commit.

- Backend source and tests type-check: passed locally.
- Backend production build: passed locally.
- Full backend test suite: 265 passed, 0 failed.
- Founder console type-check: passed locally.
- Founder console unit tests: 20 passed, 0 failed.
- Founder console production build: passed locally.
- Additive migration static/security review: passed; queue claims use `FOR UPDATE SKIP LOCKED`, a partial index and attempt-bound leases. New RPCs are `security invoker`, use an empty search path, revoke browser execution and grant only `service_role`. Existing table RLS and force-RLS remain in place.
- Production migration list and the exact existing evidence constraint were inspected read-only; Stage 4.2 is not applied.
- Production migration and advisory checks: not started; require founder approval after PR review.
- Production feature enablement and controlled founder acceptance: not started.

Stage 4.2 is not complete until the migration, feature flag and production acceptance evidence have been verified.
