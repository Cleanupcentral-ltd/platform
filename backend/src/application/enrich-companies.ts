import {
  CompaniesHouseVerificationError,
  type CompaniesHouseVerificationService,
} from "./verify-companies-house.js";

import {
  FirstPartyLookupError,
} from "../adapters/web/first-party-company-number.js";

import type {
  CompaniesHouseCompanySummary,
} from "../ports/companies-house.js";

import type {
  CompanyEnrichmentJob,
  CompanyEnrichmentRepository,
  FirstPartyCompanyNumberEvidence,
  FirstPartyCompanyNumberProvider,
} from "../ports/company-enrichment.js";

export interface CompanyEnrichmentBatchResult {
  readonly claimedCount: number;
  readonly autoVerifiedCount: number;
  readonly reviewRequiredCount: number;
  readonly completedCount: number;
  readonly failedCount: number;
}

export interface CompanyEnrichmentService {
  runBatch(): Promise<CompanyEnrichmentBatchResult>;
  retry(
    prospectId: string,
    actorId: string,
  ): Promise<void>;
}

export interface CompanyEnrichmentServiceOptions {
  readonly repository:
    CompanyEnrichmentRepository;
  readonly firstPartyProvider:
    FirstPartyCompanyNumberProvider;
  readonly companiesHouseService:
    CompaniesHouseVerificationService;
  readonly batchSize: number;
  readonly leaseSeconds: number;
}

function uniqueMatches(
  matches:
    readonly CompaniesHouseCompanySummary[],
): readonly CompaniesHouseCompanySummary[] {
  const unique = new Map<string,
    CompaniesHouseCompanySummary>();
  for (const match of matches) {
    unique.set(match.companyNumber, match);
  }
  return [...unique.values()].slice(0, 5);
}

function retryDelay(
  error: CompaniesHouseVerificationError,
): number {
  return error.failure === "provider_rate_limited"
    ? 300
    : 60;
}

export function createCompanyEnrichmentService(
  options: CompanyEnrichmentServiceOptions,
): CompanyEnrichmentService {
  async function candidates(
    job: CompanyEnrichmentJob,
    websiteNumbers: readonly string[],
  ): Promise<readonly CompaniesHouseCompanySummary[]> {
    const results:
      CompaniesHouseCompanySummary[] = [];
    for (const number of websiteNumbers.slice(0, 3)) {
      try {
        results.push(
          ...await options.companiesHouseService
            .search(job.prospectId, number),
        );
      } catch (error) {
        if (
          error instanceof CompaniesHouseVerificationError &&
          error.failure === "company_not_found"
        ) continue;
        throw error;
      }
    }
    if (results.length === 0) {
      results.push(
        ...await options.companiesHouseService
          .search(
            job.prospectId,
            job.businessName,
          ),
      );
    }
    return uniqueMatches(results);
  }

  async function completeCandidates(
    job: CompanyEnrichmentJob,
    websiteEvidence:
      FirstPartyCompanyNumberEvidence | null,
    websiteError: string | null,
  ): Promise<"review" | "complete"> {
    const matches = await candidates(
      job,
      websiteEvidence?.companyNumbers ?? [],
    );
    const hasMatches = matches.length > 0;
    await options.repository.complete({
      prospectId: job.prospectId,
      attemptCount: job.attemptCount,
      status: hasMatches
        ? "review_required"
        : "no_match",
      discoveredCompanyNumber:
        websiteEvidence?.companyNumbers.length === 1
          ? websiteEvidence.companyNumbers[0]!
          : null,
      sourceUrl:
        websiteEvidence?.sourceUrl ?? null,
      sourceExcerpt:
        websiteEvidence?.sourceExcerpt ?? null,
      sourceContentSha256:
        websiteEvidence?.contentSha256 ?? null,
      candidates: matches,
      lastErrorCode: websiteError,
    });
    return hasMatches ? "review" : "complete";
  }

  async function processJob(
    job: CompanyEnrichmentJob,
  ): Promise<
    "auto" | "review" | "complete" | "failed"
  > {
    if (job.companyNumber !== null) {
      await options.repository.complete({
        prospectId: job.prospectId,
        attemptCount: job.attemptCount,
        status: "verified_existing",
        discoveredCompanyNumber:
          job.companyNumber,
        sourceUrl: null,
        sourceExcerpt: null,
        sourceContentSha256: null,
        candidates: [],
        lastErrorCode: null,
      });
      return "complete";
    }

    let websiteEvidence:
      FirstPartyCompanyNumberEvidence | null = null;
    let websiteError: string | null = null;
    if (job.websiteUrl !== null) {
      try {
        websiteEvidence = await options
          .firstPartyProvider.find(job.websiteUrl);
      } catch (error) {
        websiteError =
          error instanceof FirstPartyLookupError
            ? `website_${error.failure}`
            : "website_unavailable";
      }
    }

    if (
      websiteEvidence !== null &&
      websiteEvidence.companyNumbers.length === 1
    ) {
      const number =
        websiteEvidence.companyNumbers[0]!;
      try {
        await options.companiesHouseService
          .verifyAutomatically(
            job.actorId,
            job.prospectId,
            number,
            job.attemptCount,
            {
              sourceUrl:
                websiteEvidence.sourceUrl,
              sourceExcerpt:
                websiteEvidence.sourceExcerpt,
              contentSha256:
                websiteEvidence.contentSha256,
            },
          );
        return "auto";
      } catch (error) {
        if (
          error instanceof CompaniesHouseVerificationError &&
          error.failure === "duplicate_company"
        ) {
          await options.repository.complete({
            prospectId: job.prospectId,
            attemptCount: job.attemptCount,
            status: "duplicate",
            discoveredCompanyNumber: number,
            sourceUrl:
              websiteEvidence.sourceUrl,
            sourceExcerpt:
              websiteEvidence.sourceExcerpt,
            sourceContentSha256:
              websiteEvidence.contentSha256,
            candidates: [],
            lastErrorCode:
              "company_number_already_linked",
          });
          return "review";
        }
        if (
          error instanceof CompaniesHouseVerificationError &&
          error.failure !== "company_not_found" &&
          error.failure !== "invalid_query"
        ) {
          await options.repository.complete({
            prospectId: job.prospectId,
            attemptCount: job.attemptCount,
            status: "failed",
            discoveredCompanyNumber: number,
            sourceUrl:
              websiteEvidence.sourceUrl,
            sourceExcerpt:
              websiteEvidence.sourceExcerpt,
            sourceContentSha256:
              websiteEvidence.contentSha256,
            candidates: [],
            lastErrorCode: error.failure,
            retryAfterSeconds:
              retryDelay(error),
          });
          return "failed";
        }
      }
    }

    try {
      return await completeCandidates(
        job,
        websiteEvidence,
        websiteError,
      );
    } catch (error) {
      const code =
        error instanceof CompaniesHouseVerificationError
          ? error.failure
          : "enrichment_unavailable";
      await options.repository.complete({
        prospectId: job.prospectId,
        attemptCount: job.attemptCount,
        status: "failed",
        discoveredCompanyNumber: null,
        sourceUrl:
          websiteEvidence?.sourceUrl ?? null,
        sourceExcerpt:
          websiteEvidence?.sourceExcerpt ?? null,
        sourceContentSha256:
          websiteEvidence?.contentSha256 ?? null,
        candidates: [],
        lastErrorCode: code,
        retryAfterSeconds:
          error instanceof CompaniesHouseVerificationError
            ? retryDelay(error)
            : 60,
      });
      return "failed";
    }
  }

  return {
    async runBatch() {
      const jobs = await options.repository
        .claimJobs(
          options.batchSize,
          options.leaseSeconds,
        );
      const outcomes = await Promise.all(
        jobs.map((job) => processJob(job)),
      );
      return {
        claimedCount: jobs.length,
        autoVerifiedCount:
          outcomes.filter(
            (outcome) => outcome === "auto",
          ).length,
        reviewRequiredCount:
          outcomes.filter(
            (outcome) => outcome === "review",
          ).length,
        completedCount:
          outcomes.filter(
            (outcome) => outcome === "complete",
          ).length,
        failedCount:
          outcomes.filter(
            (outcome) => outcome === "failed",
          ).length,
      };
    },

    async retry(prospectId, actorId) {
      await options.repository.retry(
        prospectId,
        actorId,
      );
    },
  };
}

export interface CompanyEnrichmentScheduler {
  start(): void;
  stop(): void;
}

export function createCompanyEnrichmentScheduler(
  service: Pick<CompanyEnrichmentService, "runBatch">,
  intervalMs: number,
  onResult: (
    result: CompanyEnrichmentBatchResult,
  ) => void,
  onError: (error: unknown) => void,
): CompanyEnrichmentScheduler {
  let timer: NodeJS.Timeout | null = null;
  let running = false;

  async function tick(): Promise<void> {
    if (running) return;
    running = true;
    try {
      onResult(await service.runBatch());
    } catch (error) {
      onError(error);
    } finally {
      running = false;
    }
  }

  return {
    start() {
      if (timer !== null) return;
      void tick();
      timer = setInterval(
        () => void tick(),
        intervalMs,
      );
      timer.unref();
    },
    stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
