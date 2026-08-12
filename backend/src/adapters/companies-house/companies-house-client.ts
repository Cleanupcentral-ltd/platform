import { z } from "zod";

import {
  CompaniesHouseProviderError,
  type CompaniesHouseAddress,
  type CompaniesHouseCompanyProfile,
  type CompaniesHouseCompanySummary,
  type CompaniesHouseProvider,
} from "../../ports/companies-house.js";

type FetchFunction = typeof fetch;

const addressSchema = z.object({
  premises: z.string().optional(),
  address_line_1: z.string().optional(),
  address_line_2: z.string().optional(),
  locality: z.string().optional(),
  region: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
});

const searchResponseSchema = z.object({
  items: z.array(z.object({
    title: z.string(),
    company_number: z.string(),
    company_status: z.string().optional(),
    company_type: z.string().optional(),
    address: addressSchema.optional(),
    date_of_creation: z.string().optional(),
  })).default([]),
});

const profileResponseSchema = z.object({
  company_name: z.string(),
  company_number: z.string(),
  company_status: z.string(),
  type: z.string(),
  registered_office_address:
    addressSchema.optional(),
  date_of_creation: z.string().optional(),
  sic_codes: z.array(z.string()).default([]),
});

export interface CompaniesHouseClientOptions {
  readonly apiKey: string;
  readonly apiBaseUrl: string;
  readonly timeoutMs: number;
  readonly fetchFunction?: FetchFunction;
}

function cleanText(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function address(
  value:
    z.infer<typeof addressSchema> |
    undefined,
): CompaniesHouseAddress {
  if (value === undefined) {
    return {
      formatted: null,
      postcode: null,
    };
  }

  const parts = [
    value.premises,
    value.address_line_1,
    value.address_line_2,
    value.locality,
    value.region,
    value.postal_code,
    value.country,
  ]
    .map((item) => item?.trim())
    .filter(
      (item): item is string =>
        item !== undefined &&
        item.length > 0,
    );

  return {
    formatted:
      parts.length === 0
        ? null
        : [...new Set(parts)].join(", "),
    postcode:
      value.postal_code?.trim() || null,
  };
}

function officialUrl(
  companyNumber: string,
): string {
  return `https://find-and-update.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}`;
}

function companyNumber(
  value: string,
): string {
  return value
    .replace(/\s+/g, "")
    .toUpperCase();
}

export class CompaniesHouseClient
implements CompaniesHouseProvider {
  private readonly apiBaseUrl: string;
  private readonly authorization: string;
  private readonly timeoutMs: number;
  private readonly fetchFunction: FetchFunction;

  constructor(
    options: CompaniesHouseClientOptions,
  ) {
    this.apiBaseUrl =
      options.apiBaseUrl.replace(/\/$/, "");
    this.authorization =
      `Basic ${Buffer.from(`${options.apiKey}:`).toString("base64")}`;
    this.timeoutMs = options.timeoutMs;
    this.fetchFunction =
      options.fetchFunction ?? fetch;
  }

  private async request(
    path: string,
  ): Promise<unknown> {
    const controller =
      new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.timeoutMs,
    );

    try {
      const response =
        await this.fetchFunction(
          `${this.apiBaseUrl}${path}`,
          {
            headers: {
              accept: "application/json",
              authorization:
                this.authorization,
            },
            signal: controller.signal,
          },
        );

      if (response.status === 404) {
        throw new CompaniesHouseProviderError(
          "not_found",
        );
      }
      if (response.status === 429) {
        throw new CompaniesHouseProviderError(
          "rate_limited",
        );
      }
      if (!response.ok) {
        throw new CompaniesHouseProviderError(
          "unavailable",
        );
      }

      try {
        return await response.json();
      } catch {
        throw new CompaniesHouseProviderError(
          "invalid_response",
        );
      }
    } catch (error) {
      if (
        error instanceof
          CompaniesHouseProviderError
      ) {
        throw error;
      }
      throw new CompaniesHouseProviderError(
        "unavailable",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async search(
    query: string,
    limit: number,
  ): Promise<
    readonly CompaniesHouseCompanySummary[]
  > {
    const parsed =
      searchResponseSchema.safeParse(
        await this.request(
          `/search/companies?q=${encodeURIComponent(query)}&items_per_page=${limit}`,
        ),
      );
    if (!parsed.success) {
      throw new CompaniesHouseProviderError(
        "invalid_response",
      );
    }

    return parsed.data.items
      .slice(0, limit)
      .map((item) => {
        const number = companyNumber(
          item.company_number,
        );
        return {
          companyName:
            cleanText(item.title),
          companyNumber: number,
          companyStatus:
            item.company_status ??
            "unknown",
          companyType:
            item.company_type ??
            "unknown",
          registeredOfficeAddress:
            address(item.address),
          dateOfCreation:
            item.date_of_creation ?? null,
          officialUrl:
            officialUrl(number),
        };
      });
  }

  async getProfile(
    rawCompanyNumber: string,
  ): Promise<CompaniesHouseCompanyProfile> {
    const number = companyNumber(
      rawCompanyNumber,
    );
    const parsed =
      profileResponseSchema.safeParse(
        await this.request(
          `/company/${encodeURIComponent(number)}`,
        ),
      );
    if (!parsed.success) {
      throw new CompaniesHouseProviderError(
        "invalid_response",
      );
    }

    const returnedNumber = companyNumber(
      parsed.data.company_number,
    );
    return {
      companyName:
        cleanText(parsed.data.company_name),
      companyNumber: returnedNumber,
      companyStatus:
        parsed.data.company_status,
      companyType: parsed.data.type,
      registeredOfficeAddress:
        address(
          parsed.data
            .registered_office_address,
        ),
      dateOfCreation:
        parsed.data.date_of_creation ?? null,
      officialUrl:
        officialUrl(returnedNumber),
      sicCodes: parsed.data.sic_codes,
    };
  }
}
