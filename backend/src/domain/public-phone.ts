export interface PublicPhoneEvidence {
  readonly displayValue: string;
  readonly normalizedValue: string;
  readonly support: string;
  readonly score: number;
  readonly context?: string;
}

const UK_PHONE_TEXT =
  /(?:\+44\s*\(?0?\)?|0044\s*\(?0?\)?|0)(?:[\s().-]*\d){9,10}/g;

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function visibleText(value: string): string {
  return decodeHtml(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function nationalFromInternational(
  value: string,
): string {
  const withoutOptionalTrunk =
    value.startsWith("0")
      ? value.slice(1)
      : value;
  return `0${withoutOptionalTrunk}`;
}

function validUkNationalPrefix(
  digits: string,
): boolean {
  if (digits.length !== 11) return false;

  // UK geographic and non-geographic numbers used by public businesses.
  if (/^011[3-8]\d{7}$/.test(digits)) return true;
  if (/^01[2-9]\d{8}$/.test(digits)) return true;
  if (/^0[235789]\d{9}$/.test(digits)) return true;

  return false;
}

function looksSyntheticPhone(
  digits: string,
): boolean {
  const subscriber = digits.slice(2);
  if (/^(\d)\1{6,}$/.test(subscriber)) {
    return true;
  }

  const compact = digits.replace(/^0+/, "");
  return (
    compact.includes("0123456789") ||
    compact.includes("9876543210") ||
    compact.includes("123456789") ||
    compact.includes("987654321")
  );
}

export function normalizePublicPhone(
  rawValue: string,
): string | null {
  let value = rawValue
    .trim()
    .replace(/^tel:/i, "")
    .split(/[?;]/, 1)[0] ?? "";

  try {
    value = decodeURIComponent(value);
  } catch {
    // Keep the original text when percent-decoding fails.
  }

  const startsPlus44 = /^\s*\+44/.test(value);
  const starts0044 = /^\s*0044/.test(value);
  let digits = value.replace(/\D/g, "");

  if (startsPlus44) {
    if (!digits.startsWith("44")) return null;
    digits = nationalFromInternational(
      digits.slice(2),
    );
  } else if (starts0044) {
    if (!digits.startsWith("0044")) return null;
    digits = nationalFromInternational(
      digits.slice(4),
    );
  }

  if (
    !validUkNationalPrefix(digits) ||
    looksSyntheticPhone(digits)
  ) {
    return null;
  }

  return digits;
}

function phoneContext(
  pageText: string,
  normalizedValue: string,
): string {
  for (const match of pageText.matchAll(UK_PHONE_TEXT)) {
    if (
      normalizePublicPhone(match[0]) !==
        normalizedValue
    ) continue;

    const index = match.index ?? 0;
    return pageText.slice(
      Math.max(0, index - 180),
      Math.min(
        pageText.length,
        index + match[0].length + 180,
      ),
    ).trim();
  }

  return "";
}

function addCandidate(
  target: Map<string, PublicPhoneEvidence>,
  displayValue: string,
  normalizedValue: string,
  support: string,
  score: number,
  context: string,
) {
  const current = target.get(normalizedValue);
  if (current !== undefined && current.score >= score) {
    return;
  }
  target.set(normalizedValue, {
    displayValue: displayValue.trim(),
    normalizedValue,
    support,
    score,
    context,
  });
}

export function extractPublicPhones(
  html: string,
  pageText: string,
): readonly PublicPhoneEvidence[] {
  const candidates =
    new Map<string, PublicPhoneEvidence>();

  for (
    const match of html.matchAll(
      /<a\b[^>]*href\s*=\s*["']tel:([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    )
  ) {
    const hrefValue = match[1] ?? "";
    const normalizedValue =
      normalizePublicPhone(hrefValue);
    if (normalizedValue === null) continue;
    const anchorText = visibleText(
      match[2] ?? "",
    );
    const displayValue =
      normalizePublicPhone(anchorText) ===
        normalizedValue
        ? anchorText
        : hrefValue;
    addCandidate(
      candidates,
      displayValue,
      normalizedValue,
      `Verified public phone v2: first-party tel link lists ${displayValue.trim()}.`,
      20,
      phoneContext(pageText, normalizedValue),
    );
  }

  for (const match of pageText.matchAll(UK_PHONE_TEXT)) {
    const displayValue = match[0];
    const normalizedValue =
      normalizePublicPhone(displayValue);
    if (normalizedValue === null) continue;
    addCandidate(
      candidates,
      displayValue,
      normalizedValue,
      `Verified public phone v2: first-party page text lists ${displayValue.trim()}.`,
      10,
      phoneContext(pageText, normalizedValue),
    );
  }

  return [...candidates.values()]
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.normalizedValue.localeCompare(
          right.normalizedValue,
        ),
    )
    .slice(0, 4);
}
