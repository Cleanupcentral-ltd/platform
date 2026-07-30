import type {
  ContactEnquiryRepository,
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
  WixContactEnquiryRepository,
} from "./repositories/wix-contact-enquiry-repository.js";

export function createWixContactEnquiryRepositoryFromGateway(
  dataGateway: WixDataGateway,
): ContactEnquiryRepository {
  return new WixContactEnquiryRepository(
    dataGateway,
  );
}

export function createWixContactEnquiryRepository(
  config: WixConfig = loadWixConfig(),
): ContactEnquiryRepository {
  const dataGateway =
    new WixDataClient(
      new WixApiClient(config),
    );

  return createWixContactEnquiryRepositoryFromGateway(
    dataGateway,
  );
}
