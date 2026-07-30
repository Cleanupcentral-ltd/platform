export const QUOTE_ATTACHMENT_POLICY = {
  maxFiles: 10,
  maxFileBytes: 10 * 1024 * 1024,
  maxTotalBytes: 40 * 1024 * 1024,
  maxOriginalFilenameLength: 255,
  maxSafeFilenameLength: 120,
  minimumHeaderBytes: 12,
} as const;

export type QuoteAttachmentMediaKind =
  | "image"
  | "document";

export const QUOTE_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

export type QuoteAttachmentMimeType =
  (typeof QUOTE_ATTACHMENT_MIME_TYPES)[number];

export type QuoteAttachmentExtension =
  | "jpg"
  | "jpeg"
  | "png"
  | "webp"
  | "heic"
  | "heif"
  | "pdf";

export interface QuoteAttachmentCandidate {
  readonly originalFilename: string;
  readonly declaredMimeType: string;
  readonly sizeBytes: number;
  readonly headerBytes: Uint8Array;
}

export interface ValidatedQuoteAttachment {
  readonly originalFilename: string;
  readonly safeFilename: string;
  readonly mimeType:
    QuoteAttachmentMimeType;
  readonly extension:
    QuoteAttachmentExtension;
  readonly mediaKind:
    QuoteAttachmentMediaKind;
  readonly sizeBytes: number;
}

export type QuoteAttachmentIssueCode =
  | "EMPTY_BATCH"
  | "TOO_MANY_FILES"
  | "TOTAL_SIZE_EXCEEDED"
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "INVALID_FILENAME"
  | "UNSUPPORTED_FILE_TYPE"
  | "MIME_TYPE_MISMATCH"
  | "FILE_SIGNATURE_MISMATCH";

export interface QuoteAttachmentValidationIssue {
  readonly code:
    QuoteAttachmentIssueCode;
  readonly message: string;
  readonly fileIndex?: number;
  readonly field?:
    | "files"
    | "originalFilename"
    | "declaredMimeType"
    | "sizeBytes"
    | "headerBytes";
}

export class QuoteAttachmentValidationError
  extends Error {
  readonly issues:
    readonly QuoteAttachmentValidationIssue[];

  constructor(
    issues:
      readonly QuoteAttachmentValidationIssue[],
  ) {
    super(
      issues.length === 1
        ? issues[0]?.message ??
            "The attachment is invalid."
        : "One or more attachments are invalid.",
    );

    this.name =
      "QuoteAttachmentValidationError";
    this.issues = issues;
  }
}

interface AttachmentTypeDefinition {
  readonly mimeType:
    QuoteAttachmentMimeType;
  readonly extensions:
    readonly QuoteAttachmentExtension[];
  readonly mediaKind:
    QuoteAttachmentMediaKind;
}

const TYPE_DEFINITIONS:
  readonly AttachmentTypeDefinition[] = [
    {
      mimeType: "image/jpeg",
      extensions: ["jpg", "jpeg"],
      mediaKind: "image",
    },
    {
      mimeType: "image/png",
      extensions: ["png"],
      mediaKind: "image",
    },
    {
      mimeType: "image/webp",
      extensions: ["webp"],
      mediaKind: "image",
    },
    {
      mimeType: "image/heic",
      extensions: ["heic"],
      mediaKind: "image",
    },
    {
      mimeType: "image/heif",
      extensions: ["heif"],
      mediaKind: "image",
    },
    {
      mimeType: "application/pdf",
      extensions: ["pdf"],
      mediaKind: "document",
    },
  ];

const TYPE_BY_MIME = new Map(
  TYPE_DEFINITIONS.map(
    (definition) => [
      definition.mimeType,
      definition,
    ] as const,
  ),
);

const TYPE_BY_EXTENSION = new Map(
  TYPE_DEFINITIONS.flatMap(
    (definition) =>
      definition.extensions.map(
        (extension) => [
          extension,
          definition,
        ] as const,
      ),
  ),
);

function startsWithBytes(
  bytes: Uint8Array,
  signature: readonly number[],
): boolean {
  if (
    bytes.length < signature.length
  ) {
    return false;
  }

  return signature.every(
    (value, index) =>
      bytes[index] === value,
  );
}

function asciiAt(
  bytes: Uint8Array,
  start: number,
  length: number,
): string {
  return String.fromCharCode(
    ...bytes.slice(
      start,
      start + length,
    ),
  );
}

type DetectedAttachmentType =
  | QuoteAttachmentMimeType
  | "image/heif-family";

function detectMimeType(
  bytes: Uint8Array,
): DetectedAttachmentType | null {
  if (
    startsWithBytes(
      bytes,
      [0xff, 0xd8, 0xff],
    )
  ) {
    return "image/jpeg";
  }

  if (
    startsWithBytes(
      bytes,
      [
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
      ],
    )
  ) {
    return "image/png";
  }

  if (
    asciiAt(bytes, 0, 4) ===
      "RIFF" &&
    asciiAt(bytes, 8, 4) ===
      "WEBP"
  ) {
    return "image/webp";
  }

  if (
    asciiAt(bytes, 0, 5) ===
    "%PDF-"
  ) {
    return "application/pdf";
  }

  if (
    asciiAt(bytes, 4, 4) ===
    "ftyp"
  ) {
    const brand =
      asciiAt(bytes, 8, 4)
        .toLowerCase();

    if (
      [
        "heic",
        "heix",
        "hevc",
        "hevx",
        "heim",
        "heis",
        "heif",
        "mif1",
        "msf1",
      ].includes(brand)
    ) {
      return "image/heif-family";
    }
  }

  return null;
}

function normaliseDeclaredMimeType(
  value: string,
): string {
  return (
    value
      .split(";", 1)[0]
      ?.trim()
      .toLowerCase() ?? ""
  );
}

function filenameExtension(
  filename: string,
): string {
  const finalDot =
    filename.lastIndexOf(".");

  if (
    finalDot <= 0 ||
    finalDot === filename.length - 1
  ) {
    return "";
  }

  return filename
    .slice(finalDot + 1)
    .toLowerCase();
}

function safeFilename(
  filename: string,
  extension:
    QuoteAttachmentExtension,
): string {
  const withoutExtension =
    filename.slice(
      0,
      filename.length -
        extension.length -
        1,
    );

  const slug = withoutExtension
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "attachment";

  const reservedLength =
    extension.length + 1;

  const maximumBaseLength =
    QUOTE_ATTACHMENT_POLICY
      .maxSafeFilenameLength -
    reservedLength;

  const truncated = slug
    .slice(0, maximumBaseLength)
    .replace(/-+$/g, "") ||
    "attachment";

  return `${truncated}.${extension}`;
}

function validateFilename(
  filename: string,
  fileIndex: number,
): QuoteAttachmentValidationIssue[] {
  const issues:
    QuoteAttachmentValidationIssue[] = [];

  if (
    filename.length === 0 ||
    filename.length >
      QUOTE_ATTACHMENT_POLICY
        .maxOriginalFilenameLength ||
    filename.trim() !== filename ||
    filename === "." ||
    filename === ".." ||
    filename.startsWith(".") ||
    filename.includes("/") ||
    filename.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(
      filename,
    )
  ) {
    issues.push({
      code: "INVALID_FILENAME",
      message:
        "The attachment filename is invalid or unsafe.",
      fileIndex,
      field: "originalFilename",
    });
  }

  return issues;
}

function validateOne(
  candidate:
    QuoteAttachmentCandidate,
  fileIndex: number,
): {
  readonly value:
    ValidatedQuoteAttachment | null;
  readonly issues:
    readonly QuoteAttachmentValidationIssue[];
} {
  const issues:
    QuoteAttachmentValidationIssue[] = [
      ...validateFilename(
        candidate.originalFilename,
        fileIndex,
      ),
    ];

  if (
    !Number.isSafeInteger(
      candidate.sizeBytes,
    ) ||
    candidate.sizeBytes <= 0
  ) {
    issues.push({
      code: "EMPTY_FILE",
      message:
        "Attachments must contain file data.",
      fileIndex,
      field: "sizeBytes",
    });
  } else if (
    candidate.sizeBytes >
    QUOTE_ATTACHMENT_POLICY
      .maxFileBytes
  ) {
    issues.push({
      code: "FILE_TOO_LARGE",
      message:
        "Each attachment must be 10 MB or smaller.",
      fileIndex,
      field: "sizeBytes",
    });
  }

  const extensionText =
    filenameExtension(
      candidate.originalFilename,
    );

  const extensionDefinition =
    TYPE_BY_EXTENSION.get(
      extensionText as
        QuoteAttachmentExtension,
    );

  if (!extensionDefinition) {
    issues.push({
      code: "UNSUPPORTED_FILE_TYPE",
      message:
        "Only JPEG, PNG, WebP, HEIC, HEIF and PDF attachments are accepted.",
      fileIndex,
      field: "originalFilename",
    });
  }

  const declaredMimeType =
    normaliseDeclaredMimeType(
      candidate.declaredMimeType,
    );

  const mimeDefinition =
    TYPE_BY_MIME.get(
      declaredMimeType as
        QuoteAttachmentMimeType,
    );

  if (!mimeDefinition) {
    issues.push({
      code: "UNSUPPORTED_FILE_TYPE",
      message:
        "The attachment MIME type is not supported.",
      fileIndex,
      field: "declaredMimeType",
    });
  }

  if (
    extensionDefinition &&
    mimeDefinition &&
    extensionDefinition.mimeType !==
      mimeDefinition.mimeType
  ) {
    issues.push({
      code: "MIME_TYPE_MISMATCH",
      message:
        "The attachment extension does not match its declared MIME type.",
      fileIndex,
      field: "declaredMimeType",
    });
  }

  const detectedMimeType =
    detectMimeType(
      candidate.headerBytes,
    );

  if (!detectedMimeType) {
    issues.push({
      code: "FILE_SIGNATURE_MISMATCH",
      message:
        "The attachment contents do not match an accepted file type.",
      fileIndex,
      field: "headerBytes",
    });
  } else if (
    mimeDefinition &&
    !(
      detectedMimeType ===
        mimeDefinition.mimeType ||
      (
        detectedMimeType ===
          "image/heif-family" &&
        (
          mimeDefinition.mimeType ===
            "image/heic" ||
          mimeDefinition.mimeType ===
            "image/heif"
        )
      )
    )
  ) {
    issues.push({
      code: "FILE_SIGNATURE_MISMATCH",
      message:
        "The attachment contents do not match its declared MIME type.",
      fileIndex,
      field: "headerBytes",
    });
  }

  if (
    issues.length > 0 ||
    !extensionDefinition ||
    !mimeDefinition ||
    !detectedMimeType
  ) {
    return {
      value: null,
      issues,
    };
  }

  const extension =
    extensionText as
      QuoteAttachmentExtension;

  return {
    value: {
      originalFilename:
        candidate.originalFilename,
      safeFilename: safeFilename(
        candidate.originalFilename,
        extension,
      ),
      mimeType:
        mimeDefinition.mimeType,
      extension,
      mediaKind:
        mimeDefinition.mediaKind,
      sizeBytes:
        candidate.sizeBytes,
    },
    issues: [],
  };
}

export function validateQuoteAttachments(
  candidates:
    readonly QuoteAttachmentCandidate[],
): readonly ValidatedQuoteAttachment[] {
  const issues:
    QuoteAttachmentValidationIssue[] = [];

  if (candidates.length === 0) {
    throw new QuoteAttachmentValidationError([
      {
        code: "EMPTY_BATCH",
        message:
          "At least one attachment is required.",
        field: "files",
      },
    ]);
  }

  if (
    candidates.length >
    QUOTE_ATTACHMENT_POLICY.maxFiles
  ) {
    issues.push({
      code: "TOO_MANY_FILES",
      message:
        "A quote can include no more than 10 attachments.",
      field: "files",
    });
  }

  const totalSize =
    candidates.reduce(
      (total, candidate) =>
        total +
        Math.max(
          0,
          Number.isFinite(
            candidate.sizeBytes,
          )
            ? candidate.sizeBytes
            : 0,
        ),
      0,
    );

  if (
    totalSize >
    QUOTE_ATTACHMENT_POLICY
      .maxTotalBytes
  ) {
    issues.push({
      code: "TOTAL_SIZE_EXCEEDED",
      message:
        "The combined attachment size must not exceed 40 MB.",
      field: "files",
    });
  }

  const validated:
    ValidatedQuoteAttachment[] = [];

  candidates.forEach(
    (candidate, fileIndex) => {
      const result =
        validateOne(
          candidate,
          fileIndex,
        );

      issues.push(...result.issues);

      if (result.value) {
        validated.push(result.value);
      }
    },
  );

  if (issues.length > 0) {
    throw new QuoteAttachmentValidationError(
      issues,
    );
  }

  return validated;
}
