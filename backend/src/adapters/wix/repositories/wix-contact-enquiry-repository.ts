import {
  ApplicationError,
} from "../../../domain/errors.js";

import type {
  ContactEnquiryRecord,
  CreateContactEnquiryRecord,
} from "../../../domain/models.js";

import type {
  ContactEnquiryCreateOptions,
  ContactEnquiryRepository,
} from "../../../ports/repositories.js";

import {
  WIX_COLLECTIONS,
  WIX_FIELDS,
} from "../collections.js";

import type {
  WixDataGateway,
} from "../wix-data-client.js";

import {
  mapContactEnquiryCreateToWix,
  mapContactEnquiryFromWix,
} from "./contact-enquiry-mapper.js";

import {
  mapInsertedWixItem,
  removeWixDataItems,
} from "./wix-bulk-write.js";

export class WixContactEnquiryRepository
  implements ContactEnquiryRepository
{
  constructor(
    private readonly dataGateway:
      WixDataGateway,
  ) {}

  async findBySubmissionId(
    submissionId: string,
  ): Promise<ContactEnquiryRecord | null> {
    const response =
      await this.dataGateway.queryDataItems(
        WIX_COLLECTIONS.contactEnquiries,
        {
          filter: {
            [WIX_FIELDS.contactEnquiries
              .submissionId]: {
              $eq: submissionId,
            },
          },

          paging: {
            limit: 2,
            offset: 0,
          },
        },
        {
          consistentRead: true,
        },
      );

    if (response.dataItems.length === 0) {
      return null;
    }

    if (response.dataItems.length > 1) {
      throw new ApplicationError({
        code: "STORAGE_ERROR",
        message:
          "More than one contact enquiry uses the same submission ID.",
        statusCode: 502,
        details: {
          submissionId,
          matchingRecordCount:
            response.dataItems.length,
        },
      });
    }

    return mapContactEnquiryFromWix(
      response.dataItems[0]!,
    );
  }

  async create(
    enquiry: CreateContactEnquiryRecord,
    options:
      ContactEnquiryCreateOptions = {},
  ): Promise<ContactEnquiryRecord> {
    const response =
      await this.dataGateway.insertDataItem(
        WIX_COLLECTIONS.contactEnquiries,
        mapContactEnquiryCreateToWix(
          enquiry,
        ),
        options.itemId,
      );

    return mapInsertedWixItem(
      this.dataGateway,
      WIX_COLLECTIONS.contactEnquiries,
      response.dataItem,
      mapContactEnquiryFromWix,
    );
  }

  async delete(
    enquiryId: string,
  ): Promise<void> {
    await removeWixDataItems(
      this.dataGateway,
      WIX_COLLECTIONS.contactEnquiries,
      [enquiryId],
    );
  }
}
