# Clean Up Central Operations Console

Founder operations console for Lead Engine Lite search, evidence review,
automatic qualification queues, Outlook draft approval, outreach tracking and
audited CSV fallback export.

## Route

The production route is `https://app.cleanupcentral.com/ops/leads`. The build
also emits `/ops/index.html` and `/ops/leads/index.html` so direct navigation
works on a static host without exposing the public Wix application.

## Security boundary

- The browser receives only the Supabase project URL and publishable key.
- The Supabase service-role key and provider credentials are prohibited from
  this package.
- `app_metadata.role = founder` and an `aal2` Supabase session are required.
- Password recovery returns to `/ops/leads`; the deployed route must be in the
  Supabase Auth redirect allow list.
- The backend independently validates the session before returning readiness.
- All Lead Engine capability flags remain disabled by default.

## Local verification

```sh
npm ci
npm test
```

Set the values from `.env.example` only for local manual authentication tests.

## Render build

- Build command: `cd ops-console && npm ci && npm run build`
- Publish directory: `ops-console/dist`
- Required build variables: `VITE_LEAD_ENGINE_UI_V1`, `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_BACKEND_URL`

Keep `VITE_LEAD_ENGINE_UI_V1=false` until the controlled founder MFA test is
ready. Backend capability flags independently control search, qualification
and Outlook drafting. The console contains no Microsoft credential or email
send capability; Outlook creation is an explicit founder-approved, unsent
draft operation performed by the authenticated backend. `LEAD_EXPORT_V1`
independently controls the founder-only CSV button; export files are generated
server-side, formula-safe and never expose the service key to the browser.
