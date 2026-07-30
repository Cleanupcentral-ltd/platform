import assert from "node:assert/strict";
import test from "node:test";

import {
  buildApp,
} from "../src/app.js";

import type {
  QuoteAttachmentLinkingService,
} from "../src/application/link-quote-attachment.js";

import type {
  QuotePersistenceService,
} from "../src/application/persist-quote.js";

import type {
  QuotePricingService,
} from "../src/application/price-quote.js";

import type {
  QuoteResolutionService,
} from "../src/application/resolve-quote-context.js";

import {
  QUOTE_ATTACHMENT_POLICY,
  QuoteAttachmentValidationError,
} from "../src/application/validation/quote-attachment.js";

const submissionId =
  "11111111-1111-4111-8111-111111111111";

const attachmentId =
  "22222222-2222-4222-8222-222222222222";

function jpegBytes(): Buffer {
  return Buffer.from([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x10,
    0x4a,
    0x46,
    0x49,
    0x46,
    0x00,
    0x01,
    0x44,
    0x41,
    0x54,
    0x41,
  ]);
}

function unusedResolutionService():
  QuoteResolutionService {
  return {
    async resolve() {
      throw new Error(
        "Quote submission route should not run.",
      );
    },
  };
}

function unusedPricingService():
  QuotePricingService {
  return {
    async price() {
      throw new Error(
        "Quote pricing should not run.",
      );
    },
  };
}

function unusedPersistenceService():
  QuotePersistenceService {
  return {
    async persist() {
      throw new Error(
        "Quote persistence should not run.",
      );
    },
  };
}

function attachmentRecord() {
  return {
    id:
      `quote-attachment-${attachmentId}`,
    uploadLabel:
      "CUC-Q-TEST attachment 1",
    quoteId:
      `quote-${submissionId}`,
    contactEnquiryId: null,
    uploadContext:
      "Quote" as const,
    sourceField:
      "quoteAttachments",
    fileName:
      "kitchen-photo.jpg",
    fileExtension: "jpg",
    mimeType: "image/jpeg",
    mediaType:
      "Image" as const,
    mediaUrl: null,
    wixMediaId:
      "private-wix-media-id",
    sizeBytes:
      jpegBytes().byteLength,
    uploadStatus:
      "Uploaded" as const,
    customerVisible: false,
    displayOrder: 1,
    internalNotes: null,
  };
}

async function testApp(
  service:
    QuoteAttachmentLinkingService,
) {
  return buildApp({
    quoteResolutionService:
      unusedResolutionService(),

    quotePricingService:
      unusedPricingService(),

    quotePersistenceService:
      unusedPersistenceService(),

    quoteAttachmentLinkingService:
      service,
  });
}

test(
  "PUT quote attachment returns a safe created response",
  async (context) => {
    let receivedFilename = "";

    const app = await testApp({
      async link(input) {
        receivedFilename =
          input.originalFilename;

        return {
          outcome: "created",
          attachment:
            attachmentRecord(),
        };
      },
    });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "PUT",

        url:
          `/api/quotes/${submissionId}/attachments/${attachmentId}`,

        headers: {
          "content-type":
            "image/jpeg",

          "x-file-name":
            encodeURIComponent(
              "Kitchen Photo.JPG",
            ),
        },

        payload: jpegBytes(),
      });

    assert.equal(
      response.statusCode,
      201,
    );

    assert.equal(
      receivedFilename,
      "Kitchen Photo.JPG",
    );

    const body =
      response.json<{
        success: boolean;
        replayed: boolean;
        attachment: {
          attachmentId: string;
          fileName: string;
          mediaType: string;
          sizeBytes: number;
          status: string;
          displayOrder: number;
        };
        requestId: string;
      }>();

    assert.equal(
      body.success,
      true,
    );

    assert.equal(
      body.replayed,
      false,
    );

    assert.equal(
      body.attachment
        .attachmentId,
      attachmentId,
    );

    assert.equal(
      body.attachment.fileName,
      "kitchen-photo.jpg",
    );

    assert.equal(
      response.headers[
        "cache-control"
      ],
      "no-store",
    );

    const rawBody =
      response.body;

    assert.equal(
      rawBody.includes(
        "private-wix-media-id",
      ),
      false,
    );

    assert.equal(
      rawBody.includes(
        `quote-${submissionId}`,
      ),
      false,
    );
  },
);

test(
  "PUT quote attachment returns 200 for an idempotent replay",
  async (context) => {
    const app = await testApp({
      async link() {
        return {
          outcome: "replayed",
          attachment:
            attachmentRecord(),
        };
      },
    });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "PUT",

        url:
          `/api/quotes/${submissionId}/attachments/${attachmentId}`,

        headers: {
          "content-type":
            "image/jpeg",

          "x-file-name":
            "Kitchen%20Photo.JPG",
        },

        payload: jpegBytes(),
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.equal(
      response.json<{
        replayed: boolean;
      }>().replayed,
      true,
    );
  },
);

test(
  "PUT quote attachment rejects a missing filename header",
  async (context) => {
    const app = await testApp({
      async link() {
        throw new Error(
          "Linking should not run.",
        );
      },
    });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "PUT",

        url:
          `/api/quotes/${submissionId}/attachments/${attachmentId}`,

        headers: {
          "content-type":
            "image/jpeg",
        },

        payload: jpegBytes(),
      });

    assert.equal(
      response.statusCode,
      400,
    );

    assert.equal(
      response.json<{
        error: {
          code: string;
        };
      }>().error.code,
      "VALIDATION_ERROR",
    );
  },
);

test(
  "PUT quote attachment rejects unsupported content types",
  async (context) => {
    const app = await testApp({
      async link() {
        throw new Error(
          "Linking should not run.",
        );
      },
    });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "PUT",

        url:
          `/api/quotes/${submissionId}/attachments/${attachmentId}`,

        headers: {
          "content-type":
            "application/octet-stream",

          "x-file-name":
            "photo.bin",
        },

        payload:
          Buffer.from("unsafe"),
      });

    assert.equal(
      response.statusCode,
      415,
    );

    assert.equal(
      response.json<{
        error: {
          code: string;
        };
      }>().error.code,
      "UNSUPPORTED_MEDIA_TYPE",
    );
  },
);

test(
  "PUT quote attachment returns safe validation details",
  async (context) => {
    const app = await testApp({
      async link() {
        throw new QuoteAttachmentValidationError([
          {
            code:
              "FILE_SIGNATURE_MISMATCH",
            message:
              "The attachment contents do not match its declared MIME type.",
            fileIndex: 0,
            field: "headerBytes",
          },
        ]);
      },
    });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "PUT",

        url:
          `/api/quotes/${submissionId}/attachments/${attachmentId}`,

        headers: {
          "content-type":
            "image/jpeg",

          "x-file-name":
            "photo.jpg",
        },

        payload: jpegBytes(),
      });

    assert.equal(
      response.statusCode,
      400,
    );

    const body =
      response.json<{
        error: {
          code: string;
          details: {
            issues: readonly {
              code: string;
              field: string;
            }[];
          };
        };
      }>();

    assert.equal(
      body.error.code,
      "VALIDATION_ERROR",
    );

    assert.equal(
      body.error.details
        .issues[0]?.code,
      "FILE_SIGNATURE_MISMATCH",
    );
  },
);

test(
  "PUT quote attachment rejects a body larger than 10 MB",
  async (context) => {
    const app = await testApp({
      async link() {
        throw new Error(
          "Linking should not run.",
        );
      },
    });

    context.after(
      async () => app.close(),
    );

    const response =
      await app.inject({
        method: "PUT",

        url:
          `/api/quotes/${submissionId}/attachments/${attachmentId}`,

        headers: {
          "content-type":
            "image/jpeg",

          "x-file-name":
            "photo.jpg",
        },

        payload:
          Buffer.alloc(
            QUOTE_ATTACHMENT_POLICY
              .maxFileBytes +
              1,
            0,
          ),
      });

    assert.equal(
      response.statusCode,
      413,
    );

    assert.equal(
      response.json<{
        error: {
          code: string;
        };
      }>().error.code,
      "PAYLOAD_TOO_LARGE",
    );
  },
);
