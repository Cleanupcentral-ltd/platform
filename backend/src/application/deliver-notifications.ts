import type {
  PersistedContactEnquirySubmission,
} from "./persist-contact-enquiry.js";

import type {
  PersistedQuoteSubmission,
} from "./persist-quote.js";

import {
  createContactEnquiryNotificationPlan,
  createQuoteNotificationPlan,
  type NotificationBranding,
  type SubmissionNotificationPlan,
} from "./notifications.js";

import type {
  NotificationDelivery,
  NotificationDeliveryRecord,
  NotificationDeliveryRecorder,
  NotificationDispatchItem,
  NotificationDispatchReport,
  NotificationDraft,
  NotificationRecordType,
} from "../ports/notifications.js";

export interface SubmissionNotificationService {
  notifyQuote(
    submission:
      PersistedQuoteSubmission,
  ): Promise<NotificationDispatchReport>;

  notifyContactEnquiry(
    submission:
      PersistedContactEnquirySubmission,
  ): Promise<NotificationDispatchReport>;
}

export interface SubmissionNotificationServiceOptions {
  readonly branding:
    NotificationBranding;

  readonly delivery:
    NotificationDelivery;

  readonly recorder:
    NotificationDeliveryRecorder;
}

interface RecordContext {
  readonly recordType:
    NotificationRecordType;

  readonly recordId: string;
}

const EMPTY_REPORT:
  NotificationDispatchReport = {
    attempted: 0,
    sent: 0,
    failed: 0,
    items: [],
  };

function errorCode(
  error: unknown,
): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.length > 0
  ) {
    return error.code;
  }

  return "NOTIFICATION_DELIVERY_FAILED";
}

async function recordDelivery(
  recorder:
    NotificationDeliveryRecorder,

  context:
    RecordContext,

  draft:
    NotificationDraft,

  result: Omit<
    NotificationDeliveryRecord,
    | "recordType"
    | "recordId"
    | "referenceNumber"
    | "templateId"
    | "audience"
    | "idempotencyKey"
  >,
): Promise<boolean> {
  try {
    await recorder.record({
      recordType:
        context.recordType,

      recordId:
        context.recordId,

      referenceNumber:
        draft.referenceNumber,

      templateId:
        draft.templateId,

      audience:
        draft.audience,

      idempotencyKey:
        draft.idempotencyKey,

      ...result,
    });

    return true;
  } catch {
    return false;
  }
}

async function dispatchDraft(
  delivery:
    NotificationDelivery,

  recorder:
    NotificationDeliveryRecorder,

  context:
    RecordContext,

  draft:
    NotificationDraft,
): Promise<NotificationDispatchItem> {
  try {
    const receipt =
      await delivery.send(draft);

    const deliveryRecorded =
      await recordDelivery(
        recorder,
        context,
        draft,
        {
          status: "Sent",

          providerMessageId:
            receipt.providerMessageId,

          acceptedAt:
            receipt.acceptedAt,

          errorCode: null,
        },
      );

    return {
      templateId:
        draft.templateId,

      audience:
        draft.audience,

      status: "sent",

      providerMessageId:
        receipt.providerMessageId,

      deliveryRecorded,

      errorCode: null,
    };
  } catch (error) {
    const code = errorCode(error);

    const deliveryRecorded =
      await recordDelivery(
        recorder,
        context,
        draft,
        {
          status: "Failed",

          providerMessageId: null,
          acceptedAt: null,

          errorCode: code,
        },
      );

    return {
      templateId:
        draft.templateId,

      audience:
        draft.audience,

      status: "failed",
      providerMessageId: null,
      deliveryRecorded,
      errorCode: code,
    };
  }
}

async function dispatchPlan(
  delivery:
    NotificationDelivery,

  recorder:
    NotificationDeliveryRecorder,

  context:
    RecordContext | null,

  plan:
    SubmissionNotificationPlan,
): Promise<NotificationDispatchReport> {
  if (context === null) {
    return EMPTY_REPORT;
  }

  const drafts = [
    plan.customer,
    plan.internal,
  ].filter(
    (
      draft,
    ): draft is NotificationDraft =>
      draft !== null,
  );

  if (drafts.length === 0) {
    return EMPTY_REPORT;
  }

  const items =
    await Promise.all(
      drafts.map(
        (draft) =>
          dispatchDraft(
            delivery,
            recorder,
            context,
            draft,
          ),
      ),
    );

  const sent =
    items.filter(
      ({ status }) =>
        status === "sent",
    ).length;

  return {
    attempted: items.length,
    sent,
    failed:
      items.length - sent,
    items,
  };
}

export function createSubmissionNotificationService(
  options:
    SubmissionNotificationServiceOptions,
): SubmissionNotificationService {
  return {
    async notifyQuote(
      submission,
    ): Promise<NotificationDispatchReport> {
      const context:
        RecordContext | null =
        submission.outcome ===
        "created"
          ? {
              recordType: "Quote",
              recordId:
                submission.quote.id,
            }
          : null;

      return dispatchPlan(
        options.delivery,
        options.recorder,
        context,
        createQuoteNotificationPlan(
          submission,
          options.branding,
        ),
      );
    },

    async notifyContactEnquiry(
      submission,
    ): Promise<NotificationDispatchReport> {
      const context:
        RecordContext | null =
        submission.outcome ===
        "created"
          ? {
              recordType:
                "Contact Enquiry",

              recordId:
                submission.enquiry.id,
            }
          : null;

      return dispatchPlan(
        options.delivery,
        options.recorder,
        context,
        createContactEnquiryNotificationPlan(
          submission,
          options.branding,
        ),
      );
    },
  };
}

export const NOOP_SUBMISSION_NOTIFICATION_SERVICE:
  SubmissionNotificationService = {
    async notifyQuote() {
      return EMPTY_REPORT;
    },

    async notifyContactEnquiry() {
      return EMPTY_REPORT;
    },
  };
