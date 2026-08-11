export const LEAD_SECTORS = [
  "short_let_serviced_accommodation",
  "offices_coworking",
  "community_halls_event_venues",
  "estate_letting_agents",
  "university_accommodation",
  "other_commercial_spaces",
] as const;

export type LeadSector =
  (typeof LEAD_SECTORS)[number];

export interface Coordinates {
  readonly latitude: number;
  readonly longitude: number;
}

export interface LocatedPostcode {
  readonly postcode: string;
  readonly coordinates: Coordinates;
}

export type LeadProviderFailure =
  | "invalid_postcode"
  | "postcode_provider_unavailable"
  | "search_provider_unavailable";

export class LeadProviderError extends Error {
  readonly failure: LeadProviderFailure;

  constructor(failure: LeadProviderFailure) {
    super(failure);
    this.name = "LeadProviderError";
    this.failure = failure;
  }
}

export interface PostcodeLocator {
  locate(postcode: string): Promise<LocatedPostcode>;
}

export interface LeadProviderResult {
  readonly providerPlaceId: string;
  readonly businessName: string;
  readonly formattedAddress: string | null;
  readonly primaryPostcode: string | null;
  readonly websiteUrl: string | null;
  readonly phone: string | null;
  readonly sourceUrl: string;
  readonly businessStatus: string | null;
  readonly types: readonly string[];
  readonly coordinates: Coordinates;
  readonly distanceMiles: number;
}

export interface LeadSearchProviderInput {
  readonly sector: LeadSector;
  readonly center: Coordinates;
  readonly radiusMiles: number;
}

export interface LeadSearchProvider {
  search(
    input: LeadSearchProviderInput,
  ): Promise<readonly LeadProviderResult[]>;
}

export type LeadContactType =
  | "email"
  | "phone"
  | "contact_form";

export interface CapturedLeadEvidence {
  readonly sourceUrl: string;
  readonly sourceType: string;
  readonly fieldName: string;
  readonly fieldValue: string;
  readonly sourceExcerpt: string | null;
  readonly contentSha256: string;
  readonly contactType: LeadContactType | null;
  readonly normalizedContactValue: string | null;
}

export interface CapturedLeadResult {
  readonly dedupeKey: string;
  readonly businessName: string;
  readonly websiteUrl: string | null;
  readonly primaryPostcode: string | null;
  readonly sourceRank: number | null;
  readonly evidence:
    readonly CapturedLeadEvidence[];
}

export interface StartLeadSearchInput {
  readonly founderId: string;
  readonly postcode: string;
  readonly radiusMiles: number;
  readonly sector: LeadSector;
}

export interface CaptureLeadResultsInput {
  readonly searchRunId: string | null;
  readonly sector: LeadSector;
  readonly results:
    readonly CapturedLeadResult[];
}

export interface CaptureLeadResultsOutcome {
  readonly resultCount: number;
  readonly createdCount: number;
}

export interface LeadSearchRepository {
  startSearch(
    input: StartLeadSearchInput,
  ): Promise<string>;

  completeSearch(
    input: CaptureLeadResultsInput,
  ): Promise<CaptureLeadResultsOutcome>;

  failSearch(searchRunId: string): Promise<void>;
}

