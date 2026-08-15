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
  "spa",
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

export function isGenericBusinessEmail(
  email: string,
): boolean {
  const normalized = email.trim().toLowerCase();
  if (
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(
      normalized,
    )
  ) {
    return false;
  }
  const at = normalized.indexOf("@");
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (PERSONAL_MAIL_DOMAINS.has(domain)) {
    return false;
  }
  const root = local.split(/[+._-]/, 1)[0] ?? "";
  return GENERIC_MAILBOXES.has(root);
}
