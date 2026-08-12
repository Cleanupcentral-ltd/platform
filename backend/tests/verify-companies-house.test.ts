import assert from "node:assert/strict";
import test from "node:test";

import {
  createCompaniesHouseVerificationService,
  CompaniesHouseVerificationError,
} from "../src/application/verify-companies-house.js";

import type {
  CompaniesHouseProvider,
} from "../src/ports/companies-house.js";

import type {
  LeadReviewRepository,
  RecordCompaniesHouseVerificationInput,
} from "../src/ports/lead-review.js";

const PROSPECT_ID =
  "11111111-1111-4111-8111-111111111111";
const FOUNDER_ID =
  "22222222-2222-4222-8222-222222222222";

function provider(
  companyType = "ltd",
): CompaniesHouseProvider {
  return {
    async search() {
      return [{
        companyName:
          "EXAMPLE COMPANY LTD",
        companyNumber: "01234567",
        companyStatus: "active",
        companyType,
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
    async getProfile() {
      return {
        companyName:
          "EXAMPLE COMPANY LTD",
        companyNumber: "01234567",
        companyStatus: "active",
        companyType,
        registeredOfficeAddress: {
          formatted:
            "1 High Street, BR1 1AA",
          postcode: "BR1 1AA",
        },
        dateOfCreation:
          "2020-01-01",
        officialUrl:
          "https://find-and-update.company-information.service.gov.uk/company/01234567",
        sicCodes: ["81210"],
      };
    },
  };
}

function repository(
  capture: {
    verification?:
      RecordCompaniesHouseVerificationInput;
    duplicate?: {
      readonly id: string;
      readonly businessName: string;
    } | null;
  },
): LeadReviewRepository {
  return {
    async listProspects() {
      return [];
    },
    async getProspect() {
      return null;
    },
    async addVerifiedEvidence() {
      throw new Error("not called");
    },
    async findProspectByCompanyNumber() {
      return capture.duplicate ?? null;
    },
    async recordCompaniesHouseVerification(input) {
      capture.verification = input;
      return [
        "33333333-3333-4333-8333-333333333333",
        "44444444-4444-4444-8444-444444444444",
        "55555555-5555-4555-8555-555555555555",
        "66666666-6666-4666-8666-666666666666",
      ];
    },
    async decideEvidence() {},
    async saveAssessment() {
      throw new Error("not called");
    },
  };
}

function reviewService() {
  return {
    async getProspect() {
      return {
        id: PROSPECT_ID,
        businessName:
          "Example Company",
        sector: "offices_coworking" as const,
        primaryPostcode: "BR1 1AA",
        websiteUrl: null,
        companyNumber: null,
        createdAt:
          "2026-08-12T08:00:00.000Z",
        hasSearchProvenance: true,
        hasActiveSuppression: false,
        evidence: [],
        contacts: [],
        latestAssessment: null,
      };
    },
    async assess() {
      return {
        id:
          "77777777-7777-4777-8777-777777777777",
        totalScore: 4,
        rulesVersion:
          "cuc-lel-0-10-v1",
        eligibilityResult:
          "research_required" as const,
        scoreBreakdown: {},
        blockers: [
          "unverified_approved_sector",
        ],
        rationale:
          "Research required.",
        evidenceIds: [],
        assessedAt:
          "2026-08-12T08:01:00.000Z",
      };
    },
  };
}

test(
  "founder-confirmed Companies House profile records four official facts atomically and rescales once",
  async () => {
    const capture: {
      verification?:
        RecordCompaniesHouseVerificationInput;
    } = {};
    const service =
      createCompaniesHouseVerificationService(
        repository(capture),
        reviewService(),
        provider(),
      );

    const result = await service.verify(
      FOUNDER_ID,
      PROSPECT_ID,
      " 01234567 ",
    );

    assert.equal(
      result.subscriberType,
      "corporate",
    );
    assert.equal(
      result.automaticAssessment.status,
      "updated",
    );
    assert.deepEqual(
      capture.verification?.facts.map(
        (fact) => [
          fact.factName,
          fact.factValue,
        ],
      ),
      [
        ["business_name", "EXAMPLE COMPANY LTD"],
        ["company_number", "01234567"],
        ["business_status", "active"],
        ["subscriber_type", "corporate"],
      ],
    );
    assert.ok(
      capture.verification?.facts.every(
        (fact) =>
          /^[0-9a-f]{64}$/.test(
            fact.contentSha256,
          ),
      ),
    );
  },
);

test(
  "unmapped Companies House types remain unknown instead of being guessed",
  async () => {
    const capture: {
      verification?:
        RecordCompaniesHouseVerificationInput;
    } = {};
    const service =
      createCompaniesHouseVerificationService(
        repository(capture),
        reviewService(),
        provider(
          "registered-overseas-entity",
        ),
      );

    const result = await service.verify(
      FOUNDER_ID,
      PROSPECT_ID,
      "01234567",
    );

    assert.equal(
      result.subscriberType,
      "unknown",
    );
    assert.equal(
      capture.verification?.facts.some(
        (fact) =>
          String(fact.factName) ===
            "approved_sector",
      ),
      false,
    );
  },
);

test(
  "a Companies House number already linked to another prospect is blocked before evidence capture",
  async () => {
    const capture = {
      duplicate: {
        id:
          "99999999-9999-4999-8999-999999999999",
        businessName:
          "Existing Prospect",
      },
    };
    const service =
      createCompaniesHouseVerificationService(
        repository(capture),
        reviewService(),
        provider(),
      );

    await assert.rejects(
      service.verify(
        FOUNDER_ID,
        PROSPECT_ID,
        "01234567",
      ),
      (error: unknown) =>
        error instanceof
          CompaniesHouseVerificationError &&
        error.failure ===
          "duplicate_company",
    );
  },
);
