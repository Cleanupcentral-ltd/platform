import { createHash } from "node:crypto";

import {
  canonicalLondonBorough,
} from "../domain/london-boroughs.js";

import type {
  LeadReviewService,
} from "./review-leads.js";

import type {
  CapturedLeadEvidence,
  CapturedLeadResult,
  LeadContactType,
  LeadProviderResult,
  LeadSearchProvider,
  LeadSearchRepository,
  LeadSector,
  PostcodeLocator,
} from "../ports/lead-search.js";

export type LeadSearchFailure =
  | "disabled"
  | "invalid_postcode"
  | "invalid_borough"
  | "postcode_provider_unavailable"
  | "search_provider_unavailable"
  | "repository_unavailable";

export class LeadSearchError extends Error {
  readonly failure: LeadSearchFailure;

  constructor(failure: LeadSearchFailure) {
    super(failure);
    this.name = "LeadSearchError";
    this.failure = failure;
  }
}

export type SearchLeadsInput =
  | {
      readonly mode?: "postcode";
      readonly postcode: string;
      readonly radiusMiles: number;
      readonly sector: LeadSector;
    }
  | {
      readonly mode: "borough";
      readonly borough: string;
      readonly sector: LeadSector;
    };

export interface SearchLeadSummary {
  readonly prospectId?: string;
  readonly businessName: string;
  readonly formattedAddress: string | null;
  readonly primaryPostcode: string | null;
  readonly websiteUrl: string | null;
  readonly phone: string | null;
  readonly sourceUrl: string;
  readonly distanceMiles:
    number | null;
  readonly evidenceStatus: "unverified";
}

export interface SearchLeadsOutcome {
  readonly searchRunId: string;
  readonly mode: "postcode" | "borough";
  readonly postcode: string | null;
  readonly borough: string | null;
  readonly sector: LeadSector;
  readonly radiusMiles: number | null;
  readonly resultCount: number;
  readonly createdCount: number;
  readonly automaticAssessment:
    AutomaticAssessmentSummary;
  readonly results:
    readonly SearchLeadSummary[];
}

export interface CaptureManualLeadInput {
  readonly businessName: string;
  readonly sector: LeadSector;
  readonly sourceUrl: string;
  readonly formattedAddress: string | null;
  readonly primaryPostcode: string | null;
  readonly websiteUrl: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly contactFormUrl: string | null;
}

export interface CaptureManualLeadOutcome {
  readonly resultCount: number;
  readonly createdCount: number;
  readonly automaticAssessment:
    AutomaticAssessmentSummary;
  readonly businessName: string;
  readonly evidenceStatus: "unverified";
}

export interface LeadSearchService {
  search(
    founderId: string,
    input: SearchLeadsInput,
  ): Promise<SearchLeadsOutcome>;

  captureManual(
    founderId: string,
    input: CaptureManualLeadInput,
  ): Promise<CaptureManualLeadOutcome>;
}

export interface CreateLeadSearchServiceOptions {
  readonly enabled: boolean;
  readonly postcodeLocator: PostcodeLocator | null;
  readonly searchProvider: LeadSearchProvider | null;
  readonly repository: LeadSearchRepository | null;
  readonly assessmentService?:
    Pick<LeadReviewService, "assess"> | null;
}

export interface AutomaticAssessmentSummary {
  readonly requestedCount: number;
  readonly completedCount: number;
  readonly pendingCount: number;
}

const ASSESSMENT_CONCURRENCY = 4;

async function assessCapturedProspects(
  founderId: string,
  prospectIds: readonly string[],
  service:
    Pick<LeadReviewService, "assess"> | null | undefined,
): Promise<AutomaticAssessmentSummary> {
  if (prospectIds.length === 0) {
    return {
      requestedCount: 0,
      completedCount: 0,
      pendingCount: 0,
    };
  }

  if (service === null || service === undefined) {
    return {
      requestedCount: prospectIds.length,
      completedCount: 0,
      pendingCount: prospectIds.length,
    };
  }

  let completedCount = 0;
  for (
    let index = 0;
    index < prospectIds.length;
    index += ASSESSMENT_CONCURRENCY
  ) {
    const batch = prospectIds.slice(
      index,
      index + ASSESSMENT_CONCURRENCY,
    );
    const settled = await Promise.allSettled(
      batch.map((prospectId) =>
        service.assess(
          founderId,
          prospectId,
        ),
      ),
    );
    completedCount += settled.filter(
      (result) =>
        result.status === "fulfilled",
    ).length;
  }

  return {
    requestedCount: prospectIds.length,
    completedCount,
    pendingCount:
      prospectIds.length - completedCount,
  };
}

function sha256(value: string): string {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function clean(value: string | null): string | null {
  if (value === null) return null;
  const cleaned = value.trim();
  return cleaned.length === 0 ? null : cleaned;
}

function normalizedPhone(value: string): string {
  const trimmed = value.trim();
  const prefix = trimmed.startsWith("+") ? "+" : "";
  return `${prefix}${trimmed.replace(/\D/g, "")}`;
}

function normalizedEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizedUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  return url.toString();
}

function evidenceFor(
  sourceUrl: string,
  sourceType: string,
  sourceExcerpt: string | null,
  fieldName: string,
  fieldValue: string | null,
  contactType: LeadContactType | null = null,
  normalizedContactValue: string | null = null,
): CapturedLeadEvidence | null {
  const cleaned = clean(fieldValue);
  if (cleaned === null) return null;

  return {
    sourceUrl,
    sourceType,
    fieldName,
    fieldValue: cleaned,
    sourceExcerpt,
    contentSha256: sha256(
      `${sourceUrl}\n${fieldName}\n${cleaned}`,
    ),
    contactType,
    normalizedContactValue,
  };
}

function providerCapture(
  result: LeadProviderResult,
  sourceRank: number,
): CapturedLeadResult {
  const excerpt = [
    result.businessName,
    result.formattedAddress,
  ]
    .filter(
      (value): value is string =>
        value !== null,
    )
    .join(" — ");

  const evidence = [
    evidenceFor(
      result.sourceUrl,
      "google_places",
      excerpt,
      "business_name",
      result.businessName,
    ),
    evidenceFor(
      result.sourceUrl,
      "google_places",
      excerpt,
      "formatted_address",
      result.formattedAddress,
    ),
    evidenceFor(
      result.sourceUrl,
      "google_places",
      excerpt,
      "primary_postcode",
      result.primaryPostcode,
    ),
    evidenceFor(
      result.sourceUrl,
      "google_places",
      excerpt,
      "website_url",
      result.websiteUrl,
    ),
    evidenceFor(
      result.sourceUrl,
      "google_places",
      excerpt,
      "phone",
      result.phone,
      result.phone === null
        ? null
        : "phone",
      result.phone === null
        ? null
        : normalizedPhone(result.phone),
    ),
    evidenceFor(
      result.sourceUrl,
      "google_places",
      excerpt,
      "google_place_id",
      result.providerPlaceId,
    ),
    evidenceFor(
      result.sourceUrl,
      "google_places",
      excerpt,
      "business_status",
      result.businessStatus,
    ),
    evidenceFor(
      result.sourceUrl,
      "google_places",
      excerpt,
      "place_types",
      result.types.length === 0
        ? null
        : result.types.join(","),
    ),
    result.distanceMiles === null
      ? null
      : evidenceFor(
          result.sourceUrl,
          "google_places",
          excerpt,
          "distance_miles",
          result.distanceMiles.toFixed(2),
        ),
  ].filter(
    (
      item,
    ): item is CapturedLeadEvidence =>
      item !== null,
  );

  return {
    dedupeKey:
      `google_places:${result.providerPlaceId}`,
    businessName:
      result.businessName,
    websiteUrl:
      result.websiteUrl,
    primaryPostcode:
      result.primaryPostcode,
    sourceRank,
    evidence,
  };
}

function manualCapture(
  input: CaptureManualLeadInput,
): CapturedLeadResult {
  const sourceUrl =
    normalizedUrl(input.sourceUrl);
  const excerpt =
    "Founder-supplied public source.";

  const contactEvidence = [
    input.phone === null
      ? null
      : evidenceFor(
          sourceUrl,
          "manual_public_source",
          excerpt,
          "phone",
          input.phone,
          "phone",
          normalizedPhone(input.phone),
        ),
    input.email === null
      ? null
      : evidenceFor(
          sourceUrl,
          "manual_public_source",
          excerpt,
          "email",
          input.email,
          "email",
          normalizedEmail(input.email),
        ),
    input.contactFormUrl === null
      ? null
      : evidenceFor(
          sourceUrl,
          "manual_public_source",
          excerpt,
          "contact_form_url",
          normalizedUrl(
            input.contactFormUrl,
          ),
          "contact_form",
          normalizedUrl(
            input.contactFormUrl,
          ),
        ),
  ];

  const evidence = [
    evidenceFor(
      sourceUrl,
      "manual_public_source",
      excerpt,
      "business_name",
      input.businessName,
    ),
    evidenceFor(
      sourceUrl,
      "manual_public_source",
      excerpt,
      "formatted_address",
      input.formattedAddress,
    ),
    evidenceFor(
      sourceUrl,
      "manual_public_source",
      excerpt,
      "primary_postcode",
      input.primaryPostcode,
    ),
    evidenceFor(
      sourceUrl,
      "manual_public_source",
      excerpt,
      "website_url",
      input.websiteUrl === null
        ? null
        : normalizedUrl(
            input.websiteUrl,
          ),
    ),
    ...contactEvidence,
  ].filter(
    (
      item,
    ): item is CapturedLeadEvidence =>
      item !== null,
  );

  const manualIdentity = [
    input.businessName
      .trim()
      .toLowerCase(),
    input.primaryPostcode
      ?.replace(/\s/g, "")
      .toLowerCase() ?? "",
    input.websiteUrl === null
      ? ""
      : new URL(
          input.websiteUrl,
        ).hostname
          .replace(/^www\./, "")
          .toLowerCase(),
  ].join("|");

  return {
    dedupeKey:
      `manual:${sha256(manualIdentity)}`,
    businessName:
      input.businessName.trim(),
    websiteUrl:
      input.websiteUrl === null
        ? null
        : normalizedUrl(
            input.websiteUrl,
          ),
    primaryPostcode:
      clean(input.primaryPostcode),
    sourceRank: null,
    evidence,
  };
}

function providerFailure(
  error: unknown,
  fallback:
    | "postcode_provider_unavailable"
    | "search_provider_unavailable",
): LeadSearchError {
  if (error instanceof LeadSearchError) {
    return error;
  }

  const failure =
    typeof error === "object" &&
    error !== null &&
    "failure" in error &&
    typeof error.failure === "string"
      ? error.failure
      : null;

  if (
    failure === "invalid_postcode" ||
    failure ===
      "postcode_provider_unavailable" ||
    failure ===
      "search_provider_unavailable"
  ) {
    return new LeadSearchError(
      failure,
    );
  }

  return new LeadSearchError(
    fallback,
  );
}

export function createLeadSearchService(
  options:
    CreateLeadSearchServiceOptions,
): LeadSearchService {
  function dependencies() {
    if (
      !options.enabled ||
      options.postcodeLocator === null ||
      options.searchProvider === null ||
      options.repository === null
    ) {
      throw new LeadSearchError(
        "disabled",
      );
    }

    return {
      postcodeLocator:
        options.postcodeLocator,
      searchProvider:
        options.searchProvider,
      repository:
        options.repository,
    };
  }

  return {
    async search(
      founderId,
      input,
    ) {
      const {
        postcodeLocator,
        searchProvider,
        repository,
      } = dependencies();

      const boroughMode =
        input.mode === "borough";
      const canonicalBorough =
        boroughMode
          ? canonicalLondonBorough(
              input.borough,
            )
          : null;
      if (
        boroughMode &&
        canonicalBorough === null
      ) {
        throw new LeadSearchError(
          "invalid_borough",
        );
      }

      let located:
        | Awaited<
            ReturnType<
              PostcodeLocator["locate"]
            >
          >
        | null = null;
      if (!boroughMode) {
        try {
          located =
            await postcodeLocator.locate(
              input.postcode,
            );
        } catch (error) {
          throw providerFailure(
            error,
            "postcode_provider_unavailable",
          );
        }
      }

      let searchRunId: string;
      try {
        searchRunId =
          await repository.startSearch({
            founderId,
            searchMode:
              boroughMode
                ? "borough"
                : "postcode",
            postcode:
              located?.postcode ?? null,
            radiusMiles:
              boroughMode
                ? null
                : input.radiusMiles,
            borough:
              canonicalBorough,
            sector: input.sector,
          });
      } catch {
        throw new LeadSearchError(
          "repository_unavailable",
        );
      }

      let providerResults:
        readonly LeadProviderResult[];

      try {
        providerResults =
          await searchProvider.search(
            boroughMode
              ? {
                  mode: "borough",
                  borough:
                    canonicalBorough!,
                  sector:
                    input.sector,
                }
              : {
                  mode: "postcode",
                  sector:
                    input.sector,
                  center:
                    located!.coordinates,
                  radiusMiles:
                    input.radiusMiles,
                },
          );

        if (boroughMode) {
          const verifyBorough =
            postcodeLocator
              .filterToBorough;
          if (
            verifyBorough ===
              undefined
          ) {
            throw new LeadSearchError(
              "postcode_provider_unavailable",
            );
          }
          const matchingPostcodes =
            new Set(
              (
                await verifyBorough.call(
                  postcodeLocator,
                  canonicalBorough!,
                  providerResults
                    .map(
                      (result) =>
                        result
                          .primaryPostcode,
                    )
                    .filter(
                      (
                        value,
                      ): value is string =>
                        value !== null,
                    ),
                )
              ).map(
                (postcode) =>
                  postcode
                    .replace(/\s/g, "")
                    .toUpperCase(),
              ),
            );
          providerResults =
            providerResults.filter(
              (result) =>
                result.primaryPostcode !==
                  null &&
                matchingPostcodes.has(
                  result.primaryPostcode
                    .replace(/\s/g, "")
                    .toUpperCase(),
                ),
            );
        }
      } catch (error) {
        try {
          await repository.failSearch(
            searchRunId,
          );
        } catch {
          // The original provider error remains the useful result.
        }
        throw providerFailure(
          error,
          boroughMode
            ? "postcode_provider_unavailable"
            : "search_provider_unavailable",
        );
      }

      const captured =
        providerResults.map(
          (result, index) =>
            providerCapture(
              result,
              index + 1,
            ),
        );

      let persisted;
      try {
        persisted =
          await repository.completeSearch({
            searchRunId,
            sector: input.sector,
            results: captured,
          });
      } catch {
        try {
          await repository.failSearch(
            searchRunId,
          );
        } catch {
          // The persistence error below remains the useful result.
        }
        throw new LeadSearchError(
          "repository_unavailable",
        );
      }

      let prospectIdsByPlace:
        ReadonlyMap<string, string> =
          new Map();
      if (
        repository.resolveGoogleProspectIds !==
          undefined
      ) {
        try {
          prospectIdsByPlace =
            await repository.resolveGoogleProspectIds(
              providerResults.map(
                (result) =>
                  result.providerPlaceId,
              ),
            );
        } catch {
          // Search and capture have already succeeded. The optional
          // reference only improves exact UI association and can fall
          // back to the existing matching logic if this read fails.
        }
      }

      const automaticAssessment =
        await assessCapturedProspects(
          founderId,
          persisted.createdProspectIds,
          options.assessmentService,
        );

      return {
        searchRunId,
        mode:
          boroughMode
            ? "borough" as const
            : "postcode" as const,
        postcode:
          located?.postcode ?? null,
        borough:
          canonicalBorough,
        sector: input.sector,
        radiusMiles:
          boroughMode
            ? null
            : input.radiusMiles,
        resultCount:
          persisted.resultCount,
        createdCount:
          persisted.createdCount,
        automaticAssessment,
        results:
          providerResults.map(
            (result) => {
              const prospectId =
                prospectIdsByPlace.get(
                  result.providerPlaceId,
                );
              return {
                ...(prospectId === undefined
                  ? {}
                  : { prospectId }),
                businessName:
                  result.businessName,
                formattedAddress:
                  result.formattedAddress,
                primaryPostcode:
                  result.primaryPostcode,
                websiteUrl:
                  result.websiteUrl,
                phone: result.phone,
                sourceUrl:
                  result.sourceUrl,
                distanceMiles:
                  result.distanceMiles ===
                    null
                    ? null
                    : Math.round(
                        result
                          .distanceMiles *
                          100,
                      ) / 100,
                evidenceStatus:
                  "unverified" as const,
              };
            },
          ),
      };
    },

    async captureManual(
      founderId,
      input,
    ) {
      const { repository } =
        dependencies();
      const captured =
        manualCapture(input);

      let outcome;
      try {
        outcome =
          await repository.completeSearch({
            searchRunId: null,
            sector: input.sector,
            results: [captured],
          });
      } catch {
        throw new LeadSearchError(
          "repository_unavailable",
        );
      }

      const automaticAssessment =
        await assessCapturedProspects(
          founderId,
          outcome.createdProspectIds,
          options.assessmentService,
        );

      return {
        ...outcome,
        automaticAssessment,
        businessName:
          captured.businessName,
        evidenceStatus:
          "unverified" as const,
      };
    },
  };
}
