export interface CharityCommissionCharity {
  readonly organisationNumber: number;
  readonly registeredCharityNumber: string;
  readonly groupSubsidSuffix: number;
  readonly charityName: string;
  readonly registrationStatus: string;
  readonly dateOfRegistration: string | null;
  readonly dateOfRemoval: string | null;
  readonly officialUrl: string;
}

export type CharityCommissionFailure =
  | "not_found"
  | "rate_limited"
  | "unavailable"
  | "invalid_response";

export class CharityCommissionProviderError
extends Error {
  readonly failure: CharityCommissionFailure;

  constructor(
    failure: CharityCommissionFailure,
  ) {
    super(failure);
    this.name =
      "CharityCommissionProviderError";
    this.failure = failure;
  }
}

export interface CharityCommissionProvider {
  getByRegisteredNumber(
    registeredNumber: string,
    suffix?: number,
  ): Promise<CharityCommissionCharity>;
}
