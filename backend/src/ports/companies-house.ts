export interface CompaniesHouseAddress {
  readonly formatted: string | null;
  readonly postcode: string | null;
}

export interface CompaniesHouseCompanySummary {
  readonly companyName: string;
  readonly companyNumber: string;
  readonly companyStatus: string;
  readonly companyType: string;
  readonly registeredOfficeAddress:
    CompaniesHouseAddress;
  readonly dateOfCreation: string | null;
  readonly officialUrl: string;
}

export interface CompaniesHouseCompanyProfile
extends CompaniesHouseCompanySummary {
  readonly sicCodes: readonly string[];
}

export type CompaniesHouseFailure =
  | "not_found"
  | "rate_limited"
  | "unavailable"
  | "invalid_response";

export class CompaniesHouseProviderError
extends Error {
  readonly failure: CompaniesHouseFailure;

  constructor(failure: CompaniesHouseFailure) {
    super(failure);
    this.name =
      "CompaniesHouseProviderError";
    this.failure = failure;
  }
}

export interface CompaniesHouseProvider {
  search(
    query: string,
    limit: number,
  ): Promise<
    readonly CompaniesHouseCompanySummary[]
  >;

  getProfile(
    companyNumber: string,
  ): Promise<CompaniesHouseCompanyProfile>;
}
