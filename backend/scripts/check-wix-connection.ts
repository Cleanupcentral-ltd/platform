import { WIX_COLLECTIONS } from "../src/adapters/wix/collections.js";
import { WixApiClient } from "../src/adapters/wix/wix-api-client.js";
import { loadWixConfig } from "../src/adapters/wix/wix-config.js";
import { WixDataClient } from "../src/adapters/wix/wix-data-client.js";

async function checkWixConnection(): Promise<void> {
  const config = loadWixConfig();

  const apiClient = new WixApiClient(config);

  const dataClient = new WixDataClient(
    apiClient,
  );

  const result =
    await dataClient.queryDataItems(
      WIX_COLLECTIONS.customers,
      {
        paging: {
          limit: 1,
          offset: 0,
        },
      },
      {
        consistentRead: true,
      },
    );

  console.log(
    [
      "Wix connection confirmed.",
      "The Customers collection is reachable.",
      `${result.dataItems.length} item(s) returned.`,
    ].join(" "),
  );
}

try {
  await checkWixConnection();
} catch (error) {
  console.error(
    "Wix connection check failed.",
  );

  console.error(error);

  process.exitCode = 1;
}