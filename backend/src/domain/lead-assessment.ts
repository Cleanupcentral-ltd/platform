import type {
  LeadAssessmentRecord,
  LeadContactRecord,
  LeadEvidenceRecord,
  LeadProspectReview,
} from "../ports/lead-review.js";

export const LEAD_SCORING_VERSION =
  "cuc-lel-0-10-v1.1";

export const LEAD_QUALIFICATION_BLOCKERS = {
  missingVerifiedIdentity:
    "missing_verified_identity",
  unverifiedSector:
    "unverified_approved_sector",
  missingSearchProvenance:
    "missing_search_provenance",
  inactiveOrUnverified:
    "active_status_unverified_or_inactive",
  noVerifiedContact:
    "no_verified_contact_route",
  suppression:
    "do_not_contact_or_objection",
  unresolvedSubscriber:
    "unresolved_subscriber_type",
  unapprovedEmailBasis:
    "unapproved_email_basis",
} as const;

interface DimensionScore {
  readonly points: number;
  readonly explanation: string;
  readonly evidenceIds: readonly string[];
}

export interface CalculatedLeadAssessment {
  readonly totalScore: number;
  readonly rulesVersion: string;
  readonly eligibilityResult:
    | "eligible"
    | "research_required";
  readonly scoreBreakdown: {
    readonly sectorServiceFit:
      DimensionScore;
    readonly recurringCleaningNeed:
      DimensionScore;
    readonly portfolioOrPremisesScale:
      DimensionScore;
    readonly compliantContactability:
      DimensionScore;
    readonly evidenceConfidence:
      DimensionScore;
  };
  readonly blockers: readonly string[];
  readonly rationale: string;
  readonly evidenceIds: readonly string[];
}

const PERSISTENT_SOURCE_TYPES =
  new Set([
    "first_party_website",
    "companies_house",
  ]);

function verifiedEvidence(
  prospect: LeadProspectReview,
  fieldName?: string,
): readonly LeadEvidenceRecord[] {
  return prospect.evidence.filter(
    (item) =>
      item.verificationStatus ===
        "verified" &&
      (
        fieldName === undefined ||
        item.fieldName === fieldName
      ),
  );
}

function persistentEvidence(
  prospect: LeadProspectReview,
  fieldName?: string,
): readonly LeadEvidenceRecord[] {
  return verifiedEvidence(
    prospect,
    fieldName,
  ).filter((item) =>
    PERSISTENT_SOURCE_TYPES.has(
      item.sourceType,
    ),
  );
}

function evidenceIds(
  evidence: readonly LeadEvidenceRecord[],
): readonly string[] {
  return [...new Set(
    evidence.map((item) => item.id),
  )];
}

function contactEvidenceIds(
  contacts: readonly LeadContactRecord[],
): readonly string[] {
  return [...new Set(
    contacts.map(
      (item) =>
        item.sourceEvidenceId,
    ),
  )];
}

function normalizedFact(
  evidence:
    readonly LeadEvidenceRecord[],
): string | null {
  return evidence[0]
    ?.fieldValue
    .trim()
    .toLowerCase() ?? null;
}

function sectorScore(
  prospect: LeadProspectReview,
): DimensionScore {
  const sectorEvidence =
    persistentEvidence(
      prospect,
      "approved_sector",
    );
  const matches =
    sectorEvidence.filter(
      (item) =>
        item.fieldValue ===
          prospect.sector,
    );

  if (matches.length > 0) {
    return {
      points: 2,
      explanation:
        "Approved pilot sector verified from a persistent source.",
      evidenceIds:
        evidenceIds(matches),
    };
  }

  if (sectorEvidence.length > 0) {
    return {
      points: 0,
      explanation:
        "Verified sector evidence does not match the assigned pilot sector.",
      evidenceIds:
        evidenceIds(sectorEvidence),
    };
  }

  return {
    points: 1,
    explanation:
      "Pilot-sector fit is plausible from discovery data but not yet verified.",
    evidenceIds: [],
  };
}

function recurringNeedScore(
  prospect: LeadProspectReview,
  sector: DimensionScore,
): DimensionScore {
  const directEvidence =
    persistentEvidence(
      prospect,
      "recurring_cleaning_need",
    );

  if (directEvidence.length > 0) {
    return {
      points: 2,
      explanation:
        "A recurring operational or turnover need is verified from a first-party or official source.",
      evidenceIds:
        evidenceIds(directEvidence),
    };
  }

  if (sector.points > 0) {
    return {
      points: 1,
      explanation:
        "Only the sector-level recurring cleaning need is currently supported.",
      evidenceIds:
        sector.evidenceIds,
    };
  }

  return {
    points: 0,
    explanation:
      "No public evidence of recurring cleaning need is verified.",
    evidenceIds: [],
  };
}

function scaleScore(
  prospect: LeadProspectReview,
): DimensionScore {
  const scaleEvidence =
    persistentEvidence(
      prospect,
      "premises_scale",
    );
  const multiple = scaleEvidence.filter(
    (item) =>
      item.fieldValue ===
        "multiple_properties_locations_or_units",
  );

  if (multiple.length > 0) {
    return {
      points: 2,
      explanation:
        "Multiple properties, locations or managed units are verified.",
      evidenceIds:
        evidenceIds(multiple),
    };
  }

  const onePremises = scaleEvidence.filter(
    (item) =>
      item.fieldValue ===
        "one_active_premises",
  );
  const tradingAddress =
    persistentEvidence(
      prospect,
      "trading_address",
    );

  if (
    onePremises.length > 0 ||
    tradingAddress.length > 0
  ) {
    const supporting = [
      ...onePremises,
      ...tradingAddress,
    ];
    return {
      points: 1,
      explanation:
        "One active trading premises is verified.",
      evidenceIds:
        evidenceIds(supporting),
    };
  }

  return {
    points: 0,
    explanation:
      "Premises or portfolio scale remains unknown.",
    evidenceIds: [],
  };
}

function contactabilityScore(
  prospect: LeadProspectReview,
): DimensionScore {
  const persistentEvidenceIdSet =
    new Set(
      persistentEvidence(
        prospect,
      ).map((item) => item.id),
    );
  const verifiedContacts =
    prospect.contacts.filter(
      (item) =>
        item.verificationStatus ===
          "verified" &&
        persistentEvidenceIdSet.has(
          item.sourceEvidenceId,
        ),
    );
  const emails = verifiedContacts.filter(
    (item) =>
      item.contactType === "email",
  );
  const forms = verifiedContacts.filter(
    (item) =>
      item.contactType ===
        "contact_form",
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
        "A verified public contact form is available.",
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

function confidenceScore(
  prospect: LeadProspectReview,
): DimensionScore {
  const firstParty = persistentEvidence(
    prospect,
  ).filter(
    (item) =>
      item.sourceType ===
        "first_party_website",
  );
  const companiesHouse =
    persistentEvidence(
      prospect,
    ).filter(
      (item) =>
        item.sourceType ===
          "companies_house",
    );
  const currentSourceUrls =
    new Set(
      persistentEvidence(
        prospect,
      ).map((item) => item.sourceUrl),
    );

  if (
    firstParty.length > 0 &&
    (
      companiesHouse.length > 0 ||
      currentSourceUrls.size > 1
    )
  ) {
    return {
      points: 2,
      explanation:
        "First-party evidence is corroborated by Companies House or a second current source.",
      evidenceIds:
        evidenceIds([
          ...firstParty,
          ...companiesHouse,
          ...persistentEvidence(
            prospect,
          ),
        ]),
    };
  }

  if (firstParty.length > 0) {
    return {
      points: 1,
      explanation:
        "One current first-party source is verified.",
      evidenceIds:
        evidenceIds(firstParty),
    };
  }

  return {
    points: 0,
    explanation:
      "Persistent evidence is unsupported or not yet verified.",
    evidenceIds: [],
  };
}

export function calculateLeadAssessment(
  prospect: LeadProspectReview,
): CalculatedLeadAssessment {
  const sectorServiceFit =
    sectorScore(prospect);
  const recurringCleaningNeed =
    recurringNeedScore(
      prospect,
      sectorServiceFit,
    );
  const portfolioOrPremisesScale =
    scaleScore(prospect);
  const compliantContactability =
    contactabilityScore(prospect);
  const evidenceConfidence =
    confidenceScore(prospect);
  const dimensions = [
    sectorServiceFit,
    recurringCleaningNeed,
    portfolioOrPremisesScale,
    compliantContactability,
    evidenceConfidence,
  ];

  const blockers: string[] = [];
  if (
    persistentEvidence(
      prospect,
      "business_name",
    ).length === 0
  ) {
    blockers.push(
      LEAD_QUALIFICATION_BLOCKERS
        .missingVerifiedIdentity,
    );
  }
  if (sectorServiceFit.points !== 2) {
    blockers.push(
      LEAD_QUALIFICATION_BLOCKERS
        .unverifiedSector,
    );
  }
  if (!prospect.hasSearchProvenance) {
    blockers.push(
      LEAD_QUALIFICATION_BLOCKERS
        .missingSearchProvenance,
    );
  }
  const activeStatus = normalizedFact(
    persistentEvidence(
      prospect,
      "business_status",
    ),
  );
  if (activeStatus !== "active") {
    blockers.push(
      LEAD_QUALIFICATION_BLOCKERS
        .inactiveOrUnverified,
    );
  }
  if (compliantContactability.points === 0) {
    blockers.push(
      LEAD_QUALIFICATION_BLOCKERS
        .noVerifiedContact,
    );
  }
  if (prospect.hasActiveSuppression) {
    blockers.push(
      LEAD_QUALIFICATION_BLOCKERS
        .suppression,
    );
  }

  const subscriberType = normalizedFact(
    persistentEvidence(
      prospect,
      "subscriber_type",
    ),
  );
  if (
    subscriberType === null ||
    subscriberType === "unknown"
  ) {
    blockers.push(
      LEAD_QUALIFICATION_BLOCKERS
        .unresolvedSubscriber,
    );
  }
  if (
    subscriberType !== "corporate" ||
    compliantContactability.points === 0
  ) {
    blockers.push(
      LEAD_QUALIFICATION_BLOCKERS
        .unapprovedEmailBasis,
    );
  }

  const totalScore =
    dimensions.reduce(
      (sum, item) =>
        sum + item.points,
      0,
    );
  const citedEvidence = [
    ...new Set(
      dimensions.flatMap(
        (item) => item.evidenceIds,
      ),
    ),
  ];
  const eligibilityResult =
    blockers.length === 0
      ? "eligible" as const
      : "research_required" as const;

  return {
    totalScore,
    rulesVersion:
      LEAD_SCORING_VERSION,
    eligibilityResult,
    scoreBreakdown: {
      sectorServiceFit,
      recurringCleaningNeed,
      portfolioOrPremisesScale,
      compliantContactability,
      evidenceConfidence,
    },
    blockers,
    rationale:
      eligibilityResult === "eligible"
        ? `Ready for founder draft approval with a transparent score of ${totalScore}/10. Outlook drafting and sending remain disabled.`
        : `Research required. Score ${totalScore}/10 does not override ${blockers.length} qualification blocker${blockers.length === 1 ? "" : "s"}.`,
    evidenceIds: citedEvidence,
  };
}

export function assessmentRecord(
  id: string,
  assessedAt: string,
  calculated: CalculatedLeadAssessment,
): LeadAssessmentRecord {
  return {
    id,
    totalScore:
      calculated.totalScore,
    rulesVersion:
      calculated.rulesVersion,
    eligibilityResult:
      calculated.eligibilityResult,
    scoreBreakdown:
      calculated.scoreBreakdown,
    blockers:
      calculated.blockers,
    rationale:
      calculated.rationale,
    evidenceIds:
      calculated.evidenceIds,
    assessedAt,
  };
}
