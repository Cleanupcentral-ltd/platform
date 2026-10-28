import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  DoorOpen,
  KeyRound,
  Menu,
  Phone,
  ScanSearch,
  X,
} from "lucide-react";
import { Link } from "react-router";
import horizontalFullColour from "@/imports/IMG_1776556945431__2_.png";
import {
  useCms,
  usePageSection,
  usePageSections,
  useSiteSetting,
} from "@/cms/CmsProvider";
import { resolveCmsImage } from "@/cms/cmsMedia";
import type { PageSection } from "@/cms/cmsTypes";

const heroImage =
  "https://images.unsplash.com/photo-1677951570313-b0750351c461?w=1400&h=1000&fit=crop&auto=format";

const navigation = [
  ["Home", "/home"],
  ["About", "/about"],
  ["Cleaning Services", "/cleaning-services"],
  ["Commercial Cleaning", "/commercial-cleaning"],
  ["Property Support", "/property-support"],
  ["Contact Us", "/contact"],
] as const;

const fallbackSupportItems: PageSection[] = [
  {
    title: "property-support.services.key-holding",
    heading: "Key Holding",
    body: "Secure key storage and controlled access procedures.",
  },
  {
    title: "property-support.services.property-inspection",
    heading: "Property Inspection",
    body: "Factual property checks with notes and photos.",
  },
  {
    title: "property-support.services.contractor-access",
    heading: "Contractor Access",
    body: "Secure entry and exit for approved contractors or trades.",
  },
  {
    title: "property-support.services.inventory-check",
    heading: "Inventory Check",
    body: "Check contents and condition and report changes with photos.",
  },
  {
    title: "property-support.services.emergency-attendance",
    heading: "Emergency Attendance",
    body: "Urgent attendance subject to availability; do not imply guaranteed emergency response.",
  },
  {
    title: "property-support.services.airbnb-host-support",
    heading: "Airbnb Host Support",
    body: "Pre-arrival checks, post-stay inspection and host updates.",
  },
];

type SupportIcon = typeof KeyRound;

const supportIcons: Record<string, SupportIcon> = {
  "property-support.services.key-holding": KeyRound,
  "property-support.services.property-inspection": ScanSearch,
  "property-support.services.contractor-access": DoorOpen,
  "property-support.services.inventory-check": ClipboardCheck,
  "property-support.services.emergency-attendance": Phone,
  "property-support.services.airbnb-host-support": Building2,
};

function valueOrFallback(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function fallbackFor(item: PageSection, index: number) {
  return (
    fallbackSupportItems.find(
      (fallback) => fallback.title === item.title,
    ) ??
    fallbackSupportItems[index] ??
    {}
  );
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

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#66635E]">
      {children}
    </p>
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

export default function PropertySupportPage() {
  const [drawer, setDrawer] = useState(false);
  const { loading, error } = useCms();
  const useFallbacks = loading || Boolean(error);

  const hero = usePageSection("property-support.hero");
  const servicesIntro = usePageSection(
    "property-support.services.intro",
  );
  const finalCta = usePageSection("property-support.final-cta");

  const cmsSupportItems = usePageSections(
    "Property Support",
    "Services",
  ).filter((item) => item.contentType === "Service Card");

  const supportItems = useFallbacks
    ? fallbackSupportItems
    : cmsSupportItems;

  const businessTagline = useSiteSetting("business.tagline");
  const serviceArea = useSiteSetting("contact.service_area");
  const phone = useSiteSetting("contact.phone");
  const email = useSiteSetting("contact.email");
  const copyright = useSiteSetting("legal.copyright");

  const heroContent = hero ?? {
    eyebrow: "Property Support",
    heading: "Support that keeps everything running smoothly.",
    body: "Practical support for key holding, inspections, access and attendance—so important details are handled with care.",
    supportingText: "Observe. Document. Report.",
    image: heroImage,
    imageAltText: "Secure key and property access detail",
    primaryCtaText: "Request a Custom Quote",
    primaryCtaLink: "/quote?service=property-support",
  };

  const servicesIntroContent = servicesIntro ?? {
    eyebrow: "Our Property Support Services",
    heading: "Support built around the details.",
  };

  const finalCtaContent = finalCta ?? {
    heading:
      "Need something not listed? Get in touch and we’ll see how we can help.",
    primaryCtaText: "Get in touch",
    primaryCtaLink: "/contact",
  };

  const contactLines = [
    phone?.value?.trim(),
    email?.value?.trim(),
    serviceArea?.value?.trim(),
  ].filter((line): line is string => Boolean(line));

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
                className={`flex h-full items-center border-b-2 text-[10px] font-bold uppercase tracking-[.09em] transition duration-[var(--motion-standard)] ease-[var(--ease-out)] ${to === "/property-support" ? "border-[#B08A3C] text-[#121212]" : "border-transparent text-[#66635E] hover:text-[#121212]"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <Link
            className="hidden lg:block"
            to="/quote?service=property-support"
          >
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
          <div className="border-t border-[#D8D5CF] bg-white px-5 pb-5 transition duration-[var(--motion-slow)] ease-[var(--ease-in-out)] lg:hidden">
            {navigation.map(([label, to]) => (
              <Link
                onClick={() => setDrawer(false)}
                key={label}
                to={to}
                className={`block border-b border-[#D8D5CF] py-4 text-xs font-bold uppercase tracking-[.1em] ${to === "/property-support" ? "text-[#B08A3C]" : ""}`}
              >
                {label}
              </Link>
            ))}
            <Link
              onClick={() => setDrawer(false)}
              className="mt-4 block"
              to="/quote?service=property-support"
            >
              <GoldButton full>Get a Quote</GoldButton>
            </Link>
          </div>
        )}
      </header>

      {(useFallbacks || hero) && (
        <section className="mx-auto grid max-w-[1440px] border-b border-[#D8D5CF] lg:grid-cols-2">
          <div className="flex flex-col justify-center px-5 py-16 sm:px-10 lg:min-h-[540px] lg:pl-20 lg:pr-16">
            <Eyebrow>
              {valueOrFallback(heroContent.eyebrow, "Property Support")}
            </Eyebrow>
            <h1 className="mt-6 max-w-xl font-serif text-[50px] font-medium leading-[.96] tracking-[-.035em] sm:text-[60px] lg:text-[66px]">
              {valueOrFallback(
                heroContent.heading,
                "Support that keeps everything running smoothly.",
              )}
            </h1>
            <p className="mt-6 max-w-md text-[16px] leading-7 text-[#343434]">
              {valueOrFallback(
                heroContent.body,
                "Practical support for key holding, inspections, access and attendance—so important details are handled with care.",
              )}
            </p>
            <p className="mt-5 text-[11px] font-bold uppercase tracking-[.13em] text-[#B08A3C]">
              {valueOrFallback(
                heroContent.supportingText,
                "Observe. Document. Report.",
              )}
            </p>
            <Link
              className="mt-8"
              to={valueOrFallback(
                heroContent.primaryCtaLink,
                "/quote?service=property-support",
              )}
            >
              <GoldButton>
                {valueOrFallback(
                  heroContent.primaryCtaText,
                  "Request a Custom Quote",
                )}
              </GoldButton>
            </Link>
          </div>
          <div className="min-h-[330px] sm:min-h-[460px] lg:min-h-[540px]">
            <img
              src={resolveCmsImage(heroContent.image, heroImage)}
              alt={valueOrFallback(
                heroContent.imageAltText,
                "Secure key and property access detail",
              )}
              className="size-full object-cover"
            />
          </div>
        </section>
      )}

      {(useFallbacks || servicesIntro || supportItems.length > 0) && (
        <section className="border-b border-[#D8D5CF] bg-white">
          <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-10 lg:px-16">
            {(useFallbacks || servicesIntro) && (
              <div className="mx-auto max-w-2xl border-y border-[#D8D5CF] py-6 text-center">
                <Eyebrow>
                  {valueOrFallback(
                    servicesIntroContent.eyebrow,
                    "Our Property Support Services",
                  )}
                </Eyebrow>
                <h2 className="mt-4 font-serif text-[40px] leading-[1] tracking-[-.03em] sm:text-[48px]">
                  {valueOrFallback(
                    servicesIntroContent.heading,
                    "Support built around the details.",
                  )}
                </h2>
              </div>
            )}

            {supportItems.length > 0 && (
              <div className="mt-10 grid gap-px border border-[#D8D5CF] bg-[#D8D5CF] md:grid-cols-2 lg:grid-cols-3">
                {supportItems.map((item, index) => {
                  const fallback = fallbackFor(item, index);
                  const itemKey = item.title ?? fallback.title ?? "";
                  const Icon =
                    supportIcons[itemKey] ??
                    supportIcons[fallback.title ?? ""] ??
                    Building2;
                  const heading = valueOrFallback(
                    item.heading,
                    fallback.heading ?? "Property Support",
                  );

                  return (
                    <article
                      className="bg-white p-6 sm:p-7"
                      key={itemKey || `${heading}-${index}`}
                    >
                      <div className="flex items-start gap-4">
                        <span className="grid size-10 shrink-0 place-items-center border border-[#B08A3C] text-[#B08A3C]">
                          <Icon size={20} strokeWidth={1.75} />
                        </span>
                        <div>
                          <h3 className="text-base font-bold">{heading}</h3>
                          <p className="mt-2 text-sm leading-6 text-[#66635E]">
                            {valueOrFallback(
                              item.body,
                              fallback.body ??
                                "Practical support planned around your property requirements.",
                            )}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* Property Support is not property management, repairs, maintenance, legal advice, surveying, valuation or security/guarding. */}
          </div>
        </section>
      )}

      {(useFallbacks || finalCta) && (
        <section className="border-y border-[#D8D5CF] bg-[#F1EDE4]">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-5 py-9 sm:px-10 md:flex-row md:items-center md:justify-between lg:px-16">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center border border-[#B08A3C] text-[#B08A3C]">
                <Phone size={20} strokeWidth={1.75} />
              </span>
              <h2 className="max-w-2xl font-serif text-[30px] leading-[1.06] sm:text-[38px]">
                {valueOrFallback(
                  finalCtaContent.heading,
                  "Need something not listed? Get in touch and we’ll see how we can help.",
                )}
              </h2>
            </div>
            <Link
              className="md:shrink-0"
              to={valueOrFallback(
                finalCtaContent.primaryCtaLink,
                "/contact",
              )}
            >
              <GoldButton full>
                {valueOrFallback(
                  finalCtaContent.primaryCtaText,
                  "Get in touch",
                )}
              </GoldButton>
            </Link>
          </div>
        </section>
      )}

      <footer className="border-b border-[#D8D5CF] bg-white">
        <div className="mx-auto grid max-w-[1440px] gap-8 px-5 py-9 sm:px-10 md:grid-cols-[1.35fr_1fr_1fr] lg:px-16">
          <div>
            <Logo />
            <p className="mt-5 max-w-xs text-xs leading-5 text-[#66635E]">
              {valueOrFallback(
                businessTagline?.value,
                "Professional cleaning and considered property support across London.",
              )}
            </p>
          </div>
          <div>
            <Eyebrow>Explore</Eyebrow>
            <div className="mt-4 space-y-2 text-xs">
              <Link
                className="block hover:text-[#B08A3C]"
                to="/cleaning-services"
              >
                Cleaning Services
              </Link>
              <Link
                className="block hover:text-[#B08A3C]"
                to="/property-support"
              >
                Property Support
              </Link>
              <Link className="block hover:text-[#B08A3C]" to="/about">
                About
              </Link>
              <Link className="block hover:text-[#B08A3C]" to="/contact">
                Contact Us
              </Link>
              <Link className="block hover:text-[#B08A3C]" to="/quote">
                Get a Quote
              </Link>
            </div>
          </div>
          <div>
            <Eyebrow>Contact</Eyebrow>
            <p className="mt-4 text-xs leading-6 text-[#66635E]">
              {contactLines.length > 0
                ? contactLines.map((line, index) => (
                    <span key={line}>
                      {index > 0 && <br />}
                      {line}
                    </span>
                  ))
                : "Service area information coming soon"}
            </p>
          </div>
        </div>
        <div className="mx-auto max-w-[1440px] border-t border-[#D8D5CF] px-5 py-4 text-[10px] font-bold uppercase tracking-[.1em] text-[#66635E] sm:px-10 lg:px-16">
          {valueOrFallback(
            copyright?.value,
            "© 2026 Clean Up Central Ltd. All rights reserved.",
          )}
        </div>
      </footer>
    </main>
  );
}