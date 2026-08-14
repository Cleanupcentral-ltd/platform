from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}: {old[:100]!r}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    "backend/src/ports/lead-review.ts",
    '  readonly websiteUrl: string | null;\n  readonly createdAt: string;',
    '  readonly websiteUrl: string | null;\n  readonly publicPhone: string | null;\n  readonly publicEmail: string | null;\n  readonly createdAt: string;',
)

replace_once(
    "backend/src/adapters/supabase/supabase-lead-review-repository.ts",
    '''        websiteUrl: item.website_url,\n        createdAt: item.created_at,''',
    '''        websiteUrl: item.website_url,\n        publicPhone:\n          prospectEvidence.find(\n            (record) =>\n              record.source_type ===\n                "first_party_website" &&\n              record.field_name ===\n                "public_phone" &&\n              record.verification_status ===\n                "verified",\n          )?.field_value ?? null,\n        publicEmail:\n          prospectEvidence.find(\n            (record) =>\n              record.source_type ===\n                "first_party_website" &&\n              record.field_name ===\n                "public_email" &&\n              record.verification_status ===\n                "verified",\n          )?.field_value ?? null,\n        createdAt: item.created_at,''',
)

replace_once(
    "ops-console/src/lead-review-api.ts",
    '  readonly websiteUrl: string | null;\n  readonly createdAt: string;',
    '  readonly websiteUrl: string | null;\n  readonly publicPhone: string | null;\n  readonly publicEmail: string | null;\n  readonly createdAt: string;',
)

replace_once(
    "ops-console/src/LeadDiscoveryView.tsx",
    '''                const ready =\n                  row.prospect !== null &&\n                  queueKey(row.prospect) ===\n                    "ready";\n                return (''',
    '''                const ready =\n                  row.prospect !== null &&\n                  queueKey(row.prospect) ===\n                    "ready";\n                const contactPhone =\n                  row.result.phone ??\n                  row.prospect?.publicPhone ??\n                  null;\n                const contactWebsite =\n                  row.result.websiteUrl ??\n                  row.prospect?.websiteUrl ??\n                  null;\n                const contactEmail =\n                  row.prospect?.publicEmail ??\n                  null;\n                return (''',
)

replace_once(
    "ops-console/src/LeadDiscoveryView.tsx",
    '''                    <div className="le-result-links">\n                      {row.result.phone !== null && (\n                        <a\n                          href={`tel:${row.result.phone.replace(/\\s/g, "")}`}\n                        >\n                          {row.result.phone}\n                        </a>\n                      )}\n                      {row.result.websiteUrl !== null && (\n                        <a\n                          href={row.result.websiteUrl}\n                          target="_blank"\n                          rel="noreferrer"\n                        >\n                          Website ↗\n                        </a>\n                      )}\n                      <a\n                        href={row.result.sourceUrl}\n                        target="_blank"\n                        rel="noreferrer"\n                      >\n                        Google Maps ↗\n                      </a>\n                    </div>''',
    '''                    <div className="le-result-contact">\n                      <div className="le-result-links">\n                        {contactPhone !== null && (\n                          <a\n                            href={`tel:${contactPhone.replace(/\\s/g, "")}`}\n                          >\n                            {contactPhone}\n                          </a>\n                        )}\n                        {contactWebsite !== null && (\n                          <a\n                            href={contactWebsite}\n                            target="_blank"\n                            rel="noreferrer"\n                          >\n                            Website ↗\n                          </a>\n                        )}\n                        <a\n                          href={row.result.sourceUrl}\n                          target="_blank"\n                          rel="noreferrer"\n                        >\n                          Google Maps ↗\n                        </a>\n                      </div>\n                      {contactEmail !== null && (\n                        <a\n                          className="le-result-email"\n                          href={`mailto:${contactEmail}`}\n                        >\n                          {contactEmail}\n                        </a>\n                      )}\n                    </div>''',
)

replace_once(
    "ops-console/src/redesign.css",
    '''.le-result-links {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 8px 14px;\n}\n\n.le-result-links a,''',
    '''.le-result-contact {\n  display: grid;\n  gap: 8px;\n}\n\n.le-result-links {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 8px 18px;\n}\n\n.le-result-email {\n  width: fit-content;\n  max-width: 100%;\n  overflow-wrap: anywhere;\n  color: var(--le-stone);\n  font-size: 13px;\n  font-weight: 500;\n  text-decoration-color: var(--le-gold-dark);\n  text-underline-offset: 4px;\n}\n\n.le-result-links a,''',
)

replace_once(
    "ops-console/src/redesign.css",
    '''.le-result-links a:hover,\n.le-evidence-row a:hover,''',
    '''.le-result-links a:hover,\n.le-result-email:hover,\n.le-evidence-row a:hover,''',
)

print("find prospect contact-card patch applied")
