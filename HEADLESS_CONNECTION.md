# Wix Headless connection contract

This v2 frontend intentionally keeps Wix-dependent writes behind two browser events so the UI and payloads can be tested before credentials are added.

## Quote submission

- Event: `cuc:quote-prepared`
- Temporary local test record: `localStorage['cuc:lastPreparedQuote']`
- Payload builder: `src/app/quotePayload.js`
- Pricing version: `CUC Phase 0 v1.4`

Replace the temporary local write in `src/app/Quote.tsx` with a Wix-backed submission adapter that:

1. Uploads the selected `File` objects to Wix Media.
2. Recalculates and verifies pricing on the server using the same versioned rules.
3. Calculates driving distance from BR1 5HP and RM10 8BE and uses the shorter route.
4. Creates or resolves the customer and property records.
5. Creates quote, quote-item, answer, media and status-history records atomically where possible.
6. Generates the authoritative quote number server-side.
7. Returns a success response only after Wix confirms persistence.

Never trust the browser total as the authoritative saved price.

## Contact enquiry

- Event: `cuc:enquiry-prepared`
- Temporary local test record: `localStorage['cuc:lastPreparedEnquiry']`

Replace the temporary local write in `src/app/Contact.tsx` with a Wix-backed enquiry function and show success only after it resolves.

## Environment boundary

Do not place Wix secrets, API keys or privileged tokens in Vite client environment variables. Keep privileged operations in Wix backend functions.
