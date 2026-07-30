import { ApplicationError } from "../../domain/errors.js";

import type { WixConfig } from "./wix-config.js";
import type { WixApiErrorPayload } from "./wix-data-types.js";

export type FetchImplementation = typeof fetch;

export interface WixHttpClient {
  get<T>(path: string): Promise<T>;

  post<T>(
    path: string,
    body: unknown,
  ): Promise<T>;

  put<T>(
  path: string,
  body: unknown,
): Promise<T>;

  patch<T>(
    path: string,
    body: unknown,
  ): Promise<T>;
}

function parseResponsePayload(
  responseText: string,
): unknown {
  if (!responseText) {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return responseText;
  }
}

function getWixErrorMessage(
  payload: unknown,
): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "message" in payload &&
    typeof (payload as WixApiErrorPayload)
      .message === "string"
  ) {
    return (
      (payload as WixApiErrorPayload).message ??
      "Wix rejected the request."
    );
  }

  return "Wix rejected the request.";
}

export class WixApiClient
  implements WixHttpClient
{
  private readonly baseUrl: URL;

  constructor(
    private readonly config: WixConfig,
    private readonly fetchImplementation:
      FetchImplementation = globalThis.fetch,
  ) {
    this.baseUrl = new URL(config.baseUrl);
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  post<T>(
    path: string,
    body: unknown,
  ): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  put<T>(
  path: string,
  body: unknown,
): Promise<T> {
  return this.request<T>("PUT", path, body);
}

  patch<T>(
    path: string,
    body: unknown,
  ): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "PATCH",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);

    const headers = new Headers({
      Accept: "application/json",
      Authorization: this.config.apiKey,
      "Content-Type": "application/json",
      "wix-site-id": this.config.siteId,
    });

    const requestInit: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined) {
      requestInit.body = JSON.stringify(body);
    }

    let response: Response;

    try {
      response =
        await this.fetchImplementation(
          url,
          requestInit,
        );
    } catch (error) {
      throw new ApplicationError({
        code: "STORAGE_ERROR",
        message:
          "The Wix API could not be reached.",
        statusCode: 502,
        cause: error,
      });
    }

    const responseText = await response.text();

    const payload =
      parseResponsePayload(responseText);

    if (!response.ok) {
      throw new ApplicationError({
        code: "STORAGE_ERROR",
        message: getWixErrorMessage(payload),
        statusCode: 502,
        details: {
          upstreamStatus: response.status,
          upstreamPayload: payload,
        },
      });
    }

    return payload as T;
  }
}