import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const quoteSource = readFileSync(new URL("../src/app/Quote.tsx", import.meta.url), "utf8");
const payloadSource = readFileSync(new URL("../src/app/quotePayload.js", import.meta.url), "utf8");

const commercialFrequencies = [
  "Daily",
  "Five times weekly",
  "Three times weekly",
  "Twice weekly",
  "Weekly",
  "Fortnightly",
  "Monthly",
  "Ad hoc",
  "Other / Not sure",
];
const propertySupportOptions = [
  "Key Holding",
  "Property Inspection",
  "Contractor Access",
  "Inventory Check",
  "Emergency Attendance",
  "Not Sure",
];
const occupancyStatuses = ["Occupied", "Vacant", "Short-let / holiday let", "Other / not sure"];

for (const option of [...commercialFrequencies, ...propertySupportOptions, ...occupancyStatuses]) {
  assert.equal(quoteSource.includes(`"${option}"`), true, `Quote interface is missing: ${option}`);
}

assert.equal(quoteSource.includes('"17:00–20:00"'), true);
assert.equal(quoteSource.includes("Specialist Add-on / Outsourced Supplier"), false);
assert.equal(quoteSource.includes("Specialist Property Support"), false);
assert.equal(payloadSource.includes('CUC Phase 0 v1.3'), true);
assert.equal(payloadSource.includes("occupancyStatus"), true);

console.log("Specification alignment tests passed: commercial, Property Support, occupancy and arrival-window decisions.");
