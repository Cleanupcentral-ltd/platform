import {
  WIX_COLLECTIONS,
  WIX_FIELDS,
  type WixCollectionId,
} from "../src/adapters/wix/collections.js";
import { WixApiClient } from "../src/adapters/wix/wix-api-client.js";
import { loadWixConfig } from "../src/adapters/wix/wix-config.js";
import { WixDataClient } from "../src/adapters/wix/wix-data-client.js";

interface CollectionAudit {
  readonly label: string;
  readonly collectionId: WixCollectionId;
  readonly expectedFieldIds: readonly string[];
}

const audits: readonly CollectionAudit[] = [
  {
    label: "Customers",
    collectionId: WIX_COLLECTIONS.customers,
    expectedFieldIds: Object.values(
      WIX_FIELDS.customers,
    ),
  },
  {
    label: "Properties",
    collectionId: WIX_COLLECTIONS.properties,
    expectedFieldIds: Object.values(
      WIX_FIELDS.properties,
    ),
  },
  {
    label: "Quotes",
    collectionId: WIX_COLLECTIONS.quotes,
    expectedFieldIds: Object.values(
      WIX_FIELDS.quotes,
    ),
  },
  {
    label: "Quote Items",
    collectionId: WIX_COLLECTIONS.quoteItems,
    expectedFieldIds: Object.values(
      WIX_FIELDS.quoteItems,
    ),
  },
  {
    label: "Contact Enquiries",
    collectionId:
      WIX_COLLECTIONS.contactEnquiries,
    expectedFieldIds: Object.values(
      WIX_FIELDS.contactEnquiries,
    ),
  },
  {
    label: "Media Uploads",
    collectionId:
      WIX_COLLECTIONS.mediaUploads,
    expectedFieldIds: Object.values(
      WIX_FIELDS.mediaUploads,
    ),
  },
  {
    label: "Status History",
    collectionId:
      WIX_COLLECTIONS.statusHistory,
    expectedFieldIds: Object.values(
      WIX_FIELDS.statusHistory,
    ),
  },
];

function getCustomFieldIds(
  fieldIds: readonly string[],
): string[] {
  return fieldIds
    .filter((fieldId) => !fieldId.startsWith("_"))
    .sort((left, right) =>
      left.localeCompare(right),
    );
}

async function auditWixSchema(): Promise<void> {
  const config = loadWixConfig();

  const dataClient = new WixDataClient(
    new WixApiClient(config),
  );

  let problemCount = 0;

  console.log(
    "Checking Wix collection and field IDs...\n",
  );

  for (const audit of audits) {
    try {
      const response =
        await dataClient.getDataCollection(
          audit.collectionId,
        );

      const actualFieldIds = getCustomFieldIds(
        response.collection.fields.map(
          ({ key }) => key,
        ),
      );

      const actualFieldIdSet = new Set(
        actualFieldIds,
      );

      const missingFieldIds =
        audit.expectedFieldIds
          .filter(
            (fieldId) =>
              !actualFieldIdSet.has(fieldId),
          )
          .sort((left, right) =>
            left.localeCompare(right),
          );

      console.log(
        `✓ ${audit.label}`,
      );

      console.log(
        `  Collection ID: ${response.collection.id}`,
      );

      console.log(
        `  Field IDs: ${actualFieldIds.join(", ")}`,
      );

      if (missingFieldIds.length > 0) {
        problemCount += 1;

        console.log(
          `  ⚠ Expected but not found: ${missingFieldIds.join(", ")}`,
        );
      }

      console.log("");
    } catch (error) {
      problemCount += 1;

      console.log(
        `✗ ${audit.label}`,
      );

      console.log(
        `  Could not read collection ID: ${audit.collectionId}`,
      );

      console.error(error);

      console.log("");
    }
  }

  if (problemCount > 0) {
    console.error(
      [
        "Wix schema audit found",
        `${problemCount} collection contract issue(s).`,
        "Do not enable repository writes yet.",
      ].join(" "),
    );

    process.exitCode = 1;
    return;
  }

  console.log(
    "Wix schema audit passed. All required collection and field IDs were found.",
  );
}

await auditWixSchema();