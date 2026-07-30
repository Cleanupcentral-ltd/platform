import { z } from "zod";

import { ApplicationError } from "../../domain/errors.js";

const wixEnvironmentSchema = z.strictObject({
  WIX_API_KEY: z
    .string()
    .trim()
    .min(
      20,
      "WIX_API_KEY is missing or too short.",
    ),

  WIX_SITE_ID: z
    .string()
    .trim()
    .uuid("WIX_SITE_ID must be a valid UUID."),

  WIX_API_BASE_URL: z
    .string()
    .trim()
    .url()
    .default("https://www.wixapis.com"),
});

export interface WixConfig {
  readonly apiKey: string;
  readonly siteId: string;
  readonly baseUrl: string;
}

export function loadWixConfig(
  environment: NodeJS.ProcessEnv = process.env,
): WixConfig {
  const result = wixEnvironmentSchema.safeParse({
    WIX_API_KEY: environment.WIX_API_KEY,
    WIX_SITE_ID: environment.WIX_SITE_ID,
    WIX_API_BASE_URL:
      environment.WIX_API_BASE_URL ??
      "https://www.wixapis.com",
  });

  if (!result.success) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message:
        "The Wix backend configuration is invalid.",
      statusCode: 500,
      details: {
        fields:
          result.error.flatten().fieldErrors,
      },
    });
  }

  return {
    apiKey: result.data.WIX_API_KEY,
    siteId: result.data.WIX_SITE_ID,
    baseUrl: result.data.WIX_API_BASE_URL,
  };
}