import assert from "node:assert/strict";
import test from "node:test";

import {
  groupEvidenceForDisplay,
} from "../src/evidence-view.ts";

import type {
  ProspectEvidence,
  VerificationStatus,
} from "../src/lead-review-api.ts";

function evidence(
  id: string,
  fieldName: string,
  fieldValue: string,
  sourceUrl: string,
  sourceType = "first_party_website",
  sourceExcerpt: string | null = null,
  verificationStatus:
    VerificationStatus = "verified",
): ProspectEvidence {
  return {
    id,
    sourceUrl,
    sourceType,
    fieldName,
    fieldValue,
    sourceExcerpt,
    verificationStatus,
    capturedAt:
      "2026-08-14T12:00:00.000Z",
    verifiedAt:
      verificationStatus === "verified"
        ? "2026-08-14T12:00:00.000Z"
        : null,
    verificationMethod:
      "automatic_first_party_research",
  };
}

test(
  "same company number from first-party and Companies House displays once",
  () => {
    const groups = groupEvidenceForDisplay([
      evidence(
        "00000000-0000-4000-8000-000000000001",
        "company_number",
        "01234567",
        "https://example.com/terms",
      ),
      evidence(
        "00000000-0000-4000-8000-000000000002",
        "company_number",
        "01234567",
        "https://find-and-update.company-information.service.gov.uk/company/01234567",
        "companies_house",
      ),
    ]);

    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.sources.length, 2);
  },
);

test(
  "superseded contact-form rows collapse behind the one current verified route",
  () => {
    const groups = groupEvidenceForDisplay([
      evidence(
        "00000000-0000-4000-8000-000000000011",
        "contact_form_url",
        "https://example.com/privacy",
        "https://example.com/privacy",
        "first_party_website",
        "Superseded by stricter detector.",
        "rejected",
      ),
      evidence(
        "00000000-0000-4000-8000-000000000012",
        "contact_form_url",
        "https://example.com/contact-us",
        "https://example.com/contact-us",
        "first_party_website",
        "Verified contact form v2: form contains name, email, message/enquiry fields.",
      ),
      evidence(
        "00000000-0000-4000-8000-000000000013",
        "contact_form_url",
        "https://example.com/about",
        "https://example.com/about",
        "first_party_website",
        "Superseded by stricter detector.",
        "rejected",
      ),
    ]);

    assert.equal(groups.length, 1);
    assert.equal(
      groups[0]?.value,
      "https://example.com/contact-us",
    );
    assert.equal(groups[0]?.status, "verified");
    assert.equal(groups[0]?.sources.length, 1);
    assert.equal(
      groups[0]?.sources[0]?.sourceUrl,
      "https://example.com/contact-us",
    );
  },
);
