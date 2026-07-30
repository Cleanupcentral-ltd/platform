import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  Building2,
  DoorOpen,
  KeyRound,
  Menu,
  Sparkles,
  WandSparkles,
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
  "https://images.unsplash.com/photo-1769253523308-f7bff35c60b1?w=1400&h=1000&fit=crop&auto=format";

const serviceImages = [
  "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?w=720&h=520&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1778731660430-fca071797515?w=720&h=520&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1622653533660-a1538fe8424c?w=720&h=520&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1741156386380-0236c72eb6f9?w=720&h=520&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1588540680816-e9af87bdce01?w=720&h=520&fit=crop&auto=format",
];

const navigation = [
  ["Home", "/home"],
  ["About", "/about"],
  ["Cleaning Services", "/cleaning-services"],
  ["Property Support", "/property-support"],
  ["Contact Us", "/contact"],
] as const;

const fallbackServices: PageSection[] = [
  {
    title: "cleaning-services.standard-clean",
    heading: "Standard Clean",
    body: "Routine maintenance cleaning for occupied properties in reasonable condition.",
    image: serviceImages[0],
    imageAltText: "Standard Clean service interior",
    primaryCtaText: "Get an Instant Estimate",
    primaryCtaLink: "/quote?service=standard-clean",
  },
  {
    title: "cleaning-services.deep-clean",
    heading: "Deep Clean",
    body: "Detailed restorative cleaning for built-up or first-time properties.",
    image: serviceImages[1],
    imageAltText: "Deep Clean service interior",
    primaryCtaText: "Get an Instant Estimate",
    primaryCtaLink: "/quote?service=deep-clean",
  },
  {
    title: "cleaning-services.end-of-tenancy",
    heading: "End of Tenancy",
    body: "Full internal move-out clean prepared for inspection or incoming occupants.",
    image: serviceImages[2],
    imageAltText: "End of Tenancy service interior",
    primaryCtaText: "Request a Custom Quote",
    primaryCtaLink: "/quote?service=end-of-tenancy",
  },
  {
    title: "cleaning-services.airbnb-turnover",
    heading: "Airbnb Turnover",
    body: "Guest-ready cleaning, presentation checks and reporting between stays. Dirty-condition estimates are provisional and reviewed.",
    image: serviceImages[3],
    imageAltText: "Airbnb Turnover service interior",
    primaryCtaText: "Get an Instant Estimate",
    primaryCtaLink: "/quote?service=airbnb-turnover",
  },
  {
    title: "cleaning-services.commercial-cleaning",
    heading: "Commercial Cleaning",
    body: "Quote-based cleaning for offices and light commercial premises.",
    image: serviceImages[4],
    imageAltText: "Commercial Cleaning service interior",
    primaryCtaText: "Request a Custom Quote",
    primaryCtaLink: "/quote?service=commercial-cleaning",
  },
];

type ServiceIcon = typeof Sparkles;

const serviceIcons: Record<string, ServiceIcon> = {
  "cleaning-services.standard-clean": Sparkles,
  "cleaning-services.deep-clean": WandSparkles,
  "cleaning-services.end-of-tenancy": DoorOpen,
  "cleaning-services.airbnb-turnover": KeyRound,
  "cleaning-services.commercial-cleaning": Building2,
};

function valueOrFallback(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function fallbackFor(item: PageSection, index: number) {
  return (
    fallbackServices.find((fallback) => fallback.title === item.title) ??
    fallbackServices[index] ??
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

function AccentHeading({
  heading,
  accentText,
}: {
  heading: string;
  accentText: string;
}) {
  const accentStart = accentText ? heading.lastIndexOf(accentText) : -1;

  if (accentStart < 0) return <>{heading}</>;

  return (
    <>
      {heading.slice(0, accentStart)}
      <span className="text-[#B08A3C]">
        {heading.slice(accentStart)}
      </span>
    </>
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

export default function CleaningServicesPage() {
  const [drawer, setDrawer] = useState(false);
  const { loading, error } = useCms();
  const useFallbacks = loading || Boolean(error);

  const hero = usePageSection("cleaning-services.hero");
  const finalCta = usePageSection("cleaning-services.final-cta");
  const cmsServices = usePageSections(
    "Cleaning Services",
    "Services",
  ).filter((item) => item.contentType === "Service Card");

  const services = useFallbacks ? fallbackServices : cmsServices;

  const businessTagline = useSiteSetting("business.tagline");
  const serviceArea = useSiteSetting("contact.service_area");
  const phone = useSiteSetting("contact.phone");
  const email = useSiteSetting("contact.email");
  const copyright = useSiteSetting("legal.copyright");

  const heroContent = hero ?? {
    eyebrow: "Our cleaning services",
    heading: "The right clean for every property.",
    body: "Choose the service that best fits your property, then we will guide you through the most suitable next step.",
    image: heroImage,
    imageAltText: "Calm premium bathroom interior",
  };

  const finalCtaContent = finalCta ?? {
    heading: "Not sure which service? We’re happy to help.",
    accentText: "We’re happy to help.",
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
                className={`flex h-full items-center border-b-2 text-[10px] font-bold uppercase tracking-[.09em] transition duration-[var(--motion-standard)] ease-[var(--ease-out)] ${to === "/cleaning-services" ? "border-[#B08A3C] text-[#121212]" : "border-transparent text-[#66635E] hover:text-[#121212]"}`}
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
          <div className="border-t border-[#D8D5CF] bg-white px-5 pb-5 transition duration-[var(--motion-slow)] ease-[var(--ease-in-out)] lg:hidden">
            {navigation.map(([label, to]) => (
              <Link
                onClick={() => setDrawer(false)}
                key={label}
                to={to}
                className={`block border-b border-[#D8D5CF] py-4 text-xs font-bold uppercase tracking-[.1em] ${to === "/cleaning-services" ? "text-[#B08A3C]" : ""}`}
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

      {(useFallbacks || hero) && (
        <section className="mx-auto grid max-w-[1440px] border-b border-[#D8D5CF] lg:grid-cols-2">
          <div className="flex flex-col justify-center px-5 py-16 sm:px-10 lg:min-h-[510px] lg:pl-20 lg:pr-16">
            <Eyebrow>
              {valueOrFallback(
                heroContent.eyebrow,
                "Our cleaning services",
              )}
            </Eyebrow>
            <h1 className="mt-6 max-w-lg font-serif text-[50px] font-medium leading-[.96] tracking-[-.035em] sm:text-[60px] lg:text-[68px]">
              {valueOrFallback(
                heroContent.heading,
                "The right clean for every property.",
              )}
            </h1>
            <p className="mt-6 max-w-md text-[16px] leading-7 text-[#343434]">
              {valueOrFallback(
                heroContent.body,
                "Choose the service that best fits your property, then we will guide you through the most suitable next step.",
              )}
            </p>
          </div>
          <div className="min-h-[330px] sm:min-h-[440px] lg:min-h-[510px]">
            <img
              src={resolveCmsImage(heroContent.image, heroImage)}
              alt={valueOrFallback(
                heroContent.imageAltText,
                "Calm premium bathroom interior",
              )}
              className="size-full object-cover"
            />
          </div>
        </section>
      )}

      <section className="mx-auto max-w-[1440px] px-5 py-12 sm:px-10 sm:py-16 lg:px-16">
        <div className="border-t border-[#D8D5CF]">
          {services.map((service, index) => {
            const fallback = fallbackFor(service, index);
            const serviceKey = service.title ?? fallback.title ?? "";
            const Icon =
              serviceIcons[serviceKey] ??
              serviceIcons[fallback.title ?? ""] ??
              Sparkles;
            const heading = valueOrFallback(
              service.heading,
              fallback.heading ?? "Cleaning Service",
            );
            const fallbackImage =
              typeof fallback.image === "string"
                ? fallback.image
                : serviceImages[index] ?? serviceImages[0];

            return (
              <article
                key={serviceKey || `${heading}-${index}`}
                className="grid gap-5 border-b border-[#D8D5CF] py-5 sm:grid-cols-[140px_1fr_auto] sm:items-center sm:gap-6 lg:grid-cols-[180px_1fr_72px] lg:py-6"
              >
                <img
                  src={resolveCmsImage(service.image, fallbackImage)}
                  alt={valueOrFallback(
                    service.imageAltText,
                    fallback.imageAltText ?? `${heading} service interior`,
                  )}
                  className="h-40 w-full object-cover sm:h-28 sm:w-[140px] lg:h-32 lg:w-[180px]"
                />
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-4 lg:block">
                    <h2 className="text-xl font-bold tracking-[-.015em]">
                      {heading}
                    </h2>
                    <span className="grid size-11 shrink-0 place-items-center border border-[#B08A3C] text-[#B08A3C] lg:hidden">
                      <Icon size={22} strokeWidth={1.75} />
                    </span>
                  </div>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66635E]">
                    {valueOrFallback(
                      service.body,
                      fallback.body ?? "Professional cleaning planned around your property requirements.",
                    )}
                  </p>
                  <Link
                    to={valueOrFallback(
                      service.primaryCtaLink,
                      fallback.primaryCtaLink ?? "/quote",
                    )}
                    className="mt-3 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.1em] text-[#B08A3C] transition duration-[var(--motion-standard)] ease-[var(--ease-out)] hover:text-[#7A5A1E]"
                  >
                    {valueOrFallback(
                      service.primaryCtaText,
                      fallback.primaryCtaText ?? "Get a Quote",
                    )}
                    <ArrowRight size={15} strokeWidth={1.75} />
                  </Link>
                </div>
                <span className="hidden size-14 place-items-center border border-[#B08A3C] text-[#B08A3C] lg:grid">
                  <Icon size={28} strokeWidth={1.75} />
                </span>
              </article>
            );
          })}
        </div>
      </section>

      {(useFallbacks || finalCta) && (
        <section className="border-y border-[#D8D5CF] bg-[#F1EDE4]">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-5 py-9 sm:px-10 md:flex-row md:items-center md:justify-between lg:px-16">
            <h2 className="font-serif text-[32px] leading-[1] sm:text-[38px]">
              <AccentHeading
                heading={valueOrFallback(
                  finalCtaContent.heading,
                  "Not sure which service? We’re happy to help.",
                )}
                accentText={valueOrFallback(
                  finalCtaContent.accentText,
                  "We’re happy to help.",
                )}
              />
            </h2>
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