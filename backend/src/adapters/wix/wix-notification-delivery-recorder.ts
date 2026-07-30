import type {
  NotificationDeliveryRecord,
  NotificationDeliveryRecorder,
} from "../../ports/notifications.js";

import type {
  StatusHistoryRepository,
} from "../../ports/repositories.js";

export class WixNotificationDeliveryRecorder
  implements NotificationDeliveryRecorder
{
  constructor(
    private readonly repository:
      StatusHistoryRepository,
  ) {}

  async record(
    delivery:
      NotificationDeliveryRecord,
  ): Promise<void> {
    const sent =
      delivery.status === "Sent";

    await this.repository.create({
      historyLabel:
        `${delivery.referenceNumber} - ${delivery.templateId} - ${delivery.status}`,

      quoteId:
        delivery.recordType ===
        "Quote"
          ? delivery.recordId
          : null,

      contactEnquiryId:
        delivery.recordType ===
        "Contact Enquiry"
          ? delivery.recordId
          : null,

      recordType:
        delivery.recordType,

      previousStatus: null,

      newStatus:
        sent
          ? "Email Sent"
          : "Email Failed",

      changeSource:
        "Notification Service",

      actorType: "System",
      actorId: null,

      actorName:
        "Clean Up Central Notifications",

      changeReason:
        sent
          ? "Transactional email accepted by the configured provider."
          : "Transactional email could not be delivered to the configured provider.",

      customerVisible: false,
      notes: null,

      metadata: {
        templateId:
          delivery.templateId,

        audience:
          delivery.audience,

        idempotencyKey:
          delivery.idempotencyKey,

        providerMessageId:
          delivery.providerMessageId,

        acceptedAt:
          delivery.acceptedAt,

        errorCode:
          delivery.errorCode,
      },
    });
  }
}
