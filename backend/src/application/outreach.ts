import { createHash } from "node:crypto";

import type {
  LeadEvidenceRecord,
  LeadProspectReview,
} from "../ports/lead-review.js";

import {
  isGenericBusinessEmail,
} from "../domain/business-email.js";

import type {
  OutreachActivityRecord,
  OutlookDraftGateway,
  OutreachDraftRecord,
  OutreachRepository,
  OutlookConnectionStatus,
  RecordOutreachActivityInput,
} from "../ports/outreach.js";

import {
  OUTREACH_TEMPLATE_ID,
} from "../ports/outreach.js";

import type {
  LeadReviewService,
} from "./review-leads.js";

export type OutreachFailure =
  | "not_found"
  | "not_eligible"
  | "unsupported_contact"
  | "stale_preview"
  | "not_connected"
  | "invalid_activity"
  | "provider_unavailable"
  | "repository_unavailable";

export class OutreachError extends Error {
  readonly failure: OutreachFailure;

  constructor(failure: OutreachFailure) {
    super(failure);
    this.name = "OutreachError";
    this.failure = failure;
  }
}

export interface OutreachDraftPreview {
  readonly prospectId: string;
  readonly businessName: string;
  readonly templateId: string;
  readonly contactId: string;
  readonly recipientEmail: string;
  readonly availableRecipients: readonly {
    readonly contactId: string;
    readonly email: string;
  }[];
  readonly subject: string;
  readonly body: string;
  readonly evidence: readonly {
    readonly id: string;
    readonly factName: string;
    readonly factValue: string;
    readonly sourceUrl: string;
  }[];
  readonly previewSha256: string;
}

export interface OutreachWorkspace {
  readonly connection:
    OutlookConnectionStatus;
  readonly latestDraft:
    OutreachDraftRecord | null;
  readonly activities:
    readonly OutreachActivityRecord[];
}

export interface OutreachService {
  getWorkspace(
    founderId: string,
    prospectId: string,
  ): Promise<OutreachWorkspace>;

  previewDraft(
    founderId: string,
    prospectId: string,
    contactId: string | null,
  ): Promise<OutreachDraftPreview>;

  createDraft(
    founderId: string,
    prospectId: string,
    contactId: string,
    previewSha256: string,
  ): Promise<OutreachDraftRecord>;

  createAuthorizationUrl(
    founderId: string,
  ): Promise<string>;

  completeAuthorization(
    code: string,
    state: string,
  ): Promise<void>;

  recordActivity(
    founderId: string,
    prospectId: string,
    input: Omit<
      RecordOutreachActivityInput,
      "founderId" | "prospectId"
    >,
  ): Promise<OutreachActivityRecord>;
}

function verified(
  prospect: LeadProspectReview,
  factName?: string,
): readonly LeadEvidenceRecord[] {
  return prospect.evidence.filter(
    (item) =>
      item.verificationStatus === "verified" &&
      [
        "first_party_website",
        "companies_house",
      ].includes(item.sourceType) &&
      (
        factName === undefined ||
        item.fieldName === factName
      ),
  );
}

function normalizeText(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function previewHash(value: {
  readonly prospectId: string;
  readonly contactId: string;
  readonly recipientEmail: string;
  readonly subject: string;
  readonly body: string;
  readonly evidenceIds: readonly string[];
}): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function buildPreview(
  prospect: LeadProspectReview,
  requestedContactId: string | null,
  approvedCopy: {
    readonly privacyUrl: string;
    readonly optOutText: string;
  },
): OutreachDraftPreview {
  if (
    prospect.latestAssessment === null ||
    prospect.latestAssessment
      .eligibilityResult !== "eligible" ||
    prospect.latestAssessment.blockers.length > 0 ||
    prospect.hasActiveSuppression ||
    prospect.companyEnrichment
      ?.qualificationState !==
        "ready_for_outreach"
  ) {
    throw new OutreachError("not_eligible");
  }

  const evidenceById = new Map(
    verified(prospect).map((item) => [
      item.id,
      item,
    ]),
  );
  const recipients = prospect.contacts
    .filter((contact) => {
      const source = evidenceById.get(
        contact.sourceEvidenceId,
      );
      return (
        contact.contactType === "email" &&
        contact.verificationStatus === "verified" &&
        source?.fieldName === "public_email" &&
        source.sourceType ===
          "first_party_website" &&
        isGenericBusinessEmail(
          contact.normalizedValue,
        )
      );
    })
    .map((contact) => ({
      contactId: contact.id,
      email:
        contact.normalizedValue.toLowerCase(),
    }));

  const selected = requestedContactId === null
    ? recipients[0]
    : recipients.find(
        (item) =>
          item.contactId === requestedContactId,
      );
  if (selected === undefined) {
    throw new OutreachError(
      "unsupported_contact",
    );
  }

  const businessName = normalizeText(
    prospect.businessName,
  );
  const subject =
    `Cleaning support for ${businessName}`;
  const body = [
    "Hello,",
    "",
    "I’m reaching out on behalf of Clean Up Central, a London-based company providing professional cleaning and practical property support to businesses and property operators.",
    "",
    `We’re currently introducing our services to businesses that may benefit from reliable ongoing cleaning support, and came across ${businessName} while researching organisations in your sector.`,
    "",
    "Whether you are looking for regular cleaning, additional cover when needed, or simply a dependable cleaning company to have available, we would be happy to discuss how Clean Up Central could support your business.",
    "",
    "We can arrange a brief introductory call or site visit to understand your requirements and provide a straightforward quotation.",
    "",
    "Would you be open to a short conversation?",
    "",
    "Kind regards,",
    "Clean Up Central",
    "Cleaning and support, handled properly.",
    "",
    approvedCopy.optOutText,
    `Privacy information: ${approvedCopy.privacyUrl}`,
  ].join("\n");

  const supportingIds = new Set(
    prospect.latestAssessment.evidenceIds,
  );
  const selectedContact = prospect.contacts.find(
    (item) => item.id === selected.contactId,
  )!;
  supportingIds.add(
    selectedContact.sourceEvidenceId,
  );
  const evidence = [...supportingIds]
    .map((id) => evidenceById.get(id))
    .filter((item): item is LeadEvidenceRecord =>
      item !== undefined,
    )
    .map((item) => ({
      id: item.id,
      factName: item.fieldName,
      factValue: item.fieldValue,
      sourceUrl: item.sourceUrl,
    }));
  const hash = previewHash({
    prospectId: prospect.id,
    contactId: selected.contactId,
    recipientEmail: selected.email,
    subject,
    body,
    evidenceIds: evidence.map(
      (item) => item.id,
    ),
  });

  return {
    prospectId: prospect.id,
    businessName,
    templateId: OUTREACH_TEMPLATE_ID,
    contactId: selected.contactId,
    recipientEmail: selected.email,
    availableRecipients: recipients,
    subject,
    body,
    evidence,
    previewSha256: hash,
  };
}

export function createOutreachService(options: {
  readonly leadReviewService:
    Pick<LeadReviewService, "getProspect">;
  readonly repository: OutreachRepository;
  readonly gateway: OutlookDraftGateway;
  readonly privacyUrl: string;
  readonly optOutText: string;
}): OutreachService {
  async function prospect(
    prospectId: string,
  ): Promise<LeadProspectReview> {
    try {
      return await options.leadReviewService
        .getProspect(prospectId);
    } catch {
      throw new OutreachError("not_found");
    }
  }

  return {
    async getWorkspace(founderId, prospectId) {
      await prospect(prospectId);
      try {
        const [connection, latestDraft, activities] =
          await Promise.all([
            options.gateway
              .connectionStatus(founderId),
            options.repository
              .getLatestDraft(prospectId),
            options.repository
              .listActivities(prospectId),
          ]);
        return {
          connection,
          latestDraft,
          activities,
        };
      } catch (error) {
        if (error instanceof OutreachError) throw error;
        throw new OutreachError(
          "repository_unavailable",
        );
      }
    },

    async previewDraft(
      _founderId,
      prospectId,
      contactId,
    ) {
      return buildPreview(
        await prospect(prospectId),
        contactId,
        {
          privacyUrl: options.privacyUrl,
          optOutText: options.optOutText,
        },
      );
    },

    async createDraft(
      founderId,
      prospectId,
      contactId,
      expectedPreviewSha256,
    ) {
      const preview = buildPreview(
        await prospect(prospectId),
        contactId,
        {
          privacyUrl: options.privacyUrl,
          optOutText: options.optOutText,
        },
      );
      if (
        preview.previewSha256 !==
          expectedPreviewSha256
      ) {
        throw new OutreachError(
          "stale_preview",
        );
      }
      const connection = await options.gateway
        .connectionStatus(founderId);
      if (!connection.connected) {
        throw new OutreachError(
          "not_connected",
        );
      }

      let prepared: OutreachDraftRecord;
      try {
        prepared = await options.repository
          .prepareDraft({
            prospectId,
            founderId,
            contactId,
            recipientEmail:
              preview.recipientEmail,
            subject: preview.subject,
            body: preview.body,
            templateId:
              preview.templateId,
            previewSha256:
              preview.previewSha256,
            evidenceIds:
              preview.evidence.map(
                (item) => item.id,
              ),
          });
      } catch {
        throw new OutreachError(
          "repository_unavailable",
        );
      }
      if (
        prepared.contactId !==
          preview.contactId ||
        prepared.recipientEmail !==
          preview.recipientEmail ||
        prepared.templateId !==
          preview.templateId ||
        prepared.previewSha256 !==
          preview.previewSha256
      ) {
        throw new OutreachError(
          "stale_preview",
        );
      }
      if (
        prepared.status === "drafted" ||
        prepared.outlookDraftId !== null
      ) {
        return prepared;
      }

      try {
        const created = await options.gateway
          .createOrRecoverDraft({
            founderId,
            internalDraftId: prepared.id,
            recipientEmail:
              preview.recipientEmail,
            subject: preview.subject,
            body: preview.body,
          });
        return await options.repository
          .markDrafted(
            prepared.id,
            founderId,
            created.outlookDraftId,
            created.outlookWebUrl,
          );
      } catch (error) {
        try {
          await options.repository
            .markDraftFailed(
              prepared.id,
              "outlook_provider_failure",
            );
        } catch {
          // Preserve the provider error as the useful result.
        }
        if (error instanceof OutreachError) throw error;
        throw new OutreachError(
          "provider_unavailable",
        );
      }
    },

    async createAuthorizationUrl(founderId) {
      try {
        return await options.gateway
          .createAuthorizationUrl(founderId);
      } catch {
        throw new OutreachError(
          "provider_unavailable",
        );
      }
    },

    async completeAuthorization(code, state) {
      try {
        await options.gateway
          .completeAuthorization(code, state);
      } catch {
        throw new OutreachError(
          "provider_unavailable",
        );
      }
    },

    async recordActivity(
      founderId,
      prospectId,
      input,
    ) {
      await prospect(prospectId);
      try {
        return await options.repository
          .recordActivity({
            ...input,
            founderId,
            prospectId,
          });
      } catch {
        throw new OutreachError(
          "invalid_activity",
        );
      }
    },
  };
}
