import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalLondonBorough,
  LONDON_BOROUGHS,
} from "../src/domain/london-boroughs.js";

test(
  "London borough input is canonicalised without fuzzy guessing",
  () => {
    assert.equal(
      LONDON_BOROUGHS.length,
      33,
    );
    assert.equal(
      canonicalLondonBorough("bromley"),
      "Bromley",
    );
    assert.equal(
      canonicalLondonBorough(
        "London Borough of Barking & Dagenham",
      ),
      "Barking and Dagenham",
    );
    assert.equal(
      canonicalLondonBorough("Bromly"),
      null,
    );
  },
);
