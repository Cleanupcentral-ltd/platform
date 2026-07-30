import type {
  CreatePropertyRecord,
  PropertyRecord,
  UpdatePropertyRecord,
} from "../../../domain/models.js";

import type {
  PropertyRepository,
} from "../../../ports/repositories.js";

import {
  WIX_COLLECTIONS,
  WIX_FIELDS,
} from "../collections.js";

import type {
  WixDataGateway,
} from "../wix-data-client.js";

import {
  isWixNotFoundError,
} from "../wix-errors.js";

import {
  mapPropertyChangesToWix,
  mapPropertyCreateToWix,
  mapPropertyFromWix,
} from "./property-mapper.js";

import {
  mapInsertedWixItem,
  removeWixDataItems,
} from "./wix-bulk-write.js";

export class WixPropertyRepository
  implements PropertyRepository
{
  constructor(
    private readonly dataGateway:
      WixDataGateway,
  ) {}

  async findByCustomerAndPostcode(
    customerId: string,
    postcodeNormalized: string,
  ): Promise<readonly PropertyRecord[]> {
    const response =
      await this.dataGateway.queryDataItems(
        WIX_COLLECTIONS.properties,
        {
          filter: {
            [WIX_FIELDS.properties
              .customer]: {
              $eq: customerId,
            },

            [WIX_FIELDS.properties
              .postcodeNormalized]: {
              $eq: postcodeNormalized,
            },
          },

          paging: {
            limit: 20,
            offset: 0,
          },
        },
        {
          consistentRead: true,
        },
      );

    return response.dataItems.map(
      mapPropertyFromWix,
    );
  }

  async findById(
    propertyId: string,
  ): Promise<PropertyRecord | null> {
    try {
      const response =
        await this.dataGateway.getDataItem(
          WIX_COLLECTIONS.properties,
          propertyId,
        );

      return mapPropertyFromWix(
        response.dataItem,
      );
    } catch (error) {
      if (isWixNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }

  async create(
    property: CreatePropertyRecord,
  ): Promise<PropertyRecord> {
    const response =
      await this.dataGateway.insertDataItem(
        WIX_COLLECTIONS.properties,
        mapPropertyCreateToWix(property),
      );

    return mapPropertyFromWix(
      response.dataItem,
    );
  }

  async update(
    propertyId: string,
    changes: UpdatePropertyRecord,
  ): Promise<PropertyRecord> {
    const mappedChanges =
      mapPropertyChangesToWix(changes);

    if (
      Object.keys(mappedChanges).length === 0
    ) {
      const property =
        await this.findById(propertyId);

      if (property === null) {
        throw new Error(
          `Property ${propertyId} was not found.`,
        );
      }

      return property;
    }

    const response =
      await this.dataGateway.patchDataItem(
        WIX_COLLECTIONS.properties,
        propertyId,
        mappedChanges,
      );

    return mapInsertedWixItem(
      this.dataGateway,
      WIX_COLLECTIONS.properties,
      response.dataItem,
      mapPropertyFromWix,
    );
  }

  async delete(
    propertyId: string,
  ): Promise<void> {
    await removeWixDataItems(
      this.dataGateway,
      WIX_COLLECTIONS.properties,
      [propertyId],
    );
  }
}
