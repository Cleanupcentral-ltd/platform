from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}: {old[:80]!r}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    "backend/src/ports/automatic-qualification.ts",
    '  | "public_email"\n  | "contact_form_url"',
    '  | "public_email"\n  | "public_phone"\n  | "contact_form_url"',
)
replace_once(
    "backend/src/ports/automatic-qualification.ts",
    '  readonly contactType:\n    | "email"\n    | "contact_form"\n    | null;',
    '  readonly contactType:\n    | "email"\n    | "phone"\n    | "contact_form"\n    | null;',
)

replace_once(
    "backend/src/ports/lead-review.ts",
    '  "public_email",\n  "contact_form_url",',
    '  "public_email",\n  "public_phone",\n  "contact_form_url",',
)
replace_once(
    "backend/src/ports/lead-review.ts",
    '  readonly contactType:\n    "email" | "contact_form" | null;',
    '  readonly contactType:\n    "email" | "phone" | "contact_form" | null;',
)

replace_once(
    "backend/src/application/review-leads.ts",
    'import {\n  calculateLeadAssessment,\n} from "../domain/lead-assessment.js";\n',
    'import {\n  calculateLeadAssessment,\n} from "../domain/lead-assessment.js";\n\nimport {\n  normalizePublicPhone,\n} from "../domain/public-phone.js";\n',
)
replace_once(
    "backend/src/application/review-leads.ts",
    '''  if (factName === "public_email") {
    const email = value.toLowerCase();
    if (
      !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(
        email,
      )
    ) {
      throw new LeadReviewError(
        "invalid_evidence",
      );
    }
    return email;
  }
''',
    '''  if (factName === "public_email") {
    const email = value.toLowerCase();
    if (
      !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(
        email,
      )
    ) {
      throw new LeadReviewError(
        "invalid_evidence",
      );
    }
    return email;
  }

  if (factName === "public_phone") {
    const phone = normalizePublicPhone(value);
    if (phone === null) {
      throw new LeadReviewError(
        "invalid_evidence",
      );
    }
    return value;
  }
''',
)
replace_once(
    "backend/src/application/review-leads.ts",
    '''      const contactType =
        input.factName === "public_email"
          ? "email" as const
          : input.factName ===
              "contact_form_url"
            ? "contact_form" as const
            : null;
      const normalizedContactValue =
        contactType === null
          ? null
          : factValue.toLowerCase();
''',
    '''      const contactType =
        input.factName === "public_email"
          ? "email" as const
          : input.factName === "public_phone"
            ? "phone" as const
            : input.factName ===
                "contact_form_url"
              ? "contact_form" as const
              : null;
      const normalizedContactValue =
        contactType === null
          ? null
          : contactType === "phone"
            ? normalizePublicPhone(factValue)
            : factValue.toLowerCase();
''',
)

replace_once(
    "backend/src/adapters/web/first-party-research.ts",
    'import {\n  detectContactForm,\n} from "../../domain/contact-form-evidence.js";\n',
    'import {\n  detectContactForm,\n} from "../../domain/contact-form-evidence.js";\n\nimport {\n  extractPublicPhones,\n} from "../../domain/public-phone.js";\n',
)
replace_once(
    "backend/src/adapters/web/first-party-research.ts",
    '''    const addFact = (
      page: LoadedPage,
      factName: AutomaticResearchFact["factName"],
      factValue: string,
      support: string,
      contactType: AutomaticResearchFact["contactType"] = null,
    ) => {
      const key = `${factName}\\n${factValue.toLowerCase()}`;
      if (seen.has(key) || support.length === 0) return;
      seen.add(key);
      facts.push({
        sourceUrl: page.url.toString(),
        factName,
        factValue,
        sourceExcerpt: support.slice(0, 700),
        contentSha256: sha256(`${page.url}\\n${factName}\\n${factValue}\\n${support}`),
        contactType,
        normalizedContactValue: contactType === null ? null : factValue.toLowerCase(),
      });
    };
''',
    '''    const addFact = (
      page: LoadedPage,
      factName: AutomaticResearchFact["factName"],
      factValue: string,
      support: string,
      contactType: AutomaticResearchFact["contactType"] = null,
      normalizedContactValue: string | null =
        contactType === null
          ? null
          : factValue.toLowerCase(),
    ) => {
      const key = `${factName}\\n${
        normalizedContactValue ??
        factValue.toLowerCase()
      }`;
      if (seen.has(key) || support.length === 0) return;
      seen.add(key);
      facts.push({
        sourceUrl: page.url.toString(),
        factName,
        factValue,
        sourceExcerpt: support.slice(0, 700),
        contentSha256: sha256(`${page.url}\\n${factName}\\n${factValue}\\n${support}`),
        contactType,
        normalizedContactValue,
      });
    };
''',
)
replace_once(
    "backend/src/adapters/web/first-party-research.ts",
    '    const contactFormCandidates = pages\n',
    '''    const phoneCandidates = pages
      .flatMap((page, index) =>
        extractPublicPhones(
          page.html,
          page.text,
        ).map((evidence) => ({
          page,
          index,
          evidence,
        })),
      )
      .sort((left, right) =>
        right.evidence.score -
          left.evidence.score ||
        left.index - right.index,
      );

    const bestPhone = phoneCandidates[0];
    if (bestPhone !== undefined) {
      addFact(
        bestPhone.page,
        "public_phone",
        bestPhone.evidence.displayValue,
        bestPhone.evidence.support,
        "phone",
        bestPhone.evidence.normalizedValue,
      );
    }

    const contactFormCandidates = pages
''',
)

replace_once(
    "backend/src/domain/lead-assessment.ts",
    '  "cuc-lel-0-10-v1.4";',
    '  "cuc-lel-0-10-v1.5";',
)
replace_once(
    "backend/src/domain/lead-assessment.ts",
    '''function contactabilityScore(
  prospect: LeadProspectReview,
): DimensionScore {
  const evidenceById = new Map(
    persistentEvidence(prospect).map(
      (item) => [item.id, item],
    ),
  );
  const verifiedContacts =
    prospect.contacts.filter(
      (item) =>
        item.verificationStatus ===
          "verified" &&
        evidenceById.has(
          item.sourceEvidenceId,
        ),
    );
  const emails = verifiedContacts.filter(
    (item) => {
      const source = evidenceById.get(
        item.sourceEvidenceId,
      );
      return item.contactType === "email" &&
      source?.sourceType ===
        "first_party_website" &&
      source.fieldName === "public_email" &&
      isGenericBusinessEmail(
        item.normalizedValue,
      );
    },
  );
  const forms = verifiedContacts.filter(
    (item) =>
      item.contactType ===
        "contact_form" &&
      trustedContactFormEvidence(
        evidenceById.get(
          item.sourceEvidenceId,
        ),
      ),
  );
  const subscriberType = normalizedFact(
    persistentEvidence(
      prospect,
      "subscriber_type",
    ),
  );
  const compliantEmail =
    emails.length > 0 &&
    subscriberType === "corporate";

  if (compliantEmail) {
    const supporting = [
      ...contactEvidenceIds(emails),
      ...evidenceIds(
        persistentEvidence(
          prospect,
          "subscriber_type",
        ),
      ),
    ];
    return {
      points: 2,
      explanation:
        "A verified public business email belongs to a verified corporate subscriber.",
      evidenceIds:
        [...new Set(supporting)],
    };
  }

  if (forms.length > 0) {
    return {
      points: 1,
      explanation:
        "A strictly verified public contact form is available.",
      evidenceIds:
        contactEvidenceIds(forms),
    };
  }

  return {
    points: 0,
    explanation:
      "No compliant verified public contact route is available.",
    evidenceIds: [],
  };
}
''',
    '''function contactabilityScore(
  prospect: LeadProspectReview,
): DimensionScore {
  const evidenceById = new Map(
    persistentEvidence(prospect).map(
      (item) => [item.id, item],
    ),
  );
  const verifiedContacts =
    prospect.contacts.filter(
      (item) =>
        item.verificationStatus ===
          "verified" &&
        evidenceById.has(
          item.sourceEvidenceId,
        ),
    );
  const emails = verifiedContacts.filter(
    (item) => {
      const source = evidenceById.get(
        item.sourceEvidenceId,
      );
      return item.contactType === "email" &&
      source?.sourceType ===
        "first_party_website" &&
      source.fieldName === "public_email" &&
      isGenericBusinessEmail(
        item.normalizedValue,
      );
    },
  );
  const phones = verifiedContacts.filter(
    (item) => {
      const source = evidenceById.get(
        item.sourceEvidenceId,
      );
      return item.contactType === "phone" &&
        source?.sourceType ===
          "first_party_website" &&
        source.fieldName === "public_phone";
    },
  );
  const forms = verifiedContacts.filter(
    (item) =>
      item.contactType ===
        "contact_form" &&
      trustedContactFormEvidence(
        evidenceById.get(
          item.sourceEvidenceId,
        ),
      ),
  );
  const subscriberType = normalizedFact(
    persistentEvidence(
      prospect,
      "subscriber_type",
    ),
  );
  const compliantEmail =
    emails.length > 0 &&
    subscriberType === "corporate";

  if (compliantEmail) {
    const supporting = [
      ...contactEvidenceIds(emails),
      ...evidenceIds(
        persistentEvidence(
          prospect,
          "subscriber_type",
        ),
      ),
    ];
    return {
      points: 2,
      explanation:
        "A verified public business email belongs to a verified corporate subscriber.",
      evidenceIds:
        [...new Set(supporting)],
    };
  }

  if (phones.length > 0 || forms.length > 0) {
    return {
      points: 1,
      explanation:
        phones.length > 0
          ? "A verified first-party public business phone is available."
          : "A strictly verified public contact form is available.",
      evidenceIds:
        contactEvidenceIds([
          ...phones,
          ...forms,
        ]),
    };
  }

  return {
    points: 0,
    explanation:
      "No compliant verified public contact route is available.",
    evidenceIds: [],
  };
}
''',
)
replace_once(
    "backend/src/domain/lead-assessment.ts",
    '''  if (
    subscriberType !== "corporate" ||
    compliantContactability.points === 0
  ) {
    blockers.push(
      LEAD_QUALIFICATION_BLOCKERS
        .unapprovedEmailBasis,
    );
  }
''',
    '''  const persistentEvidenceById =
    new Map(
      persistentEvidence(prospect).map(
        (item) => [item.id, item],
      ),
    );
  const hasApprovedEmailBasis =
    subscriberType === "corporate" &&
    prospect.contacts.some((contact) => {
      const source = persistentEvidenceById.get(
        contact.sourceEvidenceId,
      );
      return contact.verificationStatus ===
          "verified" &&
        contact.contactType === "email" &&
        source?.sourceType ===
          "first_party_website" &&
        source.fieldName === "public_email" &&
        isGenericBusinessEmail(
          contact.normalizedValue,
        );
    });
  if (!hasApprovedEmailBasis) {
    blockers.push(
      LEAD_QUALIFICATION_BLOCKERS
        .unapprovedEmailBasis,
    );
  }
''',
)

replace_once(
    "ops-console/src/lead-review-api.ts",
    '  | "public_email"\n  | "contact_form_url"',
    '  | "public_email"\n  | "public_phone"\n  | "contact_form_url"',
)
replace_once(
    "ops-console/src/LeadReviewView.tsx",
    '  { value: "public_email", label: "Public business email" },\n  { value: "contact_form_url", label: "Public contact form" },',
    '  { value: "public_email", label: "Public business email" },\n  { value: "public_phone", label: "Public business phone" },\n  { value: "contact_form_url", label: "Public contact form" },',
)
replace_once(
    "ops-console/src/LeadReviewView.tsx",
    '        "website_url",\n        "google_place_id",\n        "company_number",',
    '        "website_url",\n        "public_phone",\n        "google_place_id",\n        "company_number",',
)
replace_once(
    "ops-console/src/evidence-view.ts",
    '    public_email: "Public business email",\n    contact_form_url: "Public contact form",',
    '    public_email: "Public business email",\n    public_phone: "Public business phone",\n    contact_form_url: "Public contact form",',
)
replace_once(
    "ops-console/src/evidence-view.ts",
    '        "public_email",\n        "contact_form_url",',
    '        "public_email",\n        "public_phone",\n        "contact_form_url",',
)

print("mandatory contact patch applied")
