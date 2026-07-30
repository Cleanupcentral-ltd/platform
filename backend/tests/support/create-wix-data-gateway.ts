import type {
  WixDataGateway,
} from "../../src/adapters/wix/wix-data-client.js";

function unexpected(
  operation: string,
): never {
  throw new Error(
    `${operation} was not expected.`,
  );
}

export function createWixDataGateway(
  overrides: Partial<WixDataGateway> = {},
): WixDataGateway {
  return {
    async getDataCollection() {
      return unexpected(
        "getDataCollection",
      );
    },

    async getDataItem() {
      return unexpected("getDataItem");
    },

    async queryDataItems() {
      return unexpected(
        "queryDataItems",
      );
    },

    async insertDataItem() {
      return unexpected(
        "insertDataItem",
      );
    },

    async updateDataItem() {
      return unexpected(
        "updateDataItem",
      );
    },

    async patchDataItem() {
      return unexpected(
        "patchDataItem",
      );
    },

    async bulkInsertDataItems() {
      return unexpected(
        "bulkInsertDataItems",
      );
    },

    async bulkRemoveDataItems() {
  return unexpected(
    "bulkRemoveDataItems",
  );
},

    ...overrides,
  };
}