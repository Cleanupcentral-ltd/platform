import { Link } from "react-router";

const UPDATED = "14 August 2026";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-[#D8D5CF] pt-8">
      <h2 className="font-serif text-2xl text-[#121212] sm:text-3xl">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-sm leading-7 text-[#4F4C47]">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#FAF9F6] text-[#121212]">
      <header className="border-b border-[#D8D5CF] bg-white">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-5 py-5 sm:px-10">
          <Link
            to="/home"
            className="text-sm font-bold uppercase tracking-[.12em]"
          >
            Clean Up Central
          </Link>
          <Link
            to="/home"
            className="text-xs font-bold uppercase tracking-[.08em] text-[#7A5A1E]"
          >
            Back to website
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-[900px] space-y-10 px-5 py-12 sm:px-10 sm:py-16">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#7A5A1E]">
            Legal
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">
            Website Terms of Use
          </h1>
          <p className="mt-4 text-sm leading-7 text-[#66635E]">
            Last updated: {UPDATED}
          </p>
        </div>

        <Section title="About these terms">
          <p>
            These terms apply when you use the Clean Up Central website. By using the website, you agree to use it lawfully and in accordance with these terms. These website terms do not replace any quotation, booking terms, service agreement or other terms that apply to a cleaning or property-support service purchased from us.
          </p>
        </Section>

        <Section title="About Clean Up Central">
          <p>
            This website is operated by Clean Up Central Ltd, a company registered in England and Wales under company number 17167134. Our registered office is 124–128 City Road, London, United Kingdom, EC1V 2NX.
          </p>
          <p>
            You can contact us at cleanupcentral@outlook.com.
          </p>
        </Section>

        <Section title="Website information and quotations">
          <p>
            We aim to keep information on the website accurate and useful, but website content is provided for general information and may change. Service availability, scope, timing and price remain subject to the relevant quotation, confirmation and any service-specific terms.
          </p>
          <p>
            An online estimate or quotation request does not by itself create a booking or contract unless and until Clean Up Central confirms the applicable arrangement in accordance with the relevant booking process.
          </p>
        </Section>

        <Section title="Acceptable use">
          <p>
            You must not misuse the website, attempt to gain unauthorised access to our systems, introduce malicious code, interfere with the website’s operation, scrape or extract information in a way that breaches applicable law or third-party rights, or use the website for unlawful or fraudulent purposes.
          </p>
        </Section>

        <Section title="Intellectual property">
          <p>
            Unless stated otherwise, the website design, Clean Up Central branding, original text, graphics and other original materials on this website belong to Clean Up Central Ltd or are used with permission. You may view and use the website for ordinary personal or business information purposes, but you may not reproduce, sell, republish or commercially exploit our original materials without permission unless the law allows it.
          </p>
        </Section>

        <Section title="Third-party services and links">
          <p>
            The website or our internal systems may use or link to third-party services. Third-party websites and services operate under their own terms and privacy practices, and we are not responsible for their content or availability except where the law provides otherwise.
          </p>
          <p>
            Where Google Maps Platform features are used, including Google Places, use of those features is also subject to Google’s applicable terms and privacy information.
          </p>
        </Section>

        <Section title="Availability and changes">
          <p>
            We may update, suspend or withdraw website features where reasonably necessary for maintenance, security, compliance or business reasons. We do not guarantee that the website will always be available or free from interruption.
          </p>
        </Section>

        <Section title="Liability">
          <p>
            Nothing in these terms excludes or limits liability where doing so would be unlawful. Subject to that, we are not responsible for losses caused solely by reliance on general website information where a specific quotation, booking confirmation or service agreement should reasonably have been obtained, or for events outside our reasonable control.
          </p>
        </Section>

        <Section title="Privacy">
          <p>
            Our Privacy Notice explains how we use personal information in connection with the website, enquiries, quotations, services and business-development activity.
          </p>
          <p>
            <Link
              to="/privacy"
              className="font-bold text-[#7A5A1E] underline underline-offset-4"
            >
              Read our Privacy Notice
            </Link>
          </p>
        </Section>

        <Section title="Governing law">
          <p>
            These website terms are governed by the laws of England and Wales. The courts with jurisdiction under applicable law may hear disputes relating to these terms.
          </p>
        </Section>

        <Section title="Changes to these terms">
          <p>
            We may update these terms when the website, our services or applicable requirements change. The latest version will be published on this page with its updated date.
          </p>
        </Section>
      </article>
    </main>
  );
}
