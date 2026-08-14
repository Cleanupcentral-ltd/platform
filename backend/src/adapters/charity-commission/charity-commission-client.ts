import { z } from "zod";

import {
  CharityCommissionProviderError,
  type CharityCommissionCharity,
  type CharityCommissionProvider,
} from "../../ports/charity-commission.js";

type FetchFunction = typeof fetch;

const charitySchema = z.object({
  organisation_number:
    z.number().int().nonnegative(),
  reg_charity_number:
    z.number().int().positive(),
  group_subsid_suffix:
    z.number().int().nonnegative(),
  charity_name:
    z.string().min(1),
  reg_status:
    z.string().min(1),
  date_of_registration:
    z.string().nullable().optional(),
  date_of_removal:
    z.string().nullable().optional(),
});

const responseSchema =
  z.union([
    charitySchema,
    z.array(charitySchema),
  ]);

export interface CharityCommissionClientOptions {
  readonly apiKey: string;
  readonly apiBaseUrl: string;
  readonly timeoutMs: number;
  readonly fetchFunction?: FetchFunction;
  readonly subscriptionKeyHeaderName?:
    string;
}

function charityNumber(
  value: string,
): string {
  return value.replace(/\s+/g, "");
}

function cleanText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

export class CharityCommissionClient
implements CharityCommissionProvider {
  private readonly apiBaseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly fetchFunction:
    FetchFunction;
  private readonly subscriptionKeyHeaderName:
    string;

  constructor(
    options:
      CharityCommissionClientOptions,
  ) {
    const base = new URL(
      options.apiBaseUrl,
    );
    if (
      base.protocol !== "https:" ||
      !(
        base.hostname ===
          "charitycommission.gov.uk" ||
        base.hostname.endsWith(
          ".charitycommission.gov.uk",
        )
      )
    ) {
      throw new Error(
        "Charity Commission API base URL must use an official charitycommission.gov.uk HTTPS host.",
      );
    }

    this.apiBaseUrl =
      options.apiBaseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs;
    this.fetchFunction =
      options.fetchFunction ?? fetch;
    this.subscriptionKeyHeaderName =
      options.subscriptionKeyHeaderName ??
      "Ocp-Apim-Subscription-Key";
  }

  async getByRegisteredNumber(
    rawRegisteredNumber: string,
    suffix = 0,
  ): Promise<CharityCommissionCharity> {
    const registeredNumber =
      charityNumber(
        rawRegisteredNumber,
      );
    if (
      !/^\d{6,7}$/.test(
        registeredNumber,
      ) ||
      !Number.isInteger(suffix) ||
      suffix < 0
    ) {
      throw new CharityCommissionProviderError(
        "not_found",
      );
    }

    const requestUrl =
      `${this.apiBaseUrl}/charityRegNumber/` +
      `${encodeURIComponent(
        registeredNumber,
      )}/${suffix}`;

    const controller =
      new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.timeoutMs,
    );

    try {
      const response =
        await this.fetchFunction(
          requestUrl,
          {
            method: "GET",
            headers: {
              accept: "application/json",
              [this
                .subscriptionKeyHeaderName]:
                this.apiKey,
            },
            signal: controller.signal,
          },
        );

      if (response.status === 404) {
        throw new CharityCommissionProviderError(
          "not_found",
        );
      }
      if (response.status === 429) {
        throw new CharityCommissionProviderError(
          "rate_limited",
        );
      }
      if (!response.ok) {
        throw new CharityCommissionProviderError(
          "unavailable",
        );
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new CharityCommissionProviderError(
          "invalid_response",
        );
      }

      const parsed =
        responseSchema.safeParse(body);
      if (!parsed.success) {
        throw new CharityCommissionProviderError(
          "invalid_response",
        );
      }

      const items =
        Array.isArray(parsed.data)
          ? parsed.data
          : [parsed.data];
      const exact =
        items.filter(
          (item) =>
            String(
              item.reg_charity_number,
            ) === registeredNumber &&
            item.group_subsid_suffix ===
              suffix,
        );

      if (exact.length !== 1) {
        throw new CharityCommissionProviderError(
          exact.length === 0
            ? "not_found"
            : "invalid_response",
        );
      }

      const item = exact[0]!;
      return {
        organisationNumber:
          item.organisation_number,
        registeredCharityNumber:
          String(
            item.reg_charity_number,
          ),
        groupSubsidSuffix:
          item.group_subsid_suffix,
        charityName:
          cleanText(item.charity_name),
        registrationStatus:
          cleanText(item.reg_status),
        dateOfRegistration:
          item.date_of_registration ??
          null,
        dateOfRemoval:
          item.date_of_removal ??
          null,
        officialUrl: requestUrl,
      };
    } catch (error) {
      if (
        error instanceof
          CharityCommissionProviderError
      ) {
        throw error;
      }
      throw new CharityCommissionProviderError(
        "unavailable",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
