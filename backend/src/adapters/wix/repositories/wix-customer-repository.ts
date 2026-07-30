import type {
  CreateCustomerRecord,
  CustomerRecord,
  UpdateCustomerRecord,
} from "../../../domain/models.js";

import type {
  CustomerRepository,
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
  mapCustomerChangesToWix,
  mapCustomerCreateToWix,
  mapCustomerFromWix,
} from "./customer-mapper.js";

import {
  mapInsertedWixItem,
  removeWixDataItems,
} from "./wix-bulk-write.js";

export class WixCustomerRepository
  implements CustomerRepository
{
  constructor(
    private readonly dataGateway:
      WixDataGateway,
  ) {}

  async findByNormalizedEmail(
    emailNormalized: string,
  ): Promise<readonly CustomerRecord[]> {
    const response =
      await this.dataGateway.queryDataItems(
        WIX_COLLECTIONS.customers,
        {
          filter: {
            [WIX_FIELDS.customers
              .emailNormalized]: {
              $eq: emailNormalized,
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
      mapCustomerFromWix,
    );
  }

  async findByNormalizedPhone(
    phoneNormalized: string,
  ): Promise<readonly CustomerRecord[]> {
    const response =
      await this.dataGateway.queryDataItems(
        WIX_COLLECTIONS.customers,
        {
          filter: {
            [WIX_FIELDS.customers
              .phoneNormalized]: {
              $eq: phoneNormalized,
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
      mapCustomerFromWix,
    );
  }

  async findById(
    customerId: string,
  ): Promise<CustomerRecord | null> {
    try {
      const response =
        await this.dataGateway.getDataItem(
          WIX_COLLECTIONS.customers,
          customerId,
        );

      return mapCustomerFromWix(
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
    customer: CreateCustomerRecord,
  ): Promise<CustomerRecord> {
    const response =
      await this.dataGateway.insertDataItem(
        WIX_COLLECTIONS.customers,
        mapCustomerCreateToWix(customer),
      );

    return mapCustomerFromWix(
      response.dataItem,
    );
  }

  async update(
    customerId: string,
    changes: UpdateCustomerRecord,
  ): Promise<CustomerRecord> {
    const mappedChanges =
      mapCustomerChangesToWix(changes);

    if (
      Object.keys(mappedChanges).length === 0
    ) {
      const customer =
        await this.findById(customerId);

      if (customer === null) {
        throw new Error(
          `Customer ${customerId} was not found.`,
        );
      }

      return customer;
    }

    const response =
      await this.dataGateway.patchDataItem(
        WIX_COLLECTIONS.customers,
        customerId,
        mappedChanges,
      );

    return mapInsertedWixItem(
      this.dataGateway,
      WIX_COLLECTIONS.customers,
      response.dataItem,
      mapCustomerFromWix,
    );
  }

  async delete(
    customerId: string,
  ): Promise<void> {
    await removeWixDataItems(
      this.dataGateway,
      WIX_COLLECTIONS.customers,
      [customerId],
    );
  }
}
