/**
 * Track only an accepted backend quote request, not clicks or views of the
 * quote form or thank-you route.
 *
 * This uses the Google tag already provided by the site's analytics setup
 * (gtag or Google Tag Manager's dataLayer). It deliberately does not load a
 * new tracker, set marketing cookies or transmit any customer details.
 *
 * Conversion actions in Google Ads must be configured to consume this event.
 */
export function trackConfirmedQuoteLead(
  { response, submissionId, category },
  environment = globalThis,
) {
  if (
    response?.success !== true ||
    response?.replayed === true ||
    typeof response?.confirmation?.quoteNumber !== "string" ||
    !response.confirmation.quoteNumber.trim() ||
    typeof submissionId !== "string" ||
    !submissionId.trim()
  ) {
    return false;
  }

  const storageKey = `cuc:confirmed-quote-lead:${submissionId}`;
  let storage;

  try {
    storage = environment?.sessionStorage;
    if (storage?.getItem(storageKey) === "1") return false;
  } catch {
    // Browser privacy settings may disable storage; never break submissions.
  }

  // Use a service category, never user names, addresses, or contact details.
  const parameters = {
    lead_type: "quote_request",
    service_category:
      typeof category === "string" ? category : "not_specified",
  };

  try {
    if (typeof environment?.gtag === "function") {
      environment.gtag("event", "cuc_quote_submitted", parameters);
    } else if (Array.isArray(environment?.dataLayer)) {
      environment.dataLayer.push({
        event: "cuc_quote_submitted",
        ...parameters,
      });
    } else {
      // No existing Google tag; avoid pretending a conversion was reported.
      return false;
    }
  } catch {
    // Analytics must never interrupt an otherwise successful quote request.
    return false;
  }

  try {
    storage?.setItem(storageKey, "1");
  } catch {
    // Tracking was dispatched; storage is optional deduplication only.
  }
  return true;
}
