import type {
  ContactEnquiryRecord,
  CustomerRecord,
  PropertyRecord,
  QuoteRecord,
} from "../domain/models.js";

import type {
  NotificationDraft,
  NotificationRecipient,
} from "../ports/notifications.js";

export interface NotificationBranding {
  readonly businessName: string;

  readonly customerReplyTo:
    NotificationRecipient;

  readonly internalRecipients:
    readonly NotificationRecipient[];
}

export type QuoteNotificationSource =
  | {
      readonly outcome: "created";
      readonly customer: CustomerRecord;
      readonly property: PropertyRecord;
      readonly quote: QuoteRecord;
    }
  | {
      readonly outcome: "replayed";
      readonly quote: QuoteRecord;
    };

export type ContactEnquiryNotificationSource =
  | {
      readonly outcome: "created";
      readonly enquiry: ContactEnquiryRecord;
    }
  | {
      readonly outcome: "replayed";
      readonly enquiry: ContactEnquiryRecord;
    }
  | {
      readonly outcome: "suppressed";
      readonly enquiryNumber: string;
    };

export interface SubmissionNotificationPlan {
  readonly customer:
    NotificationDraft | null;

  readonly internal:
    NotificationDraft | null;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function escapeHtml(
  value: string,
): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function compactWhitespace(
  value: string,
): string {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

function optionalText(
  value: string | null,
): string | null {
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0
    ? trimmed
    : null;
}

function firstName(
  fullName: string,
): string {
  const compactName =
    compactWhitespace(fullName);

  return (
    compactName.split(" ", 1)[0] ??
    compactName
  );
}

function formatMoney(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  ).format(value);
}

function formatDate(
  value: string | null,
): string | null {
  if (value === null) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
    value,
  );

  if (match === null) {
    return value;
  }

  const year = match[1];
  const monthNumber = Number(match[2]);
  const dayNumber = Number(match[3]);
  const month =
    MONTH_NAMES[monthNumber - 1];

  if (
    year === undefined ||
    month === undefined ||
    !Number.isInteger(dayNumber) ||
    dayNumber < 1 ||
    dayNumber > 31
  ) {
    return value;
  }

  return `${dayNumber} ${month} ${year}`;
}

function publicQuoteStatus(
  quote: QuoteRecord,
): string {
  return quote.manualReviewRequired ||
    quote.status === "In Review"
    ? "Under review"
    : "Received";
}

function quoteEstimateText(
  quote: QuoteRecord,
): string | null {
  if (quote.estimatedTotal === null) {
    return null;
  }

  const label = quote.provisional
    ? "Estimated total (subject to review)"
    : "Estimated total";

  return `${label}: ${formatMoney(
    quote.estimatedTotal,
  )}`;
}

function quoteDepositText(
  quote: QuoteRecord,
): string | null {
  if (
    quote.requiredUpfrontAmount === null ||
    quote.requiredUpfrontPercentage === null
  ) {
    return null;
  }

  return [
    "Required upfront payment",
    `(${quote.requiredUpfrontPercentage}%)`,
    formatMoney(
      quote.requiredUpfrontAmount,
    ),
  ].join(" ");
}

interface DetailRow {
  readonly label: string;
  readonly value: string;
}

function rowsToText(
  rows: readonly DetailRow[],
): string {
  return rows
    .map(
      ({ label, value }) =>
        `${label}: ${value}`,
    )
    .join("\n");
}

function rowsToHtml(
  rows: readonly DetailRow[],
): string {
  return rows
    .map(
      ({ label, value }) =>
        [
          '<tr>',
          '<td style="padding:6px 12px 6px 0;font-weight:600;vertical-align:top;white-space:nowrap;">',
          escapeHtml(label),
          '</td>',
          '<td style="padding:6px 0;vertical-align:top;">',
          escapeHtml(value),
          '</td>',
          '</tr>',
        ].join(""),
    )
    .join("");
}

function paragraphsToHtml(
  paragraphs: readonly string[],
): string {
  return paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;line-height:1.6;">${escapeHtml(
          paragraph,
        )}</p>`,
    )
    .join("");
}

function notificationHtml(
  input: {
    readonly businessName: string;
    readonly heading: string;
    readonly paragraphs:
      readonly string[];
    readonly rows:
      readonly DetailRow[];
    readonly footer: string;
  },
): string {
  const details =
    input.rows.length > 0
      ? [
          '<table role="presentation" style="border-collapse:collapse;width:100%;margin:8px 0 24px;">',
          rowsToHtml(input.rows),
          '</table>',
        ].join("")
      : "";

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<body style="margin:0;padding:24px;background:#f6f6f6;color:#111;font-family:Arial,Helvetica,sans-serif;">',
    '<div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;padding:32px;">',
    `<div style="font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:24px;">${escapeHtml(
      input.businessName,
    )}</div>`,
    `<h1 style="font-size:24px;line-height:1.25;margin:0 0 20px;">${escapeHtml(
      input.heading,
    )}</h1>`,
    paragraphsToHtml(
      input.paragraphs,
    ),
    details,
    `<p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #e5e5e5;color:#555;font-size:13px;line-height:1.5;">${escapeHtml(
      input.footer,
    )}</p>`,
    '</div>',
    '</body>',
    '</html>',
  ].join("");
}

function recipient(
  email: string,
  name: string,
): NotificationRecipient {
  return {
    email,
    name:
      optionalText(name),
  };
}

function internalDraft(
  input: {
    readonly templateId:
      | "quote-received-internal"
      | "contact-received-internal";
    readonly idempotencyKey: string;
    readonly referenceNumber: string;
    readonly subject: string;
    readonly rows:
      readonly DetailRow[];
    readonly message: string | null;
    readonly customer:
      NotificationRecipient;
    readonly branding:
      NotificationBranding;
  },
): NotificationDraft | null {
  if (
    input.branding
      .internalRecipients.length === 0
  ) {
    return null;
  }

  const paragraphs = [
    "A new website submission has been stored successfully.",
    ...(input.message === null
      ? []
      : [
          "Customer message:",
          input.message,
        ]),
  ];

  const text = [
    input.subject,
    "",
    rowsToText(input.rows),
    ...(input.message === null
      ? []
      : [
          "",
          "Customer message:",
          input.message,
        ]),
    "",
    "Open the Wix dashboard to review the full record and take action.",
  ].join("\n");

  return {
    templateId:
      input.templateId,
    audience: "Internal",
    idempotencyKey:
      input.idempotencyKey,
    referenceNumber:
      input.referenceNumber,
    to:
      input.branding
        .internalRecipients,
    replyTo: input.customer,
    subject: input.subject,
    text,
    html: notificationHtml({
      businessName:
        input.branding
          .businessName,
      heading: input.subject,
      paragraphs,
      rows: input.rows,
      footer:
        `This operational alert contains customer information. Handle it only within approved ${input.branding.businessName} systems.`,
    }),
  };
}

function createdQuotePlan(
  submission:
    Extract<
      QuoteNotificationSource,
      { readonly outcome: "created" }
    >,
  branding:
    NotificationBranding,
): SubmissionNotificationPlan {
  const { customer, property, quote } =
    submission;

  const customerRecipient =
    recipient(
      customer.email,
      customer.fullName,
    );

  const requestedDate =
    formatDate(
      quote.preferredDate,
    );

  const customerRows: DetailRow[] = [
    {
      label: "Reference",
      value: quote.quoteNumber,
    },
    {
      label: "Service",
      value: quote.serviceType,
    },
    {
      label: "Status",
      value:
        publicQuoteStatus(quote),
    },
    ...(requestedDate === null
      ? []
      : [
          {
            label:
              "Requested date",
            value: requestedDate,
          },
        ]),
    ...(quote.arrivalWindow === null
      ? []
      : [
          {
            label:
              "Arrival window",
            value:
              quote.arrivalWindow,
          },
        ]),
    ...(quoteEstimateText(quote) === null
      ? []
      : [
          {
            label: "Estimate",
            value:
              quoteEstimateText(
                quote,
              ) ?? "",
          },
        ]),
    ...(quoteDepositText(quote) === null
      ? []
      : [
          {
            label:
              "Upfront payment",
            value:
              quoteDepositText(
                quote,
              ) ?? "",
          },
        ]),
  ];

  const customerParagraphs = [
    `Hi ${firstName(
      customer.fullName,
    )},`,
    "Thank you for contacting us. We have received your quote request and saved it under the reference below.",
    ...(quote.estimatedTotal === null
      ? [
          "Our team will review the details and prepare a tailored quote.",
        ]
      : [
          "Our team will check the scope, availability and any provisional charges before confirming the booking.",
        ]),
    "A booking is not confirmed until you receive written confirmation from us and any required upfront payment has been completed.",
  ];

  const customerSubject =
    `We’ve received your quote request — ${quote.quoteNumber}`;

  const customerDraft:
    NotificationDraft = {
      templateId:
        "quote-received-customer",
      audience: "Customer",
      idempotencyKey:
        `quote:${quote.submissionId}:customer-received`,
      referenceNumber:
        quote.quoteNumber,
      to: [customerRecipient],
      replyTo:
        branding.customerReplyTo,
      subject: customerSubject,
      text: [
        customerSubject,
        "",
        ...customerParagraphs,
        "",
        rowsToText(
          customerRows,
        ),
        "",
        `Regards,\n${branding.businessName}`,
      ].join("\n"),
      html: notificationHtml({
        businessName:
          branding.businessName,
        heading:
          "Quote request received",
        paragraphs:
          customerParagraphs,
        rows: customerRows,
        footer:
          `Regards, ${branding.businessName}`,
      }),
    };

  const internalRows: DetailRow[] = [
    {
      label: "Reference",
      value: quote.quoteNumber,
    },
    {
      label: "Customer",
      value: customer.fullName,
    },
    ...(customer.companyName === null
      ? []
      : [
          {
            label: "Company",
            value:
              customer.companyName,
          },
        ]),
    {
      label: "Email",
      value: customer.email,
    },
    {
      label: "Phone",
      value: customer.phone,
    },
    {
      label:
        "Preferred contact",
      value:
        quote.preferredContactMethod,
    },
    {
      label: "Category",
      value: quote.category,
    },
    {
      label: "Service",
      value: quote.serviceType,
    },
    ...(quote.cleaningScope === null
      ? []
      : [
          {
            label: "Scope",
            value:
              quote.cleaningScope,
          },
        ]),
    {
      label: "Property",
      value:
        `${property.address}, ${property.postcode}`,
    },
    ...(property.bedroomCount === null
      ? []
      : [
          {
            label: "Bedrooms",
            value: String(
              property.bedroomCount,
            ),
          },
        ]),
    ...(property.bathroomCount === null
      ? []
      : [
          {
            label: "Bathrooms",
            value: String(
              property.bathroomCount,
            ),
          },
        ]),
    ...(requestedDate === null
      ? []
      : [
          {
            label:
              "Requested date",
            value: requestedDate,
          },
        ]),
    ...(quote.arrivalWindow === null
      ? []
      : [
          {
            label:
              "Arrival window",
            value:
              quote.arrivalWindow,
          },
        ]),
    ...(quote.arrangement === null
      ? []
      : [
          {
            label:
              "Arrangement",
            value:
              quote.arrangement,
          },
        ]),
    ...(quote.frequency === null
      ? []
      : [
          {
            label: "Frequency",
            value:
              quote.frequency,
          },
        ]),
    ...(quote.urgency === null
      ? []
      : [
          {
            label: "Urgency",
            value: quote.urgency,
          },
        ]),
    ...(quote.supportServices.length === 0
      ? []
      : [
          {
            label:
              "Support services",
            value:
              quote.supportServices.join(
                ", ",
              ),
          },
        ]),
    {
      label: "Review",
      value:
        quote.manualReviewRequired
          ? "Required"
          : "Not required",
    },
    ...(quote.estimatedTotal === null
      ? []
      : [
          {
            label:
              quote.provisional
                ? "Provisional total"
                : "Estimated total",
            value: formatMoney(
              quote.estimatedTotal,
            ),
          },
        ]),
  ];

  return {
    customer: customerDraft,
    internal: internalDraft({
      templateId:
        "quote-received-internal",
      idempotencyKey:
        `quote:${quote.submissionId}:internal-received`,
      referenceNumber:
        quote.quoteNumber,
      subject:
        `[New quote] ${quote.quoteNumber} — ${quote.serviceType}`,
      rows: internalRows,
      message:
        optionalText(
          quote.customerNotes,
        ),
      customer:
        customerRecipient,
      branding,
    }),
  };
}

function createdContactPlan(
  submission:
    Extract<
      ContactEnquiryNotificationSource,
      { readonly outcome: "created" }
    >,
  branding:
    NotificationBranding,
): SubmissionNotificationPlan {
  const { enquiry } = submission;

  const customerRecipient =
    recipient(
      enquiry.email,
      enquiry.fullName,
    );

  const customerRows:
    DetailRow[] = [
      {
        label: "Reference",
        value:
          enquiry.enquiryNumber,
      },
      {
        label: "Enquiry type",
        value: enquiry.enquiryType,
      },
      {
        label:
          "Preferred contact",
        value:
          enquiry.preferredContactMethod,
      },
    ];

  const customerSubject =
    `We’ve received your enquiry — ${enquiry.enquiryNumber}`;

  const customerParagraphs = [
    `Hi ${firstName(
      enquiry.fullName,
    )},`,
    "Thank you for getting in touch. Your enquiry has been received and saved under the reference below.",
    "A member of our team will review it and respond using your preferred contact method.",
  ];

  const customerDraft:
    NotificationDraft = {
      templateId:
        "contact-received-customer",
      audience: "Customer",
      idempotencyKey:
        `contact:${enquiry.submissionId}:customer-received`,
      referenceNumber:
        enquiry.enquiryNumber,
      to: [customerRecipient],
      replyTo:
        branding.customerReplyTo,
      subject: customerSubject,
      text: [
        customerSubject,
        "",
        ...customerParagraphs,
        "",
        rowsToText(
          customerRows,
        ),
        "",
        `Regards,\n${branding.businessName}`,
      ].join("\n"),
      html: notificationHtml({
        businessName:
          branding.businessName,
        heading:
          "Enquiry received",
        paragraphs:
          customerParagraphs,
        rows: customerRows,
        footer:
          `Regards, ${branding.businessName}`,
      }),
    };

  const internalRows: DetailRow[] = [
    {
      label: "Reference",
      value:
        enquiry.enquiryNumber,
    },
    {
      label: "Customer",
      value: enquiry.fullName,
    },
    {
      label: "Email",
      value: enquiry.email,
    },
    ...(enquiry.phone.length === 0
      ? []
      : [
          {
            label: "Phone",
            value: enquiry.phone,
          },
        ]),
    {
      label: "Enquiry type",
      value: enquiry.enquiryType,
    },
    {
      label:
        "Preferred contact",
      value:
        enquiry.preferredContactMethod,
    },
    {
      label: "Attachments",
      value: String(
        enquiry.attachmentCount,
      ),
    },
  ];

  return {
    customer: customerDraft,
    internal: internalDraft({
      templateId:
        "contact-received-internal",
      idempotencyKey:
        `contact:${enquiry.submissionId}:internal-received`,
      referenceNumber:
        enquiry.enquiryNumber,
      subject:
        `[New enquiry] ${enquiry.enquiryNumber} — ${enquiry.enquiryType}`,
      rows: internalRows,
      message: enquiry.message,
      customer:
        customerRecipient,
      branding,
    }),
  };
}

export function createQuoteNotificationPlan(
  submission:
    QuoteNotificationSource,
  branding:
    NotificationBranding,
): SubmissionNotificationPlan {
  if (
    submission.outcome !== "created"
  ) {
    return {
      customer: null,
      internal: null,
    };
  }

  return createdQuotePlan(
    submission,
    branding,
  );
}

export function createContactEnquiryNotificationPlan(
  submission:
    ContactEnquiryNotificationSource,
  branding:
    NotificationBranding,
): SubmissionNotificationPlan {
  if (
    submission.outcome !== "created"
  ) {
    return {
      customer: null,
      internal: null,
    };
  }

  return createdContactPlan(
    submission,
    branding,
  );
}
