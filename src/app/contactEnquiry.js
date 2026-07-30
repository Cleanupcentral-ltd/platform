const CONTACT_API_PATH = "/api/contact-enquiries";

export const CONTACT_FORM_INITIAL_VALUES = Object.freeze({
  fullName: "",
  email: "",
  phone: "",
  enquiryType: "",
  preferredContactMethod: "",
  message: "",
  privacyConsent: false,
  website: "",
});

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PHONE_CHARACTERS_PATTERN =
  /^[+()\d\s.-]*$/;

function clean(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function phoneDigitCount(value) {
  return clean(value)
    .replace(/\D/g, "")
    .length;
}

export function createContactSubmissionId(
  cryptoObject = globalThis.crypto,
) {
  if (
    !cryptoObject ||
    typeof cryptoObject.randomUUID !==
      "function"
  ) {
    throw new Error(
      "A secure submission reference could not be created.",
    );
  }

  return cryptoObject.randomUUID();
}

export function resolveContactApiBaseUrl(
  configuredValue,
  locationObject =
    globalThis.location,
) {
  const configured =
    clean(configuredValue)
      .replace(/\/+$/u, "");

  if (configured) {
    return configured;
  }

  const hostname =
    locationObject?.hostname ?? "";

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1"
  ) {
    return "http://127.0.0.1:3001";
  }

  return "";
}

export function validateContactForm(
  values,
) {
  const errors = {};

  const fullName =
    clean(values.fullName);

  if (
    fullName.length < 2 ||
    fullName.length > 120
  ) {
    errors.fullName =
      "Enter your full name.";
  }

  const email = clean(values.email);

  if (
    email.length > 254 ||
    !EMAIL_PATTERN.test(email)
  ) {
    errors.email =
      "Enter a valid email address.";
  }

  const phone = clean(values.phone);
  const contactMethod =
    clean(
      values.preferredContactMethod,
    );

  if (
    phone.length > 0 &&
    (
      phone.length > 30 ||
      !PHONE_CHARACTERS_PATTERN.test(
        phone,
      ) ||
      phoneDigitCount(phone) < 7 ||
      phoneDigitCount(phone) > 15
    )
  ) {
    errors.phone =
      "Enter a valid phone number.";
  }

  if (
    (
      contactMethod === "Phone" ||
      contactMethod === "WhatsApp"
    ) &&
    phone.length === 0
  ) {
    errors.phone =
      "Enter a phone number for your preferred contact method.";
  }

  if (!clean(values.enquiryType)) {
    errors.enquiryType =
      "Select an enquiry type.";
  }

  if (
    ![
      "Email",
      "Phone",
      "WhatsApp",
    ].includes(contactMethod)
  ) {
    errors.preferredContactMethod =
      "Select how you would like us to contact you.";
  }

  const message =
    clean(values.message);

  if (message.length < 10) {
    errors.message =
      "Please provide a little more detail.";
  } else if (message.length > 5_000) {
    errors.message =
      "Keep your message under 5,000 characters.";
  }

  if (values.privacyConsent !== true) {
    errors.privacyConsent =
      "Confirm that we may use these details to respond.";
  }

  return errors;
}

export function createContactEnquiryPayload(
  values,
  submissionId,
) {
  return {
    submissionId,
    schemaVersion: "1.0",
    fullName: clean(values.fullName),
    email:
      clean(values.email)
        .toLowerCase(),
    phone: clean(values.phone),
    enquiryType:
      clean(values.enquiryType),
    preferredContactMethod:
      clean(
        values.preferredContactMethod,
      ),
    message: clean(values.message),
    privacyConsent:
      values.privacyConsent === true,
    website: clean(values.website),
    attachmentCount: 0,
  };
}

export function contactPayloadFingerprint(
  payload,
) {
  const {
    submissionId: _submissionId,
    ...stablePayload
  } = payload;

  return JSON.stringify(stablePayload);
}

function publicFieldName(field) {
  return String(field || "")
    .replace(/^payload\./u, "")
    .replace(/^request\./u, "");
}

function fieldErrorsFromBody(body) {
  const issues =
    body?.error?.details?.issues;

  if (!Array.isArray(issues)) {
    return {};
  }

  return Object.fromEntries(
    issues
      .filter(
        (issue) =>
          issue &&
          typeof issue.field ===
            "string" &&
          typeof issue.message ===
            "string",
      )
      .map((issue) => [
        publicFieldName(issue.field),
        issue.message,
      ]),
  );
}

export class ContactEnquiryRequestError
  extends Error {
  constructor({
    message,
    code = "REQUEST_FAILED",
    status = 0,
    requestId = "",
    fieldErrors = {},
  }) {
    super(message);
    this.name =
      "ContactEnquiryRequestError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.fieldErrors = fieldErrors;
  }
}

function requestErrorMessage(
  response,
  body,
) {
  if (
    response.status === 429
  ) {
    return "Too many enquiries were sent. Please wait a few minutes before trying again.";
  }

  if (
    response.status >= 500
  ) {
    return "We could not send your enquiry right now. Please try again shortly.";
  }

  return (
    body?.error?.message ||
    "Please check the highlighted information and try again."
  );
}

function isSuccessBody(body) {
  return (
    body?.success === true &&
    typeof body.requestId === "string" &&
    typeof body.replayed === "boolean" &&
    body.confirmation &&
    typeof body.confirmation
      .enquiryNumber === "string" &&
    typeof body.confirmation
      .message === "string" &&
    typeof body.confirmation
      .preferredContactMethod ===
      "string"
  );
}

export async function submitContactEnquiry({
  apiBaseUrl,
  submissionId,
  payload,
  fetchImpl = globalThis.fetch,
}) {
  if (
    typeof fetchImpl !== "function"
  ) {
    throw new ContactEnquiryRequestError({
      message:
        "The enquiry service is unavailable in this browser.",
    });
  }

  const baseUrl =
    clean(apiBaseUrl)
      .replace(/\/+$/u, "");

  let response;

  try {
    response = await fetchImpl(
      `${baseUrl}${CONTACT_API_PATH}`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          submissionId,
          payload,
        }),
        cache: "no-store",
      },
    );
  } catch (cause) {
    throw new ContactEnquiryRequestError({
      message:
        "We could not reach the enquiry service. Check your connection and try again.",
      code: "NETWORK_ERROR",
    });
  }

  let body = null;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new ContactEnquiryRequestError({
      message:
        requestErrorMessage(
          response,
          body,
        ),
      code:
        body?.error?.code ||
        "REQUEST_FAILED",
      status: response.status,
      requestId:
        body?.requestId || "",
      fieldErrors:
        fieldErrorsFromBody(body),
    });
  }

  if (!isSuccessBody(body)) {
    throw new ContactEnquiryRequestError({
      message:
        "The enquiry service returned an unexpected response. Please try again.",
      code: "INVALID_RESPONSE",
      status: response.status,
    });
  }

  return body;
}
