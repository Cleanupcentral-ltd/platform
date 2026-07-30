export interface PrivateMediaUploadRequest {
  readonly filename: string;
  readonly mimeType: string;
  readonly content: Uint8Array;
  readonly filePath: string;
  readonly labels: readonly string[];
}

export interface StoredPrivateMediaFile {
  readonly fileId: string;
  readonly displayName: string;
  readonly parentFolderId:
    string | null;
  readonly sizeBytes: number;
  readonly private: true;
  readonly operationStatus:
    string | null;
}

export interface PrivateMediaStorage {
  uploadPrivateFile(
    input:
      PrivateMediaUploadRequest,
  ): Promise<StoredPrivateMediaFile>;

  deletePrivateFiles(
    fileIds: readonly string[],
  ): Promise<void>;
}
