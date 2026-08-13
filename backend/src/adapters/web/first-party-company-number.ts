import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import type {
  FirstPartyCompanyNumberEvidence,
  FirstPartyCompanyNumberProvider,
} from "../../ports/company-enrichment.js";

type FetchFunction = typeof fetch;

export type FirstPartyLookupFailure =
  | "unsafe_url"
  | "unavailable"
  | "invalid_content"
  | "too_large";

export class FirstPartyLookupError
extends Error {
  readonly failure: FirstPartyLookupFailure;

  constructor(failure: FirstPartyLookupFailure) {
    super(failure);
    this.name = "FirstPartyLookupError";
    this.failure = failure;
  }
}

export interface FirstPartyCompanyNumberOptions {
  readonly timeoutMs: number;
  readonly maximumBytes: number;
  readonly maximumPages?: number;
  readonly fetchFunction?: FetchFunction;
  readonly resolveHost?: (
    hostname: string,
  ) => Promise<readonly string[]>;
}

const COMPANY_NUMBER_PATTERN =
  /\b(?:(?:companies\s+house|company|co\.?|registration)\s*)?(?:registration\s*)?(?:number|no\.?)\s*(?:is\s*)?[:#-]?\s*((?:[a-z]{2}\s*\d{6})|(?:\d{8}))\b/giu;

const REGISTERED_PATTERN =
  /\bregistered\s+(?:in|under)\s+(?:england(?:\s+and\s+wales)?|scotland|northern\s+ireland)?\s*(?:as\s+)?(?:company\s*)?(?:number|no\.?)?\s*[:#-]?\s*((?:[a-z]{2}\s*\d{6})|(?:\d{8}))\b/giu;

const LEGAL_LINK_PATTERN =
  /(?:privacy|terms|legal|company|about|contact|imprint)/i;

function sha256(value: string): string {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function ipv4IsPublic(address: string): boolean {
  const octets = address
    .split(".")
    .map(Number);
  if (
    octets.length !== 4 ||
    octets.some(
      (value) =>
        !Number.isInteger(value) ||
        value < 0 || value > 255,
    )
  ) return false;

  const [first, second] = octets as [
    number,
    number,
    number,
    number,
  ];
  return !(
    first === 0 ||
    first === 10 ||
    (first === 100 && second >= 64 && second <= 127) ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 168) ||
    (first === 192 && second === 0 && octets[2] === 2) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && octets[2] === 100) ||
    (first === 203 && second === 0 && octets[2] === 113) ||
    first >= 224
  );
}

function ipIsPublic(address: string): boolean {
  const kind = isIP(address);
  if (kind === 4) return ipv4IsPublic(address);
  if (kind !== 6) return false;

  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) {
    return ipv4IsPublic(
      normalized.slice("::ffff:".length),
    );
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

function normalizedCompanyNumber(
  value: string,
): string {
  return value
    .replace(/\s+/g, "")
    .toUpperCase();
}

function htmlText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function companyNumbers(
  text: string,
): {
  readonly numbers: readonly string[];
  readonly excerpt: string | null;
} {
  const found = new Set<string>();
  let excerpt: string | null = null;
  for (const pattern of [
    COMPANY_NUMBER_PATTERN,
    REGISTERED_PATTERN,
  ]) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const captured = match[1];
      if (captured === undefined) continue;
      const number = normalizedCompanyNumber(captured);
      if (!/^(?:[A-Z]{2}\d{6}|\d{8})$/.test(number)) {
        continue;
      }
      found.add(number);
      if (excerpt === null) {
        const start = Math.max(0, match.index - 120);
        const end = Math.min(
          text.length,
          match.index + match[0].length + 120,
        );
        excerpt = text.slice(start, end).trim();
      }
    }
  }
  return {
    numbers: [...found],
    excerpt,
  };
}

function candidateLinks(
  html: string,
  sourceUrl: URL,
): readonly URL[] {
  const results = new Map<string, URL>();
  const pattern = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(pattern)) {
    const href = match[1];
    if (
      href === undefined ||
      !LEGAL_LINK_PATTERN.test(href)
    ) continue;
    try {
      const url = new URL(href, sourceUrl);
      url.hash = "";
      if (
        url.origin === sourceUrl.origin &&
        url.protocol === "https:"
      ) {
        results.set(url.toString(), url);
      }
    } catch {
      // Ignore malformed page links.
    }
  }
  return [...results.values()];
}

async function defaultResolveHost(
  hostname: string,
): Promise<readonly string[]> {
  return (
    await lookup(hostname, {
      all: true,
      verbatim: true,
    })
  ).map((record) => record.address);
}

export class FirstPartyCompanyNumberClient
implements FirstPartyCompanyNumberProvider {
  private readonly timeoutMs: number;
  private readonly maximumBytes: number;
  private readonly maximumPages: number;
  private readonly fetchFunction: FetchFunction;
  private readonly resolveHost: (
    hostname: string,
  ) => Promise<readonly string[]>;

  constructor(
    options: FirstPartyCompanyNumberOptions,
  ) {
    this.timeoutMs = options.timeoutMs;
    this.maximumBytes = options.maximumBytes;
    this.maximumPages = options.maximumPages ?? 3;
    this.fetchFunction = options.fetchFunction ?? fetch;
    this.resolveHost = options.resolveHost ?? defaultResolveHost;
  }

  private async safeUrl(value: string): Promise<URL> {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new FirstPartyLookupError("unsafe_url");
    }
    if (
      url.protocol !== "https:" ||
      url.username !== "" ||
      url.password !== "" ||
      url.port !== "" && url.port !== "443" ||
      url.hostname === "localhost" ||
      url.hostname.endsWith(".localhost") ||
      url.hostname.endsWith(".local") ||
      url.hostname.endsWith(".internal")
    ) {
      throw new FirstPartyLookupError("unsafe_url");
    }

    const literalKind = isIP(url.hostname);
    const addresses = literalKind === 0
      ? await this.resolveHost(url.hostname)
      : [url.hostname];
    if (
      addresses.length === 0 ||
      addresses.some((address) => !ipIsPublic(address))
    ) {
      throw new FirstPartyLookupError("unsafe_url");
    }
    url.hash = "";
    return url;
  }

  private async boundedText(
    response: Response,
  ): Promise<string> {
    const declared = Number(
      response.headers.get("content-length") ?? "0",
    );
    if (
      Number.isFinite(declared) &&
      declared > this.maximumBytes
    ) {
      throw new FirstPartyLookupError("too_large");
    }
    if (response.body === null) return "";

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let total = 0;
    let result = "";
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > this.maximumBytes) {
        await reader.cancel();
        throw new FirstPartyLookupError("too_large");
      }
      result += decoder.decode(chunk.value, {
        stream: true,
      });
    }
    return result + decoder.decode();
  }

  private async page(
    initialUrl: URL,
  ): Promise<{
    readonly url: URL;
    readonly html: string;
  }> {
    let url = initialUrl;
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.timeoutMs,
      );
      let response: Response;
      try {
        response = await this.fetchFunction(url, {
          method: "GET",
          redirect: "manual",
          headers: {
            accept: "text/html,application/xhtml+xml",
            "user-agent":
              "CleanUpCentral-LeadEngineLite/1.0",
          },
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof FirstPartyLookupError) throw error;
        throw new FirstPartyLookupError("unavailable");
      } finally {
        clearTimeout(timeout);
      }

      if (
        response.status >= 300 &&
        response.status < 400
      ) {
        const location = response.headers.get("location");
        if (location === null || redirects === 3) {
          throw new FirstPartyLookupError("unavailable");
        }
        url = await this.safeUrl(
          new URL(location, url).toString(),
        );
        continue;
      }
      if (!response.ok) {
        throw new FirstPartyLookupError("unavailable");
      }
      const mediaType = (
        response.headers.get("content-type") ?? ""
      ).split(";", 1)[0]?.trim().toLowerCase();
      if (
        mediaType !== "text/html" &&
        mediaType !== "application/xhtml+xml"
      ) {
        throw new FirstPartyLookupError("invalid_content");
      }
      return {
        url,
        html: await this.boundedText(response),
      };
    }
    throw new FirstPartyLookupError("unavailable");
  }

  async find(
    websiteUrl: string,
  ): Promise<FirstPartyCompanyNumberEvidence | null> {
    const start = await this.safeUrl(websiteUrl);
    const queue: URL[] = [start];
    const visited = new Set<string>();
    const collected = new Set<string>();
    let firstExcerpt: string | null = null;
    let firstSourceUrl: string | null = null;

    while (
      queue.length > 0 &&
      visited.size < this.maximumPages
    ) {
      const requested = queue.shift()!;
      if (visited.has(requested.toString())) continue;
      const loaded = await this.page(requested);
      visited.add(loaded.url.toString());
      const text = htmlText(loaded.html);
      const found = companyNumbers(text);
      for (const number of found.numbers) {
        collected.add(number);
      }
      if (
        firstExcerpt === null &&
        found.excerpt !== null
      ) {
        firstExcerpt = found.excerpt;
        firstSourceUrl = loaded.url.toString();
      }
      if (visited.size === 1) {
        queue.push(
          ...candidateLinks(
            loaded.html,
            loaded.url,
          ).slice(0, this.maximumPages - 1),
        );
      }
    }

    if (
      collected.size === 0 ||
      firstExcerpt === null ||
      firstSourceUrl === null
    ) return null;

    const numbers = [...collected].sort();
    return {
      companyNumbers: numbers,
      sourceUrl: firstSourceUrl,
      sourceExcerpt: firstExcerpt,
      contentSha256: sha256(
        `${firstSourceUrl}\n${firstExcerpt}\n${numbers.join(",")}`,
      ),
    };
  }
}
