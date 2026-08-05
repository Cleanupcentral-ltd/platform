import type {
  CreateQuoteItemRecord,
} from "../domain/models.js";

import type {
  TravelCalculation,
} from "../domain/travel.js";

import {
  PRICES,
  PRICING_VERSION,
  calculateSelectedRoomsEstimate,
  calculateWholePropertyEstimate,
  roundMoney,
  type CleaningLevel,
  type ExtraName,
  type QuantityMap,
  type SelectedRoomName,
} from "../domain/pricing.js";

import type {
  QuoteResolutionContext,
} from "./resolve-quote-context.js";

export type PricedQuoteItem =
  Omit<
    CreateQuoteItemRecord,
    "quoteId"
  >;

export interface QuotePricingDecision {
  readonly kind:
    | "instant"
    | "custom";

  readonly pricingVersion: string;
  readonly estimatedTotal:
    number | null;

  readonly requiredUpfrontPercentage:
    number | null;

  readonly requiredUpfrontAmount:
    number | null;

  readonly remainingBalance:
    number | null;

  readonly travelFee:
    number | null;

  readonly travelPending:
    boolean;

  readonly provisional:
    boolean;

  readonly clientEstimateMismatch:
    boolean;

  readonly manualReviewRequired:
    boolean;

  readonly manualReviewReasons:
    readonly string[];

  readonly items:
    readonly PricedQuoteItem[];

  readonly pricingSnapshot:
    Readonly<
      Record<string, unknown>
    >;
}

export interface QuotePricingService {
  price(
    context:
      QuoteResolutionContext,
  ): Promise<QuotePricingDecision>;
}

export type DistanceResolver = (
  postcode: string,
) => Promise<number | null>;

export type TravelResolver = (
  postcode: string,
) => Promise<TravelCalculation>;

export interface QuotePricingOptions {
  readonly resolveDistanceMiles?:
    DistanceResolver;

  readonly resolveTravel?:
    TravelResolver;

  readonly now?: () => Date;
}

function uniqueReasons(
  reasons: readonly string[],
): readonly string[] {
  return [
    ...new Set(reasons),
  ];
}

function toCleaningLevel(
  value: string,
): CleaningLevel | null {
  if (
    value === "Standard Clean" ||
    value === "Deep Clean"
  ) {
    return value;
  }

  return null;
}

function londonParts(
  date: Date,
): Readonly<
  Record<string, string>
> {
  return Object.fromEntries(
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: "Europe/London",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      },
    )
      .formatToParts(date)
      .filter(
        ({ type }) =>
          type !== "literal",
      )
      .map(
        ({ type, value }) => [
          type,
          value,
        ],
      ),
  );
}

function londonDateTimeToUtc(
  dateText: string,
  timeText: string,
): Date {
  const [
    yearText,
    monthText,
    dayText,
  ] = dateText.split("-");

  const [
    hourText,
    minuteText,
  ] = timeText.split(":");

  const targetUtc =
    Date.UTC(
      Number(yearText),
      Number(monthText) - 1,
      Number(dayText),
      Number(hourText),
      Number(minuteText),
      0,
    );

  let guess = targetUtc;

  for (
    let attempt = 0;
    attempt < 3;
    attempt += 1
  ) {
    const parts =
      londonParts(
        new Date(guess),
      );

    const representedUtc =
      Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second),
      );

    guess +=
      targetUtc -
      representedUtc;
  }

  return new Date(guess);
}

function arrivalWindowStart(
  arrivalWindow: string,
): string {
  return (
    arrivalWindow
      .split("–", 1)[0]
      ?.trim() ?? ""
  );
}

function leadTimeHours(
  context:
    QuoteResolutionContext,
  now: Date,
): number | null {
  const preferredDate =
    context.submission
      .appointment.preferredDate;

  const arrivalWindow =
    context.submission
      .appointment.arrivalWindow;

  if (
    !preferredDate ||
    !arrivalWindow
  ) {
    return null;
  }

  const startTime =
    arrivalWindowStart(
      arrivalWindow,
    );

  if (!startTime) {
    return null;
  }

  const arrival =
    londonDateTimeToUtc(
      preferredDate,
      startTime,
    );

  return Math.max(
    0,
    (
      arrival.getTime() -
      now.getTime()
    ) /
      3_600_000,
  );
}

function requestAfter21(
  now: Date,
): boolean {
  const parts =
    londonParts(now);

  return Number(
    parts.hour ?? 0,
  ) >= 21;
}

function isVerifiedNewCustomer(
  context:
    QuoteResolutionContext,
): boolean {
  return (
    context.customer
      .verifiedCustomerStatus ===
    "Verified New"
  );
}

function createItem(
  input: PricedQuoteItem,
): PricedQuoteItem {
  return input;
}

function extraItems(
  extras: QuantityMap,
  startOrder: number,
): PricedQuoteItem[] {
  const items:
    PricedQuoteItem[] = [];

  let order = startOrder;

  for (
    const [
      extraName,
      unitPrice,
    ] of Object.entries(
      PRICES.extras,
    )
  ) {
    const quantity =
      extras[extraName] ?? 0;

    if (quantity <= 0) {
      continue;
    }

    items.push(
      createItem({
        itemLabel: extraName,

        sourceKey:
          `extra.${extraName
            .toLowerCase()
            .replace(/\s+/g, "-")}`,

        itemType: "Extra",
        itemName: extraName,
        quantity,
        unitPrice,

        lineTotal:
          roundMoney(
            unitPrice * quantity,
          ),

        discountable: false,
        provisional: false,
        customerVisible: true,
        displayOrder: order,

        metadata: {
          extraName:
            extraName as ExtraName,
        },
      }),
    );

    order += 10;
  }

  return items;
}

function standardAdditionalItems(
  input: {
    readonly bathroomCharge:
      number;

    readonly conditionCharge:
      number;

    readonly discountAmount:
      number;

    readonly travelFee:
      number | null;

    readonly sameDayCharge:
      number;

    readonly provisional:
      boolean;

    readonly startOrder:
      number;
  },
): PricedQuoteItem[] {
  const items:
    PricedQuoteItem[] = [];

  let order =
    input.startOrder;

  if (
    input.bathroomCharge > 0
  ) {
    items.push(
      createItem({
        itemLabel:
          "Additional bathrooms",

        sourceKey:
          "charge.additional-bathrooms",

        itemType:
          "Automatic Charge",

        itemName:
          "Additional bathrooms",

        quantity:
          input.bathroomCharge /
          PRICES.additionalBathroom,

        unitPrice:
          PRICES.additionalBathroom,

        lineTotal:
          input.bathroomCharge,

        discountable: true,
        provisional: false,
        customerVisible: true,
        displayOrder: order,
        metadata: null,
      }),
    );

    order += 10;
  }

  if (
    input.conditionCharge > 0
  ) {
    items.push(
      createItem({
        itemLabel:
          "Airbnb condition charge",

        sourceKey:
          "charge.airbnb-condition",

        itemType:
          "Automatic Charge",

        itemName:
          "Airbnb condition charge",

        quantity: 1,

        unitPrice:
          input.conditionCharge,

        lineTotal:
          input.conditionCharge,

        discountable: false,

        provisional:
          input.provisional,

        customerVisible: true,
        displayOrder: order,
        metadata: null,
      }),
    );

    order += 10;
  }

  if (
    input.discountAmount > 0
  ) {
    items.push(
      createItem({
        itemLabel:
          "New-customer discount",

        sourceKey:
          "discount.new-customer",

        itemType: "Discount",

        itemName:
          "New-customer discount",

        quantity: 1,

        unitPrice:
          -input.discountAmount,

        lineTotal:
          -input.discountAmount,

        discountable: false,
        provisional: false,
        customerVisible: true,
        displayOrder: order,

        metadata: {
          percentage: 15,
        },
      }),
    );

    order += 10;
  }

  if (
    input.travelFee !== null &&
    input.travelFee > 0
  ) {
    items.push(
      createItem({
        itemLabel: "Travel fee",

        sourceKey:
          "charge.travel",

        itemType:
          "Automatic Charge",

        itemName: "Travel fee",
        quantity: 1,

        unitPrice:
          input.travelFee,

        lineTotal:
          input.travelFee,

        discountable: false,
        provisional: false,
        customerVisible: true,
        displayOrder: order,
        metadata: null,
      }),
    );

    order += 10;
  }

  if (
    input.sameDayCharge > 0
  ) {
    items.push(
      createItem({
        itemLabel:
          "Same-day surcharge",

        sourceKey:
          "charge.same-day",

        itemType:
          "Automatic Charge",

        itemName:
          "Same-day surcharge",

        quantity: 1,

        unitPrice:
          input.sameDayCharge,

        lineTotal:
          input.sameDayCharge,

        discountable: false,
        provisional: false,
        customerVisible: true,
        displayOrder: order,
        metadata: null,
      }),
    );
  }

  return items;
}

function clientMismatchReasons(
  context:
    QuoteResolutionContext,
  estimatedTotal:
    number | null,
): readonly string[] {
  const clientEstimate =
    context.submission
      .clientEstimate;

  if (!clientEstimate) {
    return [];
  }

  const reasons: string[] = [];

  if (
    clientEstimate.pricingVersion !==
    PRICING_VERSION
  ) {
    reasons.push(
      "CLIENT_PRICING_VERSION_MISMATCH",
    );
  }

  if (
    estimatedTotal !== null &&
    Math.abs(
      clientEstimate.estimatedTotal -
        estimatedTotal,
    ) > 0.01
  ) {
    reasons.push(
      "CLIENT_ESTIMATE_MISMATCH",
    );
  }

  return reasons;
}

function customQuoteDecision(
  context:
    QuoteResolutionContext,
  reason: string,
): QuotePricingDecision {
  const reviewReasons =
    uniqueReasons([
      ...context.reviewReasons,
      reason,

      ...(context.submission
        .clientEstimate
        ? [
            "CLIENT_ESTIMATE_IGNORED_FOR_CUSTOM_QUOTE",
          ]
        : []),

      ...(context.submission
        .safetyWarnings
        ? [
            "SAFETY_WARNING_REPORTED",
          ]
        : []),
    ]);

  return {
    kind: "custom",
    pricingVersion:
      PRICING_VERSION,

    estimatedTotal: null,

    requiredUpfrontPercentage:
      null,

    requiredUpfrontAmount:
      null,

    remainingBalance: null,
    travelFee: null,
    travelPending: true,
    provisional: true,

    clientEstimateMismatch:
      context.submission
        .clientEstimate !==
      undefined,

    manualReviewRequired: true,
    manualReviewReasons:
      reviewReasons,

    items: [],

    pricingSnapshot: {
      kind: "custom",
      pricingVersion:
        PRICING_VERSION,

      category:
        context.submission
          .service.category,

      serviceType:
        context.submission
          .service.serviceType,

      manualReviewReasons:
        reviewReasons,
    },
  };
}

export function createQuotePricingService(
  options:
    QuotePricingOptions = {},
): QuotePricingService {
  const resolveDistanceMiles =
    options.resolveDistanceMiles ??
    (async () => null);

  const resolveTravel =
    options.resolveTravel;

  const now =
    options.now ??
    (() => new Date());

  return {
    async price(
      context,
    ): Promise<QuotePricingDecision> {
      const service =
        context.submission.service;

      if (
        service.category ===
          "Commercial Cleaning"
      ) {
        return customQuoteDecision(
          context,
          "COMMERCIAL_CUSTOM_QUOTE",
        );
      }

      if (
        service.category ===
          "Property Support"
      ) {
        return customQuoteDecision(
          context,
          "PROPERTY_SUPPORT_CUSTOM_QUOTE",
        );
      }

      if (
        service.category ===
          "Residential Cleaning" &&
        service.serviceType ===
          "End of Tenancy"
      ) {
        return customQuoteDecision(
          context,
          "END_OF_TENANCY_CUSTOM_QUOTE",
        );
      }

      const currentTime = now();

      const calculatedLeadTime =
        leadTimeHours(
          context,
          currentTime,
        );

      const sameDayNoticeHours =
        context.submission
          .appointment.sameDay
          ? calculatedLeadTime
          : null;

      const travelCalculation =
        resolveTravel === undefined
          ? null
          : await resolveTravel(
              context.property
                .normalizedPostcode,
            );

      const distanceMiles =
        travelCalculation === null
          ? await resolveDistanceMiles(
              context.property
                .normalizedPostcode,
            )
          : travelCalculation
              .distanceMiles;

      const baseReasons = [
        ...context.reviewReasons,

        ...(travelCalculation
          ?.manualReviewReason
          ? [
              travelCalculation
                .manualReviewReason,
            ]
          : []),

        ...(context.submission
          .safetyWarnings
          ? [
              "SAFETY_WARNING_REPORTED",
            ]
          : []),
      ];

      if (
        service.category ===
        "Airbnb Turnover"
      ) {
        const estimate =
          calculateWholePropertyEstimate({
            service:
              "Airbnb Turnover",

            bedrooms:
              context.submission
                .property.bedrooms,

            bathrooms:
              context.submission
                .property.bathrooms,

            extras:
              service.extras,

            isNewCustomer:
              isVerifiedNewCustomer(
                context,
              ),

            airbnbCondition:
              service.airbnbCondition,

            distanceMiles,

            sameDayNoticeHours,

            requestAfter21:
              requestAfter21(
                currentTime,
              ),

            leadTimeHours:
              calculatedLeadTime,
          });

        const mismatchReasons =
          clientMismatchReasons(
            context,
            estimate.estimatedTotal,
          );

        const reviewReasons =
          uniqueReasons([
            ...baseReasons,
            ...estimate
              .manualReviewReasons,
            ...mismatchReasons,
          ]);

        const items: PricedQuoteItem[] = [
          createItem({
            itemLabel:
              "Airbnb Turnover",

            sourceKey:
              `service.airbnb.${context.submission.property.bedrooms}-bed`,

            itemType:
              "Base Service",

            itemName:
              "Airbnb Turnover",

            quantity: 1,

            unitPrice:
              estimate.basePrice,

            lineTotal:
              estimate.basePrice,

            discountable: true,
            provisional: false,
            customerVisible: true,
            displayOrder: 10,

            metadata: {
              bedrooms:
                context.submission
                  .property.bedrooms,
            },
          }),

          ...extraItems(
            service.extras,
            40,
          ),

          ...standardAdditionalItems({
            bathroomCharge:
              estimate
                .bathroomCharge,

            conditionCharge:
              estimate
                .conditionCharge,

            discountAmount:
              estimate
                .discountAmount,

            travelFee:
              estimate.travelFee,

            sameDayCharge:
              estimate
                .sameDayCharge,

            provisional:
              estimate.provisional,

            startOrder: 20,
          }),
        ].sort(
          (left, right) =>
            left.displayOrder -
            right.displayOrder,
        );

        return {
          kind: "instant",

          pricingVersion:
            estimate.pricingVersion,

          estimatedTotal:
            estimate.estimatedTotal,

          requiredUpfrontPercentage:
            estimate
              .requiredUpfrontPercentage,

          requiredUpfrontAmount:
            estimate
              .requiredUpfrontAmount,

          remainingBalance:
            estimate
              .remainingBalance,

          travelFee:
            estimate.travelFee,

          travelPending:
            estimate.travelPending,

          provisional:
            estimate.provisional ||
            mismatchReasons.length > 0,

          clientEstimateMismatch:
            mismatchReasons.length > 0,

          manualReviewRequired:
            reviewReasons.length > 0,

          manualReviewReasons:
            reviewReasons,

          items,

          pricingSnapshot: {
            ...estimate,

            kind: "instant",

            category:
              service.category,

            serviceType:
              service.serviceType,

            distanceMiles,

            distanceOriginUsed:
              travelCalculation
                ?.originPostcode ??
              null,

            travelCalculation,

            serverCalculatedAt:
              currentTime.toISOString(),

            clientEstimate:
              context.submission
                .clientEstimate ??
              null,

            clientEstimateMismatch:
              mismatchReasons.length >
              0,
          },
        };
      }

      const cleaningLevel =
        toCleaningLevel(
          service.serviceType,
        );

      if (cleaningLevel === null) {
        return customQuoteDecision(
          context,
          "UNSUPPORTED_RESIDENTIAL_SERVICE",
        );
      }

      if (
        service.cleaningScope ===
        "Selected Rooms"
      ) {
        const estimate =
          calculateSelectedRoomsEstimate({
            cleaningLevel,

            rooms:
              service.rooms,

            extras:
              service.extras,

            distanceMiles,

            sameDayNoticeHours,

            requestAfter21:
              requestAfter21(
                currentTime,
              ),

            leadTimeHours:
              calculatedLeadTime,
          });

        const mismatchReasons =
          clientMismatchReasons(
            context,
            estimate.estimatedTotal,
          );

        const reviewReasons =
          uniqueReasons([
            ...baseReasons,
            ...estimate
              .manualReviewReasons,
            ...mismatchReasons,
          ]);

        const roomTable =
          cleaningLevel ===
          "Deep Clean"
            ? PRICES.selectedRooms
                .deep
            : PRICES.selectedRooms
                .standard;

        const roomItems:
          PricedQuoteItem[] = [];

        let order = 10;

        for (
          const [
            roomName,
            unitPrice,
          ] of Object.entries(
            roomTable,
          )
        ) {
          const roomQuantity =
            service.rooms[
              roomName as
                SelectedRoomName
            ];

          if (
            !roomQuantity ||
            roomQuantity <= 0
          ) {
            continue;
          }

          roomItems.push(
            createItem({
              itemLabel: roomName,

              sourceKey:
                `room.${roomName
                  .toLowerCase()
                  .replace(/\s+/g, "-")}`,

              itemType:
                "Selected Room",

              itemName: roomName,

              quantity:
                roomQuantity,

              unitPrice,

              lineTotal:
                roundMoney(
                  unitPrice *
                    roomQuantity,
                ),

              discountable: false,
              provisional: false,
              customerVisible: true,
              displayOrder: order,
              metadata: null,
            }),
          );

          order += 10;
        }

        if (
          estimate
            .minimumAdjustment > 0
        ) {
          roomItems.push(
            createItem({
              itemLabel:
                "Minimum booking adjustment",

              sourceKey:
                "adjustment.minimum-booking",

              itemType:
                "Automatic Charge",

              itemName:
                "Minimum booking adjustment",

              quantity: 1,

              unitPrice:
                estimate
                  .minimumAdjustment,

              lineTotal:
                estimate
                  .minimumAdjustment,

              discountable: false,
              provisional: false,
              customerVisible: true,
              displayOrder: order,
              metadata: null,
            }),
          );

          order += 10;
        }

        const items = [
          ...roomItems,

          ...extraItems(
            service.extras,
            order,
          ),

          ...standardAdditionalItems({
            bathroomCharge: 0,
            conditionCharge: 0,
            discountAmount: 0,

            travelFee:
              estimate.travelFee,

            sameDayCharge:
              estimate
                .sameDayCharge,

            provisional:
              estimate.provisional,

            startOrder:
              order + 100,
          }),
        ].sort(
          (left, right) =>
            left.displayOrder -
            right.displayOrder,
        );

        return {
          kind: "instant",

          pricingVersion:
            estimate.pricingVersion,

          estimatedTotal:
            estimate.estimatedTotal,

          requiredUpfrontPercentage:
            estimate
              .requiredUpfrontPercentage,

          requiredUpfrontAmount:
            estimate
              .requiredUpfrontAmount,

          remainingBalance:
            estimate
              .remainingBalance,

          travelFee:
            estimate.travelFee,

          travelPending:
            estimate.travelPending,

          provisional:
            estimate.provisional ||
            mismatchReasons.length > 0,

          clientEstimateMismatch:
            mismatchReasons.length > 0,

          manualReviewRequired:
            reviewReasons.length > 0,

          manualReviewReasons:
            reviewReasons,

          items,

          pricingSnapshot: {
            ...estimate,

            kind: "instant",

            category:
              service.category,

            serviceType:
              service.serviceType,

            cleaningScope:
              service.cleaningScope,

            distanceMiles,

            distanceOriginUsed:
              travelCalculation
                ?.originPostcode ??
              null,

            travelCalculation,

            serverCalculatedAt:
              currentTime.toISOString(),

            clientEstimate:
              context.submission
                .clientEstimate ??
              null,

            clientEstimateMismatch:
              mismatchReasons.length >
              0,
          },
        };
      }

      const estimate =
        calculateWholePropertyEstimate({
          service:
            cleaningLevel,

          bedrooms:
            context.submission
              .property.bedrooms,

          bathrooms:
            context.submission
              .property.bathrooms,

          extras:
            service.extras,

          isNewCustomer:
            isVerifiedNewCustomer(
              context,
            ),

          airbnbCondition: null,
          distanceMiles,
          sameDayNoticeHours,

          requestAfter21:
            requestAfter21(
              currentTime,
            ),

          leadTimeHours:
            calculatedLeadTime,
        });

      const mismatchReasons =
        clientMismatchReasons(
          context,
          estimate.estimatedTotal,
        );

      const reviewReasons =
        uniqueReasons([
          ...baseReasons,
          ...estimate
            .manualReviewReasons,
          ...mismatchReasons,
        ]);

      const items = [
        createItem({
          itemLabel:
            service.serviceType,

          sourceKey:
            `service.${service.serviceType
              .toLowerCase()
              .replace(/\s+/g, "-")}.${context.submission.property.bedrooms}-bed`,

          itemType:
            "Base Service",

          itemName:
            service.serviceType,

          quantity: 1,

          unitPrice:
            estimate.basePrice,

          lineTotal:
            estimate.basePrice,

          discountable: true,
          provisional: false,
          customerVisible: true,
          displayOrder: 10,

          metadata: {
            bedrooms:
              context.submission
                .property.bedrooms,
          },
        }),

        ...extraItems(
          service.extras,
          40,
        ),

        ...standardAdditionalItems({
          bathroomCharge:
            estimate
              .bathroomCharge,

          conditionCharge: 0,

          discountAmount:
            estimate
              .discountAmount,

          travelFee:
            estimate.travelFee,

          sameDayCharge:
            estimate.sameDayCharge,

          provisional:
            estimate.provisional,

          startOrder: 20,
        }),
      ].sort(
        (left, right) =>
          left.displayOrder -
          right.displayOrder,
      );

      return {
        kind: "instant",

        pricingVersion:
          estimate.pricingVersion,

        estimatedTotal:
          estimate.estimatedTotal,

        requiredUpfrontPercentage:
          estimate
            .requiredUpfrontPercentage,

        requiredUpfrontAmount:
          estimate
            .requiredUpfrontAmount,

        remainingBalance:
          estimate
            .remainingBalance,

        travelFee:
          estimate.travelFee,

        travelPending:
          estimate.travelPending,

        provisional:
          estimate.provisional ||
          mismatchReasons.length > 0,

        clientEstimateMismatch:
          mismatchReasons.length > 0,

        manualReviewRequired:
          reviewReasons.length > 0,

        manualReviewReasons:
          reviewReasons,

        items,

        pricingSnapshot: {
          ...estimate,

          kind: "instant",

          category:
            service.category,

          serviceType:
            service.serviceType,

          cleaningScope:
            service.cleaningScope,

          distanceMiles,

          distanceOriginUsed:
            travelCalculation
              ?.originPostcode ??
            null,

          travelCalculation,

          serverCalculatedAt:
            currentTime.toISOString(),

          clientEstimate:
            context.submission
              .clientEstimate ??
            null,

          clientEstimateMismatch:
            mismatchReasons.length >
            0,
        },
      };
    },
  };
}
