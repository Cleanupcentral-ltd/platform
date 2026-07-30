import { media } from "@wix/sdk";

export function resolveCmsImage(
  imageValue: unknown,
  fallbackUrl = "",
): string {
  if (!imageValue) return fallbackUrl;

  if (typeof imageValue === "string") {
    if (
      imageValue.startsWith("http://") ||
      imageValue.startsWith("https://")
    ) {
      return imageValue;
    }

    if (imageValue.startsWith("wix:image://")) {
      try {
        return media.getImageUrl(imageValue).url;
      } catch {
        return fallbackUrl;
      }
    }

    return fallbackUrl;
  }

  if (typeof imageValue === "object") {
    const possibleImage = imageValue as {
      url?: unknown;
      src?: unknown;
    };

    const possibleUrl = possibleImage.url ?? possibleImage.src;

    if (typeof possibleUrl === "string") {
      return resolveCmsImage(possibleUrl, fallbackUrl);
    }
  }

  return fallbackUrl;
}