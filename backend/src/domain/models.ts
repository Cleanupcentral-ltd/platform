import type {
  Arrangement,
  ArrivalWindow,
  CleaningScope,
  CustomerVerificationStatus,
  DeclaredCustomerType,
  PreferredContactMethod,
  PropertyType,
  QuoteCategory,
  QuoteStatus,
  SupportService,
  UrgencyLevel,
} from "./quote-values.js";

export interface CustomerRecord {
  readonly id: string;
  readonly fullName: string;
  readonly companyName: string | null;
  readonly email: string;
  readonly emailNormalized: string;
  readonly phone: string;
  readonly phoneNormalized: string;
  readonly declaredCustomerType: DeclaredCustomerType;
  readonly verificationStatus: CustomerVerificationStatus;
  readonly isExistingCustomer: boolean;
  readonly firstEligibleCleanCompleted: boolean;
  readonly privacyConsent: boolean;
  readonly marketingConsent: boolean;
  readonly internalNotes: string | null;
}

export type CreateCustomerRecord = Omit<
  CustomerRecord,
  "id"
>;

export type UpdateCustomerRecord = Partial<
  CreateCustomerRecord
>;

export interface PropertyRecord {
  readonly id: string;
  readonly customerId: string;
  readonly propertyLabel: string;
  readonly address: string;
  readonly postcode: string;
  readonly postcodeNormalized: string;
  readonly propertyType: PropertyType | null;
  readonly bedroomCount: number | null;
  readonly bathroomCount: number | null;
  readonly occupancyStatus: string | null;
  readonly parkingDetails: string | null;
  readonly petsDetails: string | null;
  readonly accessArrangements: string | null;
  readonly verifiedProperty: boolean;
  readonly activeProperty: boolean;
}

export type CreatePropertyRecord = Omit<
  PropertyRecord,
  "id"
>;

export type UpdatePropertyRecord = Partial<
  CreatePropertyRecord
>;

export interface QuoteRecord {
  readonly id: string;
  readonly submissionId: string;
  readonly quoteNumber: string;
  readonly customerId: string;
  readonly propertyId: string;
  readonly schemaVersion: string;
  readonly pricingVersion: string;
  readonly status: QuoteStatus;
  readonly category: QuoteCategory;
  readonly serviceType: string;
  readonly cleaningScope: CleaningScope | null;
  readonly declaredCustomerType: DeclaredCustomerType;
  readonly verifiedCustomerStatus:
    CustomerVerificationStatus;
  readonly customerStatusMismatch: boolean;
  readonly preferredContactMethod:
    PreferredContactMethod;
  readonly preferredDate: string | null;
  readonly arrivalWindow: ArrivalWindow | null;
  readonly preferredStartDate: string | null;
  readonly requiredCompletionDate: string | null;
  readonly sameDay: boolean;
  readonly arrangement: Arrangement | null;
  readonly frequency: string | null;
  readonly urgency: UrgencyLevel | null;
  readonly supportServices:
    readonly SupportService[];
  readonly manualReviewRequired: boolean;
  readonly manualReviewReasons: readonly string[];
  readonly estimatedTotal: number | null;
  readonly requiredUpfrontPercentage:
    number | null;
  readonly requiredUpfrontAmount:
    number | null;
  readonly remainingBalance: number | null;
  readonly travelFee: number | null;
  readonly travelPending: boolean;
  readonly distanceMiles: number | null;
  readonly provisional: boolean;
  readonly customerNotes: string | null;
  readonly rawSubmission: Readonly<
    Record<string, unknown>
  >;
  readonly pricingSnapshot: Readonly<
    Record<string, unknown>
  >;
}

export type CreateQuoteRecord = Omit<
  QuoteRecord,
  "id"
>;

export interface QuoteItemRecord {
  readonly id: string;
  readonly quoteId: string;
  readonly itemLabel: string;
  readonly sourceKey: string;
  readonly itemType: string;
  readonly itemName: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly lineTotal: number;
  readonly discountable: boolean;
  readonly provisional: boolean;
  readonly customerVisible: boolean;
  readonly displayOrder: number;
  readonly metadata: Readonly<
    Record<string, unknown>
  > | null;
}

export type CreateQuoteItemRecord = Omit<
  QuoteItemRecord,
  "id"
>;




export interface ContactEnquiryRecord {
  readonly id: string;
  readonly enquiryNumber: string;
  readonly submissionId: string;
  readonly customerId: string | null;
  readonly propertyId: string | null;
  readonly convertedQuoteId: string | null;
  readonly status: string;
  readonly fullName: string;
  readonly email: string;
  readonly emailNormalized: string;
  readonly phone: string;
  readonly phoneNormalized: string;
  readonly enquiryType: string;
  readonly preferredContactMethod:
    PreferredContactMethod;
  readonly message: string;
  readonly hasAttachments: boolean;
  readonly attachmentCount: number;
  readonly submissionSource: string;
  readonly reviewedAt: string | null;
  readonly respondedAt: string | null;
  readonly internalNotes: string | null;
}

export type CreateContactEnquiryRecord =
  Omit<ContactEnquiryRecord, "id">;

export type MediaUploadContext =
  | "Quote"
  | "Contact Enquiry";

export type MediaUploadType =
  | "Image"
  | "Document";

export type MediaUploadStatus =
  | "Uploaded";

export interface MediaUploadRecord {
  readonly id: string;
  readonly uploadLabel: string;
  readonly quoteId: string | null;
  readonly contactEnquiryId: string | null;
  readonly uploadContext: MediaUploadContext;
  readonly sourceField: string;
  readonly fileName: string;
  readonly fileExtension: string;
  readonly mimeType: string;
  readonly mediaType: MediaUploadType;
  readonly mediaUrl: string | null;
  readonly wixMediaId: string;
  readonly sizeBytes: number;
  readonly uploadStatus: MediaUploadStatus;
  readonly customerVisible: boolean;
  readonly displayOrder: number;
  readonly internalNotes: string | null;
}

export type CreateMediaUploadRecord = Omit<
  MediaUploadRecord,
  "id"
>;

export interface StatusHistoryRecord {
  readonly id: string;
  readonly historyLabel: string;
  readonly quoteId: string | null;
  readonly contactEnquiryId: string | null;
  readonly recordType: "Quote" | "Contact Enquiry";
  readonly previousStatus: string | null;
  readonly newStatus: string;
  readonly changeSource: string;
  readonly actorType: string;
  readonly actorId: string | null;
  readonly actorName: string | null;
  readonly changeReason: string | null;
  readonly customerVisible: boolean;
  readonly notes: string | null;
  readonly metadata: Readonly<
    Record<string, unknown>
  > | null;
}

export type CreateStatusHistoryRecord = Omit<
  StatusHistoryRecord,
  "id"
>;
