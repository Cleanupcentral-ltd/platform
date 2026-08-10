import assert from "node:assert/strict";
import test from "node:test";

import {
  captureManualLead,
  searchLeads,
} from "../src/lead-search-api.ts";

test(
  "founder search sends the MFA session only as a bearer token",
  async () => {
    let requestUrl = "";
    let requestInit:
      RequestInit | undefined;
    const result = await searchLeads(
      "https://backend.example/",
      "founder-aal2-token",
      {
        postcode: "BR1 5HP",
        radiusMiles: 5,
        sector:
          "offices_coworking",
      },
      (async (input, init) => {
        requestUrl = String(input);
        requestInit = init;
        return Response.json({
          success: true,
          search: {
            searchRunId:
              "1f8a558b-f3b6-453b-b201-6d57323d0663",
            postcode: "BR1 5HP",
            sector:
              "offices_coworking",
            radiusMiles: 5,
            resultCount: 0,
            createdCount: 0,
            results: [],
          },
        });
      }) as typeof fetch,
    );

    assert.equal(
      requestUrl,
      "https://backend.example/api/ops/leads/search",
    );
    const headers =
      new Headers(
        requestInit?.headers,
      );
    assert.equal(
      headers.get("authorization"),
      "Bearer founder-aal2-token",
    );
    assert.equal(
      String(requestInit?.body).includes(
        "founder-aal2-token",
      ),
      false,
    );
    assert.equal(result.resultCount, 0);
  },
);

test(
  "manual fallback sends the required public source evidence",
  async () => {
    let requestBody = "";
    const result =
      await captureManualLead(
        "https://backend.example",
        "founder-aal2-token",
        {
          businessName:
            "Manual Venue",
          sector:
            "community_halls_event_venues",
          sourceUrl:
            "https://venue.example/about",
          formattedAddress: null,
          primaryPostcode: null,
          websiteUrl: null,
          phone: null,
          email: null,
          contactFormUrl: null,
        },
        (async (_input, init) => {
          requestBody =
            String(init?.body);
          return Response.json(
            {
              success: true,
              manualCapture: {
                resultCount: 1,
                createdCount: 1,
                businessName:
                  "Manual Venue",
                evidenceStatus:
                  "unverified",
              },
            },
            { status: 201 },
          );
        }) as typeof fetch,
      );

    assert.equal(
      JSON.parse(requestBody)
        .sourceUrl,
      "https://venue.example/about",
    );
    assert.equal(
      result.evidenceStatus,
      "unverified",
    );
  },
);

test(
  "API failures return the backend's safe manual-fallback message",
  async () => {
    await assert.rejects(
      searchLeads(
        "https://backend.example",
        "founder-aal2-token",
        {
          postcode: "BR1 5HP",
          radiusMiles: 5,
          sector:
            "offices_coworking",
        },
        (async () =>
          Response.json(
            {
              success: false,
              error: {
                message:
                  "Business search is temporarily unavailable. Use manual capture or try again.",
              },
            },
            { status: 503 },
          )) as typeof fetch,
      ),
      /Use manual capture/,
    );
  },
);

