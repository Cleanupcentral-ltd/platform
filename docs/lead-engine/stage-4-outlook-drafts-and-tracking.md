# Lead Engine Lite Stage 4 — Outlook drafts and tracking

## Outcome

Stage 4 turns a `ready_for_outreach` prospect into one founder-reviewed,
unsent Outlook draft. It also records the founder's later manual contact,
reply, follow-up and outcome decisions.

The system cannot send email. It requests delegated `Mail.ReadWrite` access,
does not request `Mail.Send`, has no send endpoint and returns `sent: false`
after draft creation.

## Founder journey

1. Open a prospect in **Ready for outreach**.
2. Review the exact recipient, subject, body and supporting source links.
3. Choose a different verified generic business mailbox when one is available.
4. Explicitly approve **Create Outlook draft**.
5. Open the unsent draft in Outlook, edit it if required and decide manually
   whether to send it.
6. Only after a manual send, record **Contacted** in the console.
7. Record any reply, follow-up or outcome. **Do not contact** creates a durable
   suppression that overrides qualification and future drafting.

## Draft qualification gates

Draft preview and creation both require all of the following:

- the latest versioned assessment is eligible and has no blockers;
- the Stage 4.2 queue state is `ready_for_outreach`;
- the organisation is verified as a corporate subscriber;
- the selected recipient is a verified generic business mailbox published on
  a verified first-party website;
- the exact evidence records still belong to the prospect; and
- no active prospect, business, email or domain suppression matches.

Named or personal mailboxes, malformed addresses, provider-only contact data,
contact forms and unsupported evidence cannot create an Outlook draft.

The browser supplies only a prospect, selected contact and SHA-256 preview
approval. It cannot supply or alter the subject, body, permissions or evidence.
The backend rebuilds the current preview and rejects a stale approval.

## Idempotency and recovery

- The database permits only one open initial draft for the same prospect,
  contact route and template.
- The approved draft content and preview hash are immutable while that draft
  is open.
- A provider failure is stored as `failed` and never as `contacted`.
- Each Graph draft receives the custom header
  `x-clean-up-central-draft-id`.
- A retry first inspects recent Outlook Drafts for that identifier. If Graph
  succeeded before the local confirmation failed, the existing draft is
  reconciled instead of duplicated.
- A closed draft may be followed by a new explicitly approved draft. Lean v1
  does not automate reminder drafts.

## Microsoft security boundary

- OAuth 2.0 authorization code flow uses one-time state and PKCE S256.
- Requested delegated scopes are exactly `openid`, `profile`, `email`,
  `offline_access` and `Mail.ReadWrite`.
- A token response containing `Mail.Send` is rejected.
- The callback route suppresses automatic URL logging so its temporary
  authorization code does not reach application logs.
- Access and refresh tokens are AES-256-GCM encrypted before storage. The
  encryption key and Microsoft client secret stay in the backend environment.
- Outlook connection and OAuth-state tables are in the private `lead_engine`
  schema, force RLS and deny `anon` and `authenticated` access.
- The browser never receives Microsoft tokens, the Supabase service key or
  provider credentials.

Microsoft references:

- [Create an Outlook message draft](https://learn.microsoft.com/en-us/graph/api/user-post-messages?view=graph-rest-1.0)
- [Microsoft Graph permission reference](https://learn.microsoft.com/en-us/graph/permissions-reference)
- [OAuth authorization code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)

## Required production configuration

Keep the feature disabled while configuration is incomplete:

```text
LEAD_OUTLOOK_DRAFT_V1=false
MICROSOFT_CLIENT_ID=<application client ID>
MICROSOFT_CLIENT_SECRET=<backend-only client secret>
MICROSOFT_TENANT_ID=consumers
MICROSOFT_REDIRECT_URI=https://cuc-backend-2xcc.onrender.com/api/ops/leads/outlook/callback
OUTLOOK_TOKEN_ENCRYPTION_KEY=<base64-encoded 32-byte key>
OUTLOOK_GRAPH_TIMEOUT_MS=10000
OUTREACH_PRIVACY_URL=<approved HTTPS privacy information URL>
OUTREACH_OPTOUT_TEXT=<approved plain-text opt-out wording>
```

For a personal Outlook account, register the Microsoft application for
personal Microsoft accounts and use `consumers`. If the founder mailbox is a
Microsoft 365 work account, verify the tenant type before changing that value.

Register the exact redirect URI as a **Web** redirect URI. Add only delegated
`Mail.ReadWrite`; do not add application mail permissions or `Mail.Send`.
Generate the token-encryption key with a cryptographically secure 32-byte
generator, store it only in Render and preserve it for as long as encrypted
tokens must remain readable.

## Controlled rollout

1. Merge and deploy with `LEAD_OUTLOOK_DRAFT_V1=false`.
2. Apply `20260813181000_outlook_draft_workflow.sql`.
3. Run the database permission tests and Supabase security and performance
   advisors.
4. Complete Microsoft app registration and add the backend-only environment
   values.
5. Confirm Stage 4.2 automatic qualification has passed its one-business
   canary before enabling Outlook drafts.
6. Set `LEAD_OUTLOOK_DRAFT_V1=true` and deploy.
7. Connect the founder mailbox through the console and verify the consent
   screen does not list send permission.
8. On one controlled ready prospect, preview and create one unsent draft.
9. Confirm the Outlook draft matches the recipient, subject and body exactly,
   the console records `drafted`, and no `contacted` event exists.
10. Exercise a failed/retried draft, manual contacted event, follow-up, outcome
    and do-not-contact suppression in controlled records.

Rollback is to set `LEAD_OUTLOOK_DRAFT_V1=false` and redeploy. Existing draft
references, activity history, encrypted connection data and suppressions remain
available for reconciliation. No rollback path may delete suppressions.

## Live-send gate

An unsent draft acceptance test does not authorise live outreach. No pilot
email should be sent until the privacy information, legitimate-interests or
other lawful-basis assessment, retention periods and final outreach wording
have received the required professional review and founder approval.

## Acceptance evidence

- focused Outlook, qualification and route tests: passed locally;
- full backend suite: 287 passed, 0 failed;
- backend type-check and production build: passed locally;
- founder console suite: 26 passed, 0 failed; type-check and production build
  passed locally;
- all three migrations and their database acceptance suites passed against the
  production schema inside rolled-back transactions; no change was persisted;
- Microsoft consent and one-draft production acceptance: pending explicit
  founder rollout approval.
