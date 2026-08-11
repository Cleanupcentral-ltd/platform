import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";

import {
  FounderAuthError,
  type FounderAuthService,
} from "../src/ports/founder-auth.js";

import type {
  LeadSearchService,
} from "../src/application/search-leads.js";

import {
  LeadReviewError,
} from "../src/application/review-leads.js";

import type {
  LeadReviewService,
} from "../src/application/review-leads.js";

const USER_ID =
  "79b42d3d-78be-42fc-9d91-5d97566d2ed0";

const founderService:
  FounderAuthService = {
    async authenticate() {
      return {
        userId: USER_ID,
        email:
          "founder@example.com",
      };
    },
  };

const leadSearchService:
  LeadSearchService = {
    async search(
      founderId,
      input,
    ) {
      assert.equal(
        founderId,
        USER_ID,
      );
      return {
        searchRunId:
          "1f8a558b-f3b6-453b-b201-6d57323d0663",
        postcode: input.postcode,
        sector: input.sector,
        radiusMiles:
          input.radiusMiles,
        resultCount: 1,
        createdCount: 1,
        results: [{
          businessName:
            "Example Workspace",
          formattedAddress:
            "1 High Street",
          primaryPostcode:
            "BR1 1AA",
          websiteUrl:
            "https://example.com/",
          phone: null,
          sourceUrl:
            "https://maps.google.com/?cid=1",
          distanceMiles: 1.2,
          evidenceStatus:
            "unverified",
        }],
      };
    },

    async captureManual(
      founderId,
      input,
    ) {
      assert.equal(
        founderId,
        USER_ID,
      );
      return {
        resultCount: 1,
        createdCount: 1,
        businessName:
          input.businessName,
        evidenceStatus:
          "unverified",
      };
    },
  };

const leadReviewService:
  LeadReviewService = {
    async listProspects() {
      return [{
        id:
          "11111111-1111-4111-8111-111111111111",
        businessName:
          "Example Workspace",
        sector: "offices_coworking",
        primaryPostcode: "BR1 1AA",
        websiteUrl:
          "https://example.com/",
        createdAt:
          "2026-08-11T10:00:00.000Z",
        evidenceCounts: {
          unverified: 2,
          verified: 0,
          rejected: 0,
        },
        latestAssessment: null,
      }];
    },
    async getProspect(prospectId) {
      return {
        id: prospectId,
        businessName:
          "Example Workspace",
        sector: "offices_coworking",
        primaryPostcode: "BR1 1AA",
        websiteUrl:
          "https://example.com/",
        companyNumber: null,
        createdAt:
          "2026-08-11T10:00:00.000Z",
        hasSearchProvenance: true,
        hasActiveSuppression: false,
        evidence: [],
        contacts: [],
        latestAssessment: null,
      };
    },
    async addEvidence() {
      return {
        evidenceId:
          "33333333-3333-4333-8333-333333333333",
      };
    },
    async decideEvidence() {},
    async assess(
      _founderId,
      prospectId,
    ) {
      return {
        id:
          "44444444-4444-4444-8444-444444444444",
        totalScore: 2,
        rulesVersion:
          "cuc-lel-0-10-v1",
        eligibilityResult:
          "research_required",
        scoreBreakdown: {},
        blockers: [
          "missing_verified_identity",
        ],
        rationale:
          "Research required.",
        evidenceIds: [],
        assessedAt:
          "2026-08-11T12:00:00.000Z",
      };
    },
  };

function createRejectingReviewService():
  LeadReviewService {
  return {
    ...leadReviewService,
    async addEvidence() {
      throw new LeadReviewError(
        "invalid_evidence",
      );
    },
  };
}

test(
  "Lead Engine route does not exist when its feature flag is off",
  async (context) => {
    const app = await buildApp({
      leadEngineUiEnabled: false,
      founderAuthService:
        founderService,
    });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "GET",
        url:
          "/api/ops/leads/health",
        headers: {
          authorization:
            "Bearer test-token",
        },
      });

    assert.equal(
      response.statusCode,
      404,
    );
  },
);

test(
  "Lead search routes stay absent when the Stage 3 flag is off",
  async (context) => {
    const app = await buildApp({
      leadEngineUiEnabled: true,
      leadSearchEnabled: false,
      founderAuthService:
        founderService,
      leadSearchService,
    });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "POST",
        url:
          "/api/ops/leads/search",
        headers: {
          authorization:
            "Bearer test-token",
          "content-type":
            "application/json",
        },
        payload: {
          postcode: "BR1 5HP",
          radiusMiles: 5,
          sector:
            "offices_coworking",
        },
      });

    assert.equal(
      response.statusCode,
      404,
    );
  },
);

test(
  "Lead search accepts only an authenticated approved search and returns unverified evidence",
  async (context) => {
    const app = await buildApp({
      leadEngineUiEnabled: true,
      leadSearchEnabled: true,
      founderAuthService:
        founderService,
      leadSearchService,
    });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "POST",
        url:
          "/api/ops/leads/search",
        headers: {
          authorization:
            "Bearer test-token",
          "content-type":
            "application/json",
        },
        payload: {
          postcode: "BR1 5HP",
          radiusMiles: 5,
          sector:
            "offices_coworking",
        },
      });

    assert.equal(
      response.statusCode,
      200,
    );
    assert.equal(
      response.json().search
        .results[0]
        .evidenceStatus,
      "unverified",
    );
  },
);

test(
  "founder can list persisted prospects for Stage 4 review",
  async (context) => {
    const app = await buildApp({
      leadEngineUiEnabled: true,
      leadSearchEnabled: false,
      founderAuthService:
        founderService,
      leadReviewService,
    });
    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "GET",
        url:
          "/api/ops/leads/prospects",
        headers: {
          authorization:
            "Bearer test-token",
        },
      });

    assert.equal(
      response.statusCode,
      200,
    );
    assert.equal(
      response.json().prospects[0]
        .businessName,
      "Example Workspace",
    );
  },
);

test(
  "Stage 4 review routes stay absent when their rollout flag is off",
  async (context) => {
    const app = await buildApp({
      leadEngineUiEnabled: true,
      leadSearchEnabled: false,
      leadReviewEnabled: false,
      founderAuthService:
        founderService,
      leadReviewService,
    });
    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "GET",
        url:
          "/api/ops/leads/prospects",
        headers: {
          authorization:
            "Bearer test-token",
        },
      });

    assert.equal(
      response.statusCode,
      404,
    );
  },
);

test(
  "Stage 4 accepts only controlled HTTPS verification evidence",
  async (context) => {
    const app = await buildApp({
      leadEngineUiEnabled: true,
      leadSearchEnabled: false,
      founderAuthService:
        founderService,
      leadReviewService:
        createRejectingReviewService(),
    });
    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "POST",
        url:
          "/api/ops/leads/prospects/11111111-1111-4111-8111-111111111111/evidence",
        headers: {
          authorization:
            "Bearer test-token",
          "content-type":
            "application/json",
        },
        payload: {
          sourceType:
            "first_party_website",
          sourceUrl:
            "http://example.com/about",
          factName: "business_name",
          factValue:
            "Example Workspace",
        },
      });

    assert.equal(
      response.statusCode,
      400,
    );
    assert.equal(
      response.json().error.code,
      "INVALID_LEAD_EVIDENCE",
    );
  },
);

test(
  "founder can create a versioned assessment while Outlook routes stay absent",
  async (context) => {
    const app = await buildApp({
      leadEngineUiEnabled: true,
      leadSearchEnabled: false,
      founderAuthService:
        founderService,
      leadReviewService,
    });
    context.after(
      async () => app.close(),
    );

    const assessment =
      await app.inject({
        method: "POST",
        url:
          "/api/ops/leads/prospects/11111111-1111-4111-8111-111111111111/assessments",
        headers: {
          authorization:
            "Bearer test-token",
          "content-type":
            "application/json",
        },
        payload: {},
      });
    assert.equal(
      assessment.statusCode,
      201,
    );
    assert.equal(
      assessment.json().assessment
        .rulesVersion,
      "cuc-lel-0-10-v1",
    );

    const outlook = await app.inject({
      method: "POST",
      url:
        "/api/ops/leads/prospects/11111111-1111-4111-8111-111111111111/outlook-drafts",
      headers: {
        authorization:
          "Bearer test-token",
        "content-type":
          "application/json",
      },
      payload: {},
    });
    assert.equal(outlook.statusCode, 404);

    const clientScored =
      await app.inject({
        method: "POST",
        url:
          "/api/ops/leads/prospects/11111111-1111-4111-8111-111111111111/assessments",
        headers: {
          authorization:
            "Bearer test-token",
          "content-type":
            "application/json",
        },
        payload: {
          totalScore: 10,
        },
      });
    assert.equal(
      clientScored.statusCode,
      400,
    );
  },
);

test(
  "manual capture remains available as the Stage 3 fallback and requires a public source",
  async (context) => {
    const app = await buildApp({
      leadEngineUiEnabled: true,
      leadSearchEnabled: true,
      founderAuthService:
        founderService,
      leadSearchService,
    });

    context.after(
      async () => app.close(),
    );

    const invalid =
      await app.inject({
        method: "POST",
        url:
          "/api/ops/leads/manual",
        headers: {
          authorization:
            "Bearer test-token",
          "content-type":
            "application/json",
        },
        payload: {
          businessName:
            "Manual Venue",
          sector:
            "community_halls_event_venues",
          sourceUrl:
            "not-a-public-url",
        },
      });
    assert.equal(
      invalid.statusCode,
      400,
    );

    const valid =
      await app.inject({
        method: "POST",
        url:
          "/api/ops/leads/manual",
        headers: {
          authorization:
            "Bearer test-token",
          "content-type":
            "application/json",
        },
        payload: {
          businessName:
            "Manual Venue",
          sector:
            "community_halls_event_venues",
          sourceUrl:
            "https://venue.example/about",
        },
      });
    assert.equal(
      valid.statusCode,
      201,
    );
    assert.equal(
      valid.json().manualCapture
        .evidenceStatus,
      "unverified",
    );
  },
);

test(
  "Lead Engine route requires a bearer token",
  async (context) => {
    const app = await buildApp({
      leadEngineUiEnabled: true,
      founderAuthService:
        founderService,
    });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "GET",
        url:
          "/api/ops/leads/health",
      });

    assert.equal(
      response.statusCode,
      401,
    );

    assert.equal(
      response.json().error.code,
      "AUTHENTICATION_REQUIRED",
    );
  },
);

test(
  "Lead Engine route returns founder-only readiness after MFA auth",
  async (context) => {
    const app = await buildApp({
      leadEngineUiEnabled: true,
      founderAuthService:
        founderService,
    });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "GET",
        url:
          "/api/ops/leads/health",
        headers: {
          authorization:
            "Bearer test-token",
        },
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.deepEqual(
      response.json().foundation,
      {
        ready: true,
        access: "founder",
        mfa: "verified",
        userId: USER_ID,
      },
    );
  },
);

for (
  const scenario of [
    {
      failure:
        "invalid_token",
      expectedStatus: 401,
      expectedCode:
        "INVALID_AUTHENTICATION",
    },
    {
      failure:
        "mfa_required",
      expectedStatus: 403,
      expectedCode:
        "MFA_REQUIRED",
    },
    {
      failure:
        "founder_role_required",
      expectedStatus: 403,
      expectedCode: "FORBIDDEN",
    },
    {
      failure:
        "provider_unavailable",
      expectedStatus: 503,
      expectedCode:
        "AUTH_PROVIDER_UNAVAILABLE",
    },
  ] as const
) {
  test(
    `Lead Engine route maps ${scenario.failure} safely`,
    async (context) => {
      const app = await buildApp({
        leadEngineUiEnabled:
          true,
        founderAuthService: {
          async authenticate() {
            throw new FounderAuthError(
              scenario.failure,
            );
          },
        },
      });

      context.after(
        async () => app.close(),
      );

      const response =
        await app.inject({
          method: "GET",
          url:
            "/api/ops/leads/health",
          headers: {
            authorization:
              "Bearer test-token",
          },
        });

      assert.equal(
        response.statusCode,
        scenario.expectedStatus,
      );

      assert.equal(
        response.json().error.code,
        scenario.expectedCode,
      );
    },
  );
}

test(
  "CORS explicitly permits the Authorization header for the founder UI",
  async (context) => {
    const app = await buildApp({
      leadEngineUiEnabled: true,
      founderAuthService:
        founderService,
    });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "OPTIONS",
        url:
          "/api/ops/leads/health",
        headers: {
          origin:
            "http://localhost:5173",
          "access-control-request-method":
            "GET",
          "access-control-request-headers":
            "authorization",
        },
      });

    assert.equal(
      response.statusCode,
      204,
    );

    assert.match(
      response.headers[
        "access-control-allow-headers"
      ] ?? "",
      /authorization/i,
    );
  },
);
