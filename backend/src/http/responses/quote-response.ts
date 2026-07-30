import type {
  QuoteRecord,
} from "../../domain/models.js";

import type {
  ArrivalWindow,
  CleaningScope,
  QuoteCategory,
  QuoteStatus,
} from "../../domain/quote-values.js";

export interface PublicQuoteResponseSource {
  readonly outcome:
    | "created"
    | "replayed";
  readonly quote: QuoteRecord;
}

export interface PublicQuoteService {
  readonly category: QuoteCategory;
  readonly serviceType: string;
  readonly cleaningScope:
    CleaningScope | null;
}

export interface PublicQuoteAppointment {
  readonly preferredDate:
    string | null;
  readonly arrivalWindow:
    ArrivalWindow | null;
  readonly sameDay: boolean;
}

export interface PublicQuoteEstimate {
  readonly currency: "GBP";
  readonly estimatedTotal: number;
  readonly requiredUpfrontPercentage:
    number | null;
  readonly requiredUpfrontAmount:
    number | null;
  readonly remainingBalance:
    number | null;
  readonly provisional: boolean;
}

export interface PublicQuoteConfirmation {
  readonly quoteNumber: string;
  readonly status: QuoteStatus;
  readonly message: string;
  readonly service: PublicQuoteService;
  readonly appointment:
    PublicQuoteAppointment;
  readonly estimate:
    PublicQuoteEstimate | null;
}

export interface PublicQuoteSuccessResponse {
  readonly success: true;
  readonly replayed: boolean;
  readonly confirmation:
    PublicQuoteConfirmation;
  readonly requestId: string;
}

function customerMessage(
  status: QuoteStatus,
): string {
  switch (status) {
    case "Submitted":
      return "Your quote request has been received.";

    case "In Review":
      return "Your quote request has been received and is being reviewed.";

    case "More Information Required":
      return "We need a little more information before we can confirm your quote.";

    case "Revised":
      return "Your quote has been updated.";

    case "Approved":
      return "Your quote has been approved.";

    case "Rejected":
      return "We are unable to approve this quote request.";

    case "Converted to Booking":
      return "Your quote has been converted into a booking.";
  }
}

function publicEstimate(
  quote: QuoteRecord,
): PublicQuoteEstimate | null {
  if (
    quote.estimatedTotal === null
  ) {
    return null;
  }

  return {
    currency: "GBP",
    estimatedTotal:
      quote.estimatedTotal,
    requiredUpfrontPercentage:
      quote.requiredUpfrontPercentage,
    requiredUpfrontAmount:
      quote.requiredUpfrontAmount,
    remainingBalance:
      quote.remainingBalance,
    provisional:
      quote.provisional ||
      quote.travelPending,
  };
}

export function createPublicQuoteResponse(
  persisted:
    PublicQuoteResponseSource,
  requestId: string,
): PublicQuoteSuccessResponse {
  const quote = persisted.quote;

  return {
    success: true,
    replayed:
      persisted.outcome ===
      "replayed",

    confirmation: {
      quoteNumber:
        quote.quoteNumber,
      status: quote.status,
      message:
        customerMessage(
          quote.status,
        ),

      service: {
        category: quote.category,
        serviceType:
          quote.serviceType,
        cleaningScope:
          quote.cleaningScope,
      },

      appointment: {
        preferredDate:
          quote.preferredDate,
        arrivalWindow:
          quote.arrivalWindow,
        sameDay: quote.sameDay,
      },

      estimate:
        publicEstimate(quote),
    },

    requestId,
  };
}
