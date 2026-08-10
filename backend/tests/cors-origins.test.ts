import assert from "node:assert/strict";
import test from "node:test";

import { buildAllowedOrigins } from "../src/app.js";

test("adds the founder console origin without replacing website origins", () => {
  assert.deepEqual(
    buildAllowedOrigins(
      "https://cleanupcentral.com,https://www.cleanupcentral.com",
      true,
      "https://cuc-ops-console-stage2.onrender.com",
    ),
    [
      "https://cleanupcentral.com",
      "https://www.cleanupcentral.com",
      "https://cuc-ops-console-stage2.onrender.com",
    ],
  );
});

test("does not add the console origin while the Lead Engine UI is disabled", () => {
  assert.deepEqual(
    buildAllowedOrigins(
      "https://cleanupcentral.com",
      false,
      "https://cuc-ops-console-stage2.onrender.com",
    ),
    ["https://cleanupcentral.com"],
  );
});
