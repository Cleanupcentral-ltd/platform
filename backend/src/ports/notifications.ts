export const NOTIFICATION_TEMPLATE_IDS = [
  "quote-received-customer",
  "quote-received-internal",
  "contact-received-customer",
  "contact-received-internal",
] as const;

export type NotificationTemplateId =
  (typeof NOTIFICATION_TEMPLATE_IDS)[number];

export type NotificationAudience =
  | "Customer"
  | "Internal";

export interface NotificationRecipient {
  readonly email: string;
  readonly name: string | null;
}

export interface NotificationDraft {
  readonly templateId:
    NotificationTemplateId;

  readonly audience:
    NotificationAudience;

  readonly idempotencyKey: string;
  readonly referenceNumber: string;

  readonly to:
    readonly NotificationRecipient[];

  readonly replyTo:
    NotificationRecipient | null;

  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export interface NotificationDeliveryReceipt {
  readonly providerMessageId:
    string | null;

  readonly acceptedAt: string;
}

export interface NotificationDelivery {
  send(
    draft: NotificationDraft,
  ): Promise<NotificationDeliveryReceipt>;
}

export type NotificationRecordType =
  | "Quote"
  | "Contact Enquiry";

export type NotificationDeliveryStatus =
  | "Sent"
  | "Failed";

export interface NotificationDeliveryRecord {
  readonly recordType:
    NotificationRecordType;

  readonly recordId: string;
  readonly referenceNumber: string;

  readonly templateId:
    NotificationTemplateId;

  readonly audience:
    NotificationAudience;

  readonly idempotencyKey: string;

  readonly status:
    NotificationDeliveryStatus;

  readonly providerMessageId:
    string | null;

  readonly acceptedAt:
    string | null;

  readonly errorCode:
    string | null;
}

export interface NotificationDeliveryRecorder {
  record(
    delivery:
      NotificationDeliveryRecord,
  ): Promise<void>;
}

export interface NotificationDispatchItem {
  readonly templateId:
    NotificationTemplateId;

  readonly audience:
    NotificationAudience;

  readonly status:
    | "sent"
    | "failed";

  readonly providerMessageId:
    string | null;

  readonly deliveryRecorded:
    boolean;

  readonly errorCode:
    string | null;
}

export interface NotificationDispatchReport {
  readonly attempted: number;
  readonly sent: number;
  readonly failed: number;

  readonly items:
    readonly NotificationDispatchItem[];
}
