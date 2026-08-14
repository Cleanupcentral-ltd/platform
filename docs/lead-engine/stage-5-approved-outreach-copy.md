# Lead Engine Lite Stage 5 — approved outreach copy

Approved for the Stage 5 founder-reviewed outreach workflow: 14 August 2026

## Scope

The production workflow uses founder-neutral `initial_outreach_v2` sector templates for verified corporate prospects.

The Lead Engine prepares the recipient, subject and message from verified prospect evidence. The founder then uses **Copy for Outlook**, pastes the content into Outlook and reviews it manually. The Lead Engine has no email-send connection and copying a draft does not record the prospect as contacted.

Direct Microsoft Graph draft creation is deferred. The existing Graph integration remains disabled and retains its previous `initial_outreach_v1` contract for possible future activation.

## Common subject

`Cleaning support for [Business Name]`

## Common body

Every sector template uses this fixed structure. Only the sector paragraph changes.

Hello [Business Name] team,

I’m reaching out on behalf of Clean Up Central, a London-based company providing professional cleaning and practical property support to businesses and property operators.

We’re currently introducing our services to businesses that may benefit from reliable ongoing cleaning support, and came across [Business Name] while researching organisations in your sector.

[Approved sector paragraph]

We can arrange a brief introductory call or site visit to understand your requirements and provide a straightforward quotation.

Would you be open to a short conversation?

Kind regards,
Clean Up Central
Bringing Spaces back to life, one at a time.

If you do not wish to receive further business communications from Clean Up Central, please reply to this email and let us know. We will update our records accordingly.

For information about how we use business contact information, please see our Privacy Notice: [Privacy Notice URL]

## Approved sector paragraphs

### Short-let and serviced accommodation

`Whether you require regular property changeovers, additional cleaning cover during busy periods, or dependable support across a growing portfolio, we would be happy to discuss how Clean Up Central could support your operation.`

Template ID: `initial_outreach_v2_short_let_serviced_accommodation`

### Offices and coworking spaces

`Whether you require scheduled workplace cleaning, out-of-hours support, or dependable cover when your usual arrangements need extra capacity, we would be happy to discuss how Clean Up Central could support your workplace.`

Template ID: `initial_outreach_v2_offices_coworking`

### Community halls and event venues

`Whether you require cleaning before or after events, regular venue upkeep, or additional cover around busy booking periods, we would be happy to discuss how Clean Up Central could support your venue.`

Template ID: `initial_outreach_v2_community_halls_event_venues`

### Estate and letting agents

`Whether you require cleaning between tenancies, support across managed properties, or dependable cover when additional cleaning is required, we would be happy to discuss how Clean Up Central could support your team.`

Template ID: `initial_outreach_v2_estate_letting_agents`

### University accommodation

`Whether you require accommodation turnovers, communal-area cleaning, periodic deep cleans, or additional support during peak changeover periods, we would be happy to discuss how Clean Up Central could support your accommodation operation.`

Template ID: `initial_outreach_v2_university_accommodation`

### Other commercial spaces

`Whether you require regular cleaning, additional cover when needed, or simply a dependable cleaning company to have available, we would be happy to discuss how Clean Up Central could support your business.`

Template ID: `initial_outreach_v2_other_commercial_spaces`

## Evidence and contact rules

A sector template may be prepared only when:

1. the prospect is in `ready_for_outreach`;
2. the latest assessment is eligible and has no blockers;
3. there is no active suppression;
4. the prospect sector has matching verified `approved_sector` evidence; and
5. the recipient is a verified generic business email from the first-party business website.

A score or founder action cannot bypass these rules.

## Production configuration

- `OUTREACH_OPTOUT_TEXT` is: `If you do not wish to receive further business communications from Clean Up Central, please reply to this email and let us know. We will update our records accordingly.`
- `OUTREACH_PRIVACY_URL` points to the deployed public Clean Up Central Privacy Notice.
- `LEAD_OUTLOOK_DRAFT_V1` remains disabled while Microsoft Graph integration is deferred.
- No `Mail.Send` permission or email-send endpoint is introduced by the manual workflow.

## Acceptance checks

Before the Stage 5 manual-draft acceptance test is signed off, confirm:

1. greeting is `Hello [Business Name] team,`;
2. business name comes from verified durable identity, not an unverified Google label;
3. the selected v2 template matches verified sector evidence;
4. the common body is unchanged except for the business-name substitution and approved sector paragraph;
5. the signature remains founder-neutral;
6. tagline is `Bringing Spaces back to life, one at a time.`;
7. the approved opt-out appears exactly once;
8. the Privacy Notice link opens the public notice;
9. **Copy for Outlook** copies recipient, subject and body but sends nothing;
10. the founder can paste the copy into Outlook and save one unsent draft manually; and
11. no `contacted` activity is recorded merely because a draft was prepared, copied or saved.
