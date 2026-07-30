import assert from "node:assert/strict";
import { bookingDateBounds, validateBookingDate } from "../src/app/bookingValidation.js";

const now = new Date(2026, 6, 22, 10, 0, 0, 0);
assert.deepEqual(bookingDateBounds(now), { min: "2026-07-22", max: "2026-10-20" });
assert.equal(validateBookingDate("2026-07-21", "14:00–17:00", now), "Past dates cannot be selected.");
assert.equal(validateBookingDate("2026-10-21", "14:00–17:00", now), "Bookings can be requested no more than 90 days in advance.");
assert.equal(validateBookingDate("2026-07-22", "11:00–14:00", now), "Same-day requests require at least three hours’ notice before the arrival window begins.");
assert.equal(validateBookingDate("2026-07-22", "14:00–17:00", now), "");
assert.equal(validateBookingDate("2026-07-23", "08:00–11:00", now), "");
console.log("Booking-date tests passed: past-date, three-hour notice and 90-day maximum rules.");
