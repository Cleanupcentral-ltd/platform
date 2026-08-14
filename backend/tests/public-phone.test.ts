import assert from "node:assert/strict";
import test from "node:test";

import {
  extractPublicPhones,
  normalizePublicPhone,
} from "../src/domain/public-phone.js";

test(
  "normalizes common UK business phone formats",
  () => {
    assert.equal(
      normalizePublicPhone("020 8464 5566"),
      "02084645566",
    );
    assert.equal(
      normalizePublicPhone("+44 (0)20 8464 5566"),
      "02084645566",
    );
    assert.equal(
      normalizePublicPhone("0044 20 8464 5566"),
      "02084645566",
    );
  },
);

test(
  "rejects short numbers and non-UK values",
  () => {
    assert.equal(
      normalizePublicPhone("01234567"),
      null,
    );
    assert.equal(
      normalizePublicPhone("+1 212 555 0100"),
      null,
    );
  },
);

test(
  "prefers a first-party tel link and deduplicates page-text copies",
  () => {
    const results = extractPublicPhones(
      '<a href="tel:+442084645566">020 8464 5566</a>',
      "Call us on 020 8464 5566.",
    );

    assert.equal(results.length, 1);
    assert.equal(
      results[0]?.normalizedValue,
      "02084645566",
    );
    assert.match(
      results[0]?.support ?? "",
      /^Verified public phone v1: first-party tel link/,
    );
  },
);
