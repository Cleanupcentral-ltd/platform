const QUOTE_API_PATH = "/api/quotes";
const TRAVEL_API_PATH =
  "/api/travel/estimate";
const PRODUCTION_API_BASE_URL =
  "https://cuc-backend-2xcc.onrender.com";

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function resolveQuoteApiBaseUrl(
  configuredValue,
  locationObject = globalThis.location,
) {
  const configured = clean(configuredValue).replace(/\/+$/u, "");

  if (configured) {
    return configured;
  }

  const hostname = locationObject?.hostname ?? "";

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://127.0.0.1:3001";
  }

  return PRODUCTION_API_BASE_URL;
}

export function createQuoteSubmissionId(
  cryptoObject = globalThis.crypto,
) {
  if (!cryptoObject || typeof cryptoObject.randomUUID !== "function") {
    throw new Error(
      "A secure quote submission reference could not be created.",
    );
  }

  return cryptoObject.randomUUID();
}

export class QuoteSubmissionRequestError extends Error {
  constructor({
    message,
    code = "REQUEST_FAILED",
    status = 0,
    requestId = "",
  }) {
    super(message);
    this.name = "QuoteSubmissionRequestError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

function requestErrorMessage(response, body) {
  if (response.status === 429) {
    return "Too many quote requests were sent. Please wait a few minutes before trying again.";
  }

  if (response.status >= 500) {
    return "We could not submit your quote request right now. Please try again shortly.";
  }

  return (
    body?.error?.message ||
    "Please check the information supplied and try again."
  );
}

function isSuccessBody(body) {
  return (
    body?.success === true &&
    typeof body.replayed === "boolean" &&
    typeof body.requestId === "string" &&
    typeof body.confirmation?.quoteNumber === "string" &&
    typeof body.confirmation?.message === "string"
  );
}

function isTravelSuccessBody(body) {
  const travel = body?.travel;

  return (
    body?.success === true &&
    typeof body.requestId === "string" &&
    (
      travel?.status ===
        "calculated" ||
      travel?.status ===
        "manual_review"
    ) &&
    (
      travel.fee === null ||
      (
        typeof travel.fee ===
          "number" &&
        Number.isFinite(
          travel.fee,
        )
      )
    ) &&
    (
      travel.distanceMiles ===
        null ||
      (
        typeof travel
          .distanceMiles ===
          "number" &&
        Number.isFinite(
          travel.distanceMiles,
        )
      )
    ) &&
    typeof travel.pendingReview ===
      "boolean"
  );
}

export async function fetchTravelEstimate({
  apiBaseUrl,
  postcode,
  fetchImpl = globalThis.fetch,
}) {
  if (typeof fetchImpl !== "function") {
    throw new QuoteSubmissionRequestError({
      message:
        "The travel calculation service is unavailable.",
    });
  }

  const baseUrl =
    clean(apiBaseUrl)
      .replace(/\/+$/u, "");

  let response;

  try {
    response = await fetchImpl(
      `${baseUrl}${TRAVEL_API_PATH}`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          postcode:
            clean(postcode),
        }),
        cache: "no-store",
      },
    );
  } catch {
    throw new QuoteSubmissionRequestError({
      message:
        "We could not verify the travel distance right now.",
      code:
        "TRAVEL_NETWORK_ERROR",
    });
  }

  let body = null;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new QuoteSubmissionRequestError({
      message:
        body?.error?.message ||
        "We could not verify the travel distance right now.",
      code:
        body?.error?.code ||
        "TRAVEL_REQUEST_FAILED",
      status: response.status,
      requestId:
        body?.requestId || "",
    });
  }

  if (!isTravelSuccessBody(body)) {
    throw new QuoteSubmissionRequestError({
      message:
        "The travel service returned an unexpected response.",
      code:
        "INVALID_TRAVEL_RESPONSE",
      status: response.status,
    });
  }

  return body.travel;
}

export async function submitQuoteRequest({
  apiBaseUrl,
  submissionId,
  payload,
  fetchImpl = globalThis.fetch,
}) {
  if (typeof fetchImpl !== "function") {
    throw new QuoteSubmissionRequestError({
      message: "The quote service is unavailable in this browser.",
    });
  }

  const baseUrl = clean(apiBaseUrl).replace(/\/+$/u, "");

  let response;

  try {
    response = await fetchImpl(`${baseUrl}${QUOTE_API_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        submissionId,
        payload,
      }),
      cache: "no-store",
    });
  } catch {
    throw new QuoteSubmissionRequestError({
      message:
        "We could not reach the quote service. Check your connection and try again.",
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
    throw new QuoteSubmissionRequestError({
      message: requestErrorMessage(response, body),
      code: body?.error?.code || "REQUEST_FAILED",
      status: response.status,
      requestId: body?.requestId || "",
    });
  }

  if (!isSuccessBody(body)) {
    throw new QuoteSubmissionRequestError({
      message:
        "The quote service returned an unexpected response. Please try again.",
      code: "INVALID_RESPONSE",
      status: response.status,
    });
  }

  return body;
}

export async function uploadQuoteAttachments({
  apiBaseUrl,
  submissionId,
  files,
  cryptoObject = globalThis.crypto,
  fetchImpl = globalThis.fetch,
}) {
  if (!Array.isArray(files) || files.length === 0) {
    return [];
  }

  if (typeof fetchImpl !== "function") {
    throw new QuoteSubmissionRequestError({
      message: "The attachment service is unavailable in this browser.",
    });
  }

  const baseUrl = clean(apiBaseUrl).replace(/\/+$/u, "");
  const uploaded = [];

  for (const file of files) {
    const attachmentId = createQuoteSubmissionId(cryptoObject);
    let response;

    try {
      response = await fetchImpl(
        `${baseUrl}${QUOTE_API_PATH}/${submissionId}/attachments/${attachmentId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": file.type,
            "X-File-Name": encodeURIComponent(file.name),
          },
          body: file,
          cache: "no-store",
        },
      );
    } catch {
      throw new QuoteSubmissionRequestError({
        message:
          "Your quote was saved, but one or more attachments could not be uploaded. Please contact us with your quote reference.",
        code: "ATTACHMENT_NETWORK_ERROR",
      });
    }

    let body = null;

    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok) {
      throw new QuoteSubmissionRequestError({
        message:
          body?.error?.message ||
          "Your quote was saved, but one or more attachments could not be uploaded. Please contact us with your quote reference.",
        code: body?.error?.code || "ATTACHMENT_UPLOAD_FAILED",
        status: response.status,
        requestId: body?.requestId || "",
      });
    }

    uploaded.push(body);
  }

  return uploaded;
}
