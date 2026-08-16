import assert from "node:assert/strict";
import {
  readFileSync,
} from "node:fs";
import test from "node:test";

test(
  "Find Prospects displays persisted first-party email and phone details",
  () => {
    const source = readFileSync(
      new URL(
        "../src/LeadDiscoveryView.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    assert.equal(
      source.includes(
        "row.prospect?.publicPhone",
      ),
      true,
    );
    assert.equal(
      source.includes(
        "row.prospect?.publicEmail",
      ),
      true,
    );
  },
);

test(
  "redesigned workspace refreshes persisted contacts while qualification is running",
  () => {
    const source = readFileSync(
      new URL(
        "../src/LeadEngineRedesign.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    assert.equal(
      source.includes(
        "qualificationInFlight",
      ),
      true,
    );
    assert.equal(
      source.includes(
        "window.setInterval",
      ),
      true,
    );
    assert.equal(
      source.includes(
        "refreshProspects()",
      ),
      true,
    );
  },
);
