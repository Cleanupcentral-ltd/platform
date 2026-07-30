import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  WIX_COLLECTIONS,
  WIX_FIELDS,
  type WixCollectionId,
} from "../src/adapters/wix/collections.js";

import {
  createWixQuoteRepositoriesFromGateway,
} from "../src/adapters/wix/create-wix-repositories.js";

import {
  WixApiClient,
} from "../src/adapters/wix/wix-api-client.js";

import {
  loadWixConfig,
} from "../src/adapters/wix/wix-config.js";

import {
  WixDataClient,
} from "../src/adapters/wix/wix-data-client.js";

import {
  WixMediaClient,
} from "../src/adapters/wix/wix-media-client.js";

import {
  buildApp,
} from "../src/app.js";

import type {
  SubmitQuoteRequest,
} from "../src/application/validation/submit-quote.js";

import {
  ApplicationError,
} from "../src/domain/errors.js";

import type {
  MediaUploadRecord,
  QuoteRecord,
} from "../src/domain/models.js";

import type {
  PublicQuoteAttachmentResponse,
} from "../src/http/responses/quote-attachment-response.js";

import type {
  PublicQuoteSuccessResponse,
} from "../src/http/responses/quote-response.js";

interface PublicErrorResponse {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
  readonly requestId: string;
}

interface FileDescriptorLike {
  readonly id?: unknown;
  readonly displayName?: unknown;
  readonly sizeInBytes?: unknown;
  readonly private?: unknown;
  readonly operationStatus?: unknown;
}

interface GetFileDescriptorResponse {
  readonly file?: unknown;
  readonly files?: unknown;
}

interface CleanupState {
  quote: QuoteRecord | null;
  uploads: MediaUploadRecord[];
}

function londonDateAfterDays(
  days: number,
): string {
  const date = new Date(
    Date.now() +
      days * 24 * 60 * 60 * 1_000,
  );

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: "Europe/London",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    )
      .formatToParts(date)
      .filter(
        ({ type }) =>
          type !== "literal",
      )
      .map(
        ({ type, value }) => [
          type,
          value,
        ],
      ),
  );

  const year = parts["year"];
  const month = parts["month"];
  const day = parts["day"];

  assert.ok(year);
  assert.ok(month);
  assert.ok(day);

  return `${year}-${month}-${day}`;
}

function verificationPhone(
  token: string,
): string {
  const suffix = token
    .split("")
    .map((character) =>
      Number.parseInt(
        character,
        16,
      ) % 10,
    )
    .join("")
    .slice(0, 8)
    .padEnd(8, "0");

  return `070${suffix}`;
}

function createSubmission(
  submissionId: string,
  token: string,
): SubmitQuoteRequest {
  return {
    submissionId,
    schemaVersion: "1.0",

    customer: {
      fullName:
        "Build 5D Verification",
      companyName: "",
      email:
        `build5d-${token}@example.com`,
      phone:
        verificationPhone(token),
      declaredCustomerType:
        "New customer",
      preferredContactMethod:
        "Email",
      privacyConsent: true,
      marketingConsent: false,
    },

    property: {
      propertyType: "House",
      address:
        `14 Example Avenue, Verification ${token}, London`,
      postcode: "NW1 1HN",
      bedrooms: 2,
      bathrooms: 1,
      propertyCount: 1,
      propertyStatus: "Vacant",
      parkingDetails: "",
      petsDetails: "",
      accessArrangements: "",
    },

    appointment: {
      preferredDate:
        londonDateAfterDays(30),
      arrivalWindow:
        "08:00–11:00",
      preferredStartDate: "",
      requiredCompletionDate: "",
      sameDay: false,
    },

    service: {
      category:
        "Residential Cleaning",
      serviceType:
        "Standard Clean",
      cleaningScope:
        "Whole Property",

      rooms: {
        Bathroom: 0,
        Bedroom: 0,
        Kitchen: 0,
        "Living Room": 0,
        Hallway: 0,
        Stairs: 0,
      },

      extras: {
        Oven: 0,
        Fridge: 0,
        "Interior Windows": 0,
        "Grout Cleaning": 0,
        Laundry: 0,
        "Standard Consumables Package":
          0,
      },

      currentCondition: "",
      requirements: "",
    },

    safetyWarnings: "",
    additionalNotes:
      "Temporary controlled Build 5D attachment verification.",
    attachmentCount: 1,
  };
}

function tinyPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl5Z4sAAAAASUVORK5CYII=",
    "base64",
  );
}

function assertNoStore(
  response: {
    readonly headers: Readonly<
      Record<
        string,
        string |
          number |
          readonly string[] |
          undefined
      >
    >;
  },
): void {
  assert.equal(
    response.headers[
      "cache-control"
    ],
    "no-store",
  );
}

function assertSafeAttachmentResponse(
  responseBody: unknown,
  quote: QuoteRecord,
  upload: MediaUploadRecord,
  submissionId: string,
): void {
  const serialized =
    JSON.stringify(responseBody);

  for (
    const forbiddenText of [
      quote.id,
      quote.customerId,
      quote.propertyId,
      upload.wixMediaId,
      submissionId,
      "wixMediaId",
      "quoteId",
      "customerId",
      "propertyId",
      "mediaUrl",
      "internalNotes",
    ]
  ) {
    assert.equal(
      serialized.includes(
        forbiddenText,
      ),
      false,
      `Public attachment response exposed forbidden data: ${forbiddenText}`,
    );
  }
}

function positiveInteger(
  value: unknown,
): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" &&
          value.trim() !== ""
        ? Number(value)
        : Number.NaN;

  return Number.isSafeInteger(parsed) &&
    parsed > 0
    ? parsed
    : null;
}

function fileDescriptor(
  payload: unknown,
): FileDescriptorLike {
  assert.equal(
    typeof payload,
    "object",
  );
  assert.notEqual(payload, null);

  const response =
    payload as GetFileDescriptorResponse;

  if (
    typeof response.file ===
      "object" &&
    response.file !== null
  ) {
    return response.file as
      FileDescriptorLike;
  }

  if (
    Array.isArray(response.files) &&
    response.files.length === 1 &&
    typeof response.files[0] ===
      "object" &&
    response.files[0] !== null
  ) {
    return response.files[0] as
      FileDescriptorLike;
  }

  throw new Error(
    "Wix returned an invalid file descriptor response.",
  );
}

async function getFileDescriptor(
  apiClient: WixApiClient,
  fileId: string,
): Promise<FileDescriptorLike> {
  const payload =
    await apiClient.get<unknown>(
      [
        "/site-media/v1/files/get-file-by-id?fileId=",
        encodeURIComponent(fileId),
      ].join(""),
    );

  return fileDescriptor(payload);
}

function isUpstreamNotFound(
  error: unknown,
): boolean {
  return (
    error instanceof
      ApplicationError &&
    error.details?.[
      "upstreamStatus"
    ] === 404
  );
}

async function waitForPermanentDeletion(
  apiClient: WixApiClient,
  fileId: string,
): Promise<void> {
  const deadline =
    Date.now() + 30_000;

  while (Date.now() < deadline) {
    try {
      await getFileDescriptor(
        apiClient,
        fileId,
      );
    } catch (error) {
      if (isUpstreamNotFound(error)) {
        return;
      }

      throw error;
    }

    await new Promise<void>(
      (resolve) => {
        setTimeout(resolve, 500);
      },
    );
  }

  throw new Error(
    "The temporary Wix Media file still exists after permanent deletion.",
  );
}

function uniqueIds(
  values:
    readonly (string | null | undefined)[],
): string[] {
  return [
    ...new Set(
      values.filter(
        (value): value is string =>
          typeof value === "string" &&
          value.length > 0,
      ),
    ),
  ];
}

async function queryIds(
  dataClient: WixDataClient,
  collectionId: WixCollectionId,
  fieldId: string,
  value: string,
): Promise<string[]> {
  const response =
    await dataClient.queryDataItems(
      collectionId,
      {
        filter: {
          [fieldId]: {
            $eq: value,
          },
        },
        paging: {
          limit: 100,
          offset: 0,
        },
      },
      {
        consistentRead: true,
      },
    );

  return response.dataItems.map(
    ({ id }) => id,
  );
}

async function removeRecords(
  dataClient: WixDataClient,
  collectionId: WixCollectionId,
  itemIds: readonly string[],
): Promise<void> {
  const ids = uniqueIds(itemIds);

  if (ids.length === 0) {
    return;
  }

  const response =
    await dataClient.bulkRemoveDataItems(
      collectionId,
      ids,
    );

  const failures =
    response.results.filter(
      ({ itemMetadata }) =>
        itemMetadata.success ===
          false ||
        itemMetadata.error !==
          undefined,
    );

  const totalFailures =
    response.bulkActionMetadata
      ?.totalFailures ?? 0;

  const totalSuccesses =
    response.bulkActionMetadata
      ?.totalSuccesses;

  const confirmedByResults =
    response.results.length ===
      ids.length &&
    failures.length === 0;

  const confirmedByMetadata =
    totalSuccesses === ids.length &&
    totalFailures === 0;

  if (
    totalFailures > 0 ||
    failures.length > 0 ||
    (!confirmedByResults &&
      !confirmedByMetadata)
  ) {
    throw new Error(
      `Cleanup could not be confirmed for ${collectionId}.`,
    );
  }
}

async function cleanupRecords(
  dataClient: WixDataClient,
  state: CleanupState,
): Promise<void> {
  const quote = state.quote;

  if (quote === null) {
    return;
  }

  const uploadIds = uniqueIds([
    ...state.uploads.map(
      ({ id }) => id,
    ),
    ...await queryIds(
      dataClient,
      WIX_COLLECTIONS.mediaUploads,
      WIX_FIELDS.mediaUploads.quote,
      quote.id,
    ),
  ]);

  const historyIds =
    await queryIds(
      dataClient,
      WIX_COLLECTIONS.statusHistory,
      WIX_FIELDS.statusHistory.quote,
      quote.id,
    );

  const quoteItemIds =
    await queryIds(
      dataClient,
      WIX_COLLECTIONS.quoteItems,
      WIX_FIELDS.quoteItems.quote,
      quote.id,
    );

  await removeRecords(
    dataClient,
    WIX_COLLECTIONS.mediaUploads,
    uploadIds,
  );

  await removeRecords(
    dataClient,
    WIX_COLLECTIONS.statusHistory,
    historyIds,
  );

  await removeRecords(
    dataClient,
    WIX_COLLECTIONS.quoteItems,
    quoteItemIds,
  );

  await removeRecords(
    dataClient,
    WIX_COLLECTIONS.quotes,
    [quote.id],
  );

  await removeRecords(
    dataClient,
    WIX_COLLECTIONS.properties,
    [quote.propertyId],
  );

  await removeRecords(
    dataClient,
    WIX_COLLECTIONS.customers,
    [quote.customerId],
  );
}

async function assertRecordsRemoved(
  dataClient: WixDataClient,
  state: CleanupState,
): Promise<void> {
  const quote = state.quote;

  if (quote === null) {
    return;
  }

  assert.deepEqual(
    await queryIds(
      dataClient,
      WIX_COLLECTIONS.mediaUploads,
      WIX_FIELDS.mediaUploads.quote,
      quote.id,
    ),
    [],
  );

  assert.deepEqual(
    await queryIds(
      dataClient,
      WIX_COLLECTIONS.statusHistory,
      WIX_FIELDS.statusHistory.quote,
      quote.id,
    ),
    [],
  );

  assert.deepEqual(
    await queryIds(
      dataClient,
      WIX_COLLECTIONS.quoteItems,
      WIX_FIELDS.quoteItems.quote,
      quote.id,
    ),
    [],
  );

  assert.equal(
    await dataClient
      .getDataItem(
        WIX_COLLECTIONS.quotes,
        quote.id,
      )
      .then(() => true)
      .catch(() => false),
    false,
  );
}

async function verifyBuild5AttachmentFlow():
  Promise<void> {
  const config = loadWixConfig();
  const apiClient =
    new WixApiClient(config);
  const dataClient =
    new WixDataClient(apiClient);
  const repositories =
    createWixQuoteRepositoriesFromGateway(
      dataClient,
    );
  const mediaStorage =
    new WixMediaClient(apiClient);

  const submissionId = randomUUID();
  const attachmentId = randomUUID();
  const token = submissionId
    .replaceAll("-", "")
    .slice(0, 12);
  const submission =
    createSubmission(
      submissionId,
      token,
    );
  const content = tinyPng();

  const state: CleanupState = {
    quote: null,
    uploads: [],
  };

  const app = await buildApp();

  let verificationError: unknown = null;
  let closeError: unknown = null;
  let cleanupError: unknown = null;

  console.log(
    "Running controlled live Build 5 attachment verification...",
  );
  console.log(
    "Temporary Wix records and media will be removed automatically.",
  );

  try {
    const quoteResponse =
      await app.inject({
        method: "POST",
        url: "/api/quotes",
        headers: {
          "content-type":
            "application/json",
        },
        payload: {
          submissionId,
          payload: submission,
        },
      });

    assert.equal(
      quoteResponse.statusCode,
      201,
    );
    assertNoStore(quoteResponse);

    const quoteBody =
      quoteResponse.json<
        PublicQuoteSuccessResponse
      >();

    assert.equal(
      quoteBody.success,
      true,
    );

    state.quote =
      await repositories.quotes
        .findBySubmissionId(
          submissionId,
        );

    assert.ok(
      state.quote,
      "The verification quote should exist in Wix.",
    );

    const firstResponse =
      await app.inject({
        method: "PUT",
        url:
          `/api/quotes/${submissionId}/attachments/${attachmentId}`,
        headers: {
          "content-type":
            "image/png",
          "x-file-name":
            encodeURIComponent(
              "Build 5D Verification.png",
            ),
        },
        payload: content,
      });

    assert.equal(
      firstResponse.statusCode,
      201,
    );
    assertNoStore(firstResponse);

    const firstBody =
      firstResponse.json<
        PublicQuoteAttachmentResponse
      >();

    assert.equal(
      firstBody.success,
      true,
    );
    assert.equal(
      firstBody.replayed,
      false,
    );
    assert.equal(
      firstBody.attachment
        .attachmentId,
      attachmentId,
    );
    assert.equal(
      firstBody.attachment
        .fileName,
      "build-5d-verification.png",
    );
    assert.equal(
      firstBody.attachment
        .sizeBytes,
      content.byteLength,
    );

    state.uploads = [
      ...await repositories
        .mediaUploads
        .findByQuoteId(
          state.quote.id,
        ),
    ];

    assert.equal(
      state.uploads.length,
      1,
    );

    const storedUpload =
      state.uploads[0];

    assert.ok(storedUpload);
    assert.equal(
      storedUpload.id,
      `quote-attachment-${attachmentId}`,
    );
    assert.equal(
      storedUpload.quoteId,
      state.quote.id,
    );
    assert.equal(
      storedUpload.uploadStatus,
      "Uploaded",
    );
    assert.equal(
      storedUpload.sizeBytes,
      content.byteLength,
    );

    assertSafeAttachmentResponse(
      firstBody,
      state.quote,
      storedUpload,
      submissionId,
    );

    const descriptor =
      await getFileDescriptor(
        apiClient,
        storedUpload.wixMediaId,
      );

    assert.equal(
      descriptor.id,
      storedUpload.wixMediaId,
    );
    assert.equal(
      descriptor.private,
      true,
    );
    assert.equal(
      positiveInteger(
        descriptor.sizeInBytes,
      ),
      content.byteLength,
    );
    assert.notEqual(
      descriptor.operationStatus,
      "FAILED",
    );

    console.log(
      "✓ A private Wix Media file was uploaded and linked to the quote.",
    );
    console.log(
      "✓ The MediaUploads record and private file metadata were verified.",
    );
    console.log(
      "✓ The public attachment response exposed no internal IDs or media references.",
    );

    const replayResponse =
      await app.inject({
        method: "PUT",
        url:
          `/api/quotes/${submissionId}/attachments/${attachmentId}`,
        headers: {
          "content-type":
            "image/png",
          "x-file-name":
            encodeURIComponent(
              "Build 5D Verification.png",
            ),
        },
        payload: content,
      });

    assert.equal(
      replayResponse.statusCode,
      200,
    );
    assertNoStore(replayResponse);

    const replayBody =
      replayResponse.json<
        PublicQuoteAttachmentResponse
      >();

    assert.equal(
      replayBody.replayed,
      true,
    );
    assert.deepEqual(
      replayBody.attachment,
      firstBody.attachment,
    );

    const uploadsAfterReplay =
      await repositories.mediaUploads
        .findByQuoteId(
          state.quote.id,
        );

    assert.equal(
      uploadsAfterReplay.length,
      1,
    );
    assert.equal(
      uploadsAfterReplay[0]
        ?.wixMediaId,
      storedUpload.wixMediaId,
    );

    console.log(
      "✓ An identical attachment retry replayed without creating another file or record.",
    );

    const conflictResponse =
      await app.inject({
        method: "PUT",
        url:
          `/api/quotes/${submissionId}/attachments/${attachmentId}`,
        headers: {
          "content-type":
            "image/png",
          "x-file-name":
            encodeURIComponent(
              "Changed Verification.png",
            ),
        },
        payload: content,
      });

    assert.equal(
      conflictResponse.statusCode,
      409,
    );
    assertNoStore(conflictResponse);

    const conflictBody =
      conflictResponse.json<
        PublicErrorResponse
      >();

    assert.equal(
      conflictBody.success,
      false,
    );
    assert.equal(
      conflictBody.error.code,
      "CONFLICT",
    );

    assert.equal(
      (
        await repositories
          .mediaUploads
          .findByQuoteId(
            state.quote.id,
          )
      ).length,
      1,
    );

    console.log(
      "✓ Reusing an attachment reference with changed file information was rejected safely.",
    );
  } catch (error) {
    verificationError = error;
  }

  try {
    await app.close();
  } catch (error) {
    closeError = error;
  }

  try {
    state.quote ??=
      await repositories.quotes
        .findBySubmissionId(
          submissionId,
        );

    if (
      state.quote !== null &&
      state.uploads.length === 0
    ) {
      state.uploads = [
        ...await repositories
          .mediaUploads
          .findByQuoteId(
            state.quote.id,
          ),
      ];
    }

    const mediaIds = uniqueIds(
      state.uploads.map(
        ({ wixMediaId }) =>
          wixMediaId,
      ),
    );

    await cleanupRecords(
      dataClient,
      state,
    );

    if (mediaIds.length > 0) {
      await mediaStorage
        .deletePrivateFiles(
          mediaIds,
        );

      for (const mediaId of mediaIds) {
        await waitForPermanentDeletion(
          apiClient,
          mediaId,
        );
      }
    }

    await assertRecordsRemoved(
      dataClient,
      state,
    );

    console.log(
      "✓ The temporary MediaUploads record, private file and quote records were removed.",
    );
  } catch (error) {
    cleanupError = error;
  }

  if (verificationError !== null) {
    if (cleanupError !== null) {
      console.error(
        "Verification failed and cleanup also failed.",
      );
      console.error(
        "Cleanup error:",
        cleanupError,
      );
    }

    throw verificationError;
  }

  if (cleanupError !== null) {
    throw cleanupError;
  }

  if (closeError !== null) {
    throw closeError;
  }

  console.log(
    "Build 5D live attachment-flow verification passed.",
  );
}

try {
  await verifyBuild5AttachmentFlow();
} catch (error) {
  console.error(
    "Build 5D live attachment-flow verification failed.",
  );
  console.error(error);
  process.exitCode = 1;
}
