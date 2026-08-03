export const PRICING_VERSION =
  "CUC Phase 0 v1.4";

export const PRICES = {
  wholeProperty: {
    standard: {
      studio: 80,
      1: 80,
      2: 110,
      3: 150,
      additionalBedroom: 20,
    },

    deep: {
      studio: 180,
      1: 180,
      2: 235,
      3: 300,
      additionalBedroom: 30,
    },
  },

  additionalBathroom: 20,

  selectedRooms: {
    standard: {
      Bathroom: 40,
      Bedroom: 30,
      Kitchen: 40,
      "Living Room": 40,
      Hallway: 20,
      Stairs: 25,
    },

    deep: {
      Bathroom: 55,
      Bedroom: 50,
      Kitchen: 70,
      "Living Room": 70,
      Hallway: 30,
      Stairs: 40,
    },
  },

  extras: {
    Oven: 50,
    Fridge: 25,
    "Interior Windows": 10,
    "Grout Cleaning": 40,
    Laundry: 10,
    "Standard Consumables Package": 20,
  },

  airbnbCondition: {
    Good: 0,
    Moderate: 10,
    Dirty: 20,
  },

  travel: {
    upTo10Miles: 0,
    over10To20Miles: 10,
    over20To30Miles: 20,
  },

  newCustomerDiscountRate: 0.15,
} as const;

export type ExtraName =
  keyof typeof PRICES.extras;

export type SelectedRoomName =
  keyof typeof PRICES.selectedRooms.standard;

export type InstantService =
  | "Standard Clean"
  | "Deep Clean"
  | "Airbnb Turnover";

export type CleaningLevel =
  | "Standard Clean"
  | "Deep Clean";

export type AirbnbCondition =
  keyof typeof PRICES.airbnbCondition;

export type QuantityMap = Readonly<
  Record<string, number>
>;

export interface TravelDecision {
  readonly fee: number | null;
  readonly pending: boolean;
  readonly manualReview: boolean;
  readonly reason: string | null;
}

export interface PaymentDecision {
  readonly percentage: number;
  readonly amount: number;
  readonly remainingBalance: number;
}

export interface WholePropertyEstimate {
  readonly pricingVersion: string;
  readonly basePrice: number;
  readonly bathroomCharge: number;
  readonly conditionCharge: number;
  readonly extrasCharge: number;
  readonly discountBase: number;
  readonly discountAmount: number;
  readonly travelFee: number | null;
  readonly travelPending: boolean;
  readonly sameDayCharge: number;
  readonly knownChargesTotal: number;
  readonly estimatedTotal: number;
  readonly provisional: boolean;
  readonly requiredUpfrontPercentage: number;
  readonly requiredUpfrontAmount: number;
  readonly remainingBalance: number;
  readonly manualReviewReasons: readonly string[];
}

export interface SelectedRoomsEstimate {
  readonly pricingVersion: string;
  readonly roomSubtotal: number;
  readonly minimumAdjustment: number;
  readonly selectedRoomsSubtotal: number;
  readonly bathroomCharge: 0;
  readonly conditionCharge: 0;
  readonly extrasCharge: number;
  readonly discountBase: 0;
  readonly discountAmount: 0;
  readonly travelFee: number | null;
  readonly travelPending: boolean;
  readonly sameDayCharge: number;
  readonly knownChargesTotal: number;
  readonly estimatedTotal: number;
  readonly provisional: boolean;
  readonly requiredUpfrontPercentage: number;
  readonly requiredUpfrontAmount: number;
  readonly remainingBalance: number;
  readonly manualReviewReasons: readonly string[];
}

export function roundMoney(
  value: number,
): number {
  return Math.round(
    (value + Number.EPSILON) * 100,
  ) / 100;
}

function requireWholeNumber(
  value: number,
  label: string,
  minimum = 0,
): number {
  if (
    !Number.isInteger(value) ||
    value < minimum
  ) {
    throw new RangeError(
      `${label} must be a whole number of at least ${minimum}.`,
    );
  }

  return value;
}

function quantity(
  quantities: QuantityMap,
  name: string,
): number {
  const value = quantities[name] ?? 0;

  return requireWholeNumber(
    value,
    `${name} quantity`,
    0,
  );
}

export function travelFeeForDistance(
  distanceMiles: number | null,
): TravelDecision {
  if (distanceMiles === null) {
    return {
      fee: null,
      pending: true,
      manualReview: true,
      reason: "TRAVEL_DISTANCE_PENDING",
    };
  }

  if (
    !Number.isFinite(distanceMiles) ||
    distanceMiles < 0
  ) {
    throw new RangeError(
      "Distance must be a non-negative number.",
    );
  }

  if (distanceMiles <= 10) {
    return {
      fee: PRICES.travel.upTo10Miles,
      pending: false,
      manualReview: false,
      reason: null,
    };
  }

  if (distanceMiles <= 20) {
    return {
      fee:
        PRICES.travel.over10To20Miles,

      pending: false,
      manualReview: false,
      reason: null,
    };
  }

  if (distanceMiles <= 30) {
    return {
      fee:
        PRICES.travel.over20To30Miles,

      pending: false,
      manualReview: false,
      reason: null,
    };
  }

  return {
    fee: null,
    pending: true,
    manualReview: true,
    reason: "OUTSIDE_AUTOMATIC_SERVICE_AREA",
  };
}

export function sameDayFeeForNotice(
  noticeHours: number | null,
  requestAfter21 = false,
): number {
  if (noticeHours === null) {
    return 0;
  }

  if (
    !Number.isFinite(noticeHours) ||
    noticeHours < 0
  ) {
    throw new RangeError(
      "Same-day notice must be a non-negative number of hours.",
    );
  }

  if (
    requestAfter21 ||
    noticeHours < 3.5
  ) {
    return 50;
  }

  if (noticeHours <= 4) {
    return 45;
  }

  if (noticeHours <= 5) {
    return 40;
  }

  if (noticeHours <= 6) {
    return 35;
  }

  if (noticeHours <= 7) {
    return 30;
  }

  return 25;
}

export function wholePropertyBasePrice(
  service:
    | "Standard Clean"
    | "Deep Clean",
  bedrooms: number,
): number {
  const bedroomCount =
    requireWholeNumber(
      bedrooms,
      "Bedrooms",
      0,
    );

  const table =
    service === "Deep Clean"
      ? PRICES.wholeProperty.deep
      : PRICES.wholeProperty.standard;

  if (bedroomCount === 0) {
    return table.studio;
  }

  if (bedroomCount === 1) {
    return table[1];
  }

  if (bedroomCount === 2) {
    return table[2];
  }

  if (bedroomCount === 3) {
    return table[3];
  }

  return roundMoney(
    table[3] +
      (
        bedroomCount - 3
      ) *
        table.additionalBedroom,
  );
}

export function extrasTotal(
  quantities: QuantityMap,
): number {
  let total = 0;

  for (
    const [
      name,
      unitPrice,
    ] of Object.entries(
      PRICES.extras,
    )
  ) {
    const itemQuantity =
      quantity(
        quantities,
        name,
      );

    if (
      name ===
        "Standard Consumables Package" &&
      itemQuantity > 1
    ) {
      throw new RangeError(
        "Only one Standard Consumables Package can be selected.",
      );
    }

    total +=
      unitPrice * itemQuantity;
  }

  return roundMoney(total);
}

export function calculateUpfrontPayment(
  estimatedTotal: number,
  service: InstantService,
  leadTimeHours: number | null,
): PaymentDecision {
  if (
    leadTimeHours !== null &&
    (
      !Number.isFinite(
        leadTimeHours,
      ) ||
      leadTimeHours < 0
    )
  ) {
    throw new RangeError(
      "Lead time must be a non-negative number of hours.",
    );
  }

  let percentage = 50;

  if (
    leadTimeHours !== null &&
    leadTimeHours < 24
  ) {
    percentage = 100;
  }

  const amount = roundMoney(
    estimatedTotal *
      (percentage / 100),
  );

  return {
    percentage,
    amount,

    remainingBalance:
      roundMoney(
        estimatedTotal - amount,
      ),
  };
}

export function calculateWholePropertyEstimate(
  input: {
    readonly service: InstantService;
    readonly bedrooms: number;
    readonly bathrooms: number;
    readonly extras: QuantityMap;
    readonly isNewCustomer: boolean;

    readonly airbnbCondition:
      AirbnbCondition | null;

    readonly distanceMiles:
      number | null;

    readonly sameDayNoticeHours:
      number | null;

    readonly requestAfter21:
      boolean;

    readonly leadTimeHours:
      number | null;
  },
): WholePropertyEstimate {
  const isAirbnb =
    input.service ===
    "Airbnb Turnover";

  const bathroomCount =
    requireWholeNumber(
      input.bathrooms,
      "Bathrooms",
      1,
    );

  const basePrice =
    wholePropertyBasePrice(
      isAirbnb
        ? "Standard Clean"
        : input.service,

      input.bedrooms,
    );

  const bathroomCharge =
    roundMoney(
      Math.max(
        0,
        bathroomCount - 1,
      ) *
        PRICES.additionalBathroom,
    );

  const conditionCharge =
    isAirbnb &&
    input.airbnbCondition !== null
      ? PRICES.airbnbCondition[
          input.airbnbCondition
        ]
      : 0;

  const extrasCharge =
    extrasTotal(input.extras);

  const travel =
    travelFeeForDistance(
      input.distanceMiles,
    );

  const sameDayCharge =
    sameDayFeeForNotice(
      input.sameDayNoticeHours,
      input.requestAfter21,
    );

  const discountBase =
    roundMoney(
      basePrice +
        bathroomCharge,
    );

  const discountAmount =
    input.isNewCustomer
      ? roundMoney(
          discountBase *
            PRICES
              .newCustomerDiscountRate,
        )
      : 0;

  const estimatedTotal =
    roundMoney(
      discountBase -
        discountAmount +
        extrasCharge +
        conditionCharge +
        (travel.fee ?? 0) +
        sameDayCharge,
    );

  const payment =
    calculateUpfrontPayment(
      estimatedTotal,
      input.service,
      input.leadTimeHours,
    );

  const reviewReasons: string[] = [];

  if (travel.reason !== null) {
    reviewReasons.push(
      travel.reason,
    );
  }

  if (
    isAirbnb &&
    input.airbnbCondition ===
      "Dirty"
  ) {
    reviewReasons.push(
      "DIRTY_AIRBNB",
    );
  }

  if (
    input.sameDayNoticeHours !==
    null
  ) {
    reviewReasons.push(
      "SAME_DAY_BOOKING",
    );

    if (
      input.sameDayNoticeHours <
      3
    ) {
      reviewReasons.push(
        "BELOW_MINIMUM_NOTICE",
      );
    }
  }

  if (input.bedrooms >= 4) {
    reviewReasons.push(
      "FOUR_PLUS_BEDROOMS",
    );
  }

  return {
    pricingVersion:
      PRICING_VERSION,

    basePrice,
    bathroomCharge,
    conditionCharge,
    extrasCharge,
    discountBase,
    discountAmount,

    travelFee: travel.fee,

    travelPending:
      travel.pending,

    sameDayCharge,

    knownChargesTotal:
      estimatedTotal,

    estimatedTotal,

    provisional:
      travel.pending ||
      (
        isAirbnb &&
        input.airbnbCondition ===
          "Dirty"
      ),

    requiredUpfrontPercentage:
      payment.percentage,

    requiredUpfrontAmount:
      payment.amount,

    remainingBalance:
      payment.remainingBalance,

    manualReviewReasons:
      reviewReasons,
  };
}

export function calculateSelectedRoomsEstimate(
  input: {
    readonly cleaningLevel:
      CleaningLevel;

    readonly rooms:
      QuantityMap;

    readonly extras:
      QuantityMap;

    readonly distanceMiles:
      number | null;

    readonly sameDayNoticeHours:
      number | null;

    readonly requestAfter21:
      boolean;

    readonly leadTimeHours:
      number | null;
  },
): SelectedRoomsEstimate {
  const table =
    input.cleaningLevel ===
    "Deep Clean"
      ? PRICES.selectedRooms.deep
      : PRICES.selectedRooms
          .standard;

  let roomSubtotal = 0;

  for (
    const [
      roomName,
      unitPrice,
    ] of Object.entries(table)
  ) {
    roomSubtotal +=
      unitPrice *
      quantity(
        input.rooms,
        roomName,
      );
  }

  roomSubtotal =
    roundMoney(roomSubtotal);

  if (roomSubtotal <= 0) {
    throw new RangeError(
      "Select at least one room.",
    );
  }

  const hallwaySelected =
    quantity(
      input.rooms,
      "Hallway",
    ) > 0;

  const stairsSelected =
    quantity(
      input.rooms,
      "Stairs",
    ) > 0;

  const anotherRoomSelected =
    [
      "Bathroom",
      "Bedroom",
      "Kitchen",
      "Living Room",
    ].some(
      (roomName) =>
        quantity(
          input.rooms,
          roomName,
        ) > 0,
    );

  const hallwayOrStairsOnly =
    (
      hallwaySelected ||
      stairsSelected
    ) &&
    !anotherRoomSelected;

  const minimumAdjustment =
    hallwayOrStairsOnly
      ? roundMoney(
          Math.max(
            0,
            40 - roomSubtotal,
          ),
        )
      : 0;

  const selectedRoomsSubtotal =
    roundMoney(
      roomSubtotal +
        minimumAdjustment,
    );

  const extrasCharge =
    extrasTotal(input.extras);

  const travel =
    travelFeeForDistance(
      input.distanceMiles,
    );

  const sameDayCharge =
    sameDayFeeForNotice(
      input.sameDayNoticeHours,
      input.requestAfter21,
    );

  const estimatedTotal =
    roundMoney(
      selectedRoomsSubtotal +
        extrasCharge +
        (travel.fee ?? 0) +
        sameDayCharge,
    );

  const payment =
    calculateUpfrontPayment(
      estimatedTotal,
      input.cleaningLevel,
      input.leadTimeHours,
    );

  const reviewReasons: string[] = [];

  if (travel.reason !== null) {
    reviewReasons.push(
      travel.reason,
    );
  }

  if (
    input.sameDayNoticeHours !==
    null
  ) {
    reviewReasons.push(
      "SAME_DAY_BOOKING",
    );

    if (
      input.sameDayNoticeHours <
      3
    ) {
      reviewReasons.push(
        "BELOW_MINIMUM_NOTICE",
      );
    }
  }

  return {
    pricingVersion:
      PRICING_VERSION,

    roomSubtotal,
    minimumAdjustment,
    selectedRoomsSubtotal,
    bathroomCharge: 0,
    conditionCharge: 0,
    extrasCharge,
    discountBase: 0,
    discountAmount: 0,

    travelFee: travel.fee,

    travelPending:
      travel.pending,

    sameDayCharge,

    knownChargesTotal:
      estimatedTotal,

    estimatedTotal,

    provisional:
      travel.pending,

    requiredUpfrontPercentage:
      payment.percentage,

    requiredUpfrontAmount:
      payment.amount,

    remainingBalance:
      payment.remainingBalance,

    manualReviewReasons:
      reviewReasons,
  };
}