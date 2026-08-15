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
  const root = local.split(/[+._-]/, 1)[0] ?? "";
  return GENERIC_MAILBOXES.has(root);
}
