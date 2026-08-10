# Clean Up Central Operations Console

Minimal reusable founder authentication for Lead Engine Lite Stage 2.

## Route

The production route is `https://app.cleanupcentral.com/ops/leads`. The build
also emits `/ops/index.html` and `/ops/leads/index.html` so direct navigation
works on a static host without exposing the public Wix application.

## Security boundary

- The browser receives only the Supabase project URL and publishable key.
- The Supabase service-role key and provider credentials are prohibited from
  this package.
- `app_metadata.role = founder` and an `aal2` Supabase session are required.
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
ready. No search, provider, export, Outlook or sending capability is present in
this Stage 2 console.
