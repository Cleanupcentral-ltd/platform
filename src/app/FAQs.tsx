import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Menu, Minus, Plus, X } from "lucide-react";
import { Link } from "react-router";
import horizontalFullColour from "@/imports/IMG_1776556945431__2_.png";
import {
  useFaqs,
  usePageSection,
  useSiteSetting,
} from "@/cms/CmsProvider";

const navigation = [
  ["Home", "/home"],
  ["About", "/about"],
  ["Cleaning Services", "/cleaning-services"],
  ["Property Support", "/property-support"],
  ["Contact Us", "/contact"],
] as const;

interface FaqQuestion {
  id: string;
  question: string;
  answer: string;
}

interface FaqCategory {
  name: string;
  questions: FaqQuestion[];
}

const fallbackCategories: FaqCategory[] = [
  {
    name: "Quotes & Bookings",
    questions: [
      {
        id: "faq.quotes.process",
        question: "How does the quote process work?",
        answer:
          "For eligible Standard, Deep and Airbnb services, our quote generator gives you an indication of the expected price based on the information you enter. Your estimate is then submitted to our team for review. Our team will review the information provided, confirm availability and approve the quote. A booking is only confirmed after the quote has been approved and the required upfront payment has been received.",
      },
      {
        id: "faq.quotes.custom",
        question: "Which services require a custom quote?",
        answer:
          "End of Tenancy Cleaning, Commercial Cleaning and Property Support are quoted individually. This allows us to consider the property, condition, access arrangements, schedule and exact service requirements before confirming an accurate price.",
      },
      {
        id: "faq.quotes.upfront_payment",
        question: "Do you require an upfront payment?",
        answer:
          "Yes. Once your quote has been approved, a 30% upfront payment is normally required to secure the booking. The remaining balance and payment terms will be clearly shown before you proceed.",
      },
    ],
  },
  {
    name: "Cleaning Services",
    questions: [
      {
        id: "faq.cleaning.service_differences",
        question:
          "What is the difference between a Standard Clean, Deep Clean and End of Tenancy Clean?",
        answer:
          "A Standard Clean is designed for routine upkeep in a property that is already in a reasonable condition. A Deep Clean provides more detailed, restorative cleaning for areas requiring additional attention. An End of Tenancy Clean is a comprehensive, individually assessed service intended to prepare a property for inspection or its next occupant.",
      },
      {
        id: "faq.cleaning.selected_rooms",
        question: "Can I book cleaning for selected rooms only?",
        answer:
          "Yes. Standard and Deep Cleaning can be requested for selected bedrooms, bathrooms, kitchens, living rooms and hallways or stairs. You can choose multiple rooms and quantities through the quote generator. End of Tenancy Cleaning is assessed as a complete service and does not use the selected-room option.",
      },
      {
        id: "faq.cleaning.airbnb_turnover",
        question: "What is included in an Airbnb turnover?",
        answer:
          "Our Airbnb turnover service can include guest-ready cleaning, bed changes using linen supplied by the client, bin handling, basic presentation checks and key or lockbox checks where agreed. Laundry, restocking and other extras can be requested separately. We do not provide guest management, repairs or linen hire.",
      },
      {
        id: "faq.cleaning.equipment",
        question: "Do I need to provide cleaning equipment?",
        answer:
          "Equipment arrangements will be confirmed before the service. To reduce cross-contamination between properties, we prefer customers to provide a suitable vacuum and mop where possible. Please tell us in advance if this is not available so that we can agree the correct arrangement.",
      },
    ],
  },
  {
    name: "Property Support",
    questions: [
      {
        id: "faq.property_support.includes",
        question: "What does Property Support include?",
        answer:
          "Our Property Support services include secure key holding, property inspections, contractor access visits, inventory checks, emergency attendance and practical support for landlords, owners, hosts, agents and businesses. We do not provide full property management, rent collection, maintenance work or tenant-dispute management.",
      },
      {
        id: "faq.property_support.key_holding",
        question: "How does your key-holding service work?",
        answer:
          "Keys are securely registered using a unique reference, stored without displaying the property address and released only for authorised access. Collections, returns and access activity are recorded. Key holding does not give Clean Up Central unrestricted authority over the property or replace a security or locksmith service.",
      },
      {
        id: "faq.property_support.emergency_attendance",
        question: "What does emergency attendance cover?",
        answer:
          "Where it is safe and we have availability, we can attend the property, assess the visible situation, take photographs, report what we find and assist with authorised access. Emergency attendance does not include repairs, plumbing, electrical work or a guaranteed emergency-response time. Emergency services or qualified tradespeople may still be required.",
      },
    ],
  },
  {
    name: "Policies & Preparation",
    questions: [
      {
        id: "faq.policies.travel",
        question: "Do you charge for travel, parking or congestion?",
        answer:
          "Travel within the included service radius does not attract an additional travel fee. Requests beyond that area may include a distance-based charge. Parking and congestion costs are passed on at cost and shown separately where applicable.",
      },
      {
        id: "faq.policies.cancellation",
        question: "What happens if I need to cancel?",
        answer:
          "More than 48 hours’ notice normally carries no cancellation charge. Cancellations made 24–48 hours before the service may be charged at 50%, while cancellations with less than 24 hours’ notice may be charged at the full booking value.",
      },
      {
        id: "faq.policies.quality_concerns",
        question: "What should I do if I am unhappy with the service?",
        answer:
          "Please contact us within 24 hours and provide photographs or other supporting information where requested. We will review the concern fairly. Where a quality issue is verified, a re-clean is our primary remedy; refunds are not issued automatically.",
      },
    ],
  },
];

function valueOrFallback(
  value: string | undefined,
  fallback: string,
) {
  return value?.trim() || fallback;
}

function toPanelId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function Logo() {
  return (
    <span className="block h-10 w-[145px] overflow-hidden sm:h-11 sm:w-[180px]">
      <img
        src={horizontalFullColour}
        className="size-full scale-[1.65] object-contain"
        alt="Clean Up Central"
      />
    </span>
  );
}

function GoldButton({
  children,
  full = false,
}: {
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <span
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-[4px] bg-[#B08A3C] px-5 text-[11px] font-bold uppercase tracking-[.08em] text-white shadow-[inset_0_-1px_0_rgba(18,18,18,.25)] transition duration-[var(--motion-standard)] ease-[var(--ease-out)] hover:bg-[#7A5A1E] ${full ? "w-full" : ""}`}
    >
      {children}
      <ArrowRight size={16} strokeWidth={1.75} />
    </span>
  );
}

// Wix destination: /faqs
export default function FAQsPage() {
  const [drawer, setDrawer] = useState(false);
  const [activeCategoryName, setActiveCategoryName] = useState(
    fallbackCategories[0].name,
  );
  const [openQuestion, setOpenQuestion] = useState(0);

  const cmsFaqs = useFaqs();
  const hero = usePageSection("faqs.hero");
  const finalCta = usePageSection("faqs.final-cta");
  const businessTagline = useSiteSetting("business.tagline");
  const copyright = useSiteSetting("legal.copyright");

  const cmsCategories = useMemo(() => {
    const groupedFaqs = new Map<string, FaqQuestion[]>();

    cmsFaqs.forEach((faq, index) => {
      const category = faq.category?.trim();
      const question = faq.question?.trim();
      const answer = faq.answer?.trim();

      if (!category || !question || !answer) return;

      const questions = groupedFaqs.get(category) ?? [];
      questions.push({
        id: faq._id || faq.title || `${category}-${index}`,
        question,
        answer,
      });
      groupedFaqs.set(category, questions);
    });

    return Array.from(groupedFaqs, ([name, questions]) => ({
      name,
      questions,
    }));
  }, [cmsFaqs]);

  const categories =
    cmsCategories.length > 0 ? cmsCategories : fallbackCategories;

  const active =
    categories.find(
      (category) => category.name === activeCategoryName,
    ) ?? categories[0];

  const heroContent = hero ?? {
    eyebrow: "Help & Guidance",
    heading: "FAQs",
    body: "Find helpful information about our cleaning services, property support, quotes and bookings.",
  };

  const ctaContent = finalCta ?? {
    eyebrow: "Support",
    heading: "Still need help?",
    body: "If your question is not answered here, our team will be happy to help.",
    primaryCtaText: "Contact Us",
    primaryCtaLink: "/contact",
    secondaryCtaText: "Get a Quote",
    secondaryCtaLink: "/quote",
  };

  return (
    <main className="min-h-screen bg-[#FAF9F6] font-sans text-[#121212]">
      <header className="sticky top-0 z-30 border-b border-[#D8D5CF] bg-white/95 backdrop-blur">
        <div className="relative mx-auto flex h-[68px] max-w-[1440px] items-center justify-between px-5 sm:h-20 sm:px-10 lg:px-16">
          <Link to="/home" aria-label="Clean Up Central home">
            <Logo />
          </Link>
          <nav className="absolute left-1/2 hidden h-full -translate-x-1/2 items-center gap-6 lg:flex">
            {navigation.map(([label, to]) => (
              <Link
                key={label}
                to={to}
                className="flex h-full items-center border-b-2 border-transparent text-[10px] font-bold uppercase tracking-[.09em] text-[#66635E] transition duration-[var(--motion-standard)] ease-[var(--ease-out)] hover:text-[#121212]"
              >
                {label}
              </Link>
            ))}
          </nav>
          <Link className="hidden lg:block" to="/quote">
            <GoldButton>Get a Quote</GoldButton>
          </Link>
          <button
            className="grid size-11 place-items-center border border-[#D8D5CF] lg:hidden"
            onClick={() => setDrawer(!drawer)}
            aria-label="Toggle navigation"
          >
            {drawer ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {drawer && (
          <div className="border-t border-[#D8D5CF] bg-white px-5 pb-5 lg:hidden">
            {navigation.map(([label, to]) => (
              <Link
                onClick={() => setDrawer(false)}
                key={label}
                to={to}
                className="block border-b border-[#D8D5CF] py-4 text-xs font-bold uppercase tracking-[.1em]"
              >
                {label}
              </Link>
            ))}
            <Link
              onClick={() => setDrawer(false)}
              className="mt-4 block"
              to="/quote"
            >
              <GoldButton full>Get a Quote</GoldButton>
            </Link>
          </div>
        )}
      </header>

      <section className="border-b border-[#D8D5CF] bg-white">
        <div className="mx-auto max-w-[1280px] px-5 py-18 sm:px-10 sm:py-24 lg:px-0">
          <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#66635E]">
            {valueOrFallback(
              heroContent.eyebrow,
              "Help & Guidance",
            )}
          </p>
          <h1 className="mt-6 max-w-3xl font-serif text-[52px] font-medium leading-[.94] tracking-[-.035em] sm:text-[72px]">
            {valueOrFallback(heroContent.heading, "FAQs")}
          </h1>
          <p className="mt-6 max-w-xl text-[16px] leading-7 text-[#4E4B45] sm:text-[18px]">
            {valueOrFallback(
              heroContent.body,
              "Find helpful information about our cleaning services, property support, quotes and bookings.",
            )}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-5 py-14 sm:px-10 sm:py-20 lg:px-0">
        <div className="border-y border-[#D8D5CF] py-4">
          <div
            className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible"
            role="tablist"
            aria-label="FAQ categories"
          >
            {categories.map((category) => {
              const isActive = active.name === category.name;

              return (
                <button
                  key={category.name}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    setActiveCategoryName(category.name);
                    setOpenQuestion(0);
                  }}
                  className={`shrink-0 border px-4 py-3 text-[13px] font-semibold uppercase tracking-[.03em] transition duration-[var(--motion-standard)] ease-[var(--ease-out)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B08A3C] focus-visible:ring-offset-2 sm:text-sm ${
                    isActive
                      ? "border-[#B08A3C] bg-[#B08A3C] text-white"
                      : "border-[#D8D5CF] bg-white text-[#121212] hover:border-[#66635E]"
                  }`}
                >
                  {category.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-12 border-t border-[#D8D5CF] sm:mt-14">
          {active.questions.map(({ id, question, answer }, index) => {
            const isOpen = openQuestion === index;
            const panelId = `faq-panel-${toPanelId(active.name)}-${index}`;
            const buttonId = `faq-button-${toPanelId(active.name)}-${index}`;

            return (
              <article key={id} className="border-b border-[#D8D5CF]">
                <h2>
                  <button
                    id={buttonId}
                    type="button"
                    className="flex w-full items-start justify-between gap-6 px-0 py-5 text-left transition duration-[var(--motion-standard)] ease-[var(--ease-out)] hover:text-[#7A5A1E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B08A3C] focus-visible:ring-offset-4 sm:py-8"
                    onClick={() =>
                      setOpenQuestion(isOpen ? -1 : index)
                    }
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                  >
                    <span className="max-w-4xl font-sans text-[18px] font-medium leading-[1.3] tracking-normal sm:text-[25px]">
                      {question}
                    </span>
                    <span
                      className={`mt-0.5 grid size-7 shrink-0 place-items-center transition duration-[var(--motion-standard)] ease-[var(--ease-out)] ${
                        isOpen
                          ? "text-[#B08A3C]"
                          : "text-[#66635E]"
                      }`}
                    >
                      {isOpen ? (
                        <Minus size={17} strokeWidth={1.75} />
                      ) : (
                        <Plus size={17} strokeWidth={1.75} />
                      )}
                    </span>
                  </button>
                </h2>
                {isOpen && (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className="max-w-3xl pb-6 pr-10 text-[14px] leading-6 text-[#4E4B45] sm:pb-8 sm:text-[15px]"
                  >
                    {answer}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-y border-[#D8D5CF] bg-[#F1EDE4]">
        <div className="mx-auto flex max-w-[1280px] flex-col justify-between gap-8 px-5 py-12 sm:px-10 lg:flex-row lg:items-end lg:px-0 lg:py-16">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#66635E]">
              {valueOrFallback(ctaContent.eyebrow, "Support")}
            </p>
            <h2 className="mt-5 font-serif text-[42px] leading-[.96] tracking-[-.03em] sm:text-[56px]">
              {valueOrFallback(
                ctaContent.heading,
                "Still need help?",
              )}
            </h2>
            <p className="mt-5 max-w-md text-[16px] leading-7 text-[#66635E]">
              {valueOrFallback(
                ctaContent.body,
                "If your question is not answered here, our team will be happy to help.",
              )}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to={valueOrFallback(
                ctaContent.primaryCtaLink,
                "/contact",
              )}
            >
              <GoldButton>
                {valueOrFallback(
                  ctaContent.primaryCtaText,
                  "Contact Us",
                )}
              </GoldButton>
            </Link>
            <Link
              to={valueOrFallback(
                ctaContent.secondaryCtaLink,
                "/quote",
              )}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[4px] border border-[#121212] bg-transparent px-5 text-[11px] font-bold uppercase tracking-[.08em] transition duration-[var(--motion-standard)] ease-[var(--ease-out)] hover:bg-white"
            >
              {valueOrFallback(
                ctaContent.secondaryCtaText,
                "Get a Quote",
              )}
              <ArrowRight size={16} strokeWidth={1.75} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-b border-[#D8D5CF] bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-16">
          <Logo />
          <p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#66635E]">
            {valueOrFallback(
              businessTagline?.value,
              "Professional cleaning and considered property support across London.",
            )}
          </p>
        </div>
        <div className="border-t border-[#D8D5CF] px-5 py-4 text-[10px] font-bold uppercase tracking-[.1em] text-[#66635E] sm:px-10 lg:px-16">
          {valueOrFallback(
            copyright?.value,
            "© 2026 Clean Up Central Ltd. All rights reserved.",
          )}
        </div>
      </footer>
    </main>
  );
}