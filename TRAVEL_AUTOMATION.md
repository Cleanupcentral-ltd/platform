# Travel automation maintenance

Maintenance ID: `CUC-B1-MAINT-001`

## Current state

The implementation is ready for review behind `TRAVEL_AUTO_ENABLED=false`. The existing manual-review behaviour remains active while the flag is off, when Google Routes is not configured, when the provider fails, when no route exists, or when the shorter route is above 30 miles.

Production activation is not complete until the live-provider and rollout evidence below has been verified.

## Approved rule

- Calculate one-way driving distance from `BR1 5HP` and `RM10 8BE`.
- Select the shorter valid route.
- Use the provider distance without rounding to choose the band:
  - 0–10 miles inclusive: £0
  - above 10–20 miles inclusive: £10
  - above 20–30 miles inclusive: £20
  - above 30 miles: manual review
- A missing or failed distance calculation requires manual review and must not reject or prevent quote submission.

The pricing authority remains `specifications/CUC_Phase_0_Rules_and_Database_Blueprint_v1.4.yaml`.

## Design

- `GoogleRoutesMatrixProvider` is the only Google-specific component.
- The adapter calls Routes API `computeRouteMatrix` once with two origins, one destination, `DRIVE`, and `TRAFFIC_UNAWARE`.
- The field mask is limited to `originIndex,destinationIndex,status,condition,distanceMeters,duration`.
- Domain code selects the valid route and applies the existing Phase 0 travel bands.
- `POST /api/travel/estimate` returns only the public fee decision. It does not return the selected operating origin, provider evidence, or API key.
- Quote submission independently recalculates travel server-side when the flag is enabled. It does not trust the browser calculation.
- Selected origin, unrounded miles, timestamp, route elements and provider name are retained in the existing quote pricing snapshot. No unverified Wix collection field was added.

## Environment

```dotenv
TRAVEL_AUTO_ENABLED=false
GOOGLE_ROUTES_API_KEY=private-server-side-key
GOOGLE_ROUTES_API_BASE_URL=https://routes.googleapis.com
GOOGLE_ROUTES_TIMEOUT_MS=5000
```

The key must stay on Render, be restricted to the Routes API, and use the applicable server-side application restriction supported by the deployment.

## Public contract

```http
POST /api/travel/estimate
Content-Type: application/json

{"postcode":"SE1 2AA"}
```

A provider failure is a successful manual fallback, not an HTTP failure:

```json
{
  "success": true,
  "travel": {
    "status": "manual_review",
    "fee": null,
    "distanceMiles": null,
    "pendingReview": true,
    "reason": "TRAVEL_PROVIDER_UNAVAILABLE"
  },
  "requestId": "..."
}
```

## Verification and rollout gates

Verified locally:

- untouched baseline: 176/176 backend tests
- travel domain, adapter, failure fallback and HTTP contract tests
- complete backend regression suite, TypeScript and production compilation
- frontend travel-client tests, pricing/payload/mapper regressions, strict TypeScript and isolated quote-page bundle

Still required before activation:

1. Configure a restricted Google Routes key on Render while keeping `TRAVEL_AUTO_ENABLED=false`.
2. Verify representative postcodes against independent Google Maps journeys, including each fee band and an above-30-mile case.
3. Record provider metres, selected origin, calculated fee and expected fee for each check.
4. Enable the flag in a controlled window.
5. Verify health, travel endpoint responses, quote persistence evidence and manual fallback.
6. Monitor provider errors, HTTP latency and quote failures.

## Rollback

Set `TRAVEL_AUTO_ENABLED=false`. Quotes then return to the existing travel-pending/manual-review path without a code rollback or Wix schema change.

## Provider references

- https://developers.google.com/maps/documentation/routes/compute_route_matrix
- https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRouteMatrix
- https://developers.google.com/maps/documentation/routes/get-api-key
