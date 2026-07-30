import assert from "node:assert/strict";
import {
  PRICING_VERSION,
  calculateSelectedRoomsEstimate,
  calculateWholePropertyEstimate,
  sameDayFeeForNotice,
  travelFeeForDistance,
  wholePropertyBasePrice,
} from "../src/app/pricing.js";

assert.match(PRICING_VERSION, /Phase 0 v1\.3/);

assert.equal(wholePropertyBasePrice("Standard Clean", 0), 80);
assert.equal(wholePropertyBasePrice("Standard Clean", 2), 110);
assert.equal(wholePropertyBasePrice("Standard Clean", 4), 170);
assert.equal(wholePropertyBasePrice("Deep Clean", 5), 360);
assert.throws(
  () => wholePropertyBasePrice("End of Tenancy", 2),
  /Unsupported/,
);

assert.deepEqual(travelFeeForDistance(10), {
  fee: 0,
  pending: false,
  manualReview: false,
  reason: null,
});
assert.equal(travelFeeForDistance(10.1).fee, 10);
assert.equal(travelFeeForDistance(20.1).fee, 20);
assert.equal(travelFeeForDistance(30.1).manualReview, true);
assert.equal(travelFeeForDistance(null).pending, true);

assert.equal(sameDayFeeForNotice(8), 25);
assert.equal(sameDayFeeForNotice(7), 30);
assert.equal(sameDayFeeForNotice(6), 35);
assert.equal(sameDayFeeForNotice(5), 40);
assert.equal(sameDayFeeForNotice(4), 45);
assert.equal(sameDayFeeForNotice(3.49), 50);
assert.equal(sameDayFeeForNotice(8, true), 50);

const standard = calculateWholePropertyEstimate({
  service: "Standard Clean",
  bedrooms: 2,
  bathrooms: 2,
  extras: { Oven: 1 },
  isNewCustomer: true,
  travelFee: 10,
  leadTimeHours: 72,
});

assert.equal(standard.basePrice, 110);
assert.equal(standard.bathroomCharge, 20);
assert.equal(standard.extrasCharge, 50);
assert.equal(standard.discountBase, 130);
assert.equal(standard.discountAmount, 19.5);
assert.equal(standard.estimatedTotal, 170.5);
assert.equal(standard.requiredUpfrontPercentage, 30);
assert.equal(standard.requiredUpfrontAmount, 51.15);

const dirtyAirbnb = calculateWholePropertyEstimate({
  service: "Airbnb Turnover",
  bedrooms: 1,
  bathrooms: 2,
  extras: {
    Laundry: 2,
    "Standard Consumables Package": 1,
  },
  isNewCustomer: true,
  airbnbCondition: "Dirty",
  travelFee: 0,
  leadTimeHours: 72,
});

assert.equal(dirtyAirbnb.discountBase, 100);
assert.equal(dirtyAirbnb.discountAmount, 15);
assert.equal(dirtyAirbnb.conditionCharge, 20);
assert.equal(dirtyAirbnb.estimatedTotal, 145);
assert.equal(dirtyAirbnb.provisional, true);
assert.deepEqual(dirtyAirbnb.manualReviewReasons, [
  "Dirty Airbnb condition",
]);

const selectedRooms = calculateSelectedRoomsEstimate({
  cleaningLevel: "Standard Clean",
  rooms: {
    Bathroom: 2,
    Kitchen: 1,
  },
  extras: {
    Oven: 1,
  },
  travelFee: 10,
  leadTimeHours: 72,
});

assert.equal(selectedRooms.roomSubtotal, 120);
assert.equal(selectedRooms.minimumAdjustment, 0);
assert.equal(selectedRooms.extrasCharge, 50);
assert.equal(selectedRooms.discountAmount, 0);
assert.equal(selectedRooms.estimatedTotal, 180);

const hallwayOnly = calculateSelectedRoomsEstimate({
  cleaningLevel: "Deep Clean",
  rooms: {
    Hallway: 1,
  },
  travelFee: 0,
  leadTimeHours: 72,
});

assert.equal(hallwayOnly.roomSubtotal, 30);
assert.equal(hallwayOnly.minimumAdjustment, 10);
assert.equal(hallwayOnly.estimatedTotal, 40);

const stairsOnly = calculateSelectedRoomsEstimate({
  cleaningLevel: "Deep Clean",
  rooms: {
    Stairs: 1,
  },
  travelFee: 0,
  leadTimeHours: 72,
});

assert.equal(stairsOnly.roomSubtotal, 40);
assert.equal(stairsOnly.minimumAdjustment, 0);
assert.equal(stairsOnly.estimatedTotal, 40);

const hallwayAndStairs = calculateSelectedRoomsEstimate({
  cleaningLevel: "Standard Clean",
  rooms: {
    Hallway: 1,
    Stairs: 1,
  },
  travelFee: 0,
  leadTimeHours: 72,
});

assert.equal(hallwayAndStairs.roomSubtotal, 45);
assert.equal(hallwayAndStairs.minimumAdjustment, 0);
assert.equal(hallwayAndStairs.estimatedTotal, 45);

const urgentDeep = calculateWholePropertyEstimate({
  service: "Deep Clean",
  bedrooms: 2,
  bathrooms: 1,
  travelFee: 0,
  sameDayNoticeHours: 4,
});

assert.equal(urgentDeep.sameDayCharge, 45);
assert.equal(urgentDeep.estimatedTotal, 280);
assert.equal(urgentDeep.requiredUpfrontPercentage, 100);
assert.equal(urgentDeep.requiredUpfrontAmount, 280);
assert.deepEqual(urgentDeep.manualReviewReasons, [
  "Same-day booking",
]);

console.log(
  "Pricing tests passed: whole property, Selected Rooms minimum, extras, travel, discount scope, Airbnb condition, same-day fees and upfront payment.",
);