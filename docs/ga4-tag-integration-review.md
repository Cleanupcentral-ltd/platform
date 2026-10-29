# GA4 live-site tracking diagnosis and safe implementation gate

## Verified in repository
- The Vite/React site entry point `index.html` has no Google tag loader.
- `src/app/quoteLeadTracking.js` emits `cuc_quote_submitted` only if `window.gtag` exists or `window.dataLayer` is an array.
- The quote event is called only after the backend confirms success; do not replace it with a thank-you page-view conversion.
- Wix Google Tag integration was reported connected to `G-2PKXMJZYTW`, but desktop Tag Assistant could not attach and GA4 Realtime showed zero after a manual visit. This is suggestive, not conclusive evidence of an absent tag.

## Required live verification before adding any loader
1. In desktop browser DevTools > Network, reload the published site with analytics consent accepted. Search for `gtag/js`, `gtm.js`, and `collect` requests; record which tags actually load.
2. In Console inspect `typeof window.gtag`, `Array.isArray(window.dataLayer)`, and `window.dataLayer?.slice(-10)` without exposing customer details.
3. Verify consent banner/consent mode and any tracking blocker. Determine whether Wix injects its tag on this custom Wix CLI site.
4. Confirm GA4 Realtime or DebugView with an ordinary page visit and then one real test submission.

## Implementation plan if tag is truly absent
- Establish the site's actual consent-management API/event first.
- Add exactly one GA4 loader for `G-2PKXMJZYTW` at the custom frontend entry point, ensuring it does not duplicate Wix's tag.
- Default analytics storage to denied until consent is granted, and update consent through the confirmed CMP mechanism. Do not assume consent from page navigation.
- Keep `cuc_quote_submitted` on backend-confirmed success only. No names, emails, phone numbers, addresses, or quote IDs in analytics payload.
- Add automated tests for tag availability and consent handling.
- Verify in preview/staging before deploying. Leave Google Ads paused until end-to-end verification.

**Status:** Investigation branch only. No tag has been installed and no live deployment has been changed.
