import assert from "node:assert/strict";
import test from "node:test";

import {
  QUOTE_ATTACHMENT_POLICY,
  QuoteAttachmentValidationError,
  validateQuoteAttachments,
  type QuoteAttachmentCandidate,
} from "../src/application/validation/quote-attachment.js";

function jpeg(
  overrides:
    Partial<QuoteAttachmentCandidate> = {},
): QuoteAttachmentCandidate {
  return {
    originalFilename:
      "Kitchen Photo (Final).JPG",
    declaredMimeType: "image/jpeg",
    sizeBytes: 2_048,
    headerBytes: new Uint8Array([
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
    ]),
    ...overrides,
  };
}

function png(
  overrides:
    Partial<QuoteAttachmentCandidate> = {},
): QuoteAttachmentCandidate {
  return {
    originalFilename: "bathroom.png",
    declaredMimeType: "image/png",
    sizeBytes: 2_048,
    headerBytes: new Uint8Array([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
      0x00,
      0x00,
      0x00,
      0x0d,
    ]),
    ...overrides,
  };
}

function expectIssue(
  action: () => unknown,
  code: string,
): void {
  assert.throws(
    action,
    (error: unknown) => {
      assert.ok(
        error instanceof
          QuoteAttachmentValidationError,
      );

      assert.ok(
        error.issues.some(
          (issue) =>
            issue.code === code,
        ),
      );

      return true;
    },
  );
}

test(
  "accepts a genuine JPEG and creates a safe filename",
  () => {
    const [attachment] =
      validateQuoteAttachments([
        jpeg(),
      ]);

    assert.ok(attachment);
    assert.equal(
      attachment.safeFilename,
      "kitchen-photo-final.jpg",
    );
    assert.equal(
      attachment.mimeType,
      "image/jpeg",
    );
    assert.equal(
      attachment.mediaKind,
      "image",
    );
  },
);

test(
  "accepts a genuine PDF document",
  () => {
    const [attachment] =
      validateQuoteAttachments([
        {
          originalFilename:
            "inspection-report.pdf",
          declaredMimeType:
            "application/pdf",
          sizeBytes: 4_096,
          headerBytes:
            new TextEncoder().encode(
              "%PDF-1.7 sample",
            ),
        },
      ]);

    assert.ok(attachment);
    assert.equal(
      attachment.mediaKind,
      "document",
    );
  },
);

test(
  "accepts an HEIC image signature",
  () => {
    const bytes =
      new Uint8Array(12);

    bytes.set(
      new TextEncoder().encode(
        "ftyp",
      ),
      4,
    );

    bytes.set(
      new TextEncoder().encode(
        "heic",
      ),
      8,
    );

    const [attachment] =
      validateQuoteAttachments([
        {
          originalFilename:
            "turnover.heic",
          declaredMimeType:
            "image/heic",
          sizeBytes: 8_192,
          headerBytes: bytes,
        },
      ]);

    assert.ok(attachment);
    assert.equal(
      attachment.mimeType,
      "image/heic",
    );
  },
);

test(
  "rejects an unsupported SVG attachment",
  () => {
    expectIssue(
      () =>
        validateQuoteAttachments([
          {
            originalFilename:
              "diagram.svg",
            declaredMimeType:
              "image/svg+xml",
            sizeBytes: 128,
            headerBytes:
              new TextEncoder().encode(
                "<svg></svg>",
              ),
          },
        ]),
      "UNSUPPORTED_FILE_TYPE",
    );
  },
);

test(
  "rejects an extension and MIME mismatch",
  () => {
    expectIssue(
      () =>
        validateQuoteAttachments([
          jpeg({
            originalFilename:
              "photo.png",
          }),
        ]),
      "MIME_TYPE_MISMATCH",
    );
  },
);

test(
  "rejects contents that do not match the declared type",
  () => {
    expectIssue(
      () =>
        validateQuoteAttachments([
          jpeg({
            headerBytes:
              png().headerBytes,
          }),
        ]),
      "FILE_SIGNATURE_MISMATCH",
    );
  },
);

test(
  "rejects an unsafe traversal filename",
  () => {
    expectIssue(
      () =>
        validateQuoteAttachments([
          jpeg({
            originalFilename:
              "../photo.jpg",
          }),
        ]),
      "INVALID_FILENAME",
    );
  },
);

test(
  "rejects a file larger than the per-file limit",
  () => {
    expectIssue(
      () =>
        validateQuoteAttachments([
          jpeg({
            sizeBytes:
              QUOTE_ATTACHMENT_POLICY
                .maxFileBytes + 1,
          }),
        ]),
      "FILE_TOO_LARGE",
    );
  },
);

test(
  "rejects more than ten attachments",
  () => {
    expectIssue(
      () =>
        validateQuoteAttachments(
          Array.from(
            {
              length:
                QUOTE_ATTACHMENT_POLICY
                  .maxFiles + 1,
            },
            (_, index) =>
              jpeg({
                originalFilename:
                  `photo-${index}.jpg`,
              }),
          ),
        ),
      "TOO_MANY_FILES",
    );
  },
);

test(
  "rejects a batch above the combined size limit",
  () => {
    expectIssue(
      () =>
        validateQuoteAttachments(
          Array.from(
            { length: 5 },
            (_, index) =>
              jpeg({
                originalFilename:
                  `photo-${index}.jpg`,
                sizeBytes:
                  9 * 1024 * 1024,
              }),
          ),
        ),
      "TOTAL_SIZE_EXCEEDED",
    );
  },
);
