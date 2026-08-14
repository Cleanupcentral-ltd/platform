import assert from "node:assert/strict";
import test from "node:test";

import {
  createOutreachService as
    createOutreachServiceBase,
  OutreachError,
} from "../src/application/outreach.js";

import type {
  LeadEvidenceRecord,
  LeadProspectReview,
} from "../src/ports/lead-review.js";

import type {
  OutreachDraftRecord,
  OutreachRepository,
  OutlookDraftGateway,
} from "../src/ports/outreach.js";

const PROSPECT_ID =
  "11111111-1111-4111-8111-111111111111";
const FOUNDER_ID =
  "22222222-2222-4222-8222-222222222222";
const CONTACT_ID =
  "33333333-3333-4333-8333-333333333333";

function createOutreachService(
  options: Omit<
    Parameters<
      typeof createOutreachServiceBase
    >[0],
    "privacyUrl" | "optOutText"
  >,
) {
  return createOutreachServiceBase({
    ...options,
    privacyUrl:
      "https://cleanupcentral.com/privacy",
    optOutText:
      "If you would prefer not to hear from us, reply and let me know.",
  });
}

function evidence(
  index: number,
  fieldName: string,
  fieldValue: string,
): LeadEvidenceRecord {
  return {
    id:
      `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    sourceUrl:
      `https://example.com/source-${index}`,
    sourceType:
      "first_party_website",
    fieldName,
    fieldValue,
    sourceExcerpt: fieldValue,
    verificationStatus: "verified",
    capturedAt:
      "2026-08-13T10:00:00.000Z",
    verifiedAt:
      "2026-08-13T10:00:00.000Z",
  };
}

function prospect(
  email = "hello@example.com",
): LeadProspectReview {
  const records = [
    evidence(1, "business_name", "Example Offices"),
    evidence(2, "approved_sector", "offices_coworking"),
    evidence(3, "business_status", "active"),
    evidence(4, "subscriber_type", "corporate"),
    evidence(5, "public_email", email),
    evidence(
      6,
      "premises_scale",
      "multiple_properties_locations_or_units",
    ),
  ];
  return {
    id: PROSPECT_ID,
    businessName: "Example Offices",
    sector: "offices_coworking",
    primaryPostcode: "BR1 1AA",
    websiteUrl: "https://example.com/",
    companyNumber: "12345678",
    createdAt:
      "2026-08-13T09:00:00.000Z",
    hasSearchProvenance: true,
    hasActiveSuppression: false,
    evidence: records,
    contacts: [{
      id: CONTACT_ID,
      contactType: "email",
      contactValue: email,
      normalizedValue:
        email.toLowerCase(),
      sourceEvidenceId: records[4]!.id,
      verificationStatus: "verified",
    }],
    latestAssessment: {
      id:
        "44444444-4444-4444-8444-444444444444",
      totalScore: 10,
      rulesVersion:
        "cuc-lel-0-10-v1.1",
      eligibilityResult: "eligible",
      scoreBreakdown: {},
      blockers: [],
      rationale: "Ready.",
      evidenceIds: records.map(
        (item) => item.id,
      ),
      assessedAt:
        "2026-08-13T11:00:00.000Z",
    },
    companyEnrichment: {
      status: "auto_verified",
      discoveredCompanyNumber:
        "12345678",
      sourceUrl: null,
      candidates: [],
      lastErrorCode: null,
      attemptCount: 1,
      lastAttemptAt:
        "2026-08-13T10:00:00.000Z",
      completedAt:
        "2026-08-13T10:05:00.000Z",
      qualificationState:
        "ready_for_outreach",
      qualificationReasons: [],
      researchSummary: {},
      researchCompletedAt:
        "2026-08-13T10:05:00.000Z",
    },
  };
}

function draft(
  overrides:
    Partial<OutreachDraftRecord> = {},
): OutreachDraftRecord {
  return {
    id:
      "55555555-5555-4555-8555-555555555555",
    prospectId: PROSPECT_ID,
    contactId: CONTACT_ID,
    recipientEmail:
      "hello@example.com",
    subject:
      "Cleaning support for Example Offices",
    body: "Hello",
    templateId:
      "initial_outreach_v2_offices_coworking",
    previewSha256: "a".repeat(64),
    evidenceIds: [],
    status: "pending",
    outlookDraftId: null,
    outlookWebUrl: null,
    lastErrorCode: null,
    createdAt:
      "2026-08-13T12:00:00.000Z",
    updatedAt:
      "2026-08-13T12:00:00.000Z",
    ...overrides,
  };
}

function repository(capture: {
  prepared?: Parameters<
    OutreachRepository["prepareDraft"]
  >[0];
  failed?: string;
  existing?: OutreachDraftRecord;
}): OutreachRepository {
  return {
    async getLatestDraft() {
      return capture.existing ?? null;
    },
    async listActivities() {
      return [];
    },
    async prepareDraft(input) {
      capture.prepared = input;
      return capture.existing ?? draft({
        subject: input.subject,
        body: input.body,
        templateId:
          input.templateId,
        previewSha256:
          input.previewSha256,
        evidenceIds:
          input.evidenceIds,
      });
    },
    async markDrafted(
      _draftId,
      _founderId,
      outlookDraftId,
      outlookWebUrl,
    ) {
      return draft({
        status: "drafted",
        outlookDraftId,
        outlookWebUrl,
      });
    },
    async markDraftFailed(
      _draftId,
      errorCode,
    ) {
      capture.failed = errorCode;
    },
    async recordActivity() {
      throw new Error("not used");
    },
  };
}

function gateway(capture: {
  creates: number;
  fail?: boolean;
}): OutlookDraftGateway {
  return {
    async connectionStatus() {
      return {
        connected: true,
        mailboxEmail:
          "founder@outlook.com",
        connectedAt:
          "2026-08-13T12:00:00.000Z",
      };
    },
    async createAuthorizationUrl() {
      return "https://login.microsoftonline.com/authorize";
    },
    async completeAuthorization() {},
    async createOrRecoverDraft() {
      capture.creates += 1;
      if (capture.fail) {
        throw new Error("provider failed");
      }
      return {
        outlookDraftId: "graph-draft-1",
        outlookWebUrl:
          "https://outlook.live.com/mail/0/drafts/id/graph-draft-1",
      };
    },
  };
}

test(
  "preview uses the approved sender-neutral sector outreach copy",
  async () => {
    const current = prospect();
    const service = createOutreachService({
      leadReviewService: {
        async getProspect() {
          return current;
        },
      },
      repository: repository({}),
      gateway: gateway({ creates: 0 }),
    });

    const preview = await service
      .previewDraft(
        FOUNDER_ID,
        PROSPECT_ID,
        null,
      );

    assert.equal(
      preview.recipientEmail,
      "hello@example.com",
    );
    assert.equal(
      preview.sectorLabel,
      "Offices and coworking spaces",
    );
    assert.match(
      preview.body,
      /reaching out on behalf of Clean Up Central/,
    );
    assert.match(
      preview.body,
      /came across Example Offices while researching organisations in your sector/,
    );
    assert.match(
      preview.body,
      /scheduled workplace cleaning/,
    );
    assert.match(
      preview.body,
      /Would you be open to a short conversation\?/,
    );
    assert.doesNotMatch(
      preview.body,
      /Amirah|Founder, Clean Up Central/,
    );
    assert.match(
      preview.body,
      /Privacy Notice: https:\/\/cleanupcentral\.com\/privacy/,
    );
    assert.match(
      preview.body,
      /prefer not to hear from us/,
    );
    assert.ok(
      preview.evidence.some(
        (item) =>
          item.factName ===
            "premises_scale",
      ),
    );
    assert.match(
      preview.previewSha256,
      /^[0-9a-f]{64}$/,
    );
  },
);

test(
  "personal mailbox is rejected even when the contact record is marked verified",
  async () => {
    const service = createOutreachService({
      leadReviewService: {
        async getProspect() {
          return prospect(
            "amirah@example.com",
          );
        },
      },
      repository: repository({}),
      gateway: gateway({ creates: 0 }),
    });

    await assert.rejects(
      service.previewDraft(
        FOUNDER_ID,
        PROSPECT_ID,
        null,
      ),
      (error: unknown) =>
        error instanceof OutreachError &&
        error.failure ===
          "unsupported_contact",
    );
  },
);

test(
  "a generic-looking address is rejected unless its evidence is first-party",
  async () => {
    const current = prospect();
    const service = createOutreachService({
      leadReviewService: {
        async getProspect() {
          return {
            ...current,
            evidence: current.evidence.map(
              (item) =>
                item.fieldName ===
                  "public_email"
                  ? {
                      ...item,
                      sourceType:
                        "companies_house",
                    }
                  : item,
            ),
          };
        },
      },
      repository: repository({}),
      gateway: gateway({ creates: 0 }),
    });

    await assert.rejects(
      service.previewDraft(
        FOUNDER_ID,
        PROSPECT_ID,
        null,
      ),
      (error: unknown) =>
        error instanceof OutreachError &&
        error.failure ===
          "unsupported_contact",
    );
  },
);

test(
  "a malformed generic-looking address is rejected",
  async () => {
    const service = createOutreachService({
      leadReviewService: {
        async getProspect() {
          return prospect(
            "info@example.com@invalid.test",
          );
        },
      },
      repository: repository({}),
      gateway: gateway({ creates: 0 }),
    });

    await assert.rejects(
      service.previewDraft(
        FOUNDER_ID,
        PROSPECT_ID,
        null,
      ),
      (error: unknown) =>
        error instanceof OutreachError &&
        error.failure ===
          "unsupported_contact",
    );
  },
);

test(
  "one approved preview creates a draft but never records contacted",
  async () => {
    const capture: {
      prepared?: Parameters<
        OutreachRepository["prepareDraft"]
      >[0];
    } = {};
    const graph = { creates: 0 };
    const service = createOutreachService({
      leadReviewService: {
        async getProspect() {
          return prospect();
        },
      },
      repository: repository(capture),
      gateway: gateway(graph),
    });
    const preview = await service
      .previewDraft(
        FOUNDER_ID,
        PROSPECT_ID,
        CONTACT_ID,
      );
    const created = await service.createDraft(
      FOUNDER_ID,
      PROSPECT_ID,
      CONTACT_ID,
      preview.previewSha256,
    );

    assert.equal(graph.creates, 1);
    assert.equal(created.status, "drafted");
    assert.equal(
      capture.prepared?.templateId,
      "initial_outreach_v2_offices_coworking",
    );
  },
);

test(
  "stale preview is rejected before any Outlook operation",
  async () => {
    const graph = { creates: 0 };
    const service = createOutreachService({
      leadReviewService: {
        async getProspect() {
          return prospect();
        },
      },
      repository: repository({}),
      gateway: gateway(graph),
    });

    await assert.rejects(
      service.createDraft(
        FOUNDER_ID,
        PROSPECT_ID,
        CONTACT_ID,
        "0".repeat(64),
      ),
      (error: unknown) =>
        error instanceof OutreachError &&
        error.failure === "stale_preview",
    );
    assert.equal(graph.creates, 0);
  },
);

test(
  "an existing Graph-linked draft is idempotent",
  async () => {
    const graph = { creates: 0 };
    const existing = draft({
      status: "drafted",
      outlookDraftId: "graph-existing",
    });
    const capture = { existing };
    const service = createOutreachService({
      leadReviewService: {
        async getProspect() {
          return prospect();
        },
      },
      repository: repository(capture),
      gateway: gateway(graph),
    });
    const preview = await service
      .previewDraft(
        FOUNDER_ID,
        PROSPECT_ID,
        CONTACT_ID,
      );
    capture.existing = {
      ...existing,
      previewSha256:
        preview.previewSha256,
    };
    const result = await service.createDraft(
      FOUNDER_ID,
      PROSPECT_ID,
      CONTACT_ID,
      preview.previewSha256,
    );

    assert.equal(
      result.outlookDraftId,
      "graph-existing",
    );
    assert.equal(graph.creates, 0);
  },
);

test(
  "an earlier approved initial draft cannot be replaced by a changed preview",
  async () => {
    const graph = { creates: 0 };
    const service = createOutreachService({
      leadReviewService: {
        async getProspect() {
          return prospect();
        },
      },
      repository: repository({
        existing: draft({
          status: "drafted",
          outlookDraftId:
            "graph-existing",
        }),
      }),
      gateway: gateway(graph),
    });
    const preview = await service
      .previewDraft(
        FOUNDER_ID,
        PROSPECT_ID,
        CONTACT_ID,
      );

    await assert.rejects(
      service.createDraft(
        FOUNDER_ID,
        PROSPECT_ID,
        CONTACT_ID,
        preview.previewSha256,
      ),
      (error: unknown) =>
        error instanceof OutreachError &&
        error.failure ===
          "stale_preview",
    );
    assert.equal(graph.creates, 0);
  },
);

test(
  "provider failure is recorded without claiming an email was sent",
  async () => {
    const capture: { failed?: string } = {};
    const service = createOutreachService({
      leadReviewService: {
        async getProspect() {
          return prospect();
        },
      },
      repository: repository(capture),
      gateway: gateway({
        creates: 0,
        fail: true,
      }),
    });
    const preview = await service
      .previewDraft(
        FOUNDER_ID,
        PROSPECT_ID,
        CONTACT_ID,
      );

    await assert.rejects(
      service.createDraft(
        FOUNDER_ID,
        PROSPECT_ID,
        CONTACT_ID,
        preview.previewSha256,
      ),
      (error: unknown) =>
        error instanceof OutreachError &&
        error.failure ===
          "provider_unavailable",
    );
    assert.equal(
      capture.failed,
      "outlook_provider_failure",
    );
  },
);
