export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  /*
   * Handles formats such as:
   * +44 (0) 7123 456789
   */
  if (digits.startsWith("440")) {
    return `44${digits.slice(3)}`;
  }

  /*
   * Converts a normal UK mobile or landline beginning
   * with 0 into a digits-only international format.
   */
  if (digits.startsWith("0")) {
    return `44${digits.slice(1)}`;
  }

  return digits;
}

export function normalizePostcode(
  postcode: string,
): string {
  return postcode
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function normalizeAddress(
  address: string,
): string {
  return address
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}