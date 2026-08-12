import assert from "node:assert/strict";
import test from "node:test";

import {
  createLeadSearchService,
  LeadSearchError,
} from "../src/application/search-leads.js";

import type {
  CaptureLeadResultsInput,
  LeadSearchRepository,
} from "../src/ports/lead-search.js";

const USER_ID =
  "79b42d3d-78be-42fc-9d91-5d97566d2ed0";
const SEARCH_RUN_ID =
  "1f8a558b-f3b6-453b-b201-6d57323d0663";
const PROSPECT_ID =
  "11111111-1111-4111-8111-111111111111";

function repository(
  capture:
    (input: CaptureLeadResultsInput) =>
      void,
  createdProspectIds:
    readonly string[] = [PROSPECT_ID],
): LeadSearchRepository {
  return {
    async startSearch() {
      return SEARCH_RUN_ID;
    },
    async completeSearch(input) {
      capture(input);
      return {
        resultCount:
          input.results.length,
        createdCount:
          createdProspectIds.length,
        createdProspectIds,
      };
    },
    async failSearch() {},
  };
}

test(
  "lead search captures public evidence and returns an unverified founder summary",
  async () => {
    const captures:
      CaptureLeadResultsInput[] = [];
    const assessed: string[] = [];
    const service =
      createLeadSearchService({
        enabled: true,
        postcodeLocator: {
          async locate() {
            return {
              postcode: "BR1 5HP",
              coordinates: {
                latitude: 51.4,
                longitude: 0,
              },
            };
          },
        },
        searchProvider: {
          async search() {
            return [{
              providerPlaceId:
                "place-1",
              businessName:
                "Example Workspace",
              formattedAddress:
                "1 High Street",
              primaryPostcode:
                "BR1 1AA",
              websiteUrl:
                "https://example.com/",
              phone: "020 0000 0000",
              sourceUrl:
                "https://maps.google.com/?cid=1",
              businessStatus:
                "OPERATIONAL",
              types: ["office"],
              coordinates: {
                latitude: 51.401,
                longitude: 0,
              },
              distanceMiles: 1.234,
            }];
          },
        },
        repository: repository(
          (input) => {
            captures.push(input);
          },
        ),
        assessmentService: {
          async assess(
            founderId,
            prospectId,
          ) {
            assert.equal(
              founderId,
              USER_ID,
            );
            assessed.push(prospectId);
            return {} as never;
          },
        },
      });

    const result =
      await service.search(
        USER_ID,
        {
          postcode: "BR1 5HP",
          radiusMiles: 5,
          sector:
            "offices_coworking",
        },
      );

    assert.equal(
      result.results[0]
        ?.evidenceStatus,
      "unverified",
    );
    assert.equal(
      result.results[0]
        ?.distanceMiles,
      1.23,
    );
    const captured = captures[0];
    assert.ok(captured);
    assert.equal(
      captured.results[0]
        ?.dedupeKey,
      "google_places:place-1",
    );
    assert.ok(
      captured.results[0]
        ?.evidence.some(
          (evidence) =>
            evidence.fieldName ===
              "phone" &&
            evidence.contactType ===
              "phone" &&
            evidence.normalizedContactValue ===
              "02000000000",
        ),
    );
    assert.deepEqual(
      assessed,
      [PROSPECT_ID],
    );
    assert.deepEqual(
      result.automaticAssessment,
      {
        requestedCount: 1,
        completedCount: 1,
        pendingCount: 0,
      },
    );
  },
);

test(
  "manual fallback requires a public source and persists unverified evidence without a search run",
  async () => {
    const captures:
      CaptureLeadResultsInput[] = [];
    const service =
      createLeadSearchService({
        enabled: true,
        postcodeLocator: {
          async locate() {
            throw new Error(
              "not called",
            );
          },
        },
        searchProvider: {
          async search() {
            throw new Error(
              "not called",
            );
          },
        },
        repository: repository(
          (input) => {
            captures.push(input);
          },
        ),
      });

    const result =
      await service.captureManual(
        USER_ID,
        {
          businessName:
            "Manual Venue",
          sector:
            "community_halls_event_venues",
          sourceUrl:
            "https://venue.example/about#contact",
          formattedAddress: null,
          primaryPostcode:
            "BR1 1AA",
          websiteUrl:
            "https://venue.example/",
          phone: null,
          email:
            "HELLO@VENUE.EXAMPLE",
          contactFormUrl: null,
        },
      );

    const captured = captures[0];
    assert.ok(captured);
    assert.equal(
      captured.searchRunId,
      null,
    );
    assert.equal(
      result.evidenceStatus,
      "unverified",
    );
    assert.ok(
      captured.results[0]
        ?.evidence.some(
          (evidence) =>
            evidence.contactType ===
              "email" &&
            evidence.normalizedContactValue ===
              "hello@venue.example",
        ),
    );
  },
);

test(
  "a scoring outage never rolls back a successfully captured prospect",
  async () => {
    const service =
      createLeadSearchService({
        enabled: true,
        postcodeLocator: {
          async locate() {
            throw new Error(
              "not called",
            );
          },
        },
        searchProvider: {
          async search() {
            throw new Error(
              "not called",
            );
          },
        },
        repository: repository(
          () => {},
        ),
        assessmentService: {
          async assess() {
            throw new Error(
              "temporary assessment failure",
            );
          },
        },
      });

    const result =
      await service.captureManual(
        USER_ID,
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
      );

    assert.equal(result.createdCount, 1);
    assert.deepEqual(
      result.automaticAssessment,
      {
        requestedCount: 1,
        completedCount: 0,
        pendingCount: 1,
      },
    );
  },
);

test(
  "lead search fails closed when disabled",
  async () => {
    const service =
      createLeadSearchService({
        enabled: false,
        postcodeLocator: null,
        searchProvider: null,
        repository: null,
      });

    await assert.rejects(
      service.search(USER_ID, {
        postcode: "BR1 5HP",
        radiusMiles: 5,
        sector:
          "offices_coworking",
      }),
      (error: unknown) =>
        error instanceof
          LeadSearchError &&
        error.failure === "disabled",
    );
  },
);
