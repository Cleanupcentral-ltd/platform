export interface ContactFormEvidence {
  readonly support: string;
  readonly score: number;
}

const CONTACT_PATH =
  /(?:^|\/)(?:contact(?:-us)?|get-in-touch|enquir(?:y|ies)|inquir(?:y|ies)|function-enquiry)(?:\/|$)/i;

const HARD_REJECT_PATH =
  /(?:^|\/)(?:careers?|jobs?|vacanc(?:y|ies)|recruit(?:ment|ing)?|compliance|privacy(?:-policy)?|terms(?:-and-conditions)?|cookie(?:-policy)?|legal)(?:\/|$|[-_])/i;

const NON_CONTACT_PATH =
  /(?:login|sign-in|search|newsletter|subscribe)/i;

const CONTACT_LANGUAGE =
  /\b(?:contact\s+us|get\s+in\s+touch|send\s+(?:us\s+)?a\s+message|make\s+an?\s+enquir(?:y|ies)|general\s+enquir(?:y|ies)|how\s+can\s+we\s+help|your\s+message)\b/i;

const MESSAGE_FIELD =
  /(?:name|id|placeholder)\s*=\s*["'][^"']*(?:message|enquir|inquir|comment|question|details)[^"']*["']/i;

const NAME_FIELD =
  /(?:name|id|placeholder)\s*=\s*["'][^"']*(?:full[-_ ]?name|first[-_ ]?name|last[-_ ]?name|your[-_ ]?name|name)[^"']*["']/i;

const EMAIL_FIELD =
  /(?:type\s*=\s*["']email["']|(?:name|id|placeholder)\s*=\s*["'][^"']*email[^"']*["'])/i;

const PHONE_FIELD =
  /(?:type\s*=\s*["']tel["']|(?:name|id|placeholder)\s*=\s*["'][^"']*(?:phone|telephone|mobile)[^"']*["'])/i;

const SEARCH_OR_SUBSCRIPTION =
  /(?:type\s*=\s*["']search["']|\b(?:site\s+search|newsletter|subscribe|mailing\s+list|sign\s*in|log\s*in|cookie\s+preferences)\b)/i;

function visibleFormText(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function describeForm(
  formHtml: string,
  pageUrl: URL,
): ContactFormEvidence | null {
  if (HARD_REJECT_PATH.test(pageUrl.pathname)) {
    return null;
  }

  const text = visibleFormText(formHtml);
  const hasTextarea = /<textarea\b/i.test(formHtml);
  const hasMessage =
    hasTextarea || MESSAGE_FIELD.test(formHtml);
  const hasEmail = EMAIL_FIELD.test(formHtml);
  const hasName = NAME_FIELD.test(formHtml);
  const hasPhone = PHONE_FIELD.test(formHtml);
  const hasContactLanguage =
    CONTACT_LANGUAGE.test(text) ||
    CONTACT_LANGUAGE.test(formHtml);
  const contactPath =
    CONTACT_PATH.test(pageUrl.pathname);

  if (
    SEARCH_OR_SUBSCRIPTION.test(formHtml) &&
    !hasMessage &&
    !hasContactLanguage
  ) {
    return null;
  }

  if (
    !hasMessage ||
    !(
      hasEmail ||
      hasName ||
      hasPhone ||
      hasContactLanguage ||
      contactPath
    )
  ) {
    return null;
  }

  const signals = [
    hasName ? "name" : null,
    hasEmail ? "email" : null,
    hasPhone ? "phone" : null,
    hasMessage ? "message/enquiry" : null,
  ].filter(
    (value): value is string =>
      value !== null,
  );

  let score = 10;
  if (contactPath) score += 8;
  if (hasEmail) score += 2;
  if (hasName) score += 1;
  if (hasPhone) score += 1;
  if (hasContactLanguage) score += 2;
  if (NON_CONTACT_PATH.test(pageUrl.pathname)) {
    score -= 8;
  }

  return {
    score,
    support:
      `Verified contact form v3: form contains ${signals.join(", ")} fields.`,
  };
}

export function detectContactForm(
  html: string,
  pageUrl: URL,
): ContactFormEvidence | null {
  let best: ContactFormEvidence | null = null;

  for (
    const match of html.matchAll(
      /<form\b[^>]*>[\s\S]*?<\/form>/gi,
    )
  ) {
    const candidate =
      describeForm(match[0], pageUrl);
    if (
      candidate !== null &&
      (
        best === null ||
        candidate.score > best.score
      )
    ) {
      best = candidate;
    }
  }

  return best;
}
