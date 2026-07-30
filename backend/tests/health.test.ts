import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";

test("GET /health confirms the backend is available", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/health",
  });

  assert.equal(response.statusCode, 200);

  assert.deepEqual(response.json(), {
    ok: true,
    service: "cleanup-central-backend",
    version: "0.1.0",
  });
});