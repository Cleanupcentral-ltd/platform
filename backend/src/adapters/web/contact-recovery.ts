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

interface Page {
  readonly url: URL;
  readonly html: string;
  readonly text: string;
  readonly structuredText: string;
  readonly truncated: boolean;
  readonly priority: number;
}

interface QueuedPage {
  readonly url: URL;
  readonly priority: number;
}

interface EmailCandidate {
  readonly page: Page;
  readonly email: string;
  readonly support: string;
  readonly score: number;
}

interface PhoneCandidate {
  readonly page: Page;
  readonly evidence: PublicPhoneEvidence;
  readonly branchScore: number;
}

const GENERIC_MAILBOXES = new Set([
  "accommodation", "admin", "bookings", "business", "commercial",
  "contact", "enquiries", "enquiry", "events", "facilities",
  "functions", "hello", "hire", "housing", "info", "lettings",
  "management", "office", "operations", "property", "reception",
  "reservations", "residences", "sales", "spa", "student", "students",
  "support", "team", "venue",
]);

const PERSONAL_MAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "icloud.com",
  "live.co.uk", "live.com", "outlook.com", "yahoo.co.uk", "yahoo.com",
]);

const DISALLOWED_PATH =
  /(?:^|\/)(?:careers?|jobs?|vacanc(?:y|ies)|recruit(?:ment|ing)?|compliance|privacy(?:-policy)?|terms(?:-and-conditions)?|cookie(?:-policy)?|legal|news|blog|tag-[^/]+)(?:\/|$|[-_])/i;

const CONTACT_LINK =
  /(?:contact(?:-us)?|get[-_ ]?in[-_ ]?touch|enquir(?:y|ies)|inquir(?:y|ies)|find[-_ ]?us)/i;

const LOCATION_LINK =
  /(?:our[-_ ]?(?:offices?|branches?|locations?)|offices?|branches?|locations?|find[-_ ]?(?:an[-_ ]?)?(?:office|branch|location))/i;

const HIRE_LINK =
  /(?:venue[-_ ]?hire|hall[-_ ]?hire|room[-_ ]?hire|function[-_ ]?(?:room|enquir)|hire|bookings?|reservations?)/i;

const SECTOR_LINKS: Readonly<Record<LeadSector, RegExp>> = {
  short_let_serviced_accommodation:
    /(?:apartments?|accommodation|locations?|properties|reservations?)/i,
  offices_coworking:
    /(?:offices?|workspace|cowork|business[-_ ]?centre|locations?)/i,
  community_halls_event_venues:
    /(?:venue|hall|function|events?|hire|bookings?)/i,
  estate_letting_agents:
    /(?:estate[-_ ]?agents?|lettings?|sales|property[-_ ]?management|branches?|offices?)/i,
  university_accommodation:
    /(?:accommodation|residences?|halls?|student[-_ ]?living|contact)/i,
  other_commercial_spaces:
    /(?:commercial|property|premises|units?|locations?|offices?)/i,
};

const FALLBACK_PATHS = [
  "/contact",
  "/contact.html",
  "/contact-us",
  "/contact-us.html",
  "/get-in-touch",
  "/get-in-touch.html",
  "/enquiries",
  "/enquiries.html",
  "/locations",
  "/our-locations",
  "/offices",
  "/our-offices",
  "/branches",
  "/hire",
] as const;

const CONTACT_RECOVERY_MAX_BYTES = 1_048_576;

const BUSINESS_STOPWORDS = new Set([
  "accommodation", "agent", "agents", "and", "commercial", "company",
  "community", "coworking", "development", "division", "estate", "event",
  "events", "hall", "halls", "house", "letting", "lettings", "limited",
  "ltd", "office", "offices", "property", "sales", "student", "the",
  "university", "venue",
]);

const STRUCTURED_CONTACT_KEYS =
  /(?:address|branch|contact|email|location|mail|name|office|phone|tel)/i;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#(x?[0-9a-f]+);?/gi, (full, encoded: string) => {
      const isHex = encoded.toLowerCase().startsWith("x");
      const code = Number.parseInt(
        isHex ? encoded.slice(1) : encoded,
        isHex ? 16 : 10,
      );
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
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function visibleText(html: string): string {
  return decodeHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  ).replace(/\s+/g, " ").trim();
}

function htmlAttribute(tag: string, name: string): string | null {
  const quoted = tag.match(new RegExp(
    `\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`,
    "i",
  ));
  return quoted?.[2] === undefined
    ? null
    : decodeHtml(quoted[2]).trim();
}

function collectStructuredContactStrings(
  value: unknown,
  output: string[],
  depth = 0,
): void {
  if (depth > 8 || output.length >= 120) return;
  if (Array.isArray(value)) {
    for (const item of value) {
      collectStructuredContactStrings(item, output, depth + 1);
    }
    return;
  }
  if (value === null || typeof value !== "object") return;

  for (const [key, item] of Object.entries(value)) {
    if (
      typeof item === "string" &&
      item.trim().length > 0 &&
      STRUCTURED_CONTACT_KEYS.test(key)
    ) {
      output.push(item.trim());
    }
    if (item !== null && typeof item === "object") {
      collectStructuredContactStrings(item, output, depth + 1);
    }
    if (output.length >= 120) return;
  }
}

function structuredContactText(html: string): string {
  const values: string[] = [];
  for (const match of html.matchAll(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
  )) {
    const tag = `<script ${match[1] ?? ""}>`;
    const type = htmlAttribute(tag, "type")?.toLowerCase();
    if (type !== "application/ld+json" && type !== "application/json") {
      continue;
    }
    const body = match[2]?.trim();
    if (body === undefined || body.length === 0) continue;
    try {
      collectStructuredContactStrings(
        JSON.parse(body) as unknown,
        values,
      );
    } catch {
      // Malformed or truncated JSON is ignored.
    }
  }
  return decodeHtml(values.join(" "))
    .replace(/\s+/g, " ")
    .trim();
}

function javascriptCloakedEmailText(html: string): string {
  const values: string[] = [];
  for (const match of html.matchAll(
    /<script\b[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    const body = match[1] ?? "";
    if (!/(?:addy|cloak|mailto|spambot)/i.test(body)) continue;

    const assembled = new Map<string, string>();
    for (const assignment of body.matchAll(
      /(?:var\s+)?(addy[a-z0-9_]*)\s*=\s*([\s\S]*?);(?=\s*(?:(?:var\s+)?addy[a-z0-9_]*\s*=|document\.|$))/gi,
    )) {
      const name = assignment[1]?.toLowerCase();
      const expression = assignment[2] ?? "";
      if (name === undefined) continue;
      const pieces = [...expression.matchAll(
        /["']([^"']*)["']/g,
      )].map((piece) => decodeHtml(piece[1] ?? ""));
      if (pieces.length === 0) continue;
      const fragment = pieces.join("");
      const previous = assembled.get(name) ?? "";
      assembled.set(
        name,
        new RegExp(`\\b${name}\\b`, "i").test(expression)
          ? `${previous}${fragment}`
          : fragment,
      );
    }
    values.push(...assembled.values());
  }

  return values.join(" ");
}

function businessTokens(value: string): readonly string[] {
  return [...new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter((word) =>
        word.length >= 3 && !BUSINESS_STOPWORDS.has(word)),
  )];
}

function tokenMatches(
  tokens: readonly string[],
  value: string,
): number {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
  return tokens.filter((token) =>
    new RegExp(
      `\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i",
    ).test(normalized),
  ).length;
}

function excerpt(text: string, needle: string): string {
  const index = text.toLowerCase().indexOf(needle.toLowerCase());
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
  tokens: readonly string[],
): number {
  if (DISALLOWED_PATH.test(href)) return -1;
  const value = `${href} ${label}`;
  let score = CONTACT_LINK.test(value)
    ? 100
    : LOCATION_LINK.test(value)
      ? 90
      : HIRE_LINK.test(value)
        ? 85
        : SECTOR_LINKS[sector].test(value)
          ? 70
          : -1;
  if (score < 0) return score;
  score += tokenMatches(tokens, value) * 30;
  return score;
}

function discoveredLinks(
  page: Page,
  sector: LeadSector,
  tokens: readonly string[],
): readonly QueuedPage[] {
  const found = new Map<string, QueuedPage>();
  for (
    const match of page.html.matchAll(
      /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    )
  ) {
    const href = match[1];
    if (href === undefined) continue;
    const priority = linkPriority(
      href,
      visibleText(match[2] ?? ""),
      sector,
      tokens,
    );
    if (priority < 0) continue;
    try {
      const url = new URL(href, page.url);
      url.hash = "";
      if (url.protocol !== "https:" || url.origin !== page.url.origin) {
        continue;
      }
      const current = found.get(url.toString());
      if (current === undefined || current.priority < priority) {
        found.set(url.toString(), { url, priority });
      }
    } catch {
      // Ignore malformed links.
    }
  }
  return [...found.values()];
}

function decodeCfEmail(value: string): string | null {
  if (
    value.length < 4 ||
    value.length % 2 !== 0 ||
    !/^[0-9a-f]+$/i.test(value)
  ) return null;
  const key = Number.parseInt(value.slice(0, 2), 16);
  let result = "";
  for (let index = 2; index < value.length; index += 2) {
    result += String.fromCharCode(
      Number.parseInt(value.slice(index, index + 2), 16) ^ key,
    );
  }
  return result;
}

function normalizeObfuscatedEmail(value: string): string {
  return value
    .replace(/\s*(?:\[at\]|\(at\)|\{at\})\s*/gi, "@")
    .replace(/\s+at\s+(?=[a-z0-9.-]+\s+(?:\[dot\]|\(dot\)|\{dot\}|dot\s))/gi, "@")
    .replace(/\s*(?:\[dot\]|\(dot\)|\{dot\})\s*/gi, ".")
    .replace(/\s+dot\s+/gi, ".")
    .replace(/\s*@\s*/g, "@")
    .replace(/\s*\.\s*/g, ".");
}

function approvedEmail(raw: string): string | null {
  const email = raw
    .trim()
    .replace(/^mailto:/i, "")
    .split(/[?#]/, 1)[0]!
    .toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) {
    return null;
  }
  const [localPart, domain] = email.split("@") as [string, string];
  if (PERSONAL_MAIL_DOMAINS.has(domain)) return null;
  const mailbox = localPart.split(/[._+-]/, 1)[0] ?? "";
  return GENERIC_MAILBOXES.has(mailbox) ? email : null;
}

function emailMatchesWebsite(
  email: string,
  hostname: string,
): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  const host = hostname.toLowerCase().replace(/^www\./, "");
  if (domain === undefined) return false;
  return (
    domain === host ||
    hostname.toLowerCase().endsWith(`.${domain}`) ||
    domain.endsWith(`.${host}`)
  );
}

function emailsFrom(page: Page): readonly EmailCandidate[] {
  const found = new Map<string, EmailCandidate>();
  const add = (
    raw: string,
    support: string,
    score: number,
    requireWebsiteDomain = false,
  ) => {
    const email = approvedEmail(raw);
    if (
      email === null ||
      (
        requireWebsiteDomain &&
        !emailMatchesWebsite(email, page.url.hostname)
      )
    ) return;
    const current = found.get(email);
    if (current === undefined || current.score < score) {
      found.set(email, { page, email, support, score });
    }
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
      // Keep the raw value if decoding fails.
    }
    add(
      raw,
      `Verified public email recovery v2: first-party mailto link publishes ${raw.split(/[?#]/, 1)[0] ?? raw}.`,
      50,
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
        `Verified public email recovery v2: first-party anti-spam markup decodes to ${decoded}.`,
        45,
      );
    }
  }

  for (const [text, score, hostBound] of [
    [page.text, 35, false],
    [page.structuredText, 32, true],
    [javascriptCloakedEmailText(page.html), 40, true],
    [decodeHtml(page.html), 28, true],
  ] as const) {
    const normalized = normalizeObfuscatedEmail(text);
    for (
      const match of normalized.matchAll(
        /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      )
    ) {
      const raw = match[0];
      add(raw, excerpt(normalized, raw), score, hostBound);
    }
  }

  return [...found.values()];
}

function tokenProximityScore(
  tokens: readonly string[],
  evidence: PublicPhoneEvidence,
): number {
  const context = (evidence.context ?? "").toLowerCase();
  if (context.length === 0) return 0;

  const display = evidence.displayValue.toLowerCase();
  const phoneIndex = context.indexOf(display);
  const anchor = phoneIndex >= 0
    ? phoneIndex
    : Math.floor(context.length / 2);

  let score = 0;
  for (const token of tokens) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const match of context.matchAll(
      new RegExp(`\\b${escaped}\\b`, "gi"),
    )) {
      const distance = Math.abs((match.index ?? anchor) - anchor);
      if (distance <= 60) {
        score += 12;
        break;
      }
      if (distance <= 140) {
        score += 3;
        break;
      }
    }
  }
  return score;
}

function choosePhone(
  pages: readonly Page[],
  businessName: string,
): PhoneCandidate | null {
  const tokens = businessTokens(businessName);
  const candidates = pages.flatMap((page) =>
    extractPublicPhones(
      page.html,
      `${page.text} ${page.structuredText}`.trim(),
      { allowConflictingLocations: true },
    ).map((evidence) => ({
      page,
      evidence,
      branchScore:
        tokenMatches(tokens, page.url.pathname) * 8 +
        tokenProximityScore(tokens, evidence),
    })),
  ).sort((left, right) =>
    right.branchScore - left.branchScore ||
    right.evidence.score - left.evidence.score ||
    right.page.priority - left.page.priority,
  );

  const best = candidates[0];
  if (best === undefined) return null;
  if (candidates.length === 1) return best;
  const second = candidates[1]!;
  if (best.branchScore > second.branchScore) return best;

  const samePage = candidates.every((candidate) =>
    candidate.page.url.toString() === best.page.url.toString());
  if (
    samePage &&
    tokenMatches(tokens, best.page.url.pathname) > 0
  ) return best;

  return null;
}

function contactFact(
  page: Page,
  factName: AutomaticResearchFact["factName"],
  factValue: string,
  support: string,
  contactType: Exclude<AutomaticResearchFact["contactType"], null>,
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

function ipv4IsPublic(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) =>
    !Number.isInteger(value) || value < 0 || value > 255)) {
    return false;
  }
  const [first, second, third] = octets as [number, number, number];
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
    normalized === "::" || normalized === "::1" ||
    normalized.startsWith("fc") || normalized.startsWith("fd") ||
    normalized.startsWith("2001:db8:") || /^fe[89ab]/.test(normalized) ||
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
    // Contact Recovery only runs after ordinary first-party research has missed
    // a usable route. Give that second pass one additional bounded read window
    // without changing the ordinary research limit or exceeding 1 MiB.
    this.maximumBytes = Math.min(
      CONTACT_RECOVERY_MAX_BYTES,
      options.maximumBytes * 2,
    );
    this.maximumPages = options.maximumPages ?? 8;
    this.requestRetries = options.requestRetries ?? 1;
    this.fetchFunction = options.fetchFunction ?? fetch;
    this.resolveHost = options.resolveHost ?? defaultResolveHost;
  }

  private async safeUrl(value: string, upgradeHttp = false): Promise<URL> {
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
    ) throw new FirstPartyResearchError("unsafe_url");

    const addresses = isIP(url.hostname) === 0
      ? await this.resolveHost(url.hostname)
      : [url.hostname];
    if (addresses.length === 0 || addresses.some((item) => !ipIsPublic(item))) {
      throw new FirstPartyResearchError("unsafe_url");
    }
    url.hash = "";
    return url;
  }

  private async boundedBody(response: Response): Promise<{
    readonly value: string;
    readonly truncated: boolean;
  }> {
    if (response.body === null) return { value: "", truncated: false };
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let total = 0;
    let value = "";
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        return { value: value + decoder.decode(), truncated: false };
      }
      const remaining = this.maximumBytes - total;
      if (remaining <= 0) {
        await reader.cancel();
        return { value: value + decoder.decode(), truncated: true };
      }
      const accepted = chunk.value.byteLength > remaining
        ? chunk.value.slice(0, remaining)
        : chunk.value;
      total += accepted.byteLength;
      value += decoder.decode(accepted, { stream: true });
      if (accepted.byteLength < chunk.value.byteLength) {
        await reader.cancel();
        return { value: value + decoder.decode(), truncated: true };
      }
    }
  }

  private async requestPage(
    initialUrl: URL,
    priority: number,
  ): Promise<Page> {
    let url = initialUrl;
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      let redirectUrl: URL | null = null;
      for (let attempt = 0; attempt <= this.requestRetries; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
          const response = await this.fetchFunction(url, {
            method: "GET",
            redirect: "manual",
            headers: {
              accept: "text/html,application/xhtml+xml",
              "user-agent": "CleanUpCentral-LeadEngineLite/1.3",
            },
            signal: controller.signal,
          });
          if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location");
            if (location === null || redirects === 3) {
              throw new FirstPartyResearchError("temporarily_unavailable");
            }
            redirectUrl = await this.safeUrl(
              new URL(location, url).toString(),
              true,
            );
            break;
          }
          if ([408, 425, 429, 500, 502, 503, 504].includes(response.status)) {
            if (attempt < this.requestRetries) continue;
            throw new FirstPartyResearchError("temporarily_unavailable");
          }
          if (!response.ok) {
            throw new FirstPartyResearchError("unavailable");
          }
          const type = (response.headers.get("content-type") ?? "")
            .split(";", 1)[0]?.trim().toLowerCase();
          if (type !== "text/html" && type !== "application/xhtml+xml") {
            throw new FirstPartyResearchError("invalid_content");
          }
          const body = await this.boundedBody(response);
          return {
            url,
            html: body.value,
            text: visibleText(body.value),
            structuredText: structuredContactText(body.value),
            truncated: body.truncated,
            priority,
          };
        } catch (error) {
          if (
            error instanceof FirstPartyResearchError &&
            error.failure !== "temporarily_unavailable"
          ) throw error;
          if (attempt >= this.requestRetries) {
            throw new FirstPartyResearchError("temporarily_unavailable");
          }
        } finally {
          clearTimeout(timeout);
        }
      }
      if (redirectUrl !== null) {
        url = redirectUrl;
        continue;
      }
    }
    throw new FirstPartyResearchError("temporarily_unavailable");
  }

  async recover(
    websiteUrl: string,
    businessName: string,
    sector: LeadSector,
  ): Promise<ContactRecoveryResult> {
    const start = await this.safeUrl(websiteUrl, true);
    const tokens = businessTokens(businessName);
    const queue: QueuedPage[] = [{ url: start, priority: 120 }];
    const queued = new Set([start.toString()]);
    const visited = new Set<string>();
    const pages: Page[] = [];

    const enqueue = (items: readonly QueuedPage[]) => {
      for (const item of items) {
        const key = item.url.toString();
        if (visited.has(key) || queued.has(key)) continue;
        queued.add(key);
        queue.push(item);
      }
      queue.sort((left, right) =>
        right.priority - left.priority ||
        left.url.toString().localeCompare(right.url.toString()));
    };

    while (queue.length > 0 && pages.length < this.maximumPages) {
      const requested = queue.shift()!;
      queued.delete(requested.url.toString());
      if (visited.has(requested.url.toString())) continue;
      try {
        const page = await this.requestPage(requested.url, requested.priority);
        visited.add(requested.url.toString());
        visited.add(page.url.toString());
        if (page.url.origin !== start.origin) continue;
        pages.push(page);
        enqueue(discoveredLinks(page, sector, tokens));
        if (pages.length === 1) {
          enqueue(FALLBACK_PATHS.map((path, index) => ({
            url: new URL(path, page.url.origin),
            priority: 55 - index,
          })));
        }
      } catch (error) {
        visited.add(requested.url.toString());
        if (
          error instanceof FirstPartyResearchError &&
          ["temporarily_unavailable", "unavailable", "invalid_content"]
            .includes(error.failure)
        ) continue;
        throw error;
      }
    }

    const facts: AutomaticResearchFact[] = [];

    const distinctEmails = new Map<string, EmailCandidate>();
    for (const candidate of pages.flatMap(emailsFrom)) {
      const current = distinctEmails.get(candidate.email);
      if (
        current === undefined ||
        candidate.score > current.score ||
        (
          candidate.score === current.score &&
          candidate.page.priority > current.page.priority
        )
      ) distinctEmails.set(candidate.email, candidate);
    }

    for (
      const candidate of [...distinctEmails.values()]
        .sort((left, right) =>
          right.score - left.score ||
          right.page.priority - left.page.priority ||
          left.email.localeCompare(right.email))
        .slice(0, 3)
    ) {
      facts.push(contactFact(
        candidate.page,
        "public_email",
        candidate.email,
        candidate.support,
        "email",
        candidate.email,
      ));
    }

    const phone = choosePhone(pages, businessName);
    if (phone !== null) {
      facts.push(contactFact(
        phone.page,
        "public_phone",
        phone.evidence.displayValue,
        phone.evidence.context || phone.evidence.support,
        "phone",
        phone.evidence.normalizedValue,
      ));
    }

    const form = pages
      .map((page) => ({
        page,
        evidence: detectContactForm(page.html, page.url),
      }))
      .filter((item) => item.evidence !== null)
      .sort((left, right) =>
        (right.evidence?.score ?? 0) - (left.evidence?.score ?? 0) ||
        right.page.priority - left.page.priority)[0];

    if (form?.evidence !== null && form?.evidence !== undefined) {
      facts.push(contactFact(
        form.page,
        "contact_form_url",
        form.page.url.toString(),
        form.evidence.support,
        "contact_form",
        form.page.url.toString().toLowerCase(),
      ));
    }

    return {
      facts,
      visitedUrls: pages.map((page) => page.url.toString()),
      truncatedPageCount: pages.filter((page) => page.truncated).length,
    };
  }
}
