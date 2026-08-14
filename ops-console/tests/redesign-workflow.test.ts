import assert from "node:assert/strict";
import {
  readFileSync,
} from "node:fs";
import test from "node:test";

import type {
  ManualFollowUpItem,
} from "../src/manual-follow-ups-api";

import {
  matchesFollowUpFilter,
} from "../src/redesign-helpers.ts";

function followUp(
  activities:
    ManualFollowUpItem["activities"],
): ManualFollowUpItem {
  return {
    prospectId:
      "00000000-0000-4000-8000-000000000001",
    businessName: "Example Workspace",
    sector: "offices_coworking",
    primaryPostcode: "BR1 1AA",
    activities,
  };
}

test(
  "follow-up filters derive from saved outreach activity instead of an invented cadence",
  () => {
    const now = new Date(
      "2026-08-14T12:00:00.000Z",
    );
    const item = followUp([
      {
        id: "00000000-0000-4000-8000-000000000011",
        activityType: "contacted",
        outcome: null,
        notes: "Email sent",
        followUpAt: null,
        createdAt:
          "2026-08-13T10:00:00.000Z",
      },
      {
        id: "00000000-0000-4000-8000-000000000012",
        activityType:
          "follow_up_scheduled",
        outcome: null,
        notes: null,
        followUpAt:
          "2026-08-14T15:00:00.000Z",
        createdAt:
          "2026-08-13T10:01:00.000Z",
      },
    ]);

    assert.equal(
      matchesFollowUpFilter(
        item,
        "due_today",
        now,
      ),
      true,
    );
    assert.equal(
      matchesFollowUpFilter(
        item,
        "awaiting_reply",
        now,
      ),
      true,
    );
    assert.equal(
      matchesFollowUpFilter(
        item,
        "replied",
        now,
      ),
      false,
    );
  },
);

test(
  "a later reply moves a contacted prospect out of awaiting reply",
  () => {
    const item = followUp([
      {
        id: "00000000-0000-4000-8000-000000000021",
        activityType: "contacted",
        outcome: null,
        notes: null,
        followUpAt: null,
        createdAt:
          "2026-08-13T10:00:00.000Z",
      },
      {
        id: "00000000-0000-4000-8000-000000000022",
        activityType: "replied",
        outcome: null,
        notes: null,
        followUpAt: null,
        createdAt:
          "2026-08-14T09:00:00.000Z",
      },
    ]);

    assert.equal(
      matchesFollowUpFilter(
        item,
        "replied",
      ),
      true,
    );
    assert.equal(
      matchesFollowUpFilter(
        item,
        "awaiting_reply",
      ),
      false,
    );
  },
);

test(
  "redesigned primary UI has no founder Approve for outreach override or Outlook draft creation action",
  () => {
    const reviewSource = readFileSync(
      new URL(
        "../src/LeadReviewView.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    const drawerSource = readFileSync(
      new URL(
        "../src/OutreachDrawer.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    assert.equal(
      reviewSource.includes(
        "Approve for outreach",
      ),
      false,
    );
    assert.equal(
      drawerSource.includes(
        "createOutlookDraft",
      ),
      false,
    );
    assert.equal(
      drawerSource.includes(
        "Copy Email Draft",
      ),
      true,
    );
  },
);
