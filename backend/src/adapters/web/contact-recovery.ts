import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import {
  detectContactForm,
} from "../../domain/contact-form-evidence.js";

import {
  extractPublicPhones,
  type PublicPhoneEvidence,
} from "../../domain/public-phone.js";

import type {
  AutomaticResearchFact,
} from "../../ports/automatic-qualification.js";

import type {
  LeadSector,
} from "../../ports/lead-search.js";

import {
  FirstPartyResearchError,
} from "./first-party-research.js";

type FetchFunction = typeof fetch;

export interface ContactRecoveryResult {
  readonly facts: readonly AutomaticResearchFact[];
  readonly visitedUrls: readonly string[];
  readonly truncatedPageCount: number;
}

export interface ContactRecoveryProvider {
  recover(
    websiteUrl: string,
    businessName: string,
    sector: LeadSector,
  ): Promise<ContactRecoveryResult>;
}

export interface FirstPartyContactRecoveryOptions {
  readonly timeoutMs: number;
  readonly maximumBytes: number;
  readonly maximumPages?: number;
  readonly requestRetries?: number;
  readonly fetchFunction?: FetchFunction;
  readonly resolveHost?: (
    hostname: string,
  ) => Promise<readonly string[]>;
}

interface LoadedPage {
  readonly url: URL;
  readonly html: string;
  readonly text: string;
  readonly truncated: boolean;
  readonly priority: number;
}

interface QueuedPage {
  readonly url: URL;
  readonly priority: number;
}

interface EmailCandidate {
  readonly page: LoadedPage;
  readonly email: string;
  readonly support: string;
  readonly score: number;
}

interface PhoneCandidate {
  readonly page: LoadedPage;
  readonly evidence: PublicPhoneEvidence;
  readonly branchScore: number;
  readonly totalScore: number;
}

const GENERIC_MAILBOXES = new Set([
  "accommodation",
  "admin",
  "bookings",
  "business",
  "commercial",
  "contact",
  "enquiries",
  "enquiry",
  "events",
  "facilities",
  "functions",
  "hello",
  "hire",
  "housing",
  "info",
  "lettings",
  "management",
  "office",
  "operations",
  "property",
  "reception",
  "reservations",
  "residences",
  "sales",
  "student",
  "students",
  "support",
  "team",
  "venue",
]);

const PERSONAL_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "icloud.com",
  "live.co.uk",
  "live.com",
  "outlook.com",
  "yahoo.co.uk",
  "yahoo.com",
]);

const DISALLOWED_DISCOVERY_PATH =
  /(?:^|\/)(?:careers?|jobs?|vacanc(?:y|ies)|recruit(?:ment|ing)?|compliance|privacy(?:-policy)?|terms(?:-and-conditions)?|cookie(?:-policy)?|legal|news|blog)(?:\/|$|[-_])/i;

const CONTACT_DISCOVERY =
  /(?:contact(?:-us)?|get[-_ ]?in[-_ ]?touch|enquir(?:y|ies)|inquir(?:y|ies)|find[-_ ]?us)/i;

const LOCATION_DISCOVERY =
  /(?:our[-_ ]?(?:offices?|branches?|locations?)|offices?|branches?|locations?|find[-_ ]?(?:an[-_ ]?)?(?:office|branch|location))/i;

const HIRE_DISCOVERY =
  /(?:venue[-_ ]?hire|hall[-_ ]?hire|room[-_ ]?hire|function[-_ ]?(?:room|enquir)|hire|bookings?|reservations?)/i;

const SECTOR_LINK_PATTERNS:
  Readonly<Record<LeadSector, readonly RegExp[]>> = {
    short_let_serviced_accommodation: [
      /(?:apartments?|accommodation|locations?|properties|reservations?)/i,
    ],
    offices_coworking: [
      /(?:offices?|workspace|cowork|business[-_ ]?centre|locations?)/i,
    ],
    community_halls_event_venues: [
      /(?:venue|hall|function|events?|hire|bookings?)/i,
    ],
    estate_letting_agents: [
      /(?:estate[-_ ]?agents?|lettings?|sales|property[-_ ]?management|branches?|offices?)/i,
    ],
    university_accommodation: [
      /(?:accommodation|residences?|halls?|student[-_ ]?living|contact)/i,
    ],
    other_commercial_spaces: [
      /(?:commercial|property|premises|units?|locations?|offices?)/i,
    ],
  };

const FALLBACK_PATHS = [
  "/contact",
  "/contact-us",
  "/get-in-touch",
  "/enquiries",
  "/locations",
  "/our-locations",
  "/offices",
  "/our-offices",
  "/branches",
  "/hire",
] as const;

const BUSINESS_TOKEN_STOPWORDS = new Set([
  "accommodation",
  "agent",
  "agents",
  "and",
  "commercial",
  "company",
  "community",
  "coworking",
  "development",
  "division",
  "estate",
  "event",
  "events",
  "hall",
  "halls",
  "house",
  "letting",
  "lettings",
  "limited",
  "ltd",
  "office",
  "offices",
  "property",
  "sales",
  "student",
  "the",
  "university",
  "venue",
]);

function sha256(value: string): string {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function ipv4IsPublic(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((value) =>
      !Number.isInteger(value) ||
      value < 0 || value > 255)
  ) return false;

  const [first, second, third] = octets as [
    number,
    number,
    number,
  ];

  return !(
    first === 0 || first === 10 || first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 192 && second === 0) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  );
}

function ipIsPublic(address: string): boolean {
  const kind = isIP(address);
  if (kind === 4) return ipv4IsPublic(address);
  if (kind !== 6) return false;

  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) {
    return ipv4IsPublic(normalized.slice(7));
  }

  return !(
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("2001:db8:") ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith("ff")
  );
}

async function defaultResolveHost(
  hostname: string,
): Promise<readonly string[]> {
  return (await lookup(hostname, {
    all: true,
    verbatim: true,
  })).map((record) => record.address);
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#(x?[0-9a-f]+);?/gi, (
      full,
      encoded: string,
    ) => {
      const hex = encoded.toLowerCase().startsWith("x");
      const raw = hex ? encoded.slice(1) : encoded;
      const code = Number.parseInt(raw, hex ? 16 : 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) {
        return full;
      }
      try {
        return String.fromCodePoint(code);
      } catch {
        return full;
      }
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function htmlText(html: string): string {
  return decodeHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function visibleAnchorText(value: string): string {
  return htmlText(value);
}

function normalizedWords(value: string): readonly string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) =>
      word.length >= 3 &&
      !BUSINESS_TOKEN_STOPWORDS.has(word));
}

function businessTokens(
  businessName: string,
): readonly string[] {
  return [...new Set(normalizedWords(businessName))];
}

function tokenMatchCount(
  tokens: readonly string[],
  value: string,
): number {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");

  return tokens.filter((token) =>
    new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
      .test(normalized),
  ).length;
}

function excerptAround(
  text: string,
  needle: string,
): string {
  const index = text.toLowerCase()
    .indexOf(needle.toLowerCase());
  if (index < 0) return text.slice(0, 360).trim();

  return text.slice(
    Math.max(0, index - 160),
    Math.min(text.length, index + needle.length + 200),
  ).trim();
}

function linkPriority(
  href: string,
  label: string,
  sector: LeadSector,
  targetTokens: readonly string[],
): number {
  const combined = `${href} ${label}`;
  if (DISALLOWED_DISCOVERY_PATH.test(href)) return -1;

  let score = 0;
  if (CONTACT_DISCOVERY.test(combined)) score = 100;
  else if (LOCATION_DISCOVERY.test(combined)) score = 90;
  else if (HIRE_DISCOVERY.test(combined)) score = 85;
  else if (
    SECTOR_LINK_PATTERNS[sector].some((pattern) =>
      pattern.test(combined))
  ) score = 70;
  else return -1;

  score += tokenMatchCount(targetTokens, combined) * 12;
  return score;
}

function pageLinks(
  html: string,
  sourceUrl: URL,
  sector: LeadSector,
  targetTokens: readonly string[],
): readonly QueuedPage[] {
  const results = new Map<string, QueuedPage>();

  for (
    const match of html.matchAll(
      /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    )
  ) {
    const href = match[1];
    if (href === undefined) continue;

    const label = visibleAnchorText(match[2] ?? "");
    const priority = linkPriority(
      href,
      label,
      sector,
      targetTokens,
    );
    if (priority < 0) continue;

    try {
      const candidate = new URL(href, sourceUrl);
      candidate.hash = "";
      if (
        candidate.protocol !== "https:" ||
        candidate.origin !== sourceUrl.origin
      ) continue;

      const current = results.get(candidate.toString());
      if (current === undefined || current.priority < priority) {
        results.set(candidate.toString(), {
          url: candidate,
          priority,
        });
      }
    } catch {
      // Malformed links are not eligible for first-party recovery.
    }
  }

  return [...results.values()].sort(
    (left, right) =>
      right.priority - left.priority ||
      left.url.toString().localeCompare(
        right.url.toString(),
      ),
  );
}

function fallbackPages(
  sourceUrl: URL,
): readonly QueuedPage[] {
  return FALLBACK_PATHS.map((path, index) => ({
    url: new URL(path, sourceUrl.origin),
    priority: 55 - index,
  }));
}

function decodeCfEmail(value: string): string | null {
  const encoded = value.trim();
  if (
    encoded.length < 4 ||
    encoded.length % 2 !== 0 ||
    !/^[0-9a-f]+$/i.test(encoded)
  ) return null;

  const key = Number.parseInt(encoded.slice(0, 2), 16);
  let decoded = "";
  for (let index = 2; index < encoded.length; index += 2) {
    decoded += String.fromCharCode(
      Number.parseInt(encoded.slice(index, index + 2), 16) ^ key,
    );
  }
  return decoded;
}

function normalizeObfuscatedEmailText(
  value: string,
): string {
  return value
    .replace(/\s*(?:\[at\]|\(at\)|\{at\})\s*/gi, "@")
    .replace(/\s+at\s+(?=[a-z0-9.-]+\s+(?:\[dot\]|\(dot\)|\{dot\}|dot\s))/gi, "@")
    .replace(/\s*(?:\[dot\]|\(dot\)|\{dot\})\s*/gi, ".")
    .replace(/\s+dot\s+/gi, ".")
    .replace(/\s*@\s*/g, "@")
    .replace(/\s*\.\s*/g, ".");
}

function approvedGenericEmail(
  value: string,
): string | null {
  const email = value
    .trim()
    .replace(/^mailto:/i, "")
    .split(/[?#]/, 1)[0]!
    .toLowerCase();

  if (
    !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)
  ) return null;

  const [localPart, domain] = email.split("@") as [string, string];
  if (PERSONAL_MAIL_DOMAINS.has(domain)) return null;

  const mailboxRoot = localPart.split(/[._+-]/, 1)[0] ?? "";
  return GENERIC_MAILBOXES.has(mailboxRoot)
    ? email
    : null;
}

function emailCandidates(
  page: LoadedPage,
): readonly EmailCandidate[] {
  const found = new Map<string, EmailCandidate>();
  const add = (
    rawValue: string,
    support: string,
    score: number,
  ) => {
    const email = approvedGenericEmail(rawValue);
    if (email === null) return;
    const current = found.get(email);
    if (current !== undefined && current.score >= score) return;
    found.set(email, {
      page,
      email,
      support,
      score,
    });
  };

  for (
    const match of page.html.matchAll(
      /\bhref\s*=\s*["']mailto:([^"']+)["']/gi,
    )
  ) {
    let raw = decodeHtml(match[1] ?? "");
    try {
      raw = decodeURIComponent(raw);
    } catch {
      // A malformed mailto value cannot be percent-decoded, but the raw value may still be usable.
    }
    add(
      raw,
      `Verified public email recovery v1: first-party mailto link publishes ${raw.split(/[?#]/, 1)[0] ?? raw}.`,
      40,
    );
  }

  for (
    const match of page.html.matchAll(
      /\bdata-cfemail\s*=\s*["']([0-9a-f]+)["']/gi,
    )
  ) {
    const decoded = decodeCfEmail(match[1] ?? "");
    if (decoded !== null) {
      add(
        decoded,
        `Verified public email recovery v1: first-party anti-spam markup decodes to ${decoded}.`,
        35,
      );
    }
  }

  const normalizedText = normalizeObfuscatedEmailText(
    decodeHtml(page.text),
  );
  for (
    const match of normalizedText.matchAll(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    )
  ) {
    const raw = match[0];
    add(
      raw,
      excerptAround(normalizedText, raw),
      25,
    );
  }

  return [...found.values()];
}

function phonePageBranchScore(
  businessName: string,
  page: LoadedPage,
  evidence: PublicPhoneEvidence,
): number {
  const tokens = businessTokens(businessName);
  if (tokens.length === 0) return 0;

  const pathMatches = tokenMatchCount(
    tokens,
    page.url.pathname,
  );
  const contextMatches = tokenMatchCount(
    tokens,
    evidence.context ?? "",
  );

  return pathMatches * 3 + contextMatches * 4;
}

function choosePhone(
  pages: readonly LoadedPage[],
  businessName: string,
): PhoneCandidate | null {
  const byNumber = new Map<string, PhoneCandidate>();

  for (const page of pages) {
    for (
      const evidence of extractPublicPhones(
        page.html,
        page.text,
      )
    ) {
      const branchScore = phonePageBranchScore(
        businessName,
        page,
        evidence,
      );
      const candidate: PhoneCandidate = {
        page,
        evidence,
        branchScore,
        totalScore:
          evidence.score +
          page.priority +
          branchScore * 10,
      };
      const current = byNumber.get(
        evidence.normalizedValue,
      );
      if (
        current === undefined ||
        current.totalScore < candidate.totalScore
      ) {
        byNumber.set(
          evidence.normalizedValue,
          candidate,
        );
      }
    }
  }

  const candidates = [...byNumber.values()]
    .sort((left, right) =>
      right.totalScore - left.totalScore ||
      right.branchScore - left.branchScore ||
      left.evidence.normalizedValue.localeCompare(
        right.evidence.normalizedValue,
      ));

  const best = candidates[0];
  if (best === undefined) return null;
  if (candidates.length === 1) return best;

  const second = candidates[1]!;
  if (best.branchScore > second.branchScore) {
    return best;
  }

  const bestPagePathScore = tokenMatchCount(
    businessTokens(businessName),
    best.page.url.pathname,
  );
  const allBestPage = candidates.every(
    (candidate) =>
      candidate.page.url.toString() ===
        best.page.url.toString(),
  );

  if (
    allBestPage &&
    bestPagePathScore > 0
  ) {
    return best;
  }

  // Several locations/numbers are present without a unique branch match.
  // Do not persist an arbitrary number.
  return null;
}

function contactFact(
  page: LoadedPage,
  factName: AutomaticResearchFact["factName"],
  factValue: string,
  support: string,
  contactType: Exclude<
    AutomaticResearchFact["contactType"],
    null
  >,
  normalizedContactValue: string,
): AutomaticResearchFact {
  return {
    sourceUrl: page.url.toString(),
    factName,
    factValue,
    sourceExcerpt: support.slice(0, 700),
    contentSha256: sha256(
      `${page.url}\n${factName}\n${factValue}\n${support}`,
    ),
    contactType,
    normalizedContactValue,
  };
}

export class FirstPartyContactRecoveryClient
implements ContactRecoveryProvider {
  private readonly timeoutMs: number;
  private readonly maximumBytes: number;
  private readonly maximumPages: number;
  private readonly requestRetries: number;
  private readonly fetchFunction: FetchFunction;
  private readonly resolveHost: (
    hostname: string,
  ) => Promise<readonly string[]>;

  constructor(options: FirstPartyContactRecoveryOptions) {
    this.timeoutMs = options.timeoutMs;
    this.maximumBytes = options.maximumBytes;
    this.maximumPages = options.maximumPages ?? 8;
    this.requestRetries = options.requestRetries ?? 1;
    this.fetchFunction = options.fetchFunction ?? fetch;
    this.resolveHost = options.resolveHost ?? defaultResolveHost;
  }

  private async safeUrl(
    value: string,
    upgradeHttp = false,
  ): Promise<URL> {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new FirstPartyResearchError("unsafe_url");
    }

    if (upgradeHttp && url.protocol === "http:") {
      url.protocol = "https:";
      url.port = "";
    }

    if (
      url.protocol !== "https:" ||
      url.username !== "" ||
      url.password !== "" ||
      (url.port !== "" && url.port !== "443") ||
      url.hostname === "localhost" ||
      url.hostname.endsWith(".localhost") ||
      url.hostname.endsWith(".local") ||
      url.hostname.endsWith(".internal")
    ) {
      throw new FirstPartyResearchError("unsafe_url");
    }

    const addresses = isIP(url.hostname) === 0
      ? await this.resolveHost(url.hostname)
      : [url.hostname];

    if (
      addresses.length === 0 ||
      addresses.some((address) => !ipIsPublic(address))
    ) {
      throw new FirstPartyResearchError("unsafe_url");
    }

    url.hash = "";
    return url;
  }

  private async boundedText(
    response: Response,
  ): Promise<{
    readonly value: string;
    readonly truncated: boolean;
  }> {
    if (response.body === null) {
      return {
        value: "",
        truncated: false,
      };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let total = 0;
    let value = "";

    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        return {
          value: value + decoder.decode(),
          truncated: false,
        };
      }

      const remaining = this.maximumBytes - total;
      if (remaining <= 0) {
        await reader.cancel();
        return {
          value: value + decoder.decode(),
          truncated: true,
        };
      }

      const accepted = chunk.value.byteLength > remaining
        ? chunk.value.slice(0, remaining)
        : chunk.value;
      total += accepted.byteLength;
      value += decoder.decode(accepted, {
        stream: true,
      });

      if (accepted.byteLength < chunk.value.byteLength) {
        await reader.cancel();
        return {
          value: value + decoder.decode(),
          truncated: true,
        };
      }
    }
  }

  private async requestPage(
    initialUrl: URL,
    priority: number,
  ): Promise<LoadedPage> {
    let url = initialUrl;

    for (let redirects = 0; redirects <= 3; redirects += 1) {
      let followedRedirect = false;

      for (let attempt = 0; attempt <= this.requestRetries; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          this.timeoutMs,
        );

        try {
          const response = await this.fetchFunction(
            url,
            {
              method: "GET",
              redirect: "manual",
              headers: {
                accept:
                  "text/html,application/xhtml+xml",
                "user-agent":
                  "CleanUpCentral-LeadEngineLite/1.2",
              },
              signal: controller.signal,
            },
          );

          if (
            response.status >= 300 &&
            response.status < 400
          ) {
            const location = response.headers.get(
              "location",
            );
            if (location === null || redirects === 3) {
              throw new FirstPartyResearchError(
                "temporarily_unavailable",
              );
            }
            url = await this.safeUrl(
              new URL(location, url).toString(),
              true,
            );
            followedRedirect = true;
            break;
          }

          if (
            [408, 425, 429, 500, 502, 503, 504]
              .includes(response.status)
          ) {
            if (attempt < this.requestRetries) {
              continue;
            }
            throw new FirstPartyResearchError(
              "temporarily_unavailable",
            );
          }

          if (!response.ok) {
            throw new FirstPartyResearchError(
              "unavailable",
            );
          }

          const mediaType = (
            response.headers.get("content-type") ?? ""
          )
            .split(";", 1)[0]
            ?.trim()
            .toLowerCase();
          if (
            mediaType !== "text/html" &&
            mediaType !== "application/xhtml+xml"
          ) {
            throw new FirstPartyResearchError(
              "invalid_content",
            );
          }

          const body = await this.boundedText(response);
          return {
            url,
            html: body.value,
            text: htmlText(body.value),
            truncated: body.truncated,
            priority,
          };
        } catch (error) {
          if (
            error instanceof FirstPartyResearchError &&
            error.failure !== "temporarily_unavailable"
          ) {
            throw error;
          }
          if (attempt >= this.requestRetries) {
            throw new FirstPartyResearchError(
              "temporarily_unavailable",
            );
          }
        } finally {
          clearTimeout(timeout);
        }
      }

      if (followedRedirect) continue;
    }

    throw new FirstPartyResearchError(
      "temporarily_unavailable",
    );
  }

  async recover(
    websiteUrl: string,
    businessName: string,
    sector: LeadSector,
  ): Promise<ContactRecoveryResult> {
    const start = await this.safeUrl(
      websiteUrl,
      true,
    );
    const targetTokens = businessTokens(businessName);
    const queue: QueuedPage[] = [{
      url: start,
      priority: 120,
    }];
    const queued = new Set<string>([
      start.toString(),
    ]);
    const visited = new Set<string>();
    const pages: LoadedPage[] = [];

    const enqueue = (
      candidates: readonly QueuedPage[],
    ) => {
      for (const candidate of candidates) {
        const key = candidate.url.toString();
        if (
          visited.has(key) ||
          queued.has(key)
        ) continue;
        queued.add(key);
        queue.push(candidate);
      }
      queue.sort((left, right) =>
        right.priority - left.priority ||
        left.url.toString().localeCompare(
          right.url.toString(),
        ));
    };

    while (
      queue.length > 0 &&
      pages.length < this.maximumPages
    ) {
      const requested = queue.shift()!;
      queued.delete(requested.url.toString());
      if (visited.has(requested.url.toString())) {
        continue;
      }

      try {
        const loaded = await this.requestPage(
          requested.url,
          requested.priority,
        );
        visited.add(requested.url.toString());
        visited.add(loaded.url.toString());

        if (loaded.url.origin !== start.origin) {
          continue;
        }

        pages.push(loaded);
        enqueue(pageLinks(
          loaded.html,
          loaded.url,
          sector,
          targetTokens,
        ));

        if (pages.length === 1) {
          enqueue(fallbackPages(loaded.url));
        }
      } catch (error) {
        visited.add(requested.url.toString());
        if (
          error instanceof FirstPartyResearchError &&
          [
            "temporarily_unavailable",
            "unavailable",
            "invalid_content",
          ].includes(error.failure)
        ) {
          continue;
        }
        throw error;
      }
    }

    const facts: AutomaticResearchFact[] = [];
    const seen = new Set<string>();
    const addFact = (
      fact: AutomaticResearchFact,
    ) => {
      const key = `${fact.factName}\n${
        fact.normalizedContactValue ??
        fact.factValue.toLowerCase()
      }`;
      if (seen.has(key)) return;
      seen.add(key);
      facts.push(fact);
    };

    const emails = pages
      .flatMap((page) => emailCandidates(page))
      .sort((left, right) =>
        right.score - left.score ||
        right.page.priority - left.page.priority ||
        left.email.localeCompare(right.email),
      );

    for (const email of emails.slice(0, 3)) {
      addFact(contactFact(
        email.page,
        "public_email",
        email.email,
        email.support,
        "email",
        email.email,
      ));
    }

    const phone = choosePhone(
      pages,
      businessName,
    );
    if (phone !== null) {
      addFact(contactFact(
        phone.page,
        "public_phone",
        phone.evidence.displayValue,
        phone.evidence.context ||
          phone.evidence.support,
        "phone",
        phone.evidence.normalizedValue,
      ));
    }

    const bestForm = pages
      .map((page) => ({
        page,
        evidence: detectContactForm(
          page.html,
          page.url,
        ),
      }))
      .filter((candidate) =>
        candidate.evidence !== null)
      .sort((left, right) =>
        (right.evidence?.score ?? 0) -
          (left.evidence?.score ?? 0) ||
        right.page.priority - left.page.priority,
      )[0];

    if (
      bestForm !== undefined &&
      bestForm.evidence !== null
    ) {
      addFact(contactFact(
        bestForm.page,
        "contact_form_url",
        bestForm.page.url.toString(),
        bestForm.evidence.support,
        "contact_form",
        bestForm.page.url.toString().toLowerCase(),
      ));
    }

    return {
      facts,
      visitedUrls: pages.map((page) =>
        page.url.toString()),
      truncatedPageCount: pages.filter(
        (page) => page.truncated,
      ).length,
    };
  }
}
