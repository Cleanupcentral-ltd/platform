import type {
  CreateContactEnquiryRecord,
  CreateCustomerRecord,
  CreateMediaUploadRecord,
  CreatePropertyRecord,
  CreateQuoteItemRecord,
  CreateQuoteRecord,
  CreateStatusHistoryRecord,
  ContactEnquiryRecord,
  CustomerRecord,
  MediaUploadRecord,
  PropertyRecord,
  QuoteItemRecord,
  QuoteRecord,
  StatusHistoryRecord,
  UpdateCustomerRecord,
  UpdatePropertyRecord,
} from "../domain/models.js";

export interface CustomerRepository {
  findByNormalizedEmail(
    emailNormalized: string,
  ): Promise<readonly CustomerRecord[]>;

  findByNormalizedPhone(
    phoneNormalized: string,
  ): Promise<readonly CustomerRecord[]>;

  findById(
    customerId: string,
  ): Promise<CustomerRecord | null>;

  create(
    customer: CreateCustomerRecord,
  ): Promise<CustomerRecord>;

  update(
    customerId: string,
    changes: UpdateCustomerRecord,
  ): Promise<CustomerRecord>;

  delete(customerId: string): Promise<void>;
}

export interface PropertyRepository {
  findByCustomerAndPostcode(
    customerId: string,
    postcodeNormalized: string,
  ): Promise<readonly PropertyRecord[]>;

  findById(
    propertyId: string,
  ): Promise<PropertyRecord | null>;

  create(
    property: CreatePropertyRecord,
  ): Promise<PropertyRecord>;

  update(
    propertyId: string,
    changes: UpdatePropertyRecord,
  ): Promise<PropertyRecord>;

  delete(propertyId: string): Promise<void>;
}


export interface ContactEnquiryCreateOptions {
  readonly itemId?: string;
}

export interface ContactEnquiryRepository {
  findBySubmissionId(
    submissionId: string,
  ): Promise<ContactEnquiryRecord | null>;

  create(
    enquiry: CreateContactEnquiryRecord,
    options?: ContactEnquiryCreateOptions,
  ): Promise<ContactEnquiryRecord>;

  delete(
    enquiryId: string,
  ): Promise<void>;
}

export interface QuoteCreateOptions {
  readonly itemId?: string;
}

export interface QuoteRepository {
  findBySubmissionId(
    submissionId: string,
  ): Promise<QuoteRecord | null>;

  create(
    quote: CreateQuoteRecord,
    options?: QuoteCreateOptions,
  ): Promise<QuoteRecord>;

  delete(quoteId: string): Promise<void>;
}

export interface QuoteItemRepository {
  createMany(
    quoteItems: readonly CreateQuoteItemRecord[],
  ): Promise<readonly QuoteItemRecord[]>;

  deleteMany(
    quoteItemIds: readonly string[],
  ): Promise<void>;
}

export interface MediaUploadCreateOptions {
  readonly itemId?: string;
}

export interface MediaUploadRepository {
  findById(
    uploadId: string,
  ): Promise<MediaUploadRecord | null>;

  findByQuoteId(
    quoteId: string,
  ): Promise<readonly MediaUploadRecord[]>;

  create(
    upload: CreateMediaUploadRecord,
    options?: MediaUploadCreateOptions,
  ): Promise<MediaUploadRecord>;

  delete(uploadId: string): Promise<void>;

  deleteMany(
    uploadIds: readonly string[],
  ): Promise<void>;
}

export interface StatusHistoryRepository {
  findByQuoteId(
    quoteId: string,
  ): Promise<StatusHistoryRecord | null>;

  create(
    history: CreateStatusHistoryRecord,
  ): Promise<StatusHistoryRecord>;

  delete(historyId: string): Promise<void>;
}

export interface QuoteRepositories {
  readonly customers: CustomerRepository;
  readonly properties: PropertyRepository;
  readonly quotes: QuoteRepository;
  readonly quoteItems: QuoteItemRepository;
  readonly mediaUploads: MediaUploadRepository;
  readonly statusHistory: StatusHistoryRepository;
}
