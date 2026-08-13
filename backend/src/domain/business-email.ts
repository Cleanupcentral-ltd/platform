const GENERIC_MAILBOXES = new Set([
  "admin",
  "bookings",
  "contact",
  "enquiries",
  "events",
  "facilities",
  "hello",
  "info",
  "office",
  "reception",
  "sales",
  "support",
  "team",
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
