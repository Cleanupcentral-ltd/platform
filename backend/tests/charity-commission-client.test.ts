import assert from "node:assert/strict";
import test from "node:test";

import {
  CharityCommissionClient,
} from "../src/adapters/charity-commission/charity-commission-client.js";

test(
  "uses the exact registered-number operation and subscription-key header",
  async () => {
    let requestedUrl = "";
    let requestedKey = "";

    const client =
      new CharityCommissionClient({
        apiKey: "private-test-key",
        apiBaseUrl:
          "https://api.charitycommission.gov.uk/register",
        timeoutMs: 1_000,
        fetchFunction:
          (async (input, init) => {
            requestedUrl =
              String(input);
            const headers =
              new Headers(init?.headers);
            requestedKey =
              headers.get(
                "Ocp-Apim-Subscription-Key",
              ) ?? "";

            return Response.json([
              {
                organisation_number:
                  1234567,
                reg_charity_number:
                  1133537,
                group_subsid_suffix: 0,
                charity_name:
                  "M.A. CENTRE UK",
                reg_status:
                  "Registered",
                date_of_registration:
                  "2010-01-01",
                date_of_removal: "",
              },
            ]);
          }) as typeof fetch,
      });

    const charity =
      await client.getByRegisteredNumber(
        "1133537",
      );

    assert.equal(
      requestedUrl,
      "https://api.charitycommission.gov.uk/register/charityRegNumber/1133537/0",
    );
    assert.equal(
      requestedKey,
      "private-test-key",
    );
    assert.equal(
      charity.charityName,
      "M.A. CENTRE UK",
    );
    assert.equal(
      charity.registrationStatus,
      "Registered",
    );
  },
);
