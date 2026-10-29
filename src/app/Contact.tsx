import {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Mail,
  MapPin,
  Menu,
  Paperclip,
  Phone,
  X,
} from "lucide-react";
import { Link } from "react-router";
import horizontalFullColour from "@/imports/IMG_1776556945431__2_.png";
import {
  usePageSection,
  useSiteSetting,
} from "@/cms/CmsProvider";
import { resolveCmsImage } from "@/cms/cmsMedia";
import {
  CONTACT_FORM_INITIAL_VALUES,
  ContactEnquiryRequestError,
  contactPayloadFingerprint,
  createContactEnquiryPayload,
  createContactSubmissionId,
  resolveContactApiBaseUrl,
  submitContactEnquiry,
  validateContactForm,
} from "./contactEnquiry.js";

const fallbackFaqImage =
  "https://images.unsplash.com/photo-1641210791935-9603630cc28a?w=900&h=600&fit=crop&auto=format";

const navigation = [
  ["Home", "/home"],
  ["About", "/about"],
  ["Cleaning Services", "/cleaning-services"],
  ["Commercial Cleaning", "/commercial-cleaning"],
  ["Property Support", "/property-support"],
  ["Contact Us", "/contact"],
] as const;

function valueOrFallback(
  value: string | undefined,
  fallback: string,
) {
  return value?.trim() || fallback;
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
  disabled = false,
}: {
  children: ReactNode;
  full?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-[4px] bg-[#B08A3C] px-5 text-[11px] font-bold uppercase tracking-[.08em] text-white shadow-[inset_0_-1px_0_rgba(18,18,18,.25)] transition duration-[var(--motion-standard)] ease-[var(--ease-out)] hover:bg-[#7A5A1E] disabled:cursor-not-allowed disabled:opacity-60 ${full ? "w-full" : ""}`}
    >
      {children}
      <ArrowRight size={16} strokeWidth={1.75} />
    </button>
  );
}

function Field({
  label,
  full = false,
  error,
  children,
}: {
  label: string;
  full?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className={full ? "md:col-span-2" : ""}>
      <span className="block text-[11px] font-bold">
        {label}
      </span>
      {children}
      {error && (
        <span className="mt-2 block text-xs text-[#9B2C2C]">
          {error}
        </span>
      )}
    </label>
  );
}

interface ContactFormValues {
  fullName: string;
  email: string;
  phone: string;
  enquiryType: string;
  preferredContactMethod: string;
  message: string;
  privacyConsent: boolean;
  website: string;
}

type ContactFieldErrors =
  Partial<
    Record<
      keyof ContactFormValues,
      string
    >
  >;

interface ContactConfirmation {
  enquiryNumber: string;
  message: string;
  preferredContactMethod: string;
}

const inputClassName =
  "mt-2 h-[52px] w-full rounded-[4px] border border-[#D8D5CF] bg-white px-3 text-sm outline-none transition duration-[var(--motion-standard)] ease-[var(--ease-out)] focus:border-2 focus:border-[#B08A3C]";

const selectClassName =
  "h-[52px] w-full appearance-none rounded-[4px] border border-[#D8D5CF] bg-white px-3 text-sm outline-none focus:border-2 focus:border-[#B08A3C]";

export default function ContactPage() {
  const [drawer, setDrawer] = useState(false);

  const [form, setForm] =
    useState<ContactFormValues>(
      () => ({
        ...CONTACT_FORM_INITIAL_VALUES,
      }),
    );

  const [
    fieldErrors,
    setFieldErrors,
  ] = useState<ContactFieldErrors>({});

  const [
    submitState,
    setSubmitState,
  ] = useState<
    "idle" |
      "submitting" |
      "success" |
      "error"
  >("idle");

  const [
    submitError,
    setSubmitError,
  ] = useState("");

  const [
    confirmation,
    setConfirmation,
  ] = useState<
    ContactConfirmation | null
  >(null);

  const submissionIdRef =
    useRef(
      createContactSubmissionId(),
    );

  const lastFingerprintRef =
    useRef("");

  const hasAttemptedRef =
    useRef(false);

  const apiBaseUrl =
    resolveContactApiBaseUrl(
      import.meta.env
        .VITE_API_BASE_URL,
      window.location,
    );

  function updateField<
    Key extends keyof ContactFormValues,
  >(
    field: Key,
    value: ContactFormValues[Key],
  ) {
    if (hasAttemptedRef.current) {
      submissionIdRef.current =
        createContactSubmissionId();

      lastFingerprintRef.current =
        "";

      hasAttemptedRef.current =
        false;
    }

    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setFieldErrors(
      (current) => {
        const next = {
          ...current,
        };

        delete next[field];

        return next;
      },
    );

    setSubmitState("idle");
    setSubmitError("");
    setConfirmation(null);
  }

  function textChange(
    field:
      Exclude<
        keyof ContactFormValues,
        "privacyConsent"
      >,
  ) {
    return (
      event:
        ChangeEvent<
          HTMLInputElement |
            HTMLSelectElement |
            HTMLTextAreaElement
        >,
    ) => {
      updateField(
        field,
        event.target.value,
      );
    };
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const clientErrors =
      validateContactForm(
        form,
      ) as ContactFieldErrors;

    if (
      Object.keys(
        clientErrors,
      ).length > 0
    ) {
      setFieldErrors(
        clientErrors,
      );

      setSubmitState("error");

      setSubmitError(
        "Please check the highlighted information.",
      );

      return;
    }

    let submissionId =
      submissionIdRef.current;

    let payload =
      createContactEnquiryPayload(
        form,
        submissionId,
      );

    const fingerprint =
      contactPayloadFingerprint(
        payload,
      );

    if (
      lastFingerprintRef.current &&
      lastFingerprintRef.current !==
        fingerprint
    ) {
      submissionId =
        createContactSubmissionId();

      submissionIdRef.current =
        submissionId;

      payload =
        createContactEnquiryPayload(
          form,
          submissionId,
        );
    }

    lastFingerprintRef.current =
      contactPayloadFingerprint(
        payload,
      );

    hasAttemptedRef.current = true;

    setSubmitState("submitting");
    setSubmitError("");
    setFieldErrors({});

    try {
      const response =
        await submitContactEnquiry({
          apiBaseUrl,
          submissionId,
          payload,
        });

      setConfirmation({
        enquiryNumber:
          response.confirmation
            .enquiryNumber,

        message:
          response.confirmation
            .message,

        preferredContactMethod:
          response.confirmation
            .preferredContactMethod,
      });

      setSubmitState("success");
    } catch (error) {
      if (
        error instanceof
          ContactEnquiryRequestError
      ) {
        setFieldErrors(
          error.fieldErrors as
            ContactFieldErrors,
        );

        setSubmitError(
          error.message,
        );
      } else {
        setSubmitError(
          "We could not send your enquiry right now. Please try again.",
        );
      }

      setSubmitState("error");
    }
  }

  const hero = usePageSection("contact.hero");
  const faqs = usePageSection("contact.faqs");

  const businessTagline = useSiteSetting("business.tagline");
  const serviceArea = useSiteSetting("contact.service_area");
  const mondaySaturdayHours = useSiteSetting(
    "contact.hours_monday_saturday",
  );
  const sundayHours = useSiteSetting("contact.hours_sunday");
  const phone = useSiteSetting("contact.phone");
  const email = useSiteSetting("contact.email");
  const copyright = useSiteSetting("legal.copyright");

  const heroContent = hero ?? {
    eyebrow: "Get in touch",
    heading: "Let’s talk about your property.",
    body: "Tell us what you need and we will guide you through the most suitable next step.",
  };

  const faqContent = faqs ?? {
    eyebrow: "FAQs",
    heading: "Questions, answered simply.",
    body: "Find helpful information before getting in touch.",
    image: fallbackFaqImage,
    imageAltText: "Clean kitchen shelf detail",
    primaryCtaText: "View FAQs",
    primaryCtaLink: "/faqs",
  };

  const contactItems = [
    phone?.value?.trim()
      ? {
          Icon: Phone,
          label: "Phone",
          value: phone.value.trim(),
          href: phone.link?.trim() || `tel:${phone.value.trim()}`,
        }
      : null,
    email?.value?.trim()
      ? {
          Icon: Mail,
          label: "Email",
          value: email.value.trim(),
          href: email.link?.trim() || `mailto:${email.value.trim()}`,
        }
      : null,
    {
      Icon: MapPin,
      label: "Service area",
      value: valueOrFallback(serviceArea?.value, "Whole of London"),
      href: serviceArea?.link?.trim() || undefined,
    },
    {
      Icon: Clock3,
      label: "Operating hours",
      value: `Monday–Saturday: ${valueOrFallback(
        mondaySaturdayHours?.value,
        "06:00–20:00",
      )} · Sunday: ${valueOrFallback(
        sundayHours?.value,
        "14:00–20:00",
      )}`,
      href: undefined,
    },
  ].filter(Boolean) as Array<{
    Icon: typeof Phone;
    label: string;
    value: string;
    href?: string;
  }>;

  const footerContactLines = [
    phone?.value?.trim(),
    email?.value?.trim(),
    serviceArea?.value?.trim(),
  ].filter((value): value is string => Boolean(value));

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
                className={`flex h-full items-center border-b-2 text-[10px] font-bold uppercase tracking-[.09em] transition duration-[var(--motion-standard)] ease-[var(--ease-out)] ${
                  to === "/contact"
                    ? "border-[#B08A3C] text-[#121212]"
                    : "border-transparent text-[#66635E] hover:text-[#121212]"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <Link className="hidden lg:block" to="/quote">
            <span className="inline-flex min-h-12 items-center rounded-[4px] bg-[#B08A3C] px-5 text-[11px] font-bold uppercase tracking-[.08em] text-white shadow-[inset_0_-1px_0_rgba(18,18,18,.25)]">
              Get a Quote
            </span>
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
                className={`block border-b border-[#D8D5CF] py-4 text-xs font-bold uppercase tracking-[.1em] ${
                  to === "/contact" ? "text-[#B08A3C]" : ""
                }`}
              >
                {label}
              </Link>
            ))}
            <Link
              onClick={() => setDrawer(false)}
              className="mt-4 block"
              to="/quote"
            >
              <span className="flex min-h-12 w-full items-center justify-center rounded-[4px] bg-[#B08A3C] text-[11px] font-bold uppercase tracking-[.08em] text-white">
                Get a Quote
              </span>
            </Link>
          </div>
        )}
      </header>

      <section className="border-b border-[#D8D5CF] bg-white">
        <div className="mx-auto max-w-[1440px] px-5 pt-16 sm:px-10 lg:hidden">
          <Eyebrow>
            {valueOrFallback(heroContent.eyebrow, "Get in touch")}
          </Eyebrow>
          <h1 className="mt-6 max-w-md font-serif text-[50px] font-medium leading-[.96] tracking-[-.035em] sm:text-[60px]">
            {valueOrFallback(
              heroContent.heading,
              "Let’s talk about your property.",
            )}
          </h1>
          <p className="mt-6 max-w-sm text-[16px] leading-7 text-[#343434]">
            {valueOrFallback(
              heroContent.body,
              "Tell us what you need and we will guide you through the most suitable next step.",
            )}
          </p>
        </div>
        <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-10 sm:px-10 lg:grid-cols-[.7fr_1fr] lg:gap-16 lg:px-16 lg:py-16">
          <div className="order-2 lg:order-1">
            <div className="hidden lg:block">
              <Eyebrow>
                {valueOrFallback(heroContent.eyebrow, "Get in touch")}
              </Eyebrow>
              <h1 className="mt-6 max-w-md font-serif text-[50px] font-medium leading-[.96] tracking-[-.035em] sm:text-[60px]">
                {valueOrFallback(
                  heroContent.heading,
                  "Let’s talk about your property.",
                )}
              </h1>
              <p className="mt-6 max-w-sm text-[16px] leading-7 text-[#343434]">
                {valueOrFallback(
                  heroContent.body,
                  "Tell us what you need and we will guide you through the most suitable next step.",
                )}
              </p>
            </div>
            <div className="mt-8 divide-y divide-[#D8D5CF] border-y border-[#D8D5CF]">
              {contactItems.map(({ Icon, label, value, href }) => (
                <div className="flex gap-4 py-4" key={label}>
                  <span className="grid size-9 shrink-0 place-items-center border border-[#B08A3C] text-[#B08A3C]">
                    <Icon size={18} strokeWidth={1.75} />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#66635E]">
                      {label}
                    </p>
                    {href ? (
                      <a className="mt-1 block text-sm font-bold" href={href}>
                        {value}
                      </a>
                    ) : (
                      <p className="mt-1 text-sm font-bold">{value}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 max-w-sm border-l-4 border-[#B08A3C] bg-[#F1EDE4] px-4 py-3 text-xs leading-5 text-[#66635E]">
              Urgent or property-support attendance is subject to
              availability.
            </p>
          </div>

          <div className="order-1 lg:order-2">
            <form
              onSubmit={handleSubmit}
              noValidate
              className="border border-[#D8D5CF] bg-[#FAF9F6] p-6 shadow-[0_2px_8px_rgba(18,18,18,.10)] sm:p-8"
            >
              <h2 className="text-xl font-bold">
                Send an enquiry
              </h2>

              <p className="mt-2 text-sm leading-6 text-[#66635E]">
                We will use the details you provide to understand your
                enquiry and respond using your preferred contact method.
              </p>

              <input
                type="text"
                name="website"
                value={form.website}
                onChange={textChange("website")}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute left-[-9999px] size-px opacity-0"
              />

              <div className="mt-7 grid gap-x-5 gap-y-5 md:grid-cols-2">
                <Field
                  label="Full Name"
                  error={fieldErrors.fullName}
                >
                  <input
                    id="contact-full-name"
                    name="fullName"
                    type="text"
                    autoComplete="name"
                    value={form.fullName}
                    onChange={textChange("fullName")}
                    disabled={submitState === "submitting"}
                    aria-invalid={Boolean(fieldErrors.fullName)}
                    className={inputClassName}
                  />
                </Field>

                <Field
                  label="Email Address"
                  error={fieldErrors.email}
                >
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={textChange("email")}
                    disabled={submitState === "submitting"}
                    aria-invalid={Boolean(fieldErrors.email)}
                    className={inputClassName}
                  />
                </Field>

                <Field
                  label="Phone Number"
                  error={fieldErrors.phone}
                >
                  <input
                    id="contact-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={textChange("phone")}
                    disabled={submitState === "submitting"}
                    aria-invalid={Boolean(fieldErrors.phone)}
                    className={inputClassName}
                  />
                </Field>

                <Field
                  label="Enquiry Type"
                  error={fieldErrors.enquiryType}
                >
                  <span className="relative mt-2 block">
                    <select
                      id="contact-enquiry-type"
                      name="enquiryType"
                      value={form.enquiryType}
                      onChange={textChange("enquiryType")}
                      disabled={submitState === "submitting"}
                      aria-invalid={Boolean(fieldErrors.enquiryType)}
                      className={selectClassName}
                    >
                      <option value="">
                        Select an option
                      </option>
                      <option value="Cleaning Services">
                        Cleaning Services
                      </option>
                      <option value="Airbnb / Short-let">
                        Airbnb / Short-let
                      </option>
                      <option value="Commercial Cleaning">
                        Commercial Cleaning
                      </option>
                      <option value="Property Support">
                        Property Support
                      </option>
                      <option value="Other">
                        Other
                      </option>
                    </select>

                    <ChevronDown
                      className="pointer-events-none absolute right-3 top-[18px]"
                      size={16}
                    />
                  </span>
                </Field>

                <Field
                  label="Preferred Contact Method"
                  full
                  error={fieldErrors.preferredContactMethod}
                >
                  <span className="relative mt-2 block">
                    <select
                      id="contact-method"
                      name="preferredContactMethod"
                      value={form.preferredContactMethod}
                      onChange={textChange("preferredContactMethod")}
                      disabled={submitState === "submitting"}
                      aria-invalid={Boolean(
                        fieldErrors.preferredContactMethod,
                      )}
                      className={selectClassName}
                    >
                      <option value="">
                        Select an option
                      </option>
                      <option value="Email">
                        Email
                      </option>
                      <option value="Phone">
                        Phone
                      </option>
                      <option value="WhatsApp">
                        WhatsApp
                      </option>
                    </select>

                    <ChevronDown
                      className="pointer-events-none absolute right-3 top-[18px]"
                      size={16}
                    />
                  </span>
                </Field>

                <Field
                  label="Message"
                  full
                  error={fieldErrors.message}
                >
                  <textarea
                    id="contact-message"
                    name="message"
                    value={form.message}
                    onChange={textChange("message")}
                    disabled={submitState === "submitting"}
                    aria-invalid={Boolean(fieldErrors.message)}
                    maxLength={5_000}
                    className="mt-2 min-h-32 w-full rounded-[4px] border border-[#D8D5CF] bg-white p-3 text-sm outline-none transition duration-[var(--motion-standard)] ease-[var(--ease-out)] focus:border-2 focus:border-[#B08A3C]"
                  />
                </Field>

                <div className="md:col-span-2">
                  <div className="flex gap-3 border border-[#D8D5CF] bg-white px-4 py-3 text-xs leading-5 text-[#66635E]">
                    <Paperclip
                      className="mt-0.5 shrink-0 text-[#B08A3C]"
                      size={17}
                    />

                    <p>
                      Need to share photos or documents? Mention this in
                      your message and our team will arrange the secure
                      next step.
                    </p>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-start gap-3 text-xs leading-5 text-[#343434]">
                    <input
                      type="checkbox"
                      name="privacyConsent"
                      checked={form.privacyConsent}
                      onChange={(event) =>
                        updateField(
                          "privacyConsent",
                          event.target.checked,
                        )
                      }
                      disabled={submitState === "submitting"}
                      className="mt-1 size-4 accent-[#B08A3C]"
                    />

                    <span>
                      I agree that Clean Up Central may use these details
                      to respond to my enquiry.
                    </span>
                  </label>

                  {fieldErrors.privacyConsent && (
                    <p className="mt-2 text-xs text-[#9B2C2C]">
                      {fieldErrors.privacyConsent}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-7">
                <GoldButton
                  full
                  disabled={submitState === "submitting"}
                >
                  {submitState === "submitting"
                    ? "Sending enquiry"
                    : "Send enquiry"}
                </GoldButton>
              </div>

              {submitState === "error" && submitError && (
                <div
                  role="alert"
                  className="mt-5 border-l-4 border-[#9B2C2C] bg-[#F7EEEE] p-4 text-sm text-[#7A2020]"
                >
                  <p>
                    <b>We could not send the enquiry.</b>{" "}
                    {submitError}
                  </p>
                </div>
              )}

              {submitState === "success" && confirmation && (
                <div
                  role="status"
                  aria-live="polite"
                  className="mt-5 flex gap-3 border-l-4 border-[#176B45] bg-[#EDF6F1] p-4 text-sm text-[#176B45]"
                >
                  <CheckCircle2
                    className="shrink-0"
                    size={18}
                  />

                  <div>
                    <p>
                      <b>Enquiry received.</b>{" "}
                      {confirmation.message}
                    </p>

                    <p className="mt-1 text-xs">
                      Reference:{" "}
                      <b>
                        {confirmation.enquiryNumber}
                      </b>
                    </p>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      </section>

      <section className="border-b border-[#D8D5CF] bg-[#F1EDE4]">
        <div className="mx-auto grid max-w-[1440px] overflow-hidden px-5 sm:px-10 lg:grid-cols-[1.15fr_.85fr] lg:px-16">
          <div className="flex min-h-64 flex-col justify-center py-12 lg:pr-16">
            <Eyebrow>
              {valueOrFallback(faqContent.eyebrow, "FAQs")}
            </Eyebrow>
            <h2 className="mt-4 font-serif text-[40px] leading-[1] tracking-[-.03em] sm:text-[48px]">
              {valueOrFallback(
                faqContent.heading,
                "Questions, answered simply.",
              )}
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-7 text-[#66635E]">
              {valueOrFallback(
                faqContent.body,
                "Find helpful information before getting in touch.",
              )}
            </p>
            <Link
              className="mt-6 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.08em] hover:text-[#7A5A1E]"
              to={valueOrFallback(faqContent.primaryCtaLink, "/faqs")}
            >
              {valueOrFallback(
                faqContent.primaryCtaText,
                "View FAQs",
              )}{" "}
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="min-h-64">
            <img
              src={resolveCmsImage(
                faqContent.image,
                fallbackFaqImage,
              )}
              alt={valueOrFallback(
                faqContent.imageAltText,
                "Clean kitchen shelf detail",
              )}
              className="size-full object-cover"
            />
          </div>
        </div>
      </section>

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
              <Link
                className="block hover:text-[#B08A3C]"
                to="/contact"
              >
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
              {footerContactLines.length > 0
                ? footerContactLines.map((line, index) => (
                    <span key={line}>
                      {index > 0 && <br />}
                      {line}
                    </span>
                  ))
                : "Whole of London"}
            </p>
          </div>
        </div>
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 border-t border-[#D8D5CF] px-5 py-4 text-[10px] font-bold uppercase tracking-[.1em] text-[#66635E] sm:px-10 lg:px-16">
          {valueOrFallback(
            copyright?.value,
            "© 2026 Clean Up Central Ltd. All rights reserved.",
          )}
          <nav aria-label="Legal information" className="flex flex-wrap gap-4 normal-case tracking-normal">
            <Link to="/privacy" className="hover:text-[#B08A3C]">Privacy Notice</Link>
            <Link to="/terms" className="hover:text-[#B08A3C]">Terms &amp; Conditions</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}