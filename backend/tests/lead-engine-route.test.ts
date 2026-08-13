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

import type {
  CompaniesHouseVerificationService,
} from "../src/application/verify-companies-house.js";

import type {
  CompanyEnrichmentService,
} from "../src/application/enrich-companies.js";

import type {
  OutreachService,
} from "../src/application/outreach.js";

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
        automaticAssessment: {
          requestedCount: 1,
          completedCount: 1,
          pendingCount: 0,
        },
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
        automaticAssessment: {
          requestedCount: 1,
          completedCount: 1,
          pendingCount: 0,
        },
        businessName:
          input.businessName,
        evidenceStatus:
          "unverified",
      };
    },
  };

const leadReviewService:
  LeadReviewService = {
    async listProspects(founderId) {
      assert.equal(founderId, USER_ID);
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
        viewedAt: null,
        evidenceCounts: {
          unverified: 2,
          verified: 0,
          rejected: 0,
        },
        latestAssessment: null,
      }];
    },
    async setProspectViewed(
      founderId,
      prospectId,
      viewed,
    ) {
      assert.equal(founderId, USER_ID);
      assert.equal(
        prospectId,
        "11111111-1111-4111-8111-111111111111",
      );
      return viewed
        ? "2026-08-13T14:00:00.000Z"
        : null;
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
        automaticAssessment: {
          status: "updated",
          assessment: null,
        },
      };
    },
    async decideEvidence() {
      return {
        status: "updated",
        assessment: null,
      };
    },
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

const companiesHouseVerificationService:
  CompaniesHouseVerificationService = {
    async search(prospectId, query) {
      assert.equal(
        prospectId,
        "11111111-1111-4111-8111-111111111111",
      );
      assert.equal(
        query,
        "Example Workspace",
      );
      return [{
        companyName:
          "EXAMPLE WORKSPACE LTD",
        companyNumber: "01234567",
        companyStatus: "active",
        companyType: "ltd",
        registeredOfficeAddress: {
          formatted:
            "1 High Street, BR1 1AA",
          postcode: "BR1 1AA",
        },
        dateOfCreation:
          "2020-01-01",
        officialUrl:
          "https://find-and-update.company-information.service.gov.uk/company/01234567",
      }];
    },
    async verify(
      founderId,
      prospectId,
      companyNumber,
    ) {
      assert.equal(founderId, USER_ID);
      assert.equal(
        prospectId,
        "11111111-1111-4111-8111-111111111111",
      );
      assert.equal(
        companyNumber,
        "01234567",
      );
      return {
        companyName:
          "EXAMPLE WORKSPACE LTD",
        companyNumber: "01234567",
        businessStatus: "active",
        subscriberType: "corporate",
        evidenceIds: [
          "33333333-3333-4333-8333-333333333333",
        ],
        automaticAssessment: {
          status: "updated",
          assessment: null,
        },
      };
    },
    async verifyAutomatically(
      actorId,
      prospectId,
      companyNumber,
      _assertion,
    ) {
      return this.verify(
        actorId,
        prospectId,
        companyNumber,
      );
    },
  };

const companyEnrichmentService:
  CompanyEnrichmentService = {
    async runBatch() {
      return {
        claimedCount: 0,
        autoVerifiedCount: 0,
        reviewRequiredCount: 0,
        completedCount: 0,
        failedCount: 0,
      };
    },
    async retry(prospectId, actorId) {
      assert.equal(
        prospectId,
        "11111111-1111-4111-8111-111111111111",
      );
      assert.equal(actorId, USER_ID);
    },
  };

const outreachService: OutreachService = {
  async getWorkspace(founderId, prospectId) {
    assert.equal(founderId, USER_ID);
    assert.equal(
      prospectId,
      "11111111-1111-4111-8111-111111111111",
    );
    return {
      connection: {
        connected: true,
        mailboxEmail:
          "founder@outlook.com",
        connectedAt:
          "2026-08-13T12:00:00.000Z",
      },
      latestDraft: null,
      activities: [],
    };
  },
  async previewDraft(
    founderId,
    prospectId,
    contactId,
  ) {
    assert.equal(founderId, USER_ID);
    assert.equal(
      prospectId,
      "11111111-1111-4111-8111-111111111111",
    );
    assert.equal(contactId, null);
    return {
      prospectId,
      businessName: "Example Workspace",
      templateId:
        "initial_outreach_v1",
      contactId:
        "33333333-3333-4333-8333-333333333333",
      recipientEmail:
        "hello@example.com",
      availableRecipients: [{
        contactId:
          "33333333-3333-4333-8333-333333333333",
        email: "hello@example.com",
      }],
      subject:
        "Cleaning support for Example Workspace",
      body: "Hello",
      evidence: [],
      previewSha256: "a".repeat(64),
    };
  },
  async createDraft(
    founderId,
    prospectId,
    contactId,
    previewSha256,
  ) {
    assert.equal(founderId, USER_ID);
    assert.equal(
      contactId,
      "33333333-3333-4333-8333-333333333333",
    );
    assert.equal(
      previewSha256,
      "a".repeat(64),
    );
    return {
      id:
        "55555555-5555-4555-8555-555555555555",
      prospectId,
      contactId,
      recipientEmail:
        "hello@example.com",
      subject:
        "Cleaning support for Example Workspace",
      body: "Hello",
      templateId:
        "initial_outreach_v1",
      previewSha256,
      evidenceIds: [],
      status: "drafted",
      outlookDraftId:
        "graph-draft-id",
      outlookWebUrl:
        "https://outlook.live.com/mail/0/drafts/id/graph-draft-id",
      lastErrorCode: null,
      createdAt:
        "2026-08-13T12:00:00.000Z",
      updatedAt:
        "2026-08-13T12:00:00.000Z",
    };
  },
  async createAuthorizationUrl(founderId) {
    assert.equal(founderId, USER_ID);
    return "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";
  },
  async completeAuthorization() {},
  async recordActivity(
    founderId,
    prospectId,
    input,
  ) {
    assert.equal(founderId, USER_ID);
    return {
      id:
        "66666666-6666-4666-8666-666666666666",
      activityType:
        input.activityType,
      outcome: input.outcome,
      notes: input.notes,
      followUpAt: input.followUpAt,
      createdAt:
        "2026-08-13T13:00:00.000Z",
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
  "opening a prospect records only that founder's view state",
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
        method: "PUT",
        url:
          "/api/ops/leads/prospects/11111111-1111-4111-8111-111111111111/view",
        headers: {
          authorization:
            "Bearer test-token",
          "content-type":
            "application/json",
        },
        payload: { viewed: true },
      });

    assert.equal(
      response.statusCode,
      200,
    );
    assert.deepEqual(
      response.json().viewState,
      {
        prospectId:
          "11111111-1111-4111-8111-111111111111",
        viewedAt:
          "2026-08-13T14:00:00.000Z",
      },
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

test(
  "protected health exposes automatic qualification only when its worker is enabled",
  async (context) => {
    const app = await buildApp({
      leadEngineUiEnabled: true,
      founderAuthService:
        founderService,
      companyEnrichmentEnabled: true,
      automaticQualificationEnabled: true,
      companyEnrichmentService,
    });

    context.after(
      async () => app.close(),
    );

    const response = await app.inject({
      method: "GET",
      url: "/api/ops/leads/health",
      headers: {
        authorization:
          "Bearer test-token",
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(
      response.json().capabilities
        .automaticQualification,
      true,
    );
  },
);

test(
  "Outlook rollout exposes preview and draft creation without any send route or permission",
  async (context) => {
    const app = await buildApp({
      leadEngineUiEnabled: true,
      founderAuthService:
        founderService,
      outlookDraftEnabled: true,
      outreachService,
    });
    context.after(
      async () => app.close(),
    );

    const health = await app.inject({
      method: "GET",
      url: "/api/ops/leads/health",
      headers: {
        authorization:
          "Bearer test-token",
      },
    });
    assert.equal(
      health.json().capabilities
        .outlookDrafts,
      true,
    );

    const connect = await app.inject({
      method: "POST",
      url:
        "/api/ops/leads/outlook/connect",
      headers: {
        authorization:
          "Bearer test-token",
        "content-type":
          "application/json",
      },
      payload: {},
    });
    assert.equal(connect.statusCode, 200);
    assert.deepEqual(
      connect.json().permissions,
      ["Mail.ReadWrite"],
    );
    assert.equal(
      connect.json().sendingPermitted,
      false,
    );

    const preview = await app.inject({
      method: "POST",
      url:
        "/api/ops/leads/prospects/11111111-1111-4111-8111-111111111111/outlook-draft-preview",
      headers: {
        authorization:
          "Bearer test-token",
        "content-type":
          "application/json",
      },
      payload: { contactId: null },
    });
    assert.equal(preview.statusCode, 200);
    assert.equal(
      preview.json().preview
        .recipientEmail,
      "hello@example.com",
    );

    const created = await app.inject({
      method: "POST",
      url:
        "/api/ops/leads/prospects/11111111-1111-4111-8111-111111111111/outlook-drafts",
      headers: {
        authorization:
          "Bearer test-token",
        "content-type":
          "application/json",
      },
      payload: {
        contactId:
          "33333333-3333-4333-8333-333333333333",
        previewSha256:
          "a".repeat(64),
      },
    });
    assert.equal(created.statusCode, 201);
    assert.equal(created.json().sent, false);
    assert.equal(
      created.json().draft.status,
      "drafted",
    );

    const send = await app.inject({
      method: "POST",
      url:
        "/api/ops/leads/prospects/11111111-1111-4111-8111-111111111111/outlook-send",
      headers: {
        authorization:
          "Bearer test-token",
        "content-type":
          "application/json",
      },
      payload: {},
    });
    assert.equal(send.statusCode, 404);
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

test(
  "founder can search Companies House candidates without accepting evidence",
  async (context) => {
    const app = await buildApp({
      leadEngineUiEnabled: true,
      leadReviewEnabled: true,
      founderAuthService:
        founderService,
      leadReviewService,
      companiesHouseVerificationService,
    });

    context.after(
      async () => app.close(),
    );

    const response = await app.inject({
      method: "GET",
      url:
        "/api/ops/leads/prospects/11111111-1111-4111-8111-111111111111/companies-house/matches?q=Example%20Workspace",
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
      response.json().matches[0]
        .companyNumber,
      "01234567",
    );
  },
);

test(
  "founder confirmation sends only the selected Companies House number",
  async (context) => {
    const app = await buildApp({
      leadEngineUiEnabled: true,
      leadReviewEnabled: true,
      founderAuthService:
        founderService,
      leadReviewService,
      companiesHouseVerificationService,
    });

    context.after(
      async () => app.close(),
    );

    const response = await app.inject({
      method: "POST",
      url:
        "/api/ops/leads/prospects/11111111-1111-4111-8111-111111111111/companies-house/verification",
      headers: {
        authorization:
          "Bearer test-token",
        "content-type":
          "application/json",
      },
      payload: {
        companyNumber: "01234567",
      },
    });

    assert.equal(
      response.statusCode,
      201,
    );
    assert.equal(
      response.json().verification
        .subscriberType,
      "corporate",
    );
  },
);

test(
  "Companies House confirmation rejects client-supplied company facts",
  async (context) => {
    const app = await buildApp({
      leadEngineUiEnabled: true,
      leadReviewEnabled: true,
      founderAuthService:
        founderService,
      leadReviewService,
      companiesHouseVerificationService,
    });

    context.after(
      async () => app.close(),
    );

    const response = await app.inject({
      method: "POST",
      url:
        "/api/ops/leads/prospects/11111111-1111-4111-8111-111111111111/companies-house/verification",
      headers: {
        authorization:
          "Bearer test-token",
        "content-type":
          "application/json",
      },
      payload: {
        companyNumber: "01234567",
        companyStatus: "active",
      },
    });

    assert.equal(
      response.statusCode,
      400,
    );
  },
);

test(
  "founder can retry a persisted automatic company check without supplying match data",
  async (context) => {
    const app = await buildApp({
      leadEngineUiEnabled: true,
      leadSearchEnabled: false,
      founderAuthService: founderService,
      leadReviewService,
      companiesHouseVerificationService,
      companyEnrichmentEnabled: true,
      companyEnrichmentService,
    });
    context.after(async () => app.close());

    const response = await app.inject({
      method: "POST",
      url:
        "/api/ops/leads/prospects/11111111-1111-4111-8111-111111111111/company-enrichment/retry",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      payload: {},
    });

    assert.equal(response.statusCode, 202);
    assert.equal(
      response.json().status,
      "pending",
    );
  },
);
