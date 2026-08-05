/**
 * Clean Up Central Phase 0 v1.4 pricing engine.
 *
 * This file contains no React or Wix imports. The same functions can therefore
 * be reused by the quote page and the protected Wix backend.
 *
 * Locked decisions applied:
 * - A £40 minimum applies only to Hallway and/or Stairs-only bookings.
 * - Selected Rooms never receives the new-customer discount.
 * - The 15% discount covers the base cleaning price and additional bathrooms.
 * - Extras, travel, Airbnb condition and same-day charges are not discounted.
 * - Travel uses the shorter driving distance from BR1 5HP or RM10 8BE.
 */

export const PRICING_VERSION = "CUC Phase 0 v1.4";

export const PRICES = Object.freeze({
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
});

const money = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function wholeNumber(value, label, minimum = 0) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < minimum) {
    throw new RangeError(
      `${label} must be a whole number of at least ${minimum}.`,
    );
  }

  return number;
}

function nonNegativeQuantity(value, label) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  return wholeNumber(value, `${label} quantity`, 0);
}

export function travelFeeForDistance(distanceMiles) {
  if (
    distanceMiles === null ||
    distanceMiles === undefined ||
    distanceMiles === ""
  ) {
    return {
      fee: null,
      pending: true,
      manualReview: true,
      reason: "Unknown service-area distance",
    };
  }

  const distance = Number(distanceMiles);

  if (!Number.isFinite(distance) || distance < 0) {
    throw new RangeError("Distance must be a non-negative number.");
  }

  if (distance <= 10) {
    return {
      fee: PRICES.travel.upTo10Miles,
      pending: false,
      manualReview: false,
      reason: null,
    };
  }

  if (distance <= 20) {
    return {
      fee: PRICES.travel.over10To20Miles,
      pending: false,
      manualReview: false,
      reason: null,
    };
  }

  if (distance <= 30) {
    return {
      fee: PRICES.travel.over20To30Miles,
      pending: false,
      manualReview: false,
      reason: null,
    };
  }

  return {
    fee: null,
    pending: true,
    manualReview: true,
    reason: "More than 30 miles from both origin postcodes",
  };
}

export function sameDayFeeForNotice(
  noticeHours,
  requestAfter21 = false,
) {
  if (
    noticeHours === null ||
    noticeHours === undefined ||
    noticeHours === ""
  ) {
    return 0;
  }

  const hours = Number(noticeHours);

  if (!Number.isFinite(hours) || hours < 0) {
    throw new RangeError(
      "Same-day notice must be a non-negative number of hours.",
    );
  }

  if (requestAfter21 || hours < 3.5) return 50;
  if (hours <= 4) return 45;
  if (hours <= 5) return 40;
  if (hours <= 6) return 35;
  if (hours <= 7) return 30;
  return 25;
}

export function wholePropertyBasePrice(service, bedrooms) {
  if (service !== "Standard Clean" && service !== "Deep Clean") {
    throw new RangeError(
      `Unsupported whole-property service: ${service}`,
    );
  }

  const bedroomCount = wholeNumber(bedrooms, "Bedrooms", 0);
  const table =
    service === "Deep Clean"
      ? PRICES.wholeProperty.deep
      : PRICES.wholeProperty.standard;

  if (bedroomCount === 0) return table.studio;
  if (bedroomCount <= 3) return table[bedroomCount];

  return money(
    table[3] +
      (bedroomCount - 3) * table.additionalBedroom,
  );
}

export function extrasTotal(quantities = {}) {
  return money(
    Object.entries(quantities).reduce(
      (total, [name, selectedQuantity]) => {
        const unitPrice = PRICES.extras[name];

        if (unitPrice === undefined) {
          return total;
        }

        const itemQuantity = nonNegativeQuantity(
          selectedQuantity,
          name,
        );

        if (
          name === "Standard Consumables Package" &&
          itemQuantity > 1
        ) {
          throw new RangeError(
            "Only one Standard Consumables Package can be selected.",
          );
        }

        return total + unitPrice * itemQuantity;
      },
      0,
    ),
  );
}

function resolvedTravelFee(travelFee) {
  if (travelFee === null || travelFee === undefined) {
    return {
      fee: null,
      pending: true,
    };
  }

  const fee = Number(travelFee);

  if (!Number.isFinite(fee) || fee < 0) {
    throw new RangeError(
      "Travel fee must be a non-negative number.",
    );
  }

  return {
    fee: money(fee),
    pending: false,
  };
}

function upfrontPayment(
  estimatedTotal,
  service,
  leadTimeHours,
) {
  const hours =
    leadTimeHours === null || leadTimeHours === undefined
      ? null
      : Number(leadTimeHours);

  if (hours !== null && (!Number.isFinite(hours) || hours < 0)) {
    throw new RangeError(
      "Lead time must be a non-negative number of hours.",
    );
  }

  let percentage = 50;

  if (hours !== null && hours < 24) {
    percentage = 100;
  }

  const amount = money(estimatedTotal * (percentage / 100));

  return {
    percentage,
    amount,
    remainingBalance: money(estimatedTotal - amount),
  };
}

export function calculateWholePropertyEstimate({
  service,
  bedrooms,
  bathrooms,
  extras = {},
  isNewCustomer = false,
  airbnbCondition = null,
  travelFee =
    /** @type {number | null} */ (
      null
    ),
  sameDayNoticeHours = null,
  requestAfter21 = false,
  leadTimeHours = null,
}) {
  const isAirbnb = service === "Airbnb Turnover";

  if (
    !isAirbnb &&
    service !== "Standard Clean" &&
    service !== "Deep Clean"
  ) {
    throw new RangeError(
      `Unsupported instant-quote service: ${service}`,
    );
  }

  const bathroomCount = wholeNumber(
    bathrooms,
    "Bathrooms",
    1,
  );
  const basePrice = wholePropertyBasePrice(
    isAirbnb ? "Standard Clean" : service,
    bedrooms,
  );
  const bathroomCharge = money(
    Math.max(0, bathroomCount - 1) *
      PRICES.additionalBathroom,
  );
  const conditionCharge = isAirbnb
    ? PRICES.airbnbCondition[airbnbCondition] ?? 0
    : 0;
  const extrasCharge = extrasTotal(extras);
  const travel = resolvedTravelFee(travelFee);
  const knownTravelFee = travel.fee ?? 0;
  const sameDayCharge = sameDayFeeForNotice(
    sameDayNoticeHours,
    requestAfter21,
  );

   /*
   * The new-customer discount applies only to the base cleaning
   * price and automatic additional-bathroom charges.
   *
   * Extras, travel, Airbnb condition charges and same-day charges
   * are added without a discount.
   */
  const discountBase = money(
    basePrice + bathroomCharge,
  );

  const discountAmount = isNewCustomer
    ? money(
        discountBase * PRICES.newCustomerDiscountRate,
      )
    : 0;

  const knownChargesTotal = money(
    discountBase -
      discountAmount +
      extrasCharge +
      knownTravelFee +
      conditionCharge +
      sameDayCharge,
  );
  const estimatedTotal = knownChargesTotal;
  const payment = upfrontPayment(
    estimatedTotal,
    isAirbnb ? "Airbnb Turnover" : service,
    leadTimeHours ?? sameDayNoticeHours,
  );

  return {
    pricingVersion: PRICING_VERSION,
    basePrice,
    bathroomCharge,
    conditionCharge,
    extrasCharge,
    discountBase,
    discountAmount,
    travelFee: travel.fee,
    travelPending: travel.pending,
    sameDayCharge,
    knownChargesTotal,
    estimatedTotal,
    provisional:
      isAirbnb && airbnbCondition === "Dirty",
    requiredUpfrontPercentage: payment.percentage,
    requiredUpfrontAmount: payment.amount,
    remainingBalance: payment.remainingBalance,
    manualReviewReasons: [
      ...(travel.pending
        ? ["Travel fee pending review"]
        : []),
      ...(isAirbnb && airbnbCondition === "Dirty"
        ? ["Dirty Airbnb condition"]
        : []),
      ...(sameDayNoticeHours !== null &&
      sameDayNoticeHours !== undefined
        ? ["Same-day booking"]
        : []),
      ...(Number(bedrooms) >= 4
        ? ["4+ bedroom property"]
        : []),
      ...(Number(sameDayNoticeHours) < 3 &&
      sameDayNoticeHours !== null &&
      sameDayNoticeHours !== undefined
        ? ["Below minimum notice"]
        : []),
    ],
  };
}

function selectedRoomUnitPrice(table, roomName) {
  return table[roomName] ?? 0;
}

export function calculateSelectedRoomsEstimate({
  cleaningLevel,
  rooms = {},
  extras = {},
  travelFee =
    /** @type {number | null} */ (
      null
    ),
  sameDayNoticeHours = null,
  requestAfter21 = false,
  leadTimeHours = null,
}) {
  if (
    cleaningLevel !== "Standard Clean" &&
    cleaningLevel !== "Deep Clean"
  ) {
    throw new RangeError(
      `Unsupported Selected Rooms level: ${cleaningLevel}`,
    );
  }

  const table =
    cleaningLevel === "Deep Clean"
      ? PRICES.selectedRooms.deep
      : PRICES.selectedRooms.standard;
  const roomSubtotal = money(
    Object.entries(rooms).reduce(
      (total, [room, selectedQuantity]) => {
        const itemQuantity = nonNegativeQuantity(
          selectedQuantity,
          room,
        );
        const unitPrice = selectedRoomUnitPrice(
          table,
          room,
        );

        return total + unitPrice * itemQuantity;
      },
      0,
    ),
  );

    if (roomSubtotal <= 0) {
    throw new RangeError("Select at least one room.");
  }

  const hallwayOrStairsSelected =
    nonNegativeQuantity(rooms.Hallway, "Hallway") > 0 ||
    nonNegativeQuantity(rooms.Stairs, "Stairs") > 0;

  const anotherRoomTypeSelected = Object.entries(rooms).some(
    ([room, selectedQuantity]) =>
      room !== "Hallway" &&
      room !== "Stairs" &&
      nonNegativeQuantity(selectedQuantity, room) > 0,
  );

  const hallwayOrStairsOnly =
    hallwayOrStairsSelected && !anotherRoomTypeSelected;

  const minimumAdjustment = hallwayOrStairsOnly
    ? money(Math.max(0, 40 - roomSubtotal))
    : 0;

  const extrasCharge = extrasTotal(extras);
  const travel = resolvedTravelFee(travelFee);
  const sameDayCharge = sameDayFeeForNotice(
    sameDayNoticeHours,
    requestAfter21,
  );

   /*
   * A £40 minimum applies only when Hallway and/or Stairs are
   * selected without any other room type.
   *
   * Selected Rooms has no separate bathroom fee and does not receive
   * the new-customer discount.
   */
  const selectedRoomsSubtotal = money(
    roomSubtotal + minimumAdjustment,
  );
  const knownChargesTotal = money(
    selectedRoomsSubtotal +
      extrasCharge +
      (travel.fee ?? 0) +
      sameDayCharge,
  );
  const estimatedTotal = knownChargesTotal;
  const payment = upfrontPayment(
    estimatedTotal,
    cleaningLevel,
    leadTimeHours ?? sameDayNoticeHours,
  );

  return {
    pricingVersion: PRICING_VERSION,
    roomSubtotal,
    minimumAdjustment,
    selectedRoomsSubtotal,
    bathroomCharge: 0,
    conditionCharge: 0,
    extrasCharge,
    discountBase: 0,
    discountAmount: 0,
    travelFee: travel.fee,
    travelPending: travel.pending,
    sameDayCharge,
    knownChargesTotal,
    estimatedTotal,
    provisional: false,
    requiredUpfrontPercentage: payment.percentage,
    requiredUpfrontAmount: payment.amount,
    remainingBalance: payment.remainingBalance,
    manualReviewReasons: [
      ...(travel.pending
        ? ["Travel fee pending review"]
        : []),
      ...(sameDayNoticeHours !== null &&
      sameDayNoticeHours !== undefined
        ? ["Same-day booking"]
        : []),
      ...(Number(sameDayNoticeHours) < 3 &&
      sameDayNoticeHours !== null &&
      sameDayNoticeHours !== undefined
        ? ["Below minimum notice"]
        : []),
    ],
  };
}

export function formatGBP(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value) || 0);
}
