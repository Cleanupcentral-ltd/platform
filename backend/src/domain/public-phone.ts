export interface PublicPhoneEvidence {
  readonly displayValue: string;
  readonly normalizedValue: string;
  readonly support: string;
  readonly score: number;
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
    digits = `0${digits.slice(2)}`;
  } else if (starts0044) {
    if (!digits.startsWith("0044")) return null;
    digits = `0${digits.slice(4)}`;
  }

  if (
    !digits.startsWith("0") ||
    digits.length < 10 ||
    digits.length > 11 ||
    /^0+$/.test(digits)
  ) {
    return null;
  }

  return digits;
}

function addCandidate(
  target: Map<string, PublicPhoneEvidence>,
  displayValue: string,
  normalizedValue: string,
  support: string,
  score: number,
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
      `Verified public phone v1: first-party tel link lists ${displayValue.trim()}.`,
      20,
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
      `Verified public phone v1: first-party page text lists ${displayValue.trim()}.`,
      10,
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
    .slice(0, 3);
}
