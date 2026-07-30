import type {
  QuoteRepositories,
} from "../../ports/repositories.js";

import {
  WixApiClient,
} from "./wix-api-client.js";

import {
  loadWixConfig,
  type WixConfig,
} from "./wix-config.js";

import {
  WixDataClient,
  type WixDataGateway,
} from "./wix-data-client.js";

import {
  WixCustomerRepository,
} from "./repositories/wix-customer-repository.js";

import {
  WixMediaUploadRepository,
} from "./repositories/wix-media-upload-repository.js";

import {
  WixPropertyRepository,
} from "./repositories/wix-property-repository.js";

import {
  WixQuoteItemRepository,
} from "./repositories/wix-quote-item-repository.js";

import {
  WixQuoteRepository,
} from "./repositories/wix-quote-repository.js";

import {
  WixStatusHistoryRepository,
} from "./repositories/wix-status-history-repository.js";

export function createWixQuoteRepositoriesFromGateway(
  dataGateway: WixDataGateway,
): QuoteRepositories {
  return {
    customers:
      new WixCustomerRepository(
        dataGateway,
      ),

    properties:
      new WixPropertyRepository(
        dataGateway,
      ),

    quotes:
      new WixQuoteRepository(
        dataGateway,
      ),

    quoteItems:
      new WixQuoteItemRepository(
        dataGateway,
      ),

    mediaUploads:
      new WixMediaUploadRepository(
        dataGateway,
      ),

    statusHistory:
      new WixStatusHistoryRepository(
        dataGateway,
      ),
  };
}

export function createWixQuoteRepositories(
  config: WixConfig = loadWixConfig(),
): QuoteRepositories {
  const dataGateway =
    new WixDataClient(
      new WixApiClient(config),
    );

  return createWixQuoteRepositoriesFromGateway(
    dataGateway,
  );
}