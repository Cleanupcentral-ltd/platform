import assert from "node:assert/strict";
import test from "node:test";

import {
  formatOutlookCopy,
} from "../src/manual-outreach-api.ts";

test(
  "manual Outlook copy includes recipient, subject and approved body without changing state",
  () => {
    const result = formatOutlookCopy({
      recipientEmail:
        "info@example.com",
      subject:
        "Cleaning support for Example Business",
      body: [
        "Hello Example Business team,",
        "",
        "Would you be open to a short conversation?",
      ].join("\n"),
    });

    assert.equal(
      result,
      [
        "To: info@example.com",
        "Subject: Cleaning support for Example Business",
        "",
        "Hello Example Business team,",
        "",
        "Would you be open to a short conversation?",
      ].join("\n"),
    );
  },
);
