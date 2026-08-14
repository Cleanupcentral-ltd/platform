# Lead Engine Lite Stage 5 — approved initial outreach copy

Approved for the Stage 5 controlled Outlook-draft test: 14 August 2026

## Scope

This is the founder-neutral `initial_outreach_v1` message for verified corporate prospects. It is draft-only. A founder must review the draft before manually sending it from Outlook.

The current backend copy must be brought into exact alignment with this record before the one-unsent-draft acceptance test is signed off.

## Subject

`Cleaning support for [Business Name]`

## Body

Hello [Business Name] team,

I’m reaching out on behalf of Clean Up Central, a London-based company providing professional cleaning and practical property support to businesses and property operators.

We’re currently introducing our services to businesses that may benefit from reliable ongoing cleaning support, and came across [Business Name] while researching organisations in your sector.

Whether you are looking for regular cleaning, additional cover when needed, or simply a dependable cleaning company to have available, we would be happy to discuss how Clean Up Central could support your business.

We can arrange a brief introductory call or site visit to understand your requirements and provide a straightforward quotation.

Would you be open to a short conversation?

Kind regards,
Clean Up Central
Bringing Spaces back to life, one at a time.

If you do not wish to receive further business communications from Clean Up Central, please reply to this email and let us know. We will update our records accordingly.

For information about how we use business contact information, please see our Privacy Notice: [Privacy Notice URL]

## Production configuration

- `OUTREACH_OPTOUT_TEXT` must be set to: `If you do not wish to receive further business communications from Clean Up Central, please reply to this email and let us know. We will update our records accordingly.`
- `OUTREACH_PRIVACY_URL` must contain the actual deployed HTTPS URL of the public Clean Up Central Privacy Notice.
- Do not use a guessed URL. The deployed URL must be smoke-tested before the Outlook canary.
- `Mail.Send` remains prohibited from the Lead Engine Outlook permission set.

## Acceptance checks

Before the one unsent Outlook draft is accepted, confirm:

1. greeting is `Hello [Business Name] team,`;
2. the business name is derived from verified durable identity, not an unverified Google label;
3. the approved body above is unchanged except for the business-name substitution;
4. the signature is founder-neutral;
5. tagline is `Bringing Spaces back to life, one at a time.`;
6. the approved opt-out appears exactly once;
7. the Privacy Notice URL is live and opens the public notice;
8. Outlook contains a draft only and no message has been sent;
9. no `contacted` activity is recorded merely because a draft was created.
