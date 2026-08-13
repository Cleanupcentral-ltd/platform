import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import type {
  AutomaticResearchFact,
  FirstPartyResearchProvider,
  FirstPartyResearchResult,
} from "../../ports/automatic-qualification.js";

import type {
  LeadSector,
} from "../../ports/lead-search.js";

type FetchFunction = typeof fetch;

export type FirstPartyResearchFailure =
  | "unsafe_url"
  | "temporarily_unavailable"
  | "unavailable"
  | "invalid_content";

export class FirstPartyResearchError
extends Error {
  readonly failure: FirstPartyResearchFailure;

  constructor(failure: FirstPartyResearchFailure) {
    super(failure);
    this.name = "FirstPartyResearchError";
    this.failure = failure;
  }
}

export interface FirstPartyResearchOptions {
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
}

const PAGE_LINK_PATTERN =
  /(?:about|contact|legal|terms|privacy|imprint|governance|company[-_ ]?information|corporate[-_ ]?information|charity)/i;

const COMPANY_NUMBER_PATTERNS = [
  /\b(?:(?:companies\s+house|company|co\.?|registration)\s*)?(?:registration\s*)?(?:number|no\.?)\s*(?:is\s*)?[:#-]?\s*((?:[a-z]{2}\s*\d{6})|(?:\d{8}))\b/giu,
  /\bregistered\s+(?:in|under)\s+(?:england(?:\s+and\s+wales)?|scotland|northern\s+ireland)?\s*(?:as\s+)?(?:company\s*)?(?:number|no\.?)?\s*[:#-]?\s*((?:[a-z]{2}\s*\d{6})|(?:\d{8}))\b/giu,
] as const;

const GENERIC_MAILBOXES = new Set([
  "admin",
  "bookings",
  "business",
  "commercial",
  "contact",
  "enquiries",
  "enquiry",
  "events",
  "hello",
  "info",
  "office",
  "operations",
  "reception",
  "sales",
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

const SECTOR_PATTERNS:
  Readonly<Record<LeadSector,
    readonly RegExp[]>> = {
    short_let_serviced_accommodation: [
      /\bserviced\s+(?:apartment|accommodation)s?\b/i,
      /\bshort[- ]?let\b/i,
      /\bholiday\s+(?:let|accommodation)s?\b/i,
      /\baparthotel\b/i,
    ],
    offices_coworking: [
      /\bco[- ]?working\b/i,
      /\bserviced\s+offices?\b/i,
      /\boffice\s+space\b/i,
      /\bbusiness\s+centre\b/i,
    ],
    community_halls_event_venues: [
      /\bcommunity\s+hall\b/i,
      /\bevent\s+venue\b/i,
      /\bvenue\s+hire\b/i,
      /\bfunction\s+room\b/i,
      /\bhall\s+hire\b/i,
    ],
    estate_letting_agents: [
      /\bestate\s+agents?\b/i,
      /\bletting\s+agents?\b/i,
      /\bproperty\s+management\b/i,
      /\bproperty\s+agents?\b/i,
    ],
    university_accommodation: [
      /\bstudent\s+accommodation\b/i,
      /\bhalls?\s+of\s+residence\b/i,
      /\bstudent\s+(?:living|residences?)\b/i,
      /\buniversity\s+accommodation\b/i,
    ],
    other_commercial_spaces: [
      /\bcommercial\s+(?:space|premises|property|unit)s?\b/i,
      /\bretail\s+(?:space|unit)s?\b/i,
      /\bindustrial\s+(?:space|unit)s?\b/i,
      /\bbusiness\s+premises\b/i,
    ],
  };

const SCALE_PATTERNS = [
  /\bour\s+locations\b/i,
  /\bmultiple\s+(?:locations|properties|sites|venues|units)\b/i,
  /\bportfolio\s+of\s+(?:properties|homes|venues|units)\b/i,
  /\b(?:manage|managing|operate|operating)\s+(?:more\s+than\s+|over\s+)?\d+\s+(?:properties|locations|sites|venues|units|rooms)\b/i,
  /\b\d+\s+(?:locations|properties|sites|venues|units)\s+(?:across|throughout)\b/i,
] as const;

const RECURRING_NEED_PATTERNS = [
  /\b(?:daily|weekly|regular)\s+(?:turnover|changeover|events?|bookings?|operations?)\b/i,
  /\b(?:guest|tenant|resident)\s+changeovers?\b/i,
  /\bcheck[- ]?in\b[\s\S]{0,80}\bcheck[- ]?out\b/i,
  /\bopen\s+(?:seven|7)\s+days\b/i,
] as const;

const METADATA_FIELDS = new Set([
  "description",
  "og:description",
  "og:site_name",
  "og:title",
  "twitter:description",
  "twitter:title",
]);

const JSON_LD_FIELDS = new Set([
  "addressLocality",
  "addressRegion",
  "alternateName",
  "description",
  "email",
  "legalName",
  "name",
  "postalCode",
  "streetAddress",
  "telephone",
  "url",
]);

const STRUCTURED_JSON_SCRIPT_TYPES = new Set([
  "application/ld+json",
  "application/json",
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
    normalized === "::" || normalized === "::1" ||
    normalized.startsWith("fc") || normalized.startsWith("fd") ||
    normalized.startsWith("2001:db8:") ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith("ff")
  );
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
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

function collectJsonLdStrings(
  value: unknown,
  output: string[],
  depth = 0,
): void {
  if (depth > 8 || output.length >= 80) return;
  if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonLdStrings(item, output, depth + 1);
    }
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (
      JSON_LD_FIELDS.has(key) &&
      typeof item === "string" &&
      item.trim().length > 0
    ) output.push(item.trim());
    if (item !== null && typeof item === "object") {
      collectJsonLdStrings(item, output, depth + 1);
    }
    if (output.length >= 80) return;
  }
}

function metadataText(html: string): string {
  const values: string[] = [];
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (title !== undefined) values.push(title.replace(/<[^>]+>/g, " "));

  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const key = (
      htmlAttribute(tag, "name") ?? htmlAttribute(tag, "property")
    )?.toLowerCase();
    const content = htmlAttribute(tag, "content");
    if (key !== undefined && METADATA_FIELDS.has(key) && content !== null) {
      values.push(content);
    }
  }

  for (const match of html.matchAll(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
  )) {
    const type = htmlAttribute(`<script ${match[1] ?? ""}>`, "type")
      ?.toLowerCase();
    if (type === undefined || !STRUCTURED_JSON_SCRIPT_TYPES.has(type)) continue;
    const body = match[2]?.trim();
    if (body === undefined || body.length === 0) continue;
    try {
      collectJsonLdStrings(JSON.parse(body) as unknown, values);
    } catch {
      // Malformed or truncated structured JSON cannot become evidence.
    }
  }

  return decodeHtml(values.join(" "))
    .replace(/\s+/g, " ")
    .trim();
}

function htmlText(html: string): string {
  const visibleText = decodeHtml(html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  return `${visibleText} ${metadataText(html)}`
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedWords(value: string): readonly string[] {
  const ignored = new Set([
    "and", "company", "group", "limited", "llp", "ltd", "plc", "the", "uk",
  ]);
  return value.toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length >= 2 && !ignored.has(word));
}

function identityMatch(
  businessName: string,
  text: string,
): RegExpMatchArray | null {
  const words = normalizedWords(businessName);
  if (words.length === 0) return null;
  const escapedWords = words.map((word) =>
    word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const exact = text.match(new RegExp(
    `\\b${escapedWords.join("[^a-z0-9]+")}\\b`,
    "i",
  ));
  if (exact !== null) return exact;
  const matched = words.filter((word) =>
    new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
      .test(text));
  const minimum = words.length === 1
    ? 1
    : Math.max(2, Math.ceil(words.length * 0.75));
  if (matched.length < minimum) return null;
  const pattern = new RegExp(
    `\\b(?:${matched.map((word) =>
      word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|")})\\b`,
    "i",
  );
  return text.match(pattern);
}

function excerpt(
  text: string,
  pattern: RegExp | RegExpMatchArray,
): string {
  const match = pattern instanceof RegExp
    ? text.match(pattern)
    : pattern;
  const index = match?.index ?? (
    match?.[0] === undefined
      ? 0
      : text.toLowerCase().indexOf(match[0].toLowerCase())
  );
  const matchLength = match?.[0]?.length ?? 0;
  return text.slice(
    Math.max(0, index - 140),
    Math.min(text.length, index + matchLength + 180),
  ).trim();
}

function pageLinks(html: string, sourceUrl: URL): readonly URL[] {
  const results = new Map<string, URL>();
  const linkPattern = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(linkPattern)) {
    const href = match[1];
    const label = htmlText(match[2] ?? "");
    if (
      href === undefined ||
      !PAGE_LINK_PATTERN.test(`${href} ${label}`)
    ) continue;
    try {
      const candidate = new URL(href, sourceUrl);
      candidate.hash = "";
      if (
        candidate.protocol === "https:" &&
        candidate.origin === sourceUrl.origin
      ) results.set(candidate.toString(), candidate);
    } catch {
      // Malformed links cannot become evidence.
    }
  }
  return [...results.values()];
}

function canonicalPageLinks(
  html: string,
  sourceUrl: URL,
): readonly URL[] {
  const results = new Map<string, URL>();
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = htmlAttribute(tag, "rel")
      ?.toLowerCase()
      .split(/\s+/) ?? [];
    const href = htmlAttribute(tag, "href");
    if (!rel.includes("canonical") || href === null) continue;
    try {
      const candidate = new URL(href, sourceUrl);
      candidate.hash = "";
      if (
        candidate.protocol === "https:" &&
        candidate.origin === sourceUrl.origin &&
        candidate.toString() !== sourceUrl.toString()
      ) results.set(candidate.toString(), candidate);
    } catch {
      // Malformed canonical links cannot become evidence.
    }
  }
  return [...results.values()];
}

function pageDiagnostic(page: LoadedPage) {
  const scriptTypes = [...page.html.matchAll(
    /<script\b([^>]*)>/gi,
  )].map((match) =>
    htmlAttribute(`<script ${match[1] ?? ""}>`, "type")
      ?.toLowerCase() ?? "");
  return {
    url: `${page.url.origin}${page.url.pathname}`,
    htmlCharacters: page.html.length,
    extractedTextCharacters: page.text.length,
    titlePresent: /<title\b[^>]*>/i.test(page.html),
    metaTagCount: [...page.html.matchAll(/<meta\b[^>]*>/gi)].length,
    jsonLdScriptCount: scriptTypes.filter(
      (type) => type === "application/ld+json",
    ).length,
    applicationJsonScriptCount: scriptTypes.filter(
      (type) => type === "application/json",
    ).length,
    canonicalLinkCount: canonicalPageLinks(page.html, page.url).length,
    truncated: page.truncated,
  };
}

function companyNumberAssertions(
  pages: readonly LoadedPage[],
): FirstPartyResearchResult["companyNumberAssertions"] {
  const found = new Map<string, {
    readonly companyNumber: string;
    readonly sourceUrl: string;
    readonly sourceExcerpt: string;
    readonly contentSha256: string;
  }>();
  for (const page of pages) {
    for (const pattern of COMPANY_NUMBER_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of page.text.matchAll(pattern)) {
        const captured = match[1];
        if (captured === undefined) continue;
        const value = captured.replace(/\s+/g, "").toUpperCase();
        if (/^(?:[A-Z]{2}\d{6}|\d{8})$/.test(value) && !found.has(value)) {
          const support = excerpt(page.text, match);
          found.set(value, {
            companyNumber: value,
            sourceUrl: page.url.toString(),
            sourceExcerpt: support,
            contentSha256: sha256(`${page.url}\ncompany_number\n${value}\n${support}`),
          });
        }
      }
    }
  }
  return [...found.values()].sort((left, right) =>
    left.companyNumber.localeCompare(right.companyNumber));
}

function organisationType(
  hostname: string,
  text: string,
): FirstPartyResearchResult["organisationType"] {
  if (hostname === "gov.uk" || hostname.endsWith(".gov.uk")) {
    return "public_body";
  }
  if (hostname === "ac.uk" || hostname.endsWith(".ac.uk")) {
    return "university";
  }
  if (/\b(?:registered\s+charity|charity\s+(?:number|no\.?))\b/i.test(text)) {
    return "charity";
  }
  if (/\b(?:community\s+(?:association|organisation|organization|group)|village\s+hall)\b/i.test(text)) {
    return "community_organisation";
  }
  return "commercial";
}

async function defaultResolveHost(hostname: string): Promise<readonly string[]> {
  return (await lookup(hostname, {
    all: true,
    verbatim: true,
  })).map((record) => record.address);
}

export class FirstPartyResearchClient
implements FirstPartyResearchProvider {
  private readonly timeoutMs: number;
  private readonly maximumBytes: number;
  private readonly maximumPages: number;
  private readonly requestRetries: number;
  private readonly fetchFunction: FetchFunction;
  private readonly resolveHost: (
    hostname: string,
  ) => Promise<readonly string[]>;

  constructor(options: FirstPartyResearchOptions) {
    this.timeoutMs = options.timeoutMs;
    this.maximumBytes = options.maximumBytes;
    this.maximumPages = options.maximumPages ?? 6;
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
      url.protocol !== "https:" || url.username !== "" ||
      url.password !== "" || (url.port !== "" && url.port !== "443") ||
      url.hostname === "localhost" ||
      url.hostname.endsWith(".localhost") ||
      url.hostname.endsWith(".local") ||
      url.hostname.endsWith(".internal")
    ) throw new FirstPartyResearchError("unsafe_url");

    const addresses = isIP(url.hostname) === 0
      ? await this.resolveHost(url.hostname)
      : [url.hostname];
    if (addresses.length === 0 || addresses.some((address) => !ipIsPublic(address))) {
      throw new FirstPartyResearchError("unsafe_url");
    }
    url.hash = "";
    return url;
  }

  private async boundedText(response: Response): Promise<{
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
      if (chunk.done) return {
        value: value + decoder.decode(),
        truncated: false,
      };
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

  private async requestPage(initialUrl: URL): Promise<LoadedPage> {
    let url = initialUrl;
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      let lastFailure: unknown = null;
      for (let attempt = 0; attempt <= this.requestRetries; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
          const response = await this.fetchFunction(url, {
            method: "GET",
            redirect: "manual",
            headers: {
              accept: "text/html,application/xhtml+xml",
              "user-agent": "CleanUpCentral-LeadEngineLite/1.1",
            },
            signal: controller.signal,
          });
          if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location");
            if (location === null || redirects === 3) {
              throw new FirstPartyResearchError("temporarily_unavailable");
            }
            url = await this.safeUrl(new URL(location, url).toString(), true);
            lastFailure = null;
            break;
          }
          if ([408, 425, 429, 500, 502, 503, 504].includes(response.status)) {
            lastFailure = new FirstPartyResearchError("temporarily_unavailable");
            if (attempt < this.requestRetries) continue;
            throw lastFailure;
          }
          if (!response.ok) {
            throw new FirstPartyResearchError("unavailable");
          }
          const mediaType = (response.headers.get("content-type") ?? "")
            .split(";", 1)[0]?.trim().toLowerCase();
          if (mediaType !== "text/html" && mediaType !== "application/xhtml+xml") {
            throw new FirstPartyResearchError("invalid_content");
          }
          const body = await this.boundedText(response);
          return {
            url,
            html: body.value,
            text: htmlText(body.value),
            truncated: body.truncated,
          };
        } catch (error) {
          lastFailure = error;
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
      if (lastFailure === null) continue;
    }
    throw new FirstPartyResearchError("temporarily_unavailable");
  }

  async research(
    websiteUrl: string,
    businessName: string,
    sector: LeadSector,
  ): Promise<FirstPartyResearchResult> {
    const start = await this.safeUrl(websiteUrl, true);
    const queue: URL[] = [start];
    const visited = new Set<string>();
    const pages: LoadedPage[] = [];
    while (queue.length > 0 && pages.length < this.maximumPages) {
      const requested = queue.shift()!;
      if (visited.has(requested.toString())) continue;
      const loaded = await this.requestPage(requested);
      visited.add(requested.toString());
      visited.add(loaded.url.toString());
      pages.push(loaded);
      if (pages.length === 1) {
        queue.unshift(...canonicalPageLinks(loaded.html, loaded.url));
        queue.push(...pageLinks(loaded.html, loaded.url));
      }
    }
    const identityPage = pages.find((page) =>
      identityMatch(businessName, page.text) !== null);
    if (identityPage === undefined) {
      console.info(JSON.stringify({
        event: "lead_first_party_identity_not_confirmed",
        pages: pages.map(pageDiagnostic),
      }));
      return {
        canonicalWebsiteUrl: pages[0]?.url.toString() ?? start.toString(),
        companyNumberAssertions: [],
        facts: [],
        visitedUrls: pages.map((page) => page.url.toString()),
        truncatedPageCount: pages.filter((page) => page.truncated).length,
        organisationType: "unknown",
        reviewReasons: ["website_identity_not_confirmed"],
      };
    }

    const combinedText = pages.map((page) => page.text).join(" ");
    const type = organisationType(identityPage.url.hostname, combinedText);
    const facts: AutomaticResearchFact[] = [];
    const seen = new Set<string>();
    const addFact = (
      page: LoadedPage,
      factName: AutomaticResearchFact["factName"],
      factValue: string,
      support: string,
      contactType: AutomaticResearchFact["contactType"] = null,
    ) => {
      const key = `${factName}\n${factValue.toLowerCase()}`;
      if (seen.has(key) || support.length === 0) return;
      seen.add(key);
      facts.push({
        sourceUrl: page.url.toString(),
        factName,
        factValue,
        sourceExcerpt: support.slice(0, 700),
        contentSha256: sha256(`${page.url}\n${factName}\n${factValue}\n${support}`),
        contactType,
        normalizedContactValue: contactType === null ? null : factValue.toLowerCase(),
      });
    };

    const identity = identityMatch(businessName, identityPage.text)!;
    const identityExcerpt = excerpt(identityPage.text, identity);
    addFact(identityPage, "business_name", businessName.trim(), identityExcerpt);
    addFact(identityPage, "website_url", identityPage.url.toString(), identityExcerpt);
    addFact(identityPage, "organisation_type", type, identityExcerpt);

    const sectorPage = pages.find((page) =>
      SECTOR_PATTERNS[sector].some((pattern) => pattern.test(page.text)));
    if (sectorPage !== undefined) {
      const pattern = SECTOR_PATTERNS[sector].find((item) => item.test(sectorPage.text))!;
      addFact(sectorPage, "approved_sector", sector, excerpt(sectorPage.text, pattern));
    }

    for (const page of pages) {
      const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
      for (const match of page.text.matchAll(emailPattern)) {
        const email = match[0].toLowerCase();
        const [localPart, domain] = email.split("@") as [string, string];
        if (
          !GENERIC_MAILBOXES.has(localPart) ||
          PERSONAL_MAIL_DOMAINS.has(domain)
        ) continue;
        addFact(page, "public_email", email, excerpt(page.text, match), "email");
      }
      if (
        /<form\b/i.test(page.html) &&
        (
          /(?:contact|enquir|inquiry|get-in-touch)/i
            .test(page.url.pathname) ||
          /\b(?:contact\s+us|send\s+(?:us\s+)?a\s+message|make\s+an\s+enquir|general\s+enquir)/i
            .test(page.text)
        )
      ) {
        addFact(
          page,
          "contact_form_url",
          page.url.toString(),
          "A public contact form is present on this first-party page.",
          "contact_form",
        );
      }
    }

    const scalePage = pages.find((page) =>
      SCALE_PATTERNS.some((pattern) => pattern.test(page.text)));
    if (scalePage !== undefined) {
      const pattern = SCALE_PATTERNS.find((item) => item.test(scalePage.text))!;
      addFact(
        scalePage,
        "premises_scale",
        "multiple_properties_locations_or_units",
        excerpt(scalePage.text, pattern),
      );
    }
    const recurringPage = pages.find((page) =>
      RECURRING_NEED_PATTERNS.some((pattern) => pattern.test(page.text)));
    if (recurringPage !== undefined) {
      const pattern = RECURRING_NEED_PATTERNS.find((item) => item.test(recurringPage.text))!;
      addFact(
        recurringPage,
        "recurring_cleaning_need",
        "recurring_operational_or_turnover_need",
        excerpt(recurringPage.text, pattern),
      );
    }

    if (type === "university" || type === "public_body") {
      addFact(identityPage, "business_status", "active", identityExcerpt);
      addFact(identityPage, "subscriber_type", "corporate", identityExcerpt);
    }

    const reviewReasons: string[] = [];
    if (sectorPage === undefined) reviewReasons.push("approved_sector_not_confirmed");
    if (!facts.some((fact) => fact.contactType !== null)) {
      reviewReasons.push("no_generic_business_contact_found");
    }
    if (["charity", "community_organisation", "commercial"].includes(type)) {
      reviewReasons.push("subscriber_type_requires_official_verification");
    }

    return {
      canonicalWebsiteUrl: identityPage.url.toString(),
      companyNumberAssertions: companyNumberAssertions(pages),
      facts,
      visitedUrls: pages.map((page) => page.url.toString()),
      truncatedPageCount: pages.filter((page) => page.truncated).length,
      organisationType: type,
      reviewReasons,
    };
  }
}
