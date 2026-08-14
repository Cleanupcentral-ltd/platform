import { createHash } from "node:crypto";

import type {
  LeadEvidenceRecord,
  LeadProspectReview,
} from "../ports/lead-review.js";

import {
  isGenericBusinessEmail,
} from "../domain/business-email.js";

import type {
  ManualOutreachFollowUp,
  ManualOutreachRepository,
} from "../ports/manual-outreach.js";

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
  readonly sector: LeadProspectReview["sector"];
  readonly sectorLabel: string;
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

export interface ManualOutreachWorkspace {
  readonly activities:
    readonly OutreachActivityRecord[];
}

export interface ManualOutreachService {
  getWorkspace(
    founderId: string,
    prospectId: string,
  ): Promise<ManualOutreachWorkspace>;

  listFollowUps(
    founderId: string,
  ): Promise<readonly ManualOutreachFollowUp[]>;

  previewDraft(
    founderId: string,
    prospectId: string,
    contactId: string | null,
  ): Promise<OutreachDraftPreview>;

  recordActivity(
    founderId: string,
    prospectId: string,
    input: Omit<
      RecordOutreachActivityInput,
      "founderId" | "prospectId"
    >,
  ): Promise<OutreachActivityRecord>;
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

type OutreachSector =
  LeadProspectReview["sector"];

type PreviewMode =
  | "manual_sector"
  | "outlook_legacy";

const GENERIC_SERVICE_PARAGRAPH =
  "Whether you are looking for regular cleaning, additional cover when needed, or simply a dependable cleaning company to have available, we would be happy to discuss how Clean Up Central could support your business.";

const SECTOR_COPY: Readonly<Record<
  OutreachSector,
  {
    readonly label: string;
    readonly templateId: string;
    readonly serviceParagraph: string;
  }
>> = {
  short_let_serviced_accommodation: {
    label:
      "Short-let and serviced accommodation",
    templateId:
      "initial_outreach_v2_short_let_serviced_accommodation",
    serviceParagraph:
      "Whether you require regular property changeovers, additional cleaning cover during busy periods, or dependable support across a growing portfolio, we would be happy to discuss how Clean Up Central could support your operation.",
  },
  offices_coworking: {
    label:
      "Offices and coworking spaces",
    templateId:
      "initial_outreach_v2_offices_coworking",
    serviceParagraph:
      "Whether you require scheduled workplace cleaning, out-of-hours support, or dependable cover when your usual arrangements need extra capacity, we would be happy to discuss how Clean Up Central could support your workplace.",
  },
  community_halls_event_venues: {
    label:
      "Community halls and event venues",
    templateId:
      "initial_outreach_v2_community_halls_event_venues",
    serviceParagraph:
      "Whether you require cleaning before or after events, regular venue upkeep, or additional cover around busy booking periods, we would be happy to discuss how Clean Up Central could support your venue.",
  },
  estate_letting_agents: {
    label:
      "Estate and letting agents",
    templateId:
      "initial_outreach_v2_estate_letting_agents",
    serviceParagraph:
      "Whether you require cleaning between tenancies, support across managed properties, or dependable cover when additional cleaning is required, we would be happy to discuss how Clean Up Central could support your team.",
  },
  university_accommodation: {
    label:
      "University accommodation",
    templateId:
      "initial_outreach_v2_university_accommodation",
    serviceParagraph:
      "Whether you require accommodation turnovers, communal-area cleaning, periodic deep cleans, or additional support during peak changeover periods, we would be happy to discuss how Clean Up Central could support your accommodation operation.",
  },
  other_commercial_spaces: {
    label:
      "Other commercial spaces",
    templateId:
      "initial_outreach_v2_other_commercial_spaces",
    serviceParagraph:
      GENERIC_SERVICE_PARAGRAPH,
  },
};

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

function verifiedSector(
  prospect: LeadProspectReview,
): OutreachSector {
  const confirmed = verified(
    prospect,
    "approved_sector",
  ).some(
    (item) =>
      item.fieldValue === prospect.sector,
  );
  if (!confirmed) {
    throw new OutreachError("not_eligible");
  }
  return prospect.sector;
}

function buildPreview(
  prospect: LeadProspectReview,
  requestedContactId: string | null,
  approvedCopy: {
    readonly privacyUrl: string;
    readonly optOutText: string;
  },
  mode: PreviewMode,
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

  const sector = verifiedSector(prospect);
  const sectorCopy = SECTOR_COPY[sector];
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
  const serviceParagraph =
    mode === "manual_sector"
      ? sectorCopy.serviceParagraph
      : GENERIC_SERVICE_PARAGRAPH;
  const templateId =
    mode === "manual_sector"
      ? sectorCopy.templateId
      : OUTREACH_TEMPLATE_ID;
  const body = [
    `Hello ${businessName} team,`,
    "",
    "I’m reaching out on behalf of Clean Up Central, a London-based company providing professional cleaning and practical property support to businesses and property operators.",
    "",
    `We’re currently introducing our services to businesses that may benefit from reliable ongoing cleaning support, and came across ${businessName} while researching organisations in your sector.`,
    "",
    serviceParagraph,
    "",
    "We can arrange a brief introductory call or site visit to understand your requirements and provide a straightforward quotation.",
    "",
    "Would you be open to a short conversation?",
    "",
    "Kind regards,",
    "Clean Up Central",
    "Bringing Spaces back to life, one at a time.",
    "",
    approvedCopy.optOutText,
    `For information about how we use business contact information, please see our Privacy Notice: ${approvedCopy.privacyUrl}`,
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
    sector,
    sectorLabel: sectorCopy.label,
    templateId,
    contactId: selected.contactId,
    recipientEmail: selected.email,
    availableRecipients: recipients,
    subject,
    body,
    evidence,
    previewSha256: hash,
  };
}

function createProspectLoader(
  leadReviewService:
    Pick<LeadReviewService, "getProspect">,
) {
  return async (
    prospectId: string,
  ): Promise<LeadProspectReview> => {
    try {
      return await leadReviewService
        .getProspect(prospectId);
    } catch {
      throw new OutreachError("not_found");
    }
  };
}

export function createManualOutreachService(options: {
  readonly leadReviewService:
    Pick<LeadReviewService, "getProspect">;
  readonly repository:
    ManualOutreachRepository;
  readonly privacyUrl: string;
  readonly optOutText: string;
}): ManualOutreachService {
  const prospect = createProspectLoader(
    options.leadReviewService,
  );

  return {
    async getWorkspace(_founderId, prospectId) {
      await prospect(prospectId);
      try {
        return {
          activities:
            await options.repository
              .listActivities(prospectId),
        };
      } catch {
        throw new OutreachError(
          "repository_unavailable",
        );
      }
    },

    async listFollowUps(_founderId) {
      try {
        return await options.repository
          .listFollowUps(1_000);
      } catch {
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
        "manual_sector",
      );
    },

    async recordActivity(
      founderId,
      prospectId,
      input,
    ) {
      await prospect(prospectId);
      try {
        return await options.repository
          .recordManualActivity({
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

export function createOutreachService(options: {
  readonly leadReviewService:
    Pick<LeadReviewService, "getProspect">;
  readonly repository: OutreachRepository;
  readonly gateway: OutlookDraftGateway;
  readonly privacyUrl: string;
  readonly optOutText: string;
}): OutreachService {
  const prospect = createProspectLoader(
    options.leadReviewService,
  );

  const preview = async (
    prospectId: string,
    contactId: string | null,
  ) => buildPreview(
    await prospect(prospectId),
    contactId,
    {
      privacyUrl: options.privacyUrl,
      optOutText: options.optOutText,
    },
    "outlook_legacy",
  );

  return {
    async getWorkspace(founderId, prospectId) {
      await prospect(prospectId);
      try {
        const [
          connection,
          latestDraft,
          activities,
        ] = await Promise.all([
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
      return preview(
        prospectId,
        contactId,
      );
    },

    async createDraft(
      founderId,
      prospectId,
      contactId,
      expectedPreviewSha256,
    ) {
      const currentPreview = await preview(
        prospectId,
        contactId,
      );
      if (
        currentPreview.previewSha256 !==
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
              currentPreview.recipientEmail,
            subject:
              currentPreview.subject,
            body: currentPreview.body,
            templateId:
              currentPreview.templateId,
            previewSha256:
              currentPreview.previewSha256,
            evidenceIds:
              currentPreview.evidence.map(
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
          currentPreview.contactId ||
        prepared.recipientEmail !==
          currentPreview.recipientEmail ||
        prepared.templateId !==
          currentPreview.templateId ||
        prepared.previewSha256 !==
          currentPreview.previewSha256
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
              currentPreview.recipientEmail,
            subject:
              currentPreview.subject,
            body: currentPreview.body,
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
