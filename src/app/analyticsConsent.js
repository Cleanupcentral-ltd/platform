export const GA4_ID = "G-2PKXMJZYTW";
export const CONSENT_KEY = "cuc:analytics-consent:v1";

export function readAnalyticsConsent(environment = globalThis) {
  try {
    const value = environment.localStorage?.getItem(CONSENT_KEY);
    return value === "accepted" || value === "rejected" ? value : null;
  } catch {
    return null;
  }
}

export function saveAnalyticsConsent(value, environment = globalThis) {
  if (value !== "accepted" && value !== "rejected") return;
  try { environment.localStorage?.setItem(CONSENT_KEY, value); } catch {}
}

export function startAnalytics(environment = globalThis) {
  if (readAnalyticsConsent(environment) !== "accepted") return false;
  const doc = environment.document;
  if (!doc) return false;
  // Do not load a second tag if Wix or another integration already supplied one.
  if (typeof environment.gtag === "function") return true;
  if (doc.querySelector('script[src*="googletagmanager.com/gtag/js"]')) return true;
  const layer = environment.dataLayer = environment.dataLayer || [];
  environment.gtag = function () { layer.push(arguments); };
  environment.gtag("js", new Date());
  environment.gtag("config", GA4_ID);
  const script = doc.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA4_ID);
  doc.head.appendChild(script);
  return true;
}
