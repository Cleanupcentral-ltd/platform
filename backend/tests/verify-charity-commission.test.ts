import assert from "node:assert/strict";
import test from "node:test";

import {
  createCharityCommissionVerificationService,
} from "../src/application/verify-charity-commission.js";

import type {
  RecordAutomaticCharityCommissionVerificationInput,
} from "../src/ports/lead-review.js";

const PROSPECT_ID =
  "11111111-1111-4111-8111-111111111111";
const FOUNDER_ID =
  "22222222-2222-4222-8222-222222222222";

test(
  "records exact first-party charity-number verification and active register status",
  async () => {
    let recorded:
      RecordAutomaticCharityCommissionVerificationInput |
      undefined;

    const service =
      createCharityCommissionVerificationService(
        {
          async recordAutomaticCharityCommissionVerification(
            input,
          ) {
            recorded = input;
            return [
              "33333333-3333-4333-8333-333333333333",
            ];
          },
        },
        {
          async getByRegisteredNumber(
            registeredNumber,
            suffix,
          ) {
            assert.equal(
              registeredNumber,
              "1133537",
            );
            assert.equal(suffix, 0);

            return {
              organisationNumber:
                1234567,
              registeredCharityNumber:
                "1133537",
              groupSubsidSuffix: 0,
              charityName:
                "M.A. CENTRE UK",
              registrationStatus:
                "Registered",
              dateOfRegistration:
                "2010-01-01",
              dateOfRemoval: null,
              officialUrl:
                "https://api.charitycommission.gov.uk/register/charityRegNumber/1133537/0",
            };
          },
        },
      );

    const result =
      await service.verifyAutomatically(
        FOUNDER_ID,
        PROSPECT_ID,
        1,
        {
          charityNumber:
            "1133537",
          sourceUrl:
            "https://www.bromleyvenuehire.co.uk/",
          sourceExcerpt:
            "M.A.Centre, UK Registered charity - 1133537",
          contentSha256:
            "a".repeat(64),
        },
      );

    assert.equal(
      result.businessStatus,
      "active",
    );
    assert.equal(
      result.charityName,
      "M.A. CENTRE UK",
    );
    assert.equal(
      recorded
        ?.firstPartyAssertion
        .charityNumber,
      "1133537",
    );
    assert.deepEqual(
      recorded?.facts.map(
        (fact) => [
          fact.factName,
          fact.factValue,
        ],
      ),
      [
        [
          "registered_charity_name",
          "M.A. CENTRE UK",
        ],
        [
          "charity_number",
          "1133537",
        ],
        [
          "business_status",
          "active",
        ],
      ],
    );
  },
);
