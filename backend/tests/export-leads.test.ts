import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLeadExportCsv,
  createLeadExportService,
} from "../src/application/export-leads.js";

import type {
  LeadExportRow,
} from "../src/ports/lead-export.js";

const row: LeadExportRow = {
  prospectReference:
    "11111111-1111-4111-8111-111111111111",
  businessName:
    "=HYPERLINK(\"https://bad.example\")",
  sector: "offices_coworking",
  postcode: "BR1 1AA",
  website: "https://example.com/",
  verifiedContactRoute:
    "hello@example.com",
  eligibilityResult: "eligible",
  totalScore: 8,
  rulesVersion: "rules-v1",
  status: "ready_for_outreach",
  nextFollowUpAt: null,
  outcome: null,
  sourceUrls: [
    "https://example.com/about",
    "https://example.com/contact",
  ],
  suppressionState: false,
  createdAt:
    "2026-08-13T10:00:00.000Z",
};

test(
  "CSV export is deterministic and neutralises spreadsheet formulas",
  () => {
    const csv = buildLeadExportCsv([
      row,
    ]);

    assert.match(
      csv,
      /"'=HYPERLINK\(""https:\/\/bad\.example""\)"/,
    );
    assert.match(
      csv,
      /"8\/10 · rules-v1"/,
    );
    assert.match(
      csv,
      /"https:\/\/example\.com\/about \| https:\/\/example\.com\/contact"/,
    );
    assert.equal(
      csv.endsWith("\r\n"),
      true,
    );
  },
);

test(
  "export service records through the repository and dates the safe filename",
  async () => {
    let exportedBy = "";
    const service =
      createLeadExportService(
        {
          async createExport(founderId) {
            exportedBy = founderId;
            return [row];
          },
        },
        () => new Date(
          "2026-08-13T12:00:00.000Z",
        ),
      );

    const file = await service.createCsv(
      "22222222-2222-4222-8222-222222222222",
    );
    assert.equal(
      exportedBy,
      "22222222-2222-4222-8222-222222222222",
    );
    assert.equal(file.rowCount, 1);
    assert.equal(
      file.filename,
      "clean-up-central-leads-2026-08-13.csv",
    );
  },
);
