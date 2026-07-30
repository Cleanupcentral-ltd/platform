import {
  ApplicationError,
} from "../../domain/errors.js";

import type {
  PrivateMediaStorage,
  PrivateMediaUploadRequest,
  StoredPrivateMediaFile,
} from "../../ports/media-storage.js";

export interface WixMediaJsonClient {
  post<T>(
    path: string,
    body: unknown,
  ): Promise<T>;
}

export interface WixMediaClientOptions {
  readonly uploadTimeoutMs?: number;
}

interface GenerateUploadUrlResponse {
  readonly uploadUrl?: unknown;
}

interface WixUploadResponse {
  readonly file?: unknown;
}

interface WixFileDescriptorLike {
  readonly id?: unknown;
  readonly displayName?: unknown;
  readonly parentFolderId?: unknown;
  readonly sizeInBytes?: unknown;
  readonly private?: unknown;
  readonly operationStatus?: unknown;
}

const GENERATE_UPLOAD_URL_PATH =
  "/site-media/v1/files/generate-upload-url";

const BULK_DELETE_FILES_PATH =
  "/site-media/v1/bulk/files/delete";

const DEFAULT_UPLOAD_TIMEOUT_MS =
  60_000;

function parsePayload(
  text: string,
): unknown {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function storageError(
  message: string,
  details?: Readonly<
    Record<string, unknown>
  >,
  cause?: unknown,
): ApplicationError {
  const options = {
    code: "STORAGE_ERROR" as const,
    message,
    statusCode: 502,
    ...(details === undefined
      ? {}
      : { details }),
    ...(cause === undefined
      ? {}
      : { cause }),
  };

  return new ApplicationError(options);
}

function signedUploadUrl(
  value: unknown,
  filename: string,
): URL {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw storageError(
      "Wix returned an invalid media upload URL.",
    );
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch (error) {
    throw storageError(
      "Wix returned an invalid media upload URL.",
      undefined,
      error,
    );
  }

  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== ""
  ) {
    throw storageError(
      "Wix returned an unsafe media upload URL.",
    );
  }

  url.searchParams.set(
    "filename",
    filename,
  );

  return url;
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

  if (
    !Number.isSafeInteger(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

function normalizeUploadedFile(
  payload: unknown,
  expectedSize: number,
): StoredPrivateMediaFile {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("file" in payload)
  ) {
    throw storageError(
      "Wix returned invalid media file metadata.",
    );
  }

  const file =
    (payload as WixUploadResponse)
      .file;

  if (
    typeof file !== "object" ||
    file === null
  ) {
    throw storageError(
      "Wix returned invalid media file metadata.",
    );
  }

  const descriptor =
    file as WixFileDescriptorLike;

  const fileId =
    typeof descriptor.id === "string"
      ? descriptor.id.trim()
      : "";

  const displayName =
    typeof descriptor.displayName ===
      "string"
      ? descriptor.displayName.trim()
      : "";

  const sizeBytes = positiveInteger(
    descriptor.sizeInBytes,
  );

  if (
    !fileId ||
    !displayName ||
    sizeBytes === null ||
    sizeBytes !== expectedSize
  ) {
    throw storageError(
      "Wix returned incomplete media file metadata.",
    );
  }

  if (descriptor.private !== true) {
    throw storageError(
      "Wix did not store the attachment as a private file.",
    );
  }

  const operationStatus =
    typeof descriptor.operationStatus ===
      "string" &&
    descriptor.operationStatus.trim()
      ? descriptor.operationStatus.trim()
      : null;

  if (
    operationStatus === "FAILED"
  ) {
    throw storageError(
      "Wix reported that the media upload failed.",
    );
  }

  return {
    fileId,
    displayName,
    parentFolderId:
      typeof descriptor.parentFolderId ===
        "string" &&
      descriptor.parentFolderId.trim()
        ? descriptor.parentFolderId.trim()
        : null,
    sizeBytes,
    private: true,
    operationStatus,
  };
}

function timeoutMs(
  value: number | undefined,
): number {
  const resolved =
    value ??
    DEFAULT_UPLOAD_TIMEOUT_MS;

  if (
    !Number.isSafeInteger(resolved) ||
    resolved < 1_000 ||
    resolved > 300_000
  ) {
    throw new Error(
      "The Wix media upload timeout is invalid.",
    );
  }

  return resolved;
}

export class WixMediaClient
  implements PrivateMediaStorage
{
  private readonly uploadTimeoutMs:
    number;

  constructor(
    private readonly httpClient:
      WixMediaJsonClient,
    private readonly fetchImplementation:
      typeof fetch = globalThis.fetch,
    options:
      WixMediaClientOptions = {},
  ) {
    this.uploadTimeoutMs = timeoutMs(
      options.uploadTimeoutMs,
    );
  }

  async uploadPrivateFile(
    input:
      PrivateMediaUploadRequest,
  ): Promise<StoredPrivateMediaFile> {
    const generated =
      await this.httpClient.post<
        GenerateUploadUrlResponse
      >(
        GENERATE_UPLOAD_URL_PATH,
        {
          mimeType: input.mimeType,
          fileName: input.filename,
          filePath: input.filePath,
          parentFolderId:
            "media-root",
          private: true,
          labels: [
            ...input.labels,
          ],
        },
      );

    const url = signedUploadUrl(
      generated.uploadUrl,
      input.filename,
    );

    let response: Response;

    try {
      response =
        await this.fetchImplementation(
          url,
          {
            method: "PUT",
            headers: {
              Accept:
                "application/json",
              "Content-Type":
                input.mimeType,
            },
            body: Buffer.from(
              input.content,
            ),
            redirect: "error",
            signal: AbortSignal.timeout(
              this.uploadTimeoutMs,
            ),
          },
        );
    } catch (error) {
      throw storageError(
        "The Wix media upload could not be completed.",
        undefined,
        error,
      );
    }

    const responseText =
      await response.text();

    const payload = parsePayload(
      responseText,
    );

    if (!response.ok) {
      throw storageError(
        "Wix rejected the media upload.",
        {
          upstreamStatus:
            response.status,
          upstreamPayload:
            payload,
        },
      );
    }

    return normalizeUploadedFile(
      payload,
      input.content.byteLength,
    );
  }

  async deletePrivateFiles(
    fileIds: readonly string[],
  ): Promise<void> {
    const uniqueFileIds = [
      ...new Set(
        fileIds
          .map((fileId) =>
            fileId.trim(),
          )
          .filter(Boolean),
      ),
    ];

    if (uniqueFileIds.length === 0) {
      return;
    }

    await this.httpClient.post<unknown>(
      BULK_DELETE_FILES_PATH,
      {
        fileIds: uniqueFileIds,
        permanent: true,
      },
    );
  }
}
