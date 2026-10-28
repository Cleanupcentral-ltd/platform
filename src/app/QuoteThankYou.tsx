import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Link, Navigate, useLocation } from "react-router";
import horizontalFullColour from "@/imports/IMG_1776556945431__2_.png";

type ConfirmationState = {
  confirmed?: boolean;
  quoteNumber?: string;
};

/**
 * The website uses hash routing. A successful quote submission navigates to
 * /#/quote/thank-you with ephemeral router state; manually visiting or sharing
 * this URL cannot display a successful submission.
 *
 * Google Ads/GA4 must count the confirmed generate_lead event, NOT every
 * visit or page_view at this route (hash-based SPA navigation can be missed,
 * reloaded or opened manually).
 */
export default function QuoteThankYouPage() {
  const location = useLocation();
  const state = location.state as ConfirmationState | null;
  const quoteNumber =
    typeof state?.quoteNumber === "string"
      ? state.quoteNumber.trim()
      : "";

  if (state?.confirmed !== true || !quoteNumber) {
    return <Navigate to="/quote" replace />;
  }

  return (
    <main className="min-h-screen bg-[#FAF9F6] font-sans text-[#121212]">
      <header className="border-b border-[#D8D5CF] bg-white">
        <div className="mx-auto flex min-h-[76px] max-w-[1240px] items-center justify-between px-5 sm:px-10">
          <Link to="/home" aria-label="Clean Up Central home">
            <span className="block h-10 w-[145px] overflow-hidden sm:h-11 sm:w-[180px]">
              <img src={horizontalFullColour} className="size-full scale-[1.65] object-contain" alt="Clean Up Central" />
            </span>
          </Link>
          <Link to="/home" className="text-xs font-bold uppercase tracking-[.08em] text-[#343434] hover:text-[#7A5A1E]">
            Return Home
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-5 pb-24 pt-20 text-center sm:px-10 sm:pt-28">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#176B45] text-white">
          <CheckCircle2 size={32} aria-hidden="true" />
        </span>
        <p className="mt-8 text-xs font-bold uppercase tracking-[.18em] text-[#7A5A1E]">
          Request received
        </p>
        <h1 className="mt-4 font-serif text-[42px] leading-[1.05] tracking-[-.03em] sm:text-[56px]">
          Thank you for your enquiry.
        </h1>
        <p className="mx-auto mt-6 max-w-lg text-base leading-7 text-[#66635E]">
          Your quote request has been successfully submitted. Our team will review
          the details and contact you about the next steps.
        </p>

        <div className="mt-9 border border-[#D8D5CF] bg-white px-6 py-8 text-left sm:px-9">
          <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#66635E]">
            Your quote reference
          </p>
          <p className="mt-2 break-words font-serif text-[28px] text-[#121212]">
            {quoteNumber}
          </p>
          <p className="mt-5 text-sm leading-6 text-[#66635E]">
            This is confirmation of your enquiry, not a confirmed booking.
            We'll be in touch after reviewing your request.
          </p>
        </div>

        <Link
          to="/home"
          className="mt-8 inline-flex min-h-12 items-center justify-center gap-3 rounded-[4px] bg-[#B08A3C] px-6 text-xs font-bold uppercase tracking-[.08em] text-white hover:bg-[#7A5A1E]"
        >
          Back to Home
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
