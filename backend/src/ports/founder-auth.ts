export interface FounderIdentity {
  readonly userId: string;
  readonly email: string | null;
}

export type FounderAuthFailure =
  | "invalid_token"
  | "mfa_required"
  | "founder_role_required"
  | "provider_unavailable";

export class FounderAuthError extends Error {
  readonly failure: FounderAuthFailure;

  constructor(
    failure: FounderAuthFailure,
  ) {
    super(failure);
    this.name = "FounderAuthError";
    this.failure = failure;
  }
}

export interface FounderAuthService {
  authenticate(
    accessToken: string,
  ): Promise<FounderIdentity>;
}
