import assert from "node:assert/strict";
import test from "node:test";

import {
  WixMediaClient,
  type WixMediaJsonClient,
} from "../src/adapters/wix/wix-media-client.js";

import {
  ApplicationError,
} from "../src/domain/errors.js";

import type {
  PrivateMediaUploadRequest,
} from "../src/ports/media-storage.js";

function uploadRequest():
  PrivateMediaUploadRequest {
  return {
    filename:
      "upload-id-kitchen-photo.jpg",
    mimeType: "image/jpeg",
    content: new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xe0,
      0x44,
      0x41,
      0x54,
      0x41,
    ]),
    filePath:
      "/cleanup-central/quote-attachments/pending",
    labels: [
      "cleanup-central",
      "quote-attachment",
      "pending",
    ],
  };
}

test(
  "generates a private Wix upload URL and uploads only the binary file",
  async () => {
    let generatedPath = "";
    let generatedBody: unknown;
    let uploadUrl = "";
    let uploadInit:
      RequestInit | undefined;

    const jsonClient:
      WixMediaJsonClient = {
        async post<T>(
          path: string,
          body: unknown,
        ): Promise<T> {
          generatedPath = path;
          generatedBody = body;

          return {
            uploadUrl:
              "https://upload.wixmp.com/signed-token?existing=1",
          } as T;
        },
      };

    const fakeFetch:
      typeof fetch = async (
        input,
        init,
      ) => {
        uploadUrl = String(input);
        uploadInit = init;

        return new Response(
          JSON.stringify({
            file: {
              id: "media-file-1.jpg",
              displayName:
                "upload-id-kitchen-photo.jpg",
              parentFolderId:
                "folder-1",
              sizeInBytes: "8",
              private: true,
              operationStatus:
                "READY",
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type":
                "application/json",
            },
          },
        );
      };

    const client = new WixMediaClient(
      jsonClient,
      fakeFetch,
    );

    const result =
      await client.uploadPrivateFile(
        uploadRequest(),
      );

    assert.equal(
      generatedPath,
      "/site-media/v1/files/generate-upload-url",
    );

    assert.deepEqual(
      generatedBody,
      {
        mimeType: "image/jpeg",
        fileName:
          "upload-id-kitchen-photo.jpg",
        filePath:
          "/cleanup-central/quote-attachments/pending",
        parentFolderId:
          "media-root",
        private: true,
        labels: [
          "cleanup-central",
          "quote-attachment",
          "pending",
        ],
      },
    );

    const parsedUrl =
      new URL(uploadUrl);

    assert.equal(
      parsedUrl.protocol,
      "https:",
    );

    assert.equal(
      parsedUrl.searchParams.get(
        "filename",
      ),
      "upload-id-kitchen-photo.jpg",
    );

    assert.ok(uploadInit);
    assert.equal(
      uploadInit.method,
      "PUT",
    );
    assert.equal(
      uploadInit.redirect,
      "error",
    );

    const headers = new Headers(
      uploadInit.headers,
    );

    assert.equal(
      headers.get("Content-Type"),
      "image/jpeg",
    );

    assert.equal(
      headers.get("Authorization"),
      null,
    );

    assert.equal(
      headers.get("wix-site-id"),
      null,
    );

    assert.ok(
      Buffer.isBuffer(
        uploadInit.body,
      ),
    );

    assert.deepEqual(
      [...(
        uploadInit.body as Buffer
      )],
      [...uploadRequest().content],
    );

    assert.deepEqual(result, {
      fileId: "media-file-1.jpg",
      displayName:
        "upload-id-kitchen-photo.jpg",
      parentFolderId:
        "folder-1",
      sizeBytes: 8,
      private: true,
      operationStatus: "READY",
    });
  },
);

test(
  "rejects an unsafe generated upload URL before sending file data",
  async () => {
    let uploadCalls = 0;

    const jsonClient:
      WixMediaJsonClient = {
        async post<T>(): Promise<T> {
          return {
            uploadUrl:
              "http://example.com/upload",
          } as T;
        },
      };

    const client = new WixMediaClient(
      jsonClient,
      async () => {
        uploadCalls += 1;
        return new Response();
      },
    );

    await assert.rejects(
      () =>
        client.uploadPrivateFile(
          uploadRequest(),
        ),
      (error: unknown) => {
        assert.ok(
          error instanceof
            ApplicationError,
        );
        assert.equal(
          error.code,
          "STORAGE_ERROR",
        );
        return true;
      },
    );

    assert.equal(uploadCalls, 0);
  },
);

test(
  "converts a signed upload failure into a storage error",
  async () => {
    const jsonClient:
      WixMediaJsonClient = {
        async post<T>(): Promise<T> {
          return {
            uploadUrl:
              "https://upload.wixmp.com/signed-token",
          } as T;
        },
      };

    const client = new WixMediaClient(
      jsonClient,
      async () =>
        new Response(
          JSON.stringify({
            message:
              "Upload rejected",
          }),
          {
            status: 403,
            headers: {
              "Content-Type":
                "application/json",
            },
          },
        ),
    );

    await assert.rejects(
      () =>
        client.uploadPrivateFile(
          uploadRequest(),
        ),
      (error: unknown) => {
        assert.ok(
          error instanceof
            ApplicationError,
        );
        assert.equal(
          error.code,
          "STORAGE_ERROR",
        );
        assert.deepEqual(
          error.details,
          {
            upstreamStatus: 403,
            upstreamPayload: {
              message:
                "Upload rejected",
            },
          },
        );
        return true;
      },
    );
  },
);

test(
  "rejects a Wix response that did not store the file privately",
  async () => {
    const jsonClient:
      WixMediaJsonClient = {
        async post<T>(): Promise<T> {
          return {
            uploadUrl:
              "https://upload.wixmp.com/signed-token",
          } as T;
        },
      };

    const client = new WixMediaClient(
      jsonClient,
      async () =>
        new Response(
          JSON.stringify({
            file: {
              id: "media-file-1.jpg",
              displayName:
                "upload-id-kitchen-photo.jpg",
              sizeInBytes: "8",
              private: false,
              operationStatus:
                "READY",
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type":
                "application/json",
            },
          },
        ),
    );

    await assert.rejects(
      () =>
        client.uploadPrivateFile(
          uploadRequest(),
        ),
      /did not store the attachment as a private file/,
    );
  },
);

test(
  "rejects malformed upload metadata",
  async () => {
    const jsonClient:
      WixMediaJsonClient = {
        async post<T>(): Promise<T> {
          return {
            uploadUrl:
              "https://upload.wixmp.com/signed-token",
          } as T;
        },
      };

    const client = new WixMediaClient(
      jsonClient,
      async () =>
        new Response(
          JSON.stringify({
            file: {
              id: "",
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type":
                "application/json",
            },
          },
        ),
    );

    await assert.rejects(
      () =>
        client.uploadPrivateFile(
          uploadRequest(),
        ),
      ApplicationError,
    );
  },
);



test(
  "permanently deletes uploaded private files through Wix Media",
  async () => {
    let receivedPath = "";
    let receivedBody: unknown;

    const jsonClient:
      WixMediaJsonClient = {
        async post<T>(
          path: string,
          body: unknown,
        ): Promise<T> {
          receivedPath = path;
          receivedBody = body;

          return {} as T;
        },
      };

    const client =
      new WixMediaClient(
        jsonClient,
      );

    await client.deletePrivateFiles([
      "media-file-1.jpg",
      "media-file-1.jpg",
      " media-file-2.pdf ",
      "",
    ]);

    assert.equal(
      receivedPath,
      "/site-media/v1/bulk/files/delete",
    );

    assert.deepEqual(
      receivedBody,
      {
        fileIds: [
          "media-file-1.jpg",
          "media-file-2.pdf",
        ],
        permanent: true,
      },
    );
  },
);

test(
  "does not call Wix when there are no media files to delete",
  async () => {
    let calls = 0;

    const jsonClient:
      WixMediaJsonClient = {
        async post<T>(): Promise<T> {
          calls += 1;
          return {} as T;
        },
      };

    const client =
      new WixMediaClient(
        jsonClient,
      );

    await client.deletePrivateFiles([]);

    assert.equal(calls, 0);
  },
);
