import assert from "node:assert/strict";
import test from "node:test";

import {
  addVerificationEvidence,
  assessProspect,
  beginOutlookConnection,
  createOutlookDraft,
  listProspects,
  previewOutlookDraft,
  retryCompanyEnrichment,
  searchCompaniesHouseMatches,
  updateProspectViewState,
  verifyCompaniesHouseMatch,
} from "../src/lead-review-api.ts";

const PROSPECT_ID =
  "11111111-1111-4111-8111-111111111111";

test(
  "prospect review queue uses the MFA session only as a bearer token",
  async () => {
    let requestUrl = "";
    let requestInit:
      RequestInit | undefined;
    const result = await listProspects(
      "https://backend.example/",
      "founder-aal2-token",
      (async (input, init) => {
        requestUrl = String(input);
        requestInit = init;
        return Response.json({
          success: true,
          prospects: [],
        });
      }) as typeof fetch,
    );

    assert.equal(
      requestUrl,
      "https://backend.example/api/ops/leads/prospects",
    );
    const headers = new Headers(
      requestInit?.headers,
    );
    assert.equal(
      headers.get("authorization"),
      "Bearer founder-aal2-token",
    );
    assert.deepEqual(result, []);
  },
);

test(
  "prospect view state changes only through an explicit founder action",
  async () => {
    let requestUrl = "";
    let requestInit:
      RequestInit | undefined;
    const viewedAt =
      await updateProspectViewState(
        "https://backend.example",
        "founder-aal2-token",
        PROSPECT_ID,
        true,
        (async (input, init) => {
          requestUrl = String(input);
          requestInit = init;
          return Response.json({
            success: true,
            viewState: {
              prospectId: PROSPECT_ID,
              viewedAt:
                "2026-08-13T14:00:00.000Z",
            },
          });
        }) as typeof fetch,
      );

    assert.match(
      requestUrl,
      /\/prospects\/11111111-1111-4111-8111-111111111111\/view$/,
    );
    assert.equal(
      requestInit?.method,
      "PUT",
    );
    assert.deepEqual(
      JSON.parse(String(requestInit?.body)),
      { viewed: true },
    );
    assert.equal(
      viewedAt,
      "2026-08-13T14:00:00.000Z",
    );
  },
);

test(
  "automatic company retry sends no client-supplied match or score",
  async () => {
    let requestUrl = "";
    let requestBody = "";
    await retryCompanyEnrichment(
      "https://backend.example",
      "founder-aal2-token",
      PROSPECT_ID,
      (async (input, init) => {
        requestUrl = String(input);
        requestBody = String(init?.body);
        return Response.json(
          {
            success: true,
            status: "pending",
          },
          { status: 202 },
        );
      }) as typeof fetch,
    );

    assert.match(
      requestUrl,
      /company-enrichment\/retry$/,
    );
    assert.equal(requestBody, "{}");
  },
);

test(
  "Companies House candidate search sends only the founder query",
  async () => {
    let requestUrl = "";
    const matches =
      await searchCompaniesHouseMatches(
        "https://backend.example",
        "founder-aal2-token",
        PROSPECT_ID,
        "Example & Co",
        (async (input) => {
          requestUrl = String(input);
          return Response.json({
            success: true,
            matches: [{
              companyName:
                "EXAMPLE & CO LTD",
              companyNumber:
                "01234567",
              companyStatus:
                "active",
              companyType: "ltd",
              registeredOfficeAddress: {
                formatted:
                  "1 High Street",
                postcode: "BR1 1AA",
              },
              dateOfCreation:
                "2020-01-01",
              officialUrl:
                "https://find-and-update.company-information.service.gov.uk/company/01234567",
            }],
          });
        }) as typeof fetch,
      );

    assert.match(
      requestUrl,
      /companies-house\/matches\?q=Example%20%26%20Co$/,
    );
    assert.equal(
      matches[0]?.companyNumber,
      "01234567",
    );
  },
);

test(
  "Companies House confirmation sends only the selected company number",
  async () => {
    let requestBody = "";
    const result =
      await verifyCompaniesHouseMatch(
        "https://backend.example",
        "founder-aal2-token",
        PROSPECT_ID,
        "01234567",
        (async (_input, init) => {
          requestBody =
            String(init?.body);
          return Response.json(
            {
              success: true,
              verification: {
                companyName:
                  "EXAMPLE COMPANY LTD",
                companyNumber:
                  "01234567",
                businessStatus:
                  "active",
                subscriberType:
                  "corporate",
                evidenceIds: [],
                automaticAssessment: {
                  status: "updated",
                  assessment: null,
                },
              },
            },
            { status: 201 },
          );
        }) as typeof fetch,
      );

    assert.deepEqual(
      JSON.parse(requestBody),
      { companyNumber: "01234567" },
    );
    assert.equal(
      result.subscriberType,
      "corporate",
    );
  },
);

test(
  "first-party verification sends one atomic fact and its source",
  async () => {
    let requestBody = "";
    const result =
      await addVerificationEvidence(
        "https://backend.example",
        "founder-aal2-token",
        PROSPECT_ID,
        {
          sourceType:
            "first_party_website",
          sourceUrl:
            "https://example.com/about",
          factName:
            "business_name",
          factValue:
            "Example Business",
          sourceExcerpt: null,
        },
        (async (_input, init) => {
          requestBody =
            String(init?.body);
          return Response.json(
            {
              success: true,
              verification: {
                evidenceId:
                  "33333333-3333-4333-8333-333333333333",
                automaticAssessment: {
                  status: "updated",
                  assessment: null,
                },
              },
            },
            { status: 201 },
          );
        }) as typeof fetch,
      );

    const body = JSON.parse(requestBody);
    assert.equal(
      body.sourceType,
      "first_party_website",
    );
    assert.equal(
      body.factName,
      "business_name",
    );
    assert.equal(
      body.sourceUrl,
      "https://example.com/about",
    );
    assert.equal(
      result.evidenceId,
      "33333333-3333-4333-8333-333333333333",
    );
    assert.equal(
      result.automaticAssessment.status,
      "updated",
    );
  },
);

test(
  "assessment request has no client-supplied score",
  async () => {
    let requestBody = "";
    const result = await assessProspect(
      "https://backend.example",
      "founder-aal2-token",
      PROSPECT_ID,
      (async (_input, init) => {
        requestBody = String(init?.body);
        return Response.json(
          {
            success: true,
            assessment: {
              id:
                "44444444-4444-4444-8444-444444444444",
              totalScore: 2,
              rulesVersion:
                "cuc-lel-0-10-v1",
              eligibilityResult:
                "research_required",
              scoreBreakdown: {},
              blockers: [
                "missing_verified_identity",
              ],
              rationale:
                "Research required.",
              evidenceIds: [],
              assessedAt:
                "2026-08-11T12:00:00.000Z",
            },
          },
          { status: 201 },
        );
      }) as typeof fetch,
    );

    assert.equal(requestBody, "{}");
    assert.equal(result.totalScore, 2);
    assert.equal(
      result.rulesVersion,
      "cuc-lel-0-10-v1",
    );
  },
);

test(
  "Outlook connection rejects any backend response that permits sending",
  async () => {
    await assert.rejects(
      beginOutlookConnection(
        "https://backend.example",
        "founder-aal2-token",
        (async () => Response.json({
          authorizationUrl:
            "https://login.microsoftonline.com/authorize",
          permissions: [
            "Mail.ReadWrite",
            "Mail.Send",
          ],
          sendingPermitted: true,
        })) as typeof fetch,
      ),
      /unsupported Outlook send permission/,
    );
  },
);

test(
  "Outlook draft approval sends only the verified contact and exact preview hash",
  async () => {
    let previewBody = "";
    const preview = await previewOutlookDraft(
      "https://backend.example",
      "founder-aal2-token",
      PROSPECT_ID,
      null,
      (async (_input, init) => {
        previewBody = String(init?.body);
        return Response.json({
          preview: {
            prospectId: PROSPECT_ID,
            businessName:
              "Example Business",
            templateId:
              "initial_outreach_v1",
            contactId:
              "33333333-3333-4333-8333-333333333333",
            recipientEmail:
              "hello@example.com",
            availableRecipients: [],
            subject:
              "Cleaning support",
            body: "Hello",
            evidence: [],
            previewSha256:
              "a".repeat(64),
          },
        });
      }) as typeof fetch,
    );
    assert.deepEqual(
      JSON.parse(previewBody),
      { contactId: null },
    );

    let approvalBody = "";
    await createOutlookDraft(
      "https://backend.example",
      "founder-aal2-token",
      PROSPECT_ID,
      preview.contactId,
      preview.previewSha256,
      (async (_input, init) => {
        approvalBody = String(init?.body);
        return Response.json(
          {
            sent: false,
            draft: {
              id:
                "55555555-5555-4555-8555-555555555555",
              prospectId: PROSPECT_ID,
              contactId:
                preview.contactId,
              recipientEmail:
                "hello@example.com",
              subject:
                "Cleaning support",
              body: "Hello",
              templateId:
                "initial_outreach_v1",
              previewSha256:
                preview.previewSha256,
              evidenceIds: [],
              status: "drafted",
              outlookDraftId:
                "graph-draft-id",
              outlookWebUrl: null,
              lastErrorCode: null,
              createdAt:
                "2026-08-13T12:00:00.000Z",
              updatedAt:
                "2026-08-13T12:00:00.000Z",
            },
          },
          { status: 201 },
        );
      }) as typeof fetch,
    );
    assert.deepEqual(
      JSON.parse(approvalBody),
      {
        contactId:
          preview.contactId,
        previewSha256:
          preview.previewSha256,
      },
    );
  },
);
