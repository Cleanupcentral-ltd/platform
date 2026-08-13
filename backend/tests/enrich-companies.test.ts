import assert from "node:assert/strict";
import test from "node:test";

import {
  createCompanyEnrichmentService,
} from "../src/application/enrich-companies.js";

import type {
  CompaniesHouseVerificationService,
} from "../src/application/verify-companies-house.js";

import type {
  CompanyEnrichmentRepository,
  CompleteCompanyEnrichmentInput,
  FirstPartyCompanyNumberProvider,
} from "../src/ports/company-enrichment.js";

const PROSPECT_ID =
  "11111111-1111-4111-8111-111111111111";
const ACTOR_ID =
  "22222222-2222-4222-8222-222222222222";

function repository(
  capture: {
    completion?: CompleteCompanyEnrichmentInput;
  },
): CompanyEnrichmentRepository {
  return {
    async claimJobs() {
      return [{
        prospectId: PROSPECT_ID,
        actorId: ACTOR_ID,
        businessName: "Example Company",
        websiteUrl: "https://example.com/",
        companyNumber: null,
        attemptCount: 1,
      }];
    },
    async complete(input) {
      capture.completion = input;
    },
    async retry() {},
  };
}

function match() {
  return {
    companyName: "EXAMPLE COMPANY LTD",
    companyNumber: "01234567",
    companyStatus: "active",
    companyType: "ltd",
    registeredOfficeAddress: {
      formatted: "1 High Street, BR1 1AA",
      postcode: "BR1 1AA",
    },
    dateOfCreation: "2020-01-01",
    officialUrl:
      "https://find-and-update.company-information.service.gov.uk/company/01234567",
  };
}

function companiesHouse(
  calls: { automatic: number },
): CompaniesHouseVerificationService {
  return {
    async search() {
      return [match()];
    },
    async verify() {
      throw new Error("manual verification not called");
    },
    async verifyAutomatically() {
      calls.automatic += 1;
      return {
        companyName: "EXAMPLE COMPANY LTD",
        companyNumber: "01234567",
        businessStatus: "active",
        subscriberType: "corporate",
        evidenceIds: [],
        automaticAssessment: {
          status: "updated",
          assessment: null,
        },
      };
    },
  };
}

test(
  "automatically verifies only one labelled first-party company number",
  async () => {
    const capture: {
      completion?: CompleteCompanyEnrichmentInput;
    } = {};
    const calls = { automatic: 0 };
    const firstParty:
      FirstPartyCompanyNumberProvider = {
        async find() {
          return {
            companyNumbers: ["01234567"],
            sourceUrl:
              "https://example.com/privacy",
            sourceExcerpt:
              "Company number 01234567",
            contentSha256: "a".repeat(64),
          };
        },
      };
    const service =
      createCompanyEnrichmentService({
        repository: repository(capture),
        firstPartyProvider: firstParty,
        companiesHouseService:
          companiesHouse(calls),
        batchSize: 5,
        leaseSeconds: 180,
      });

    const result = await service.runBatch();

    assert.equal(calls.automatic, 1);
    assert.equal(capture.completion, undefined);
    assert.equal(result.autoVerifiedCount, 1);
  },
);

test(
  "name-search candidates remain founder review exceptions",
  async () => {
    const capture: {
      completion?: CompleteCompanyEnrichmentInput;
    } = {};
    const calls = { automatic: 0 };
    const firstParty:
      FirstPartyCompanyNumberProvider = {
        async find() {
          return null;
        },
      };
    const service =
      createCompanyEnrichmentService({
        repository: repository(capture),
        firstPartyProvider: firstParty,
        companiesHouseService:
          companiesHouse(calls),
        batchSize: 5,
        leaseSeconds: 180,
      });

    const result = await service.runBatch();

    assert.equal(calls.automatic, 0);
    assert.equal(
      capture.completion?.status,
      "review_required",
    );
    assert.equal(
      capture.completion?.candidates.length,
      1,
    );
    assert.equal(result.reviewRequiredCount, 1);
  },
);
