import assert from "node:assert/strict";
import test from "node:test";

import {
  createAutomaticQualificationService,
} from "../src/application/qualify-leads.js";

import type {
  AutomaticQualificationRepository,
  AutomaticResearchFact,
  CompleteAutomaticQualificationInput,
  FirstPartyResearchResult,
} from "../src/ports/automatic-qualification.js";

const PROSPECT_ID =
  "11111111-1111-4111-8111-111111111111";
const FOUNDER_ID =
  "22222222-2222-4222-8222-222222222222";

function identityFact(): AutomaticResearchFact {
  return {
    sourceUrl:
      "https://example.ac.uk/accommodation",
    factName: "business_name",
    factValue: "Example University Halls",
    sourceExcerpt:
      "Example University Halls student accommodation.",
    contentSha256: "a".repeat(64),
    contactType: null,
    normalizedContactValue: null,
  };
}

function emailFact(
  value = "accommodation@example.ac.uk",
): AutomaticResearchFact {
  return {
    sourceUrl:
      "https://example.ac.uk/contact",
    factName: "public_email",
    factValue: value,
    sourceExcerpt:
      `Accommodation enquiries: ${value}`,
    contentSha256: "b".repeat(64),
    contactType: "email",
    normalizedContactValue: value,
  };
}

function phoneFact(): AutomaticResearchFact {
  return {
    sourceUrl:
      "https://example.ac.uk/contact",
    factName: "public_phone",
    factValue: "020 8464 5566",
    sourceExcerpt:
      "Call 020 8464 5566",
    contentSha256: "c".repeat(64),
    contactType: "phone",
    normalizedContactValue: "02084645566",
  };
}

function research(
  contactFacts: readonly AutomaticResearchFact[] = [],
): FirstPartyResearchResult {
  return {
    canonicalWebsiteUrl:
      "https://example.ac.uk/accommodation",
    companyNumberAssertions: [],
    legalOperatorAssertions: [],
    charityNumberAssertions: [],
    facts: [
      identityFact(),
      ...contactFacts,
    ],
    visitedUrls: [
      "https://example.ac.uk/accommodation",
    ],
    truncatedPageCount: 0,
    organisationType: "university",
    reviewReasons:
      contactFacts.length === 0
        ? ["no_generic_business_contact_found"]
        : [],
  };
}

function repository(
  recorded: AutomaticResearchFact[][],
  completed: {
    value?: CompleteAutomaticQualificationInput;
  },
  onRecord?: (
    facts: readonly AutomaticResearchFact[],
  ) => void,
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
          "https://example.ac.uk/accommodation",
        companyNumber: null,
        attemptCount: 1,
      }];
    },
    async recordResearch(
      _prospectId,
      _actorId,
      _attemptCount,
      facts,
    ) {
      onRecord?.(facts);
      recorded.push([...facts]);
      return facts.map((_, index) =>
        `44444444-4444-4444-8444-${String(index).padStart(12, "0")}`,
      );
    },
    async completeQualification(input) {
      completed.value = input;
    },
    async retry() {},
  };
}

function leadReviewService() {
  return {
    async assess() {
      return {
        id:
          "33333333-3333-4333-8333-333333333333",
        totalScore: 6,
        rulesVersion: "test",
        eligibilityResult:
          "research_required" as const,
        scoreBreakdown: {},
        blockers: [
          "score_below_ready_threshold",
        ],
        rationale: "test",
        evidenceIds: [],
        assessedAt:
          "2026-08-15T00:00:00.000Z",
      };
    },
    async getProspect() {
      return {
        id: PROSPECT_ID,
        businessName:
          "Example University Halls",
        sector:
          "university_accommodation" as const,
        primaryPostcode: null,
        websiteUrl:
          "https://example.ac.uk/accommodation",
        companyNumber: null,
        createdAt:
          "2026-08-15T00:00:00.000Z",
        hasSearchProvenance: true,
        hasActiveSuppression: false,
        evidence: [],
        contacts: [],
        latestAssessment: null,
      };
    },
  };
}

function companiesHouseService() {
  return {
    async search() {
      return [];
    },
    async verify() {
      throw new Error("not used");
    },
    async verifyAutomatically() {
      throw new Error("not used");
    },
  };
}

test(
  "runs one targeted recovery pass when identity is confirmed but no contact route was found",
  async () => {
    const recorded: AutomaticResearchFact[][] = [];
    const completed: {
      value?: CompleteAutomaticQualificationInput;
    } = {};
    let recoveryCalls = 0;

    const service = createAutomaticQualificationService({
      repository:
        repository(recorded, completed),
      firstPartyProvider: {
        async research() {
          return research();
        },
      },
      contactRecoveryProvider: {
        async recover() {
          recoveryCalls += 1;
          return {
            facts: [emailFact()],
            visitedUrls: [
              "https://example.ac.uk/contact",
            ],
            truncatedPageCount: 0,
          };
        },
      },
      companiesHouseService:
        companiesHouseService(),
      leadReviewService:
        leadReviewService(),
      batchSize: 1,
      leaseSeconds: 180,
      activationTotalLimit: 1,
    });

    await service.runBatch();

    assert.equal(recoveryCalls, 1);
    assert.equal(recorded.length, 2);
    assert.deepEqual(
      recorded[1]?.map((fact) =>
        fact.factName),
      ["public_email"],
    );
    assert.equal(
      completed.value?.reasons.includes(
        "no_generic_business_contact_found",
      ),
      false,
    );
    assert.deepEqual(
      completed.value?.researchSummary
        .contactRecovery,
      {
        attempted: true,
        status: "recovered",
        visitedUrls: [
          "https://example.ac.uk/contact",
        ],
        truncatedPageCount: 0,
        recoveredFactCount: 1,
      },
    );
  },
);

test(
  "completes a missing email when ordinary research already found a phone",
  async () => {
    const recorded: AutomaticResearchFact[][] = [];
    const completed: {
      value?: CompleteAutomaticQualificationInput;
    } = {};
    let recoveryCalls = 0;

    const service = createAutomaticQualificationService({
      repository:
        repository(recorded, completed),
      firstPartyProvider: {
        async research() {
          return research([phoneFact()]);
        },
      },
      contactRecoveryProvider: {
        async recover() {
          recoveryCalls += 1;
          return {
            facts: [
              phoneFact(),
              emailFact(),
            ],
            visitedUrls: [
              "https://example.ac.uk/contact",
            ],
            truncatedPageCount: 0,
          };
        },
      },
      companiesHouseService:
        companiesHouseService(),
      leadReviewService:
        leadReviewService(),
      batchSize: 1,
      leaseSeconds: 180,
      activationTotalLimit: 1,
    });

    await service.runBatch();

    assert.equal(recoveryCalls, 1);
    assert.equal(recorded.length, 2);
    assert.deepEqual(
      recorded[1]?.map((fact) => fact.contactType),
      ["email"],
    );
  },
);

test(
  "does not run contact completion when ordinary research already found both email and phone",
  async () => {
    const recorded: AutomaticResearchFact[][] = [];
    const completed: {
      value?: CompleteAutomaticQualificationInput;
    } = {};
    let recoveryCalls = 0;

    const service = createAutomaticQualificationService({
      repository:
        repository(recorded, completed),
      firstPartyProvider: {
        async research() {
          return research([
            phoneFact(),
            emailFact(),
          ]);
        },
      },
      contactRecoveryProvider: {
        async recover() {
          recoveryCalls += 1;
          return {
            facts: [],
            visitedUrls: [],
            truncatedPageCount: 0,
          };
        },
      },
      companiesHouseService:
        companiesHouseService(),
      leadReviewService:
        leadReviewService(),
      batchSize: 1,
      leaseSeconds: 180,
      activationTotalLimit: 1,
    });

    await service.runBatch();

    assert.equal(recoveryCalls, 0);
    assert.equal(recorded.length, 1);
    assert.deepEqual(
      completed.value?.researchSummary
        .contactRecovery,
      {
        attempted: false,
        status: "not_needed",
        visitedUrls: [],
        truncatedPageCount: 0,
        recoveredFactCount: 0,
      },
    );
  },
);

test(
  "persists recovered contacts independently so one rejected fact cannot discard another valid route",
  async () => {
    const recorded: AutomaticResearchFact[][] = [];
    const completed: {
      value?: CompleteAutomaticQualificationInput;
    } = {};
    const storedTypes: string[] = [];
    let initialWrite = true;

    const qualificationRepository = repository(
      recorded,
      completed,
      (facts) => {
        if (initialWrite) {
          initialWrite = false;
          return;
        }
        if (facts[0]?.contactType === "email") {
          throw new Error("email rejected");
        }
        if (facts[0]?.contactType !== null) {
          storedTypes.push(facts[0]!.contactType!);
        }
      },
    );

    const service = createAutomaticQualificationService({
      repository: qualificationRepository,
      firstPartyProvider: {
        async research() {
          return research();
        },
      },
      contactRecoveryProvider: {
        async recover() {
          return {
            facts: [
              emailFact(),
              phoneFact(),
            ],
            visitedUrls: [
              "https://example.ac.uk/contact",
            ],
            truncatedPageCount: 0,
          };
        },
      },
      companiesHouseService:
        companiesHouseService(),
      leadReviewService:
        leadReviewService(),
      batchSize: 1,
      leaseSeconds: 180,
      activationTotalLimit: 1,
    });

    await service.runBatch();

    assert.deepEqual(storedTypes, ["phone"]);
    assert.deepEqual(
      completed.value?.researchSummary
        .contactRecovery,
      {
        attempted: true,
        status: "recovered",
        visitedUrls: [
          "https://example.ac.uk/contact",
        ],
        truncatedPageCount: 0,
        recoveredFactCount: 1,
      },
    );
  },
);

test(
  "removes generic discovery descriptors from the first-party identity query without reducing it to one word",
  async () => {
    const recorded: AutomaticResearchFact[][] = [];
    const completed: {
      value?: CompleteAutomaticQualificationInput;
    } = {};
    let identityQuery = "";

    const qualificationRepository = {
      ...repository(recorded, completed),
      async claimQualificationJobs() {
        return [{
          prospectId: PROSPECT_ID,
          actorId: FOUNDER_ID,
          businessName: "Community House Halls",
          sector:
            "community_halls_event_venues" as const,
          websiteUrl:
            "https://community.example/",
          companyNumber: null,
          attemptCount: 1,
        }];
      },
    };

    const service = createAutomaticQualificationService({
      repository: qualificationRepository,
      firstPartyProvider: {
        async research(_url, businessName) {
          identityQuery = businessName;
          return research();
        },
      },
      companiesHouseService:
        companiesHouseService(),
      leadReviewService:
        leadReviewService(),
      batchSize: 1,
      leaseSeconds: 180,
      activationTotalLimit: 1,
    });

    await service.runBatch();

    assert.equal(identityQuery, "Community House");
  },
);
