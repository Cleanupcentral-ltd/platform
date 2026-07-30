import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeAddress,
  normalizeEmail,
  normalizePhone,
  normalizePostcode,
} from "../src/domain/normalization.js";

test("normalizes email addresses", () => {
  assert.equal(
    normalizeEmail(" Prince@Example.COM "),
    "prince@example.com",
  );
});

test("normalizes UK phone numbers", () => {
  assert.equal(
    normalizePhone("07123 456789"),
    "447123456789",
  );

  assert.equal(
    normalizePhone("+44 (0) 7123 456789"),
    "447123456789",
  );
});

test("normalizes postcodes", () => {
  assert.equal(
    normalizePostcode(" nw1 1hn "),
    "NW11HN",
  );
});

test(
  "normalizes addresses for matching",
  () => {
    assert.equal(
      normalizeAddress(
        "  14 Example Avenue, London  ",
      ),
      "14 example avenue london",
    );
  },
);