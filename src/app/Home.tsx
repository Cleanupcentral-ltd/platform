import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  Building2,
  Calculator,
  CalendarCheck,
  ClipboardCheck,
  Menu,
  Phone,
  ShieldCheck,
  X,
} from "lucide-react";
import { Link } from "react-router";
import horizontalFullColour from "@/imports/IMG_1776556945431__2_.png";
import horizontalReversed from "@/imports/920E7430-910D-4BAD-99EB-92FD7E571F84-1.png";
import {
  useCms,
  usePageSection,
  usePageSections,
  useSiteSetting,
} from "@/cms/CmsProvider";
import { resolveCmsImage } from "@/cms/cmsMedia";
import type { PageSection } from "@/cms/cmsTypes";

const heroImage =
  "https://images.unsplash.com/photo-1526056047424-9ba7a120fa79?w=1400&h=1100&fit=crop&auto=format";
const keysImage =
  "https://images.unsplash.com/photo-1741156386380-0236c72eb6f9?w=900&h=640&fit=crop&auto=format";

type Icon = typeof ArrowRight;

const fallbackConfidence: PageSection[] = [
  {
    title: "home.confidence.professional-standards",
    heading: "Professional cleaning standards",
  },
  {
    title: "home.confidence.residential-commercial",
    heading: "Residential and commercial cleaning",
  },
  {
    title: "home.confidence.airbnb-turnover",
    heading: "Airbnb turnover support",
  },
  {
    title: "home.confidence.online-quotations",
    heading: "Simple online quotations",
  },
];

const fallbackServiceCards: PageSection[] = [
  {
    title: "home.services.cleaning",
    eyebrow: "Cleaning Services",
    heading: "Cleaning Services",
    body: "Professional cleaning for homes, stays and workspaces, planned around your requirements.",
    image: heroImage,
    imageAltText: "Warm, professionally prepared living room",
    primaryCtaText: "View services",
    primaryCtaLink: "/cleaning-services",
  },
  {
    title: "home.services.property-support",
    eyebrow: "Property Support",
    heading: "Property Support",
    body: "Practical support for properties that need trusted care between visits.",
    image: keysImage,
    imageAltText: "Keys held at an apartment entrance",
    primaryCtaText: "View services",
    primaryCtaLink: "/property-support",
  },
];

const fallbackSteps: PageSection[] = [
  {
    title: "home.how-it-works.tell-us",
    eyebrow: "01",
    heading: "Tell us what you need",
    body: "Share the property and service details so we can assess the request.",
  },
  {
    title: "home.how-it-works.quotation",
    eyebrow: "02",
    heading: "Receive your quotation",
    body: "Eligible requests receive an instant estimate; others are reviewed for a tailored quote.",
  },
  {
    title: "home.how-it-works.arrange",
    eyebrow: "03",
    heading: "We arrange the service",
    body: "Once your quotation is approved, we arrange the service with you.",
  },
];

function valueOrFallback(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function Logo({ reversed = false }: { reversed?: boolean }) {
  return (
    <span className="block h-10 w-[145px] overflow-hidden sm:h-11 sm:w-[180px]">
      <img
        className="size-full scale-[1.65] object-contain"
        src={reversed ? horizontalReversed : horizontalFullColour}
        alt="Clean Up Central"
      />
    </span>
  );
}

function Button({
  children,
  variant = "gold",
  full = false,
  arrow = false,
}: {
  children: ReactNode;
  variant?: "gold" | "text" | "outline";
  full?: boolean;
  arrow?: boolean;
}) {
  const styles = {
    gold:
      "bg-[#B08A3C] text-white shadow-[inset_0_-1px_0_rgba(18,18,18,.25)] hover:bg-[#7A5A1E]",
    text: "px-0 text-[#121212] hover:text-[#7A5A1E]",
    outline:
      "border border-[#121212] bg-white text-[#121212] hover:bg-[#F1EDE4]",
  };

  return (
    <button
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-[4px] px-5 text-[11px] font-bold uppercase tracking-[.08em] transition duration-[var(--motion-standard)] ease-[var(--ease-out)] ${styles[variant]} ${full ? "w-full" : ""}`}
    >
      {children}
      {arrow && <ArrowRight size={16} strokeWidth={1.75} />}
    </button>
  );
}

function Photo({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={`block h-full w-full object-cover ${className}`}
    />
  );
}

function Eyebrow({
  children,
  dark = false,
}: {
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <p
      className={`text-[10px] font-bold uppercase tracking-[.18em] ${dark ? "text-[#D6B875]" : "text-[#66635E]"}`}
    >
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
  const accentStart = accentText
    ? heading.lastIndexOf(accentText)
    : -1;

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

export default function Home() {
  const [drawer, setDrawer] = useState(false);
  const { loading, error } = useCms();
  const useFallbacks = loading || Boolean(error);

  const hero = usePageSection("home.hero");
  const servicesIntro = usePageSection("home.services.intro");
  const howItWorksIntro = usePageSection("home.how-it-works.intro");
  const finalCta = usePageSection("home.final-cta");

  const cmsConfidence = usePageSections("Home", "Confidence Strip");
  const cmsServices = usePageSections("Home", "Services Overview").filter(
    (item) => item.contentType === "Card",
  );
  const cmsSteps = usePageSections("Home", "How It Works").filter(
    (item) => item.contentType === "Step",
  );

  const businessTagline = useSiteSetting("business.tagline");
  const serviceArea = useSiteSetting("contact.service_area");
  const phone = useSiteSetting("contact.phone");
  const email = useSiteSetting("contact.email");
  const copyright = useSiteSetting("legal.copyright");

  const confidence = useFallbacks
    ? fallbackConfidence
    : cmsConfidence;
  const serviceCards = useFallbacks
    ? fallbackServiceCards
    : cmsServices;
  const steps = useFallbacks ? fallbackSteps : cmsSteps;

  const heroContent = hero ?? {
    eyebrow: "Professional. Reliable. Trusted.",
    heading: "Cleaning and support, handled properly.",
    accentText: "handled properly.",
    body: "Professional cleaning and practical property support across London—handled with clear standards and a considered approach.",
    image: heroImage,
    imageAltText: "Warm apartment living room with natural light",
    primaryCtaText: "Get a Quote",
    primaryCtaLink: "/quote",
    secondaryCtaText: "Explore our services",
    secondaryCtaLink: "/cleaning-services",
  };

  const routes = [
    ["Home", "/home"],
    ["About", "/about"],
    ["Cleaning Services", "/cleaning-services"],
    ["Property Support", "/property-support"],
    ["Contact", "/contact"],
  ] as const;

  const confidenceIcons: Icon[] = [
    ShieldCheck,
    Building2,
    CalendarCheck,
    ClipboardCheck,
  ];
  const stepIcons: Icon[] = [ClipboardCheck, Calculator, CalendarCheck];

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
            {routes.map(([label, to], index) => (
              <Link
                key={label}
                to={to}
                className={`flex h-full items-center border-b-2 text-[10px] font-bold uppercase tracking-[.09em] transition duration-[var(--motion-standard)] ease-[var(--ease-out)] ${index === 0 ? "border-[#B08A3C]" : "border-transparent text-[#66635E] hover:text-[#121212]"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="hidden lg:block">
            <Link to="/get-a-quote">
              <Button>Get a Quote</Button>
            </Link>
          </div>
          <button
            onClick={() => setDrawer(!drawer)}
            className="grid size-11 place-items-center border border-[#D8D5CF] lg:hidden"
            aria-label="Toggle navigation"
          >
            {drawer ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {drawer && (
          <div className="border-t border-[#D8D5CF] bg-white px-5 pb-5 transition duration-[var(--motion-slow)] ease-[var(--ease-in-out)] lg:hidden">
            {routes.map(([label, to]) => (
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
              to="/get-a-quote"
              className="mt-4 block"
            >
              <Button full>Get a Quote</Button>
            </Link>
          </div>
        )}
      </header>

      {(useFallbacks || hero) && (
        <section
          className="mx-auto grid max-w-[1440px] border-b border-[#D8D5CF] lg:grid-cols-[.85fr_1fr]"
          aria-label="Introduction"
        >
          <div className="flex min-h-[480px] flex-col justify-center px-5 py-16 sm:px-10 lg:min-h-[600px] lg:pl-20 lg:pr-16">
            <Eyebrow>
              {valueOrFallback(
                heroContent.eyebrow,
                "Professional. Reliable. Trusted.",
              )}
            </Eyebrow>
            <h1 className="mt-6 max-w-xl font-serif text-[49px] font-medium leading-[.96] tracking-[-.035em] sm:text-[58px] lg:text-[68px]">
              <AccentHeading
                heading={valueOrFallback(
                  heroContent.heading,
                  "Cleaning and support, handled properly.",
                )}
                accentText={valueOrFallback(
                  heroContent.accentText,
                  "handled properly.",
                )}
              />
            </h1>
            <p className="mt-6 max-w-md text-[16px] leading-7 text-[#343434]">
              {valueOrFallback(
                heroContent.body,
                "Professional cleaning and practical property support across London—handled with clear standards and a considered approach.",
              )}
            </p>
            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Link
                to={valueOrFallback(
                  heroContent.primaryCtaLink,
                  "/quote",
                )}
              >
                <Button>
                  {valueOrFallback(
                    heroContent.primaryCtaText,
                    "Get a Quote",
                  )}
                </Button>
              </Link>
              <Link
                to={valueOrFallback(
                  heroContent.secondaryCtaLink,
                  "/cleaning-services",
                )}
              >
                <Button variant="text" arrow>
                  {valueOrFallback(
                    heroContent.secondaryCtaText,
                    "Explore our services",
                  )}
                </Button>
              </Link>
            </div>
          </div>
          <div className="min-h-[320px] sm:min-h-[440px] lg:min-h-[600px]">
            {loading ? (
              <div
                aria-hidden="true"
                className="h-full w-full bg-[#F1EDE4]"
              />
            ) : (
              <Photo
                src={resolveCmsImage(heroContent.image, heroImage)}
                alt={valueOrFallback(
                  heroContent.imageAltText,
                  "Warm apartment living room with natural light",
                )}
              />
            )}
          </div>
        </section>
      )}

      {confidence.length > 0 && (
        <section className="mx-auto max-w-[1440px] px-5 py-10 sm:px-10 lg:px-16">
          <div className="grid border-y border-[#D8D5CF] sm:grid-cols-2 lg:grid-cols-4">
            {confidence.map((item, index) => {
              const ConfidenceIcon =
                confidenceIcons[index] ?? ShieldCheck;
              return (
                <div
                  key={item.title ?? item.heading ?? index}
                  className={`flex min-h-28 items-center gap-4 border-b border-[#D8D5CF] py-5 sm:px-5 sm:[&:nth-child(odd)]:border-r lg:border-b-0 lg:border-r lg:px-6 lg:last:border-r-0 ${index > 1 ? "sm:border-b-0" : ""}`}
                >
                  <span className="grid size-9 place-items-center border border-[#B08A3C] text-[#B08A3C]">
                    <ConfidenceIcon size={18} strokeWidth={1.75} />
                  </span>
                  <p className="max-w-40 text-[12px] font-bold leading-5">
                    {item.heading}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {serviceCards.length > 0 && (
        <section className="border-y border-[#D8D5CF] bg-white">
          <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-10 lg:px-16">
            {(useFallbacks || servicesIntro) && (
              <div className="mx-auto max-w-lg text-center">
                <Eyebrow>
                  {valueOrFallback(
                    servicesIntro?.eyebrow,
                    "How we can help",
                  )}
                </Eyebrow>
                <h2 className="mt-4 font-serif text-[40px] leading-[1] tracking-[-.03em] sm:text-[48px]">
                  {valueOrFallback(
                    servicesIntro?.heading,
                    "Two ways we can help.",
                  )}
                </h2>
              </div>
            )}
            <div className="mt-10 grid gap-6 border-t border-[#D8D5CF] pt-6 md:grid-cols-2">
              {serviceCards.map((card, index) => {
                const fallback =
                  fallbackServiceCards[index] ?? fallbackServiceCards[0];
                return (
                  <EditorialCard
                    key={card.title ?? card.heading ?? index}
                    image={resolveCmsImage(card.image, String(fallback.image))}
                    alt={valueOrFallback(
                      card.imageAltText,
                      fallback.imageAltText ?? "Clean Up Central service",
                    )}
                    eyebrow={valueOrFallback(
                      card.eyebrow,
                      fallback.eyebrow ?? "Services",
                    )}
                    title={valueOrFallback(
                      card.heading,
                      fallback.heading ?? "Our service",
                    )}
                    copy={valueOrFallback(
                      card.body,
                      fallback.body ?? "",
                    )}
                    cta={valueOrFallback(
                      card.primaryCtaText,
                      fallback.primaryCtaText ?? "View services",
                    )}
                    to={valueOrFallback(
                      card.primaryCtaLink,
                      fallback.primaryCtaLink ?? "/cleaning-services",
                    )}
                  />
                );
              })}
            </div>
          </div>
        </section>
      )}

      {steps.length > 0 && (
        <section className="mx-auto max-w-[1440px] px-5 py-16 sm:px-10 lg:px-16">
          <div className="border-t border-[#D8D5CF] pt-6">
            {(useFallbacks || howItWorksIntro) && (
              <Eyebrow>
                {valueOrFallback(
                  howItWorksIntro?.eyebrow,
                  "How it works",
                )}
              </Eyebrow>
            )}
            <div className="mt-6 grid gap-8 md:grid-cols-3">
              {steps.map((step, index) => {
                const StepIcon = stepIcons[index] ?? ClipboardCheck;
                const fallback = fallbackSteps[index] ?? fallbackSteps[0];
                return (
                  <div
                    key={step.title ?? step.heading ?? index}
                    className="border-t-2 border-[#121212] pt-4"
                  >
                    <p className="font-serif text-3xl text-[#B08A3C]">
                      {valueOrFallback(
                        step.eyebrow,
                        fallback.eyebrow ?? String(index + 1).padStart(2, "0"),
                      )}
                    </p>
                    <span className="mt-4 grid size-10 place-items-center border border-[#D8D5CF]">
                      <StepIcon size={20} strokeWidth={1.75} />
                    </span>
                    <h3 className="mt-5 text-base font-bold">
                      {valueOrFallback(
                        step.heading,
                        fallback.heading ?? "Next step",
                      )}
                    </h3>
                    <p className="mt-2 max-w-xs text-sm leading-6 text-[#66635E]">
                      {valueOrFallback(
                        step.body,
                        fallback.body ?? "",
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {(useFallbacks || finalCta) && (
        <section className="bg-[#121212]">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-5 py-9 sm:px-10 md:flex-row md:items-center md:justify-between lg:px-16">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center border border-[#B08A3C] text-[#D6B875]">
                <Phone size={20} strokeWidth={1.75} />
              </span>
              <div>
                <Eyebrow dark>
                  {valueOrFallback(
                    finalCta?.eyebrow,
                    "Support for your property",
                  )}
                </Eyebrow>
                <h2 className="mt-2 font-serif text-[34px] leading-[1] text-white sm:text-[40px]">
                  {valueOrFallback(
                    finalCta?.heading,
                    "Ready to take care of your property?",
                  )}
                </h2>
              </div>
            </div>
            <Link
              className="md:shrink-0"
              to={valueOrFallback(finalCta?.primaryCtaLink, "/quote")}
            >
              <Button full>
                {valueOrFallback(
                  finalCta?.primaryCtaText,
                  "Get a quote",
                )}
              </Button>
            </Link>
          </div>
        </section>
      )}

      <footer className="border-b border-[#D8D5CF] bg-white">
        <div className="mx-auto grid max-w-[1440px] gap-8 px-5 py-9 sm:px-10 md:grid-cols-[1.3fr_1fr_1fr] lg:px-16">
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
              <Link
                className="block hover:text-[#B08A3C]"
                to="/get-a-quote"
              >
                Get a Quote
              </Link>
            </div>
          </div>
          <div>
            <Eyebrow>Contact</Eyebrow>
            <p className="mt-4 text-xs leading-6 text-[#66635E]">
              {contactLines.length > 0 ? (
                contactLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))
              ) : (
                <>
                  Details to be confirmed
                  <br />
                  Coverage to be confirmed
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mx-auto max-w-[1440px] border-t border-[#D8D5CF] px-5 py-4 text-[10px] font-bold uppercase tracking-[.1em] text-[#66635E] sm:px-10 lg:px-16">
          {valueOrFallback(
            copyright?.value,
            "© Clean Up Central · All rights reserved",
          )}
        </div>
      </footer>
    </main>
  );
}

function EditorialCard({
  image,
  alt,
  eyebrow,
  title,
  copy,
  cta,
  to,
}: {
  image: string;
  alt: string;
  eyebrow: string;
  title: string;
  copy: string;
  cta: string;
  to: string;
}) {
  return (
    <article className="overflow-hidden border border-[#D8D5CF] bg-[#FAF9F6]">
      <div className="aspect-[3/2]">
        <Photo src={image} alt={alt} />
      </div>
      <div className="p-6">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h3 className="mt-3 text-xl font-bold">{title}</h3>
        <p className="mt-3 max-w-md text-sm leading-6 text-[#66635E]">
          {copy}
        </p>
        <Link
          to={to}
          className="mt-4 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.08em] hover:text-[#7A5A1E]"
        >
          {cta} <ArrowRight size={16} />
        </Link>
      </div>
    </article>
  );
}