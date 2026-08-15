import assert from "node:assert/strict";
import test from "node:test";

import {
  createAutomaticQualificationService,
} from "../src/application/qualify-leads.js";

import type {
  AutomaticQualificationRepository,
  CompleteAutomaticQualificationInput,
  FirstPartyResearchResult,
} from "../src/ports/automatic-qualification.js";

import type {
  LeadAssessmentRecord,
  LeadProspectReview,
} from "../src/ports/lead-review.js";

const PROSPECT_ID =
  "11111111-1111-4111-8111-111111111111";
const FOUNDER_ID =
  "22222222-2222-4222-8222-222222222222";

const research: FirstPartyResearchResult = {
  canonicalWebsiteUrl:
    "https://example.ac.uk/accommodation",
  companyNumberAssertions: [],
  facts: [],
  visitedUrls: [
    "https://example.ac.uk/accommodation",
    "https://example.ac.uk/contact",
  ],
  truncatedPageCount: 0,
  organisationType: "university",
  reviewReasons: [],
};

function assessment(
  eligible: boolean,
  blockers: readonly string[],
): LeadAssessmentRecord {
  return {
    id:
      "33333333-3333-4333-8333-333333333333",
    totalScore: eligible ? 8 : 6,
    rulesVersion: "cuc-lel-0-10-v1.1",
    eligibilityResult:
      eligible ? "eligible" : "research_required",
    scoreBreakdown: {},
    blockers,
    rationale: "test",
    evidenceIds: [],
    assessedAt:
      "2026-08-13T12:00:00.000Z",
  };
}

function prospect(
  suppressed: boolean,
): LeadProspectReview {
  return {
    id: PROSPECT_ID,
    businessName: "Example University Halls",
    sector: "university_accommodation",
    primaryPostcode: "SE10 9ED",
    websiteUrl:
      "https://example.ac.uk/accommodation",
    companyNumber: null,
    createdAt:
      "2026-08-13T10:00:00.000Z",
    hasSearchProvenance: true,
    hasActiveSuppression: suppressed,
    evidence: [],
    contacts: [],
    latestAssessment: null,
  };
}

function repository(
  capture: {
    complete?:
      CompleteAutomaticQualificationInput;
  },
): AutomaticQualificationRepository {
  return {
    async activate() {
      return 1;
    },
    async claimQualificationJobs() {
      return [{
        prospectId: PROSPECT_ID,
        actorId: FOUNDER_ID,
        businessName:
          "Example University Halls",
        sector:
          "university_accommodation",
        websiteUrl:
          "http://example.ac.uk/accommodation",
        companyNumber: null,
        attemptCount: 1,
      }];
    },
    async recordResearch() {
      return [];
    },
    async completeQualification(input) {
      capture.complete = input;
    },
    async retry() {},
  };
}

test(
  "official institutional evidence can enter the ready queue without a Companies House match",
  async () => {
    const capture: {
      complete?:
        CompleteAutomaticQualificationInput;
    } = {};
    let companiesHouseSearches = 0;
    const service =
      createAutomaticQualificationService({
        repository: repository(capture),
        firstPartyProvider: {
          async research() {
            return research;
          },
        },
        companiesHouseService: {
          async search() {
            companiesHouseSearches += 1;
            return [];
          },
          async verify() {
            throw new Error("not used");
          },
          async verifyAutomatically() {
            throw new Error("not used");
          },
        },
        leadReviewService: {
          async assess() {
            return assessment(true, []);
          },
          async getProspect() {
            return prospect(false);
          },
        },
        batchSize: 5,
        leaseSeconds: 180,
        activationTotalLimit: 1,
      });

    const batch = await service.runBatch();

    assert.equal(companiesHouseSearches, 0);
    assert.equal(batch.autoVerifiedCount, 1);
    assert.equal(
      capture.complete?.queueState,
      "ready_for_outreach",
    );
    assert.deepEqual(
      capture.complete?.reasons,
      [],
    );
  },
);

test(
  "an active suppression always routes an otherwise qualified prospect to excluded",
  async () => {
    const capture: {
      complete?:
        CompleteAutomaticQualificationInput;
    } = {};
    const service =
      createAutomaticQualificationService({
        repository: repository(capture),
        firstPartyProvider: {
          async research() {
            return research;
          },
        },
        companiesHouseService: {
          async search() {
            return [];
          },
          async verify() {
            throw new Error("not used");
          },
          async verifyAutomatically() {
            throw new Error("not used");
          },
        },
        leadReviewService: {
          async assess() {
            return assessment(false, [
              "do_not_contact_or_objection",
            ]);
          },
          async getProspect() {
            return prospect(true);
          },
        },
        batchSize: 5,
        leaseSeconds: 180,
        activationTotalLimit: 1,
      });

    await service.runBatch();

    assert.equal(
      capture.complete?.queueState,
      "excluded",
    );
    assert.ok(
      capture.complete?.reasons.includes(
        "do_not_contact_or_objection",
      ),
    );
  },
);

test(
  "postcode cross-check records one active premises",
  async () => {
    const capture: {
      complete?:
        CompleteAutomaticQualificationInput;
    } = {};
    let premises:
      | {
          sourceUrl: string;
          sourceExcerpt: string;
          contentSha256: string;
        }
      | undefined;

    const qualificationRepository:
      AutomaticQualificationRepository = {
        ...repository(capture),
        async recordSinglePremises(
          _prospectId,
          _actorId,
          _attemptCount,
          sourceUrl,
          sourceExcerpt,
          contentSha256,
        ) {
          premises = {
            sourceUrl,
            sourceExcerpt,
            contentSha256,
          };
          return [
            "44444444-4444-4444-8444-444444444444",
          ];
        },
      };

    const service =
      createAutomaticQualificationService({
        repository: qualificationRepository,
        firstPartyProvider: {
          async research() {
            return {
              ...research,
              facts: [{
                sourceUrl:
                  "https://example.ac.uk/accommodation",
                factName: "business_name",
                factValue:
                  "Example University Halls",
                sourceExcerpt:
                  "Example University Halls, 1 College Road, London SE10 9ED.",
                contentSha256:
                  "a".repeat(64),
                contactType: null,
                normalizedContactValue: null,
              }],
            };
          },
        },
        companiesHouseService: {
          async search() {
            return [];
          },
          async verify() {
            throw new Error("not used");
          },
          async verifyAutomatically() {
            throw new Error("not used");
          },
        },
        leadReviewService: {
          async assess() {
            return assessment(
              false,
              ["score_below_ready_threshold"],
            );
          },
          async getProspect() {
            return prospect(false);
          },
        },
        batchSize: 5,
        leaseSeconds: 180,
        activationTotalLimit: 1,
      });

    await service.runBatch();

    assert.equal(
      premises?.sourceUrl,
      "https://example.ac.uk/accommodation",
    );
    assert.ok(
      premises?.sourceExcerpt.includes(
        "SE10 9ED",
      ),
    );
    assert.match(
      premises?.contentSha256 ?? "",
      /^[0-9a-f]{64}$/,
    );
    assert.equal(
      capture.complete?.researchSummary
        .verifiedFactCount,
      2,
    );
  },
);

test(
  "charity-number evidence uses the Charity Commission path without a Companies House name search",
  async () => {
    const capture: {
      complete?:
        CompleteAutomaticQualificationInput;
    } = {};
    let charityVerifications = 0;
    let companiesHouseSearches = 0;

    const charityResearch:
      FirstPartyResearchResult = {
        ...research,
        canonicalWebsiteUrl:
          "https://example.org/",
        visitedUrls: [
          "https://example.org/",
        ],
        organisationType: "charity",
        companyNumberAssertions: [{
          companyNumber: "06793389",
          sourceUrl:
            "https://example.org/",
          sourceExcerpt:
            "Registered in England No: 06793389",
          contentSha256:
            "c".repeat(64),
        }],
        charityNumberAssertions: [{
          charityNumber: "1133537",
          sourceUrl:
            "https://example.org/",
          sourceExcerpt:
            "Registered charity - 1133537",
          contentSha256:
            "b".repeat(64),
        }],
      };

    const service =
      createAutomaticQualificationService({
        repository:
          repository(capture),
        firstPartyProvider: {
          async research() {
            return charityResearch;
          },
        },
        charityCommissionService: {
          async verifyAutomatically() {
            charityVerifications += 1;
            return {
              charityName:
                "M.A. CENTRE UK",
              charityNumber:
                "1133537",
              businessStatus:
                "active",
              evidenceIds: [],
            };
          },
        },
        companiesHouseService: {
          async search() {
            companiesHouseSearches += 1;
            return [];
          },
          async verify() {
            throw new Error(
              "not used",
            );
          },
          async verifyAutomatically() {
            throw new Error(
              "not used",
            );
          },
        },
        leadReviewService: {
          async assess() {
            return assessment(
              false,
              [
                "unresolved_subscriber_type",
              ],
            );
          },
          async getProspect() {
            return prospect(false);
          },
        },
        batchSize: 5,
        leaseSeconds: 180,
        activationTotalLimit: null,
      });

    await service.runBatch();

    assert.equal(
      charityVerifications,
      1,
    );
    assert.equal(
      companiesHouseSearches,
      0,
    );
    assert.equal(
      capture.complete
        ?.enrichmentStatus,
      "auto_verified",
    );
    assert.ok(
      Array.isArray(
        capture.complete
          ?.researchSummary
          .charityNumbers,
      ),
    );
  },
);

test(
  "one exact Companies House name match auto-verifies after first-party identity is confirmed",
  async () => {
    const capture: {
      complete?:
        CompleteAutomaticQualificationInput;
    } = {};
    const commercialResearch:
      FirstPartyResearchResult = {
        canonicalWebsiteUrl:
          "https://examplecommercial.co.uk/",
        companyNumberAssertions: [],
        legalOperatorAssertions: [],
        charityNumberAssertions: [],
        facts: [{
          sourceUrl:
            "https://examplecommercial.co.uk/",
          factName: "business_name",
          factValue: "Example Commercial Ltd",
          sourceExcerpt:
            "Example Commercial Ltd provides commercial property services.",
          contentSha256:
            "d".repeat(64),
          contactType: null,
          normalizedContactValue: null,
        }],
        visitedUrls: [
          "https://examplecommercial.co.uk/",
        ],
        truncatedPageCount: 0,
        organisationType: "commercial",
        reviewReasons: [],
      };
    let automaticExactVerifications = 0;

    const qualificationRepository:
      AutomaticQualificationRepository = {
        ...repository(capture),
        async claimQualificationJobs() {
          return [{
            prospectId: PROSPECT_ID,
            actorId: FOUNDER_ID,
            businessName:
              "Example Commercial Ltd",
            sector:
              "other_commercial_spaces",
            websiteUrl:
              "https://examplecommercial.co.uk/",
            companyNumber: null,
            attemptCount: 1,
          }];
        },
      };

    const service =
      createAutomaticQualificationService({
        repository: qualificationRepository,
        firstPartyProvider: {
          async research() {
            return commercialResearch;
          },
        },
        companiesHouseService: {
          async search() {
            return [{
              companyName:
                "EXAMPLE COMMERCIAL LTD",
              companyNumber: "01234567",
              companyStatus: "active",
              companyType: "ltd",
              registeredOfficeAddress: {
                formatted: null,
                postcode: null,
              },
              dateOfCreation: null,
              officialUrl:
                "https://find-and-update.company-information.service.gov.uk/company/01234567",
            }, {
              companyName:
                "EXAMPLE COMMERCIAL HOLDINGS LTD",
              companyNumber: "07654321",
              companyStatus: "active",
              companyType: "ltd",
              registeredOfficeAddress: {
                formatted: null,
                postcode: null,
              },
              dateOfCreation: null,
              officialUrl:
                "https://find-and-update.company-information.service.gov.uk/company/07654321",
            }];
          },
          async verify() {
            throw new Error("not used");
          },
          async verifyAutomatically() {
            throw new Error("not used");
          },
          async verifyAutomaticallyByLegalOperator(
            _actorId,
            _prospectId,
            _attemptCount,
            assertion,
          ) {
            automaticExactVerifications += 1;
            assert.equal(
              assertion.operatorName,
              "Example Commercial Ltd",
            );
            return {
              companyName:
                "EXAMPLE COMMERCIAL LTD",
              companyNumber: "01234567",
              businessStatus: "active",
              subscriberType: "corporate",
              evidenceIds: [],
              automaticAssessment: {
                status: "updated",
                assessment: assessment(true, []),
              },
            };
          },
        },
        leadReviewService: {
          async assess() {
            return assessment(true, []);
          },
          async getProspect() {
            return prospect(false);
          },
        },
        batchSize: 5,
        leaseSeconds: 180,
        activationTotalLimit: null,
      });

    await service.runBatch();

    assert.equal(
      automaticExactVerifications,
      1,
    );
    assert.equal(
      capture.complete?.enrichmentStatus,
      "auto_verified",
    );
    assert.equal(
      capture.complete
        ?.discoveredCompanyNumber,
      "01234567",
    );
    assert.deepEqual(
      capture.complete?.candidates,
      [],
    );
    assert.deepEqual(
      capture.complete?.reasons,
      [],
    );
  },
);

test(
  "ambiguous Companies House name matches still require founder review",
  async () => {
    const capture: {
      complete?:
        CompleteAutomaticQualificationInput;
    } = {};
    const commercialResearch:
      FirstPartyResearchResult = {
        canonicalWebsiteUrl:
          "https://examplecommercial.co.uk/",
        companyNumberAssertions: [],
        legalOperatorAssertions: [],
        charityNumberAssertions: [],
        facts: [{
          sourceUrl:
            "https://examplecommercial.co.uk/",
          factName: "business_name",
          factValue: "Example Commercial Ltd",
          sourceExcerpt:
            "Example Commercial Ltd provides commercial property services.",
          contentSha256:
            "e".repeat(64),
          contactType: null,
          normalizedContactValue: null,
        }],
        visitedUrls: [
          "https://examplecommercial.co.uk/",
        ],
        truncatedPageCount: 0,
        organisationType: "commercial",
        reviewReasons: [],
      };
    let automaticExactVerifications = 0;

    const qualificationRepository:
      AutomaticQualificationRepository = {
        ...repository(capture),
        async claimQualificationJobs() {
          return [{
            prospectId: PROSPECT_ID,
            actorId: FOUNDER_ID,
            businessName:
              "Example Commercial Ltd",
            sector:
              "other_commercial_spaces",
            websiteUrl:
              "https://examplecommercial.co.uk/",
            companyNumber: null,
            attemptCount: 1,
          }];
        },
      };

    const exact = (companyNumber: string) => ({
      companyName: "EXAMPLE COMMERCIAL LTD",
      companyNumber,
      companyStatus: "active",
      companyType: "ltd",
      registeredOfficeAddress: {
        formatted: null,
        postcode: null,
      },
      dateOfCreation: null,
      officialUrl:
        `https://find-and-update.company-information.service.gov.uk/company/${companyNumber}`,
    });

    const service =
      createAutomaticQualificationService({
        repository: qualificationRepository,
        firstPartyProvider: {
          async research() {
            return commercialResearch;
          },
        },
        companiesHouseService: {
          async search() {
            return [
              exact("01234567"),
              exact("07654321"),
            ];
          },
          async verify() {
            throw new Error("not used");
          },
          async verifyAutomatically() {
            throw new Error("not used");
          },
          async verifyAutomaticallyByLegalOperator() {
            automaticExactVerifications += 1;
            throw new Error("must not auto-verify");
          },
        },
        leadReviewService: {
          async assess() {
            return assessment(false, [
              "unresolved_subscriber_type",
            ]);
          },
          async getProspect() {
            return prospect(false);
          },
        },
        batchSize: 5,
        leaseSeconds: 180,
        activationTotalLimit: null,
      });

    await service.runBatch();

    assert.equal(
      automaticExactVerifications,
      0,
    );
    assert.equal(
      capture.complete?.enrichmentStatus,
      "review_required",
    );
    assert.ok(
      capture.complete?.reasons.includes(
        "companies_house_match_requires_confirmation",
      ),
    );
  },
);
