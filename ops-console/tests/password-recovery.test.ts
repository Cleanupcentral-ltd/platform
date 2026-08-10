import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPasswordRecoveryRedirect,
  isPasswordRecoveryReturn,
} from "../src/password-recovery.ts";

test("password recovery returns to the deployed founder route", () => {
  assert.equal(
    buildPasswordRecoveryRedirect(
      "https://cuc-ops-console-stage2.onrender.com/other/path",
    ),
    "https://cuc-ops-console-stage2.onrender.com/ops/leads?recovery=1",
  );
});

test("only an explicit recovery marker activates password update mode", () => {
  assert.equal(
    isPasswordRecoveryReturn(
      "https://cuc-ops-console-stage2.onrender.com/ops/leads?recovery=1&code=abc",
    ),
    true,
  );
  assert.equal(
    isPasswordRecoveryReturn(
      "https://cuc-ops-console-stage2.onrender.com/ops/leads?code=abc",
    ),
    false,
  );
});
