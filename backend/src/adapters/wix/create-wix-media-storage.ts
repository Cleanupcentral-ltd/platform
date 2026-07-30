import {
  WixApiClient,
} from "./wix-api-client.js";

import {
  loadWixConfig,
} from "./wix-config.js";

import {
  WixMediaClient,
} from "./wix-media-client.js";

export function createWixMediaStorage():
  WixMediaClient {
  const config = loadWixConfig();

  return new WixMediaClient(
    new WixApiClient(config),
  );
}
