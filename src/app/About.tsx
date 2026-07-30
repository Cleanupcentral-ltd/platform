import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  CircleX,
  Menu,
  ShieldCheck,
  X,
} from "lucide-react";
import { Link } from "react-router";
import horizontalFullColour from "@/imports/IMG_1776556945431__2_.png";
import {
  useCms,
  usePageSection,
  usePageSections,
  useSiteSetting,
  useSiteStatistics,
} from "@/cms/CmsProvider";
import { resolveCmsImage } from "@/cms/cmsMedia";
import type { PageSection } from "@/cms/cmsTypes";

const heroImage =
  "https://images.unsplash.com/photo-1758273238415-01ec03d9ef27?w=1400&h=1100&fit=crop&auto=format";

const navigation = [
  ["Home", "/home"],
  ["About", "/about"],
  ["Cleaning Services", "/cleaning-services"],
  ["Property Support", "/property-support"],
  ["Contact Us", "/contact"],
] as const;

const fallbackStandards: PageSection[] = [
  { title: "about.standards.professional", heading: "Professional" },
  { title: "about.standards.reliable", heading: "Reliable" },
  { title: "about.standards.honest", heading: "Honest" },
  { title: "about.standards.respectful", heading: "Respectful" },
  { title: "about.standards.accountable", heading: "Accountable" },
  { title: "about.standards.attentive", heading: "Attentive" },
];

const fallbackQualities: PageSection[] = [
  {
    title: "about.why.trust",
    eyebrow: "01",
    heading: "Trust",
    body: "Properties, access information and customer instructions are handled with care and discretion.",
  },
  {
    title: "about.why.organisation",
    eyebrow: "02",
    heading: "Organisation",
    body: "Service details and requirements are confirmed clearly before arrangements are finalised.",
  },
  {
    title: "about.why.communication",
    eyebrow: "03",
    heading: "Communication",
    body: "Customers are kept informed about what is happening and what they need to do next.",
  },
  {
    title: "about.why.quality-control",
    eyebrow: "04",
    heading: "Quality control",
    body: "Clear service expectations help us review the work delivered and address concerns appropriately.",
  },
  {
    title: "about.why.respect-for-property",
    eyebrow: "05",
    heading: "Respect for property",
    body: "Every space is treated professionally, carefully and with consideration for the people who use it.",
  },
];

const fallbackIncluded: PageSection[] = [
  {
    title: "about.scope.included.residential-cleaning",
    heading: "Residential cleaning",
  },
  {
    title: "about.scope.included.airbnb-turnover",
    heading: "Airbnb turnover cleaning",
  },
  {
    title: "about.scope.included.commercial-enquiries",
    heading: "Commercial cleaning enquiries",
  },
  {
    title: "about.scope.included.property-support",
    heading: "Practical property-support tasks",
  },
  {
    title: "about.scope.included.inspection-reporting",
    heading: "Inspections, access and accurate reporting within an agreed scope",
  },
];

const fallbackExcluded: PageSection[] = [
  {
    title: "about.scope.excluded.property-management",
    heading: "Full property management",
  },
  {
    title: "about.scope.excluded.repairs-maintenance",
    heading: "Repairs and maintenance works",
  },
  { title: "about.scope.excluded.surveying", heading: "Surveying" },
  {
    title: "about.scope.excluded.security",
    heading: "Security services",
  },
  {
    title: "about.scope.excluded.legal-compliance",
    heading: "Legal or regulatory compliance",
  },
  {
    title: "about.scope.excluded.rent-tenant-disputes",
    heading: "Rent collection and tenant disputes",
  },
];

function valueOrFallback(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function fallbackFor(
  item: PageSection,
  fallbacks: PageSection[],
  index: number,
) {
  return (
    fallbacks.find((fallback) => fallback.title === item.title) ??
    fallbacks[index] ??
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

function TextLink({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-11 items-center gap-2 text-[11px] font-bold uppercase tracking-[.08em] text-[#121212] transition duration-[var(--motion-standard)] ease-[var(--ease-out)] hover:text-[#7A5A1E]">
      {children}
      <ArrowRight size={16} strokeWidth={1.75} />
    </span>
  );
}

export default function About() {
  const [drawer, setDrawer] = useState(false);
  const { loading, error } = useCms();
  const useFallbacks = loading || Boolean(error);

  const hero = usePageSection("about.hero");
  const standardsIntro = usePageSection("about.standards.intro");
  const whyIntro = usePageSection("about.why.intro");
  const scopeIntro = usePageSection("about.scope.intro");
  const includedHeading = usePageSection("about.scope.included.heading");
  const excludedHeading = usePageSection("about.scope.excluded.heading");
  const finalCta = usePageSection("about.final-cta");

  const cmsStandards = usePageSections("About", "Standards").filter(
    (item) => item.contentType === "List Item",
  );
  const cmsQualities = usePageSections(
    "About",
    "Why Customers Choose Us",
  ).filter((item) => item.contentType === "Item");
  const cmsIncluded = usePageSections(
    "About",
    "Service Boundaries — Included",
  ).filter((item) => item.contentType === "List Item");
  const cmsExcluded = usePageSections(
    "About",
    "Service Boundaries — Excluded",
  ).filter((item) => item.contentType === "List Item");

  const standards = useFallbacks ? fallbackStandards : cmsStandards;
  const qualities = useFallbacks ? fallbackQualities : cmsQualities;
  const included = useFallbacks ? fallbackIncluded : cmsIncluded;
  const excluded = useFallbacks ? fallbackExcluded : cmsExcluded;

  const statistics = useSiteStatistics("About").filter(
    (statistic) => statistic.value?.trim() && statistic.label?.trim(),
  );
  const businessTagline = useSiteSetting("business.tagline");
  const serviceArea = useSiteSetting("contact.service_area");
  const phone = useSiteSetting("contact.phone");
  const email = useSiteSetting("contact.email");
  const copyright = useSiteSetting("legal.copyright");

  const heroContent = hero ?? {
    eyebrow: "About Clean Up Central",
    heading: "Your property. Our priority.",
    accentText: "Our priority.",
    body: "Clean Up Central provides dependable cleaning and practical property support for homeowners, hosts and property professionals. Our approach combines clear communication, careful service and accountable processes—so customers always understand what is being provided and what happens next.",
    image: heroImage,
    imageAltText: "Professional team member preparing a bright finished property",
    primaryCtaText: "Get a Quote",
    primaryCtaLink: "/quote",
    secondaryCtaText: "View Our Services",
    secondaryCtaLink: "/cleaning-services",
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
                className={`flex h-full items-center border-b-2 text-[10px] font-bold uppercase tracking-[.09em] transition duration-[var(--motion-standard)] ease-[var(--ease-out)] ${to === "/about" ? "border-[#B08A3C] text-[#121212]" : "border-transparent text-[#66635E] hover:text-[#121212]"}`}
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
                className={`block border-b border-[#D8D5CF] py-4 text-xs font-bold uppercase tracking-[.1em] ${to === "/about" ? "text-[#B08A3C]" : ""}`}
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
        <section className="mx-auto grid max-w-[1440px] border-b border-[#D8D5CF] lg:grid-cols-[.85fr_1fr]">
          <div className="flex flex-col justify-center px-5 py-16 sm:px-10 lg:min-h-[600px] lg:pl-20 lg:pr-16">
            <Eyebrow>
              {valueOrFallback(
                heroContent.eyebrow,
                "About Clean Up Central",
              )}
            </Eyebrow>
            <h1 className="mt-6 max-w-lg font-serif text-[50px] font-medium leading-[.96] tracking-[-.035em] sm:text-[60px] lg:text-[68px]">
              <AccentHeading
                heading={valueOrFallback(
                  heroContent.heading,
                  "Your property. Our priority.",
                )}
                accentText={valueOrFallback(
                  heroContent.accentText,
                  "Our priority.",
                )}
              />
            </h1>
            <p className="mt-6 max-w-md text-[16px] leading-7 text-[#343434]">
              {valueOrFallback(
                heroContent.body,
                "Clean Up Central provides dependable cleaning and practical property support for homeowners, hosts and property professionals. Our approach combines clear communication, careful service and accountable processes—so customers always understand what is being provided and what happens next.",
              )}
            </p>
            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
              <Link
                to={valueOrFallback(
                  heroContent.primaryCtaLink,
                  "/quote",
                )}
              >
                <GoldButton>
                  {valueOrFallback(
                    heroContent.primaryCtaText,
                    "Get a Quote",
                  )}
                </GoldButton>
              </Link>
              <Link
                to={valueOrFallback(
                  heroContent.secondaryCtaLink,
                  "/cleaning-services",
                )}
              >
                <TextLink>
                  {valueOrFallback(
                    heroContent.secondaryCtaText,
                    "View Our Services",
                  )}
                </TextLink>
              </Link>
            </div>
          </div>
          <div className="min-h-[340px] sm:min-h-[480px] lg:min-h-[600px]">
            <img
              src={resolveCmsImage(heroContent.image, heroImage)}
              alt={valueOrFallback(
                heroContent.imageAltText,
                "Professional team member preparing a bright finished property",
              )}
              className="size-full object-cover"
            />
          </div>
        </section>
      )}

      {standards.length > 0 && (
        <section className="border-b border-[#D8D5CF] bg-white">
          <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-10 lg:px-16">
            {(useFallbacks || standardsIntro) && (
              <div className="mx-auto max-w-2xl border-t border-[#D8D5CF] pt-6 text-center">
                <Eyebrow>
                  {valueOrFallback(
                    standardsIntro?.eyebrow,
                    "The Standard",
                  )}
                </Eyebrow>
                <h2 className="mt-4 font-serif text-[40px] leading-[1] tracking-[-.03em] sm:text-[48px]">
                  {valueOrFallback(
                    standardsIntro?.heading,
                    "The principles behind every service.",
                  )}
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-[15px] leading-7 text-[#66635E]">
                  {valueOrFallback(
                    standardsIntro?.body,
                    "Our standards shape how we communicate, how we work inside each property and how we respond when something needs attention.",
                  )}
                </p>
              </div>
            )}
            <div className="mt-10 grid border-y border-[#D8D5CF] sm:grid-cols-2 lg:grid-cols-3">
              {standards.map((standard, index) => {
                const fallback = fallbackFor(
                  standard,
                  fallbackStandards,
                  index,
                );
                const label = valueOrFallback(
                  standard.heading,
                  fallback.heading ?? "Our standard",
                );

                return (
                  <div
                    key={standard.title ?? label}
                    className={`flex min-h-20 items-center gap-3 border-b border-[#D8D5CF] px-4 py-4 sm:px-5 ${index > 6 ? "lg:border-b-0" : ""} ${index % 3 !== 2 ? "lg:border-r" : ""} ${index % 2 === 0 ? "sm:border-r lg:border-r" : ""}`}
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full border border-[#B08A3C] text-[#B08A3C]">
                      <Check size={13} strokeWidth={1.75} />
                    </span>
                    <p className="text-sm font-bold">{label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {qualities.length > 0 && (
        <section className="mx-auto max-w-[1440px] px-5 py-16 sm:px-10 lg:px-16">
          <div className="grid gap-10 border-t border-[#D8D5CF] pt-6 lg:grid-cols-[.9fr_1.1fr]">
            {(useFallbacks || whyIntro) && (
              <div>
                <Eyebrow>
                  {valueOrFallback(
                    whyIntro?.eyebrow,
                    "Why customers choose us",
                  )}
                </Eyebrow>
                <h2 className="mt-5 max-w-lg font-serif text-[40px] leading-[1] tracking-[-.03em] sm:text-[48px]">
                  {valueOrFallback(
                    whyIntro?.heading,
                    "Reliable property care depends on more than the final result.",
                  )}
                </h2>
                <p className="mt-6 max-w-md text-[16px] leading-7 text-[#343434]">
                  {valueOrFallback(
                    whyIntro?.body,
                    "Customers need to know that instructions have been understood, access details have been handled carefully and the agreed service will be delivered with proper oversight.",
                  )}
                </p>
              </div>
            )}
            <div className="divide-y divide-[#D8D5CF] border-y border-[#D8D5CF]">
              {qualities.map((quality, index) => {
                const fallback = fallbackFor(
                  quality,
                  fallbackQualities,
                  index,
                );

                return (
                  <div
                    className="grid gap-4 py-4 sm:grid-cols-[38px_1fr]"
                    key={quality.title ?? quality.heading ?? index}
                  >
                    <span className="font-serif text-2xl text-[#B08A3C]">
                      {valueOrFallback(
                        quality.eyebrow,
                        fallback.eyebrow ??
                          String(index + 1).padStart(2, "0"),
                      )}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold">
                        {valueOrFallback(
                          quality.heading,
                          fallback.heading ?? "Our approach",
                        )}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-[#66635E]">
                        {valueOrFallback(
                          quality.body,
                          fallback.body ?? "",
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {(included.length > 0 || excluded.length > 0) && (
        <section className="border-y border-[#D8D5CF] bg-white">
          <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-10 lg:px-16">
            {(useFallbacks || scopeIntro) && (
              <div className="max-w-2xl">
                <Eyebrow>
                  {valueOrFallback(scopeIntro?.eyebrow, "Our role")}
                </Eyebrow>
                <h2 className="mt-4 font-serif text-[40px] leading-[1] tracking-[-.03em] sm:text-[48px]">
                  {valueOrFallback(
                    scopeIntro?.heading,
                    "Clear boundaries create a better service.",
                  )}
                </h2>
                <p className="mt-6 text-[16px] leading-7 text-[#343434]">
                  {valueOrFallback(
                    scopeIntro?.body,
                    "Clean Up Central provides professional cleaning and practical property support within a clearly agreed service scope.",
                  )}
                </p>
              </div>
            )}
            <div className="mt-10 grid gap-px border border-[#D8D5CF] bg-[#D8D5CF] md:grid-cols-2">
              {included.length > 0 && (
                <ListBlock
                  title={valueOrFallback(
                    includedHeading?.heading,
                    "We can help with",
                  )}
                  icon={ShieldCheck}
                  items={included}
                  fallbacks={fallbackIncluded}
                />
              )}
              {excluded.length > 0 && (
                <ListBlock
                  title={valueOrFallback(
                    excludedHeading?.heading,
                    "Outside our scope",
                  )}
                  icon={CircleX}
                  items={excluded}
                  fallbacks={fallbackExcluded}
                />
              )}
            </div>
          </div>
        </section>
      )}

      {statistics.length > 0 && (
        <section className="bg-[#121212]">
          <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-10 lg:px-16">
            <div className="grid divide-y divide-white/20 border-y border-white/20 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
              {statistics.map((statistic, index) => (
                <div
                  className="p-7"
                  key={statistic.title ?? statistic.label ?? index}
                >
                  <p className="font-serif text-[50px] leading-none text-[#D6B875] sm:text-[60px]">
                    {statistic.value}
                  </p>
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-[.11em] text-white/70">
                    {statistic.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {(useFallbacks || finalCta) && (
        <section className="border-y border-[#D8D5CF] bg-[#F1EDE4]">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-7 px-5 py-14 sm:px-10 md:flex-row md:items-end md:justify-between lg:px-16">
            <div>
              <Eyebrow>
                {valueOrFallback(finalCta?.eyebrow, "Ready when you are")}
              </Eyebrow>
              <h2 className="mt-4 max-w-xl font-serif text-[40px] leading-[1] tracking-[-.03em] sm:text-[48px]">
                {valueOrFallback(
                  finalCta?.heading,
                  "Tell us what your property needs.",
                )}
              </h2>
              <p className="mt-5 max-w-xl text-[16px] leading-7 text-[#343434]">
                {valueOrFallback(
                  finalCta?.body,
                  "Request a quote for cleaning or practical property support, and we will guide you through the most suitable next step.",
                )}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:shrink-0">
              <Link
                to={valueOrFallback(finalCta?.primaryCtaLink, "/quote")}
              >
                <GoldButton>
                  {valueOrFallback(
                    finalCta?.primaryCtaText,
                    "Get a Quote",
                  )}
                </GoldButton>
              </Link>
              <Link
                to={valueOrFallback(
                  finalCta?.secondaryCtaLink,
                  "/contact",
                )}
              >
                <TextLink>
                  {valueOrFallback(
                    finalCta?.secondaryCtaText,
                    "Contact Us",
                  )}
                </TextLink>
              </Link>
            </div>
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
              {contactLines.length > 0 ? (
                contactLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))
              ) : (
                <>
                  Contact information placeholder
                  <br />
                  Service area placeholder
                </>
              )}
            </p>
            <div className="mt-4 space-y-2 text-xs text-[#66635E]">
              <span className="block">Privacy Policy</span>
              <span className="block">Terms and Conditions</span>
              <span className="block">Cookie Policy</span>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-[1440px] border-t border-[#D8D5CF] px-5 py-4 text-[10px] font-bold uppercase tracking-[.1em] text-[#66635E] sm:px-10 lg:px-16">
          {valueOrFallback(
            copyright?.value,
            "© Clean Up Central · Copyright information placeholder",
          )}
        </div>
      </footer>
    </main>
  );
}

function ListBlock({
  title,
  icon: Icon,
  items,
  fallbacks,
}: {
  title: string;
  icon: typeof ShieldCheck;
  items: PageSection[];
  fallbacks: PageSection[];
}) {
  return (
    <div className="bg-white p-7">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center border border-[#B08A3C] text-[#B08A3C]">
          <Icon size={20} strokeWidth={1.75} />
        </span>
        <h3 className="text-base font-bold">{title}</h3>
      </div>
      <ul className="mt-6 space-y-3">
        {items.map((item, index) => {
          const fallback = fallbackFor(item, fallbacks, index);
          const label = valueOrFallback(
            item.heading,
            fallback.heading ?? "Service item",
          );

          return (
            <li
              className="flex gap-3 text-sm leading-6 text-[#66635E]"
              key={item.title ?? label}
            >
              <span className="mt-[10px] size-1.5 shrink-0 rounded-full bg-[#B08A3C]" />
              {label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}