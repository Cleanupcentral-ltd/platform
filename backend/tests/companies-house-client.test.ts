import assert from "node:assert/strict";
import test from "node:test";

import {
  CompaniesHouseClient,
} from "../src/adapters/companies-house/companies-house-client.js";

import {
  CompaniesHouseProviderError,
} from "../src/ports/companies-house.js";

test(
  "Companies House search uses server-side Basic authentication and returns bounded official candidates",
  async () => {
    let requestUrl = "";
    let requestInit:
      RequestInit | undefined;
    const client = new CompaniesHouseClient({
      apiKey: "private-api-key",
      apiBaseUrl:
        "https://api.company-information.service.gov.uk",
      timeoutMs: 1_000,
      fetchFunction:
        (async (input, init) => {
          requestUrl = String(input);
          requestInit = init;
          return Response.json({
            items: [{
              title:
                "<b>Example</b>  Company Ltd",
              company_number:
                " 01234567 ",
              company_status:
                "active",
              company_type: "ltd",
              date_of_creation:
                "2020-01-02",
              address: {
                premises: "1",
                address_line_1:
                  "High Street",
                locality: "Bromley",
                postal_code:
                  "BR1 1AA",
              },
            }],
          });
        }) as typeof fetch,
    });

    const matches = await client.search(
      "Example Company",
      5,
    );

    assert.match(
      requestUrl,
      /\/search\/companies\?q=Example%20Company&items_per_page=5$/,
    );
    const headers = new Headers(
      requestInit?.headers,
    );
    assert.equal(
      headers.get("authorization"),
      `Basic ${Buffer.from("private-api-key:").toString("base64")}`,
    );
    assert.deepEqual(matches, [{
      companyName:
        "Example Company Ltd",
      companyNumber: "01234567",
      companyStatus: "active",
      companyType: "ltd",
      registeredOfficeAddress: {
        formatted:
          "1, High Street, Bromley, BR1 1AA",
        postcode: "BR1 1AA",
      },
      dateOfCreation: "2020-01-02",
      officialUrl:
        "https://find-and-update.company-information.service.gov.uk/company/01234567",
    }]);
  },
);

test(
  "Companies House profile returns only validated official fields",
  async () => {
    const client = new CompaniesHouseClient({
      apiKey: "private-api-key",
      apiBaseUrl:
        "https://api.company-information.service.gov.uk/",
      timeoutMs: 1_000,
      fetchFunction:
        (async () => Response.json({
          company_name:
            "EXAMPLE COMPANY LTD",
          company_number: "01234567",
          company_status: "active",
          type: "ltd",
          registered_office_address: {
            address_line_1:
              "1 High Street",
            postal_code: "BR1 1AA",
          },
          sic_codes: ["81210"],
        })) as typeof fetch,
    });

    const profile =
      await client.getProfile(
        " 01234567 ",
      );

    assert.equal(
      profile.companyName,
      "EXAMPLE COMPANY LTD",
    );
    assert.deepEqual(
      profile.sicCodes,
      ["81210"],
    );
    assert.equal(
      profile.registeredOfficeAddress
        .formatted,
      "1 High Street, BR1 1AA",
    );
  },
);

test(
  "Companies House rate limits are reported without exposing the API key",
  async () => {
    const client = new CompaniesHouseClient({
      apiKey: "private-api-key",
      apiBaseUrl:
        "https://api.company-information.service.gov.uk",
      timeoutMs: 1_000,
      fetchFunction:
        (async () => new Response(
          "rate limited",
          { status: 429 },
        )) as typeof fetch,
    });

    await assert.rejects(
      client.search("Example", 5),
      (error: unknown) =>
        error instanceof
          CompaniesHouseProviderError &&
        error.failure === "rate_limited" &&
        !error.message.includes(
          "private-api-key",
        ),
    );
  },
);
