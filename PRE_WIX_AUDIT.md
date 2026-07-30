# Clean Up Central v2.2 pre-Wix audit

Audit date: 22 July 2026

## Passed

- Phase 0 v1.3 prices, discount scope, travel rules and manual-review triggers
- Unrestricted bedroom counter, using 0 for Studio and the existing per-bedroom pricing formulas above three bedrooms
- Flexible property-type capture without changing the pricing calculation
- Separate Hallway and Stairs prices and the Hallway/Stairs-only £40 minimum
- Past-date blocking, three-hour minimum notice and 90-day maximum advance-booking validation
- Dirty Airbnb £20 provisional-charge notice on the photograph step and summary
- Selected Rooms condition-review notice
- Correct pending/manual-review travel status when distance is unknown or over 30 miles
- Persistent state, required-field validation, consent, quote payload creation and file metadata
- Drag-and-drop/browse upload controls with selected-file display and removal
- Four-stage Figma progress indicator and focused Commercial and Property Support screens
- Original Figma layouts restored for all public pages; functional changes are confined to behaviour and required form content
- Phone and email placeholders retained for later replacement
- Phase 0 customer-service hours shown on the Contact page
- Strict TypeScript check, automated tests, production build and zero-vulnerability dependency audit

## Source precedence note

Phase 0 v1.3 remains the pricing authority. The user's confirmed July 22 UI decisions supersede only its property-size/property-type capture wording: bedroom count is unrestricted and property type can be described flexibly. These changes do not alter prices.

## Intentionally pending Wix Headless connection

- Wix project configuration and OAuth setup
- Permanent quote and enquiry storage
- Wix Media uploads
- Server-side price verification
- Driving-distance calculation and travel-fee confirmation
- Authoritative quote-number generation
- Customer/property record matching
- Email notifications, payments, approvals and booking conversion

The live Harmony website and domain should remain unchanged until the Wix-connected test deployment passes end-to-end verification.
