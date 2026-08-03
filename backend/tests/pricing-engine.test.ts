import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateSelectedRoomsEstimate,
  calculateWholePropertyEstimate,
  sameDayFeeForNotice,
  travelFeeForDistance,
} from "../src/domain/pricing.js";

const zeroExtras = {
  Oven: 0,
  Fridge: 0,
  "Interior Windows": 0,
  "Grout Cleaning": 0,
  Laundry: 0,
  "Standard Consumables Package": 0,
};

test(
  "calculates a two-bedroom new-customer Standard Clean",
  () => {
    const result =
      calculateWholePropertyEstimate({
        service:
          "Standard Clean",

        bedrooms: 2,
        bathrooms: 1,
        extras: zeroExtras,
        isNewCustomer: true,
        airbnbCondition: null,
        distanceMiles: 0,

        sameDayNoticeHours:
          null,

        requestAfter21: false,

        leadTimeHours: 72,
      });

    assert.equal(
      result.basePrice,
      110,
    );

    assert.equal(
      result.discountAmount,
      16.5,
    );

    assert.equal(
      result.estimatedTotal,
      93.5,
    );

    assert.equal(
      result.requiredUpfrontPercentage,
      50,
    );

    assert.equal(
      result.requiredUpfrontAmount,
      46.75,
    );
  },
);

test(
  "discounts the extra-bathroom charge but not an oven",
  () => {
    const result =
      calculateWholePropertyEstimate({
        service:
          "Standard Clean",

        bedrooms: 2,
        bathrooms: 2,

        extras: {
          ...zeroExtras,
          Oven: 1,
        },

        isNewCustomer: true,
        airbnbCondition: null,
        distanceMiles: 0,

        sameDayNoticeHours:
          null,

        requestAfter21: false,

        leadTimeHours: 72,
      });

    assert.equal(
      result.bathroomCharge,
      20,
    );

    assert.equal(
      result.discountBase,
      130,
    );

    assert.equal(
      result.discountAmount,
      19.5,
    );

    assert.equal(
      result.extrasCharge,
      50,
    );

    assert.equal(
      result.estimatedTotal,
      160.5,
    );
  },
);

test(
  "applies the hallway-only minimum",
  () => {
    const result =
      calculateSelectedRoomsEstimate({
        cleaningLevel:
          "Standard Clean",

        rooms: {
          Bathroom: 0,
          Bedroom: 0,
          Kitchen: 0,
          "Living Room": 0,
          Hallway: 1,
          Stairs: 0,
        },

        extras: zeroExtras,
        distanceMiles: 0,

        sameDayNoticeHours:
          null,

        requestAfter21: false,
        leadTimeHours: 72,
      });

    assert.equal(
      result.roomSubtotal,
      20,
    );

    assert.equal(
      result.minimumAdjustment,
      20,
    );

    assert.equal(
      result.estimatedTotal,
      40,
    );

    assert.equal(
      result.discountAmount,
      0,
    );
  },
);

test(
  "keeps unknown travel pending",
  () => {
    assert.deepEqual(
      travelFeeForDistance(
        null,
      ),
      {
        fee: null,
        pending: true,
        manualReview: true,
        reason:
          "TRAVEL_DISTANCE_PENDING",
      },
    );
  },
);

test(
  "uses the locked same-day surcharge bands",
  () => {
    assert.equal(
      sameDayFeeForNotice(8),
      25,
    );

    assert.equal(
      sameDayFeeForNotice(6.5),
      30,
    );

    assert.equal(
      sameDayFeeForNotice(5.5),
      35,
    );

    assert.equal(
      sameDayFeeForNotice(4.5),
      40,
    );

    assert.equal(
      sameDayFeeForNotice(3.75),
      45,
    );

    assert.equal(
      sameDayFeeForNotice(3),
      50,
    );
  },
);

test(
  "marks Dirty Airbnb pricing provisional",
  () => {
    const result =
      calculateWholePropertyEstimate({
        service:
          "Airbnb Turnover",

        bedrooms: 1,
        bathrooms: 1,
        extras: zeroExtras,
        isNewCustomer: false,

        airbnbCondition:
          "Dirty",

        distanceMiles: 0,

        sameDayNoticeHours:
          null,

        requestAfter21: false,
        leadTimeHours: 72,
      });

    assert.equal(
      result.conditionCharge,
      20,
    );

    assert.equal(
      result.provisional,
      true,
    );

    assert.ok(
      result.manualReviewReasons
        .includes(
          "DIRTY_AIRBNB",
        ),
    );
  },
);