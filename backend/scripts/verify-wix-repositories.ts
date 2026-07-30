import {
  WIX_COLLECTIONS,
  type WixCollectionId,
} from "../src/adapters/wix/collections.js";

import {
  createWixQuoteRepositoriesFromGateway,
} from "../src/adapters/wix/create-wix-repositories.js";

import {
  WixApiClient,
} from "../src/adapters/wix/wix-api-client.js";

import {
  loadWixConfig,
} from "../src/adapters/wix/wix-config.js";

import {
  WixDataClient,
} from "../src/adapters/wix/wix-data-client.js";

interface CreatedRecords {
  customerId: string | null;
  propertyId: string | null;
  quoteId: string | null;
  quoteItemIds: string[];
  historyId: string | null;
}

async function removeRecords(
  dataClient: WixDataClient,
  collectionId: WixCollectionId,
  itemIds: readonly string[],
): Promise<void> {
  if (itemIds.length === 0) {
    return;
  }

  const response =
    await dataClient.bulkRemoveDataItems(
      collectionId,
      itemIds,
    );

  const totalFailures =
    response.bulkActionMetadata
      ?.totalFailures ?? 0;

  const failedResults =
    response.results.filter(
      ({ itemMetadata }) =>
        itemMetadata.success === false ||
        itemMetadata.error !== undefined,
    );

  if (
    totalFailures > 0 ||
    failedResults.length > 0
  ) {
    throw new Error(
      [
        "Cleanup failed for",
        collectionId,
        `(${totalFailures} failure(s)).`,
      ].join(" "),
    );
  }
}

async function cleanup(
  dataClient: WixDataClient,
  created: CreatedRecords,
): Promise<void> {
  await removeRecords(
    dataClient,
    WIX_COLLECTIONS.statusHistory,
    created.historyId
      ? [created.historyId]
      : [],
  );

  await removeRecords(
    dataClient,
    WIX_COLLECTIONS.quoteItems,
    created.quoteItemIds,
  );

  await removeRecords(
    dataClient,
    WIX_COLLECTIONS.quotes,
    created.quoteId
      ? [created.quoteId]
      : [],
  );

  await removeRecords(
    dataClient,
    WIX_COLLECTIONS.properties,
    created.propertyId
      ? [created.propertyId]
      : [],
  );

  await removeRecords(
    dataClient,
    WIX_COLLECTIONS.customers,
    created.customerId
      ? [created.customerId]
      : [],
  );
}

async function verifyWixRepositories():
  Promise<void> {
  const config = loadWixConfig();

  const dataClient =
    new WixDataClient(
      new WixApiClient(config),
    );

  const repositories =
    createWixQuoteRepositoriesFromGateway(
      dataClient,
    );

  const token = [
    Date.now().toString(36),
    Math.random()
      .toString(36)
      .slice(2, 8),
  ].join("-");

  const label =
    `BUILD4D-VERIFY-${token}`;

  const created: CreatedRecords = {
    customerId: null,
    propertyId: null,
    quoteId: null,
    quoteItemIds: [],
    historyId: null,
  };

  let verificationError: unknown;
  let cleanupError: unknown;

  try {
    const customer =
      await repositories.customers.create({
        fullName: label,
        companyName: null,

        email:
          `${label.toLowerCase()}@example.com`,

        emailNormalized:
          `${label.toLowerCase()}@example.com`,

        phone: "07000000000",

        phoneNormalized:
          "447000000000",

        declaredCustomerType:
          "New customer",

        verificationStatus:
          "Verified New",

        isExistingCustomer: false,

        firstEligibleCleanCompleted:
          false,

        privacyConsent: true,

        marketingConsent: false,

        internalNotes:
          "Temporary Build 4D verification record.",
      });

    created.customerId = customer.id;

    const patchedCustomer =
      await repositories.customers.update(
        customer.id,
        {
          marketingConsent: true,
        },
      );

    if (
      patchedCustomer
        .marketingConsent !== true
    ) {
      throw new Error(
        "Customer patch verification failed.",
      );
    }

    const property =
      await repositories.properties.create({
        customerId: customer.id,

        propertyLabel: label,

        address:
          "14 Example Avenue, London",

        postcode: "NW1 1HN",

        postcodeNormalized:
          "NW11HN",

        propertyType: "House",
        bedroomCount: 1,
        bathroomCount: 1,
        occupancyStatus: "Vacant",
        parkingDetails: null,
        petsDetails: null,
        accessArrangements: null,
        verifiedProperty: false,
        activeProperty: true,
      });

    created.propertyId = property.id;

    const patchedProperty =
      await repositories.properties.update(
        property.id,
        {
          verifiedProperty: true,
        },
      );

    if (
      patchedProperty
        .verifiedProperty !== true
    ) {
      throw new Error(
        "Property patch verification failed.",
      );
    }

    const submissionId =
      `submission-${token}`;

    const quote =
      await repositories.quotes.create({
        submissionId,

        quoteNumber:
          `CUC-VERIFY-${token.toUpperCase()}`,

        customerId: customer.id,
        propertyId: property.id,
        schemaVersion: "1",

        pricingVersion:
          "CUC Phase 0 v1.3",

        status: "Submitted",

        category:
          "Residential Cleaning",

        serviceType:
          "Standard Clean",

        cleaningScope:
          "Whole Property",

        declaredCustomerType:
          "New customer",

        verifiedCustomerStatus:
          "Verified New",

        customerStatusMismatch:
          false,

        preferredContactMethod:
          "Email",

        preferredDate:
          "2099-01-15",

        arrivalWindow:
          "08:00–11:00",

        preferredStartDate:
          null,

        requiredCompletionDate:
          null,

        sameDay: false,
        arrangement: null,
        frequency: null,
        urgency: null,
        supportServices: [],

        manualReviewRequired:
          false,

        manualReviewReasons: [],

        estimatedTotal: 70,

        requiredUpfrontPercentage:
          30,

        requiredUpfrontAmount:
          21,

        remainingBalance: 49,
        travelFee: 0,
        travelPending: false,
        distanceMiles: 0,
        provisional: false,

        customerNotes:
          "Temporary Build 4D repository verification record.",

        rawSubmission: {
          verificationRun: token,
        },

        pricingSnapshot: {
          basePrice: 70,
          estimatedTotal: 70,
        },
      });

    created.quoteId = quote.id;

    const locatedQuote =
      await repositories.quotes
        .findBySubmissionId(
          submissionId,
        );

    if (
      locatedQuote?.id !== quote.id
    ) {
      throw new Error(
        "Quote lookup verification failed.",
      );
    }

    const quoteItems =
      await repositories.quoteItems
        .createMany([
          {
            quoteId: quote.id,

            itemLabel:
              "Standard Clean",

            sourceKey:
              "base-clean",

            itemType:
              "Cleaning",

            itemName:
              "Standard Clean",

            quantity: 1,
            unitPrice: 70,
            lineTotal: 70,
            discountable: true,
            provisional: false,
            customerVisible: true,
            displayOrder: 1,

            metadata: {
              verificationRun:
                token,
            },
          },
        ]);

    created.quoteItemIds =
      quoteItems.map(({ id }) => id);

    const history =
      await repositories.statusHistory
        .create({
          historyLabel:
            `${label} submitted`,

          quoteId: quote.id,

          contactEnquiryId: null,

          recordType: "Quote",

          previousStatus: null,

          newStatus: "Submitted",

          changeSource:
            "Build 4D Verification",

          actorType: "System",

          actorId: null,

          actorName:
            "Build 4D verifier",

          changeReason:
            "Controlled repository verification",

          customerVisible: false,

          notes:
            "Temporary record; removed after verification.",

          metadata: {
            verificationRun:
              token,
          },
        });

    created.historyId = history.id;

    console.log(
      [
        "Live repository verification succeeded.",
        "Customer, Property, Quote, Quote Item",
        "and Status History writes were confirmed.",
      ].join(" "),
    );
  } catch (error) {
    verificationError = error;
  }

  try {
    await cleanup(
      dataClient,
      created,
    );
  } catch (error) {
    cleanupError = error;
  }

  if (verificationError) {
    if (cleanupError) {
      console.error(
        "Verification cleanup also failed.",
        cleanupError,
      );
    }

    throw verificationError;
  }

  if (cleanupError) {
    throw cleanupError;
  }

  console.log(
    "Temporary Wix verification records were removed successfully.",
  );
}

try {
  await verifyWixRepositories();
} catch (error) {
  console.error(
    "Live Wix repository verification failed.",
  );

  console.error(error);

  process.exitCode = 1;
}