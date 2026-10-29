import { Link } from "react-router";

const UPDATED = "29 October 2026";

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

export default function PrivacyPage() {
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
            Privacy Notice
          </h1>
          <p className="mt-4 text-sm leading-7 text-[#66635E]">
            Last updated: {UPDATED}
          </p>
        </div>

        <Section title="Who we are">
          <p>
            Clean Up Central Ltd is the controller of personal information covered by this notice. We are a company registered in England and Wales under company number 17167134. Our registered office is 124–128 City Road, London, United Kingdom, EC1V 2NX.
          </p>
          <p>
            For privacy questions, requests or objections, contact us at cleanupcentral@outlook.com.
          </p>
        </Section>

        <Section title="Information we collect">
          <p>
            We may collect information that you provide when you contact us, request a quotation, make an enquiry or communicate with us about our services. This can include your name, contact details, property or service information, correspondence and other information needed to respond to your request or provide our services.
          </p>
          <p>
            For business development, we may also use publicly available business information, including business names, business contact details, company or registration information, public website information and evidence about the services, locations or activities of an organisation. Where a business contact identifies an individual, that information is treated as personal data.
          </p>
        </Section>

        <Section title="Where business prospect information comes from">
          <p>
            We use public and first-party sources to identify and assess organisations that may reasonably be interested in our cleaning and property-support services. Sources may include an organisation’s own website, Companies House, the Charity Commission and other appropriate official or public sources.
          </p>
          <p>
            We may use Google Places to discover businesses. Google Places information is used for discovery and display rather than as our permanent source of verified business identity or contact information. We may retain a Google Place ID so that the relevant place can be referenced again, while durable prospect evidence is obtained from first-party or appropriate official sources.
          </p>
        </Section>

        <Section title="Why we use information and our lawful bases">
          <p>
            We use personal information to respond to enquiries, prepare quotations, provide and administer services, maintain business records, secure and operate our systems, and communicate with customers and business contacts.
          </p>
          <p>
            Depending on the activity, we rely on steps requested before entering into a contract, performance of a contract, compliance with legal obligations, or our legitimate interests. Our legitimate interests include operating and improving our business, preventing misuse, maintaining accurate records and introducing relevant Clean Up Central services to suitable business organisations in a proportionate way.
          </p>
          <p>
            Where we use legitimate interests for business-to-business marketing, we assess whether the use is necessary and balanced against the rights and expectations of the people concerned. We do not treat a high prospect score as permission to contact someone where a legal, suppression or verification blocker applies.
          </p>
        </Section>

        <Section title="Business-to-business marketing">
          <p>
            Our Lead Engine is an internal founder tool. It is designed to restrict email outreach to verified corporate business prospects using a verified generic business email or another approved business contact route. It does not automatically send marketing emails.
          </p>
          <p>
            You can object to direct marketing at any time. If you ask us not to contact you for marketing, we will stop and keep only the minimum information needed to respect that request and prevent further marketing contact.
          </p>
        </Section>

        <Section title="How long we keep information">
          <p>
            We keep information only for as long as it is reasonably needed for the purpose for which it was collected, including legal, accounting, security and record-keeping requirements. Prospect information that does not progress is reviewed and removed under our internal retention schedule. Contact and customer records may be kept longer where needed to manage an ongoing relationship, resolve disputes or meet legal obligations.
          </p>
          <p>
            Suppression records may be retained for longer than ordinary prospect records because deleting them could cause us to contact someone again after they have objected.
          </p>
        </Section>

        <Section title="Who we share information with">
          <p>
            We use service providers to operate our website, systems, communications and business processes. These may include hosting, database, website, email and infrastructure providers. We disclose only the information reasonably needed for the relevant service and require providers to handle it appropriately.
          </p>
          <p>
            We may also disclose information where required by law, to protect our legal rights, or in connection with a genuine business reorganisation or transfer where appropriate safeguards apply.
          </p>
        </Section>

        <Section title="International transfers">
          <p>
            Some technology providers may process information outside the United Kingdom. Where UK data-protection law requires safeguards for an international transfer, we use an appropriate transfer mechanism or rely on another lawful safeguard available for that transfer.
          </p>
        </Section>

        <Section title="Security">
          <p>
            We use technical and organisational measures intended to protect information against unauthorised access, loss, alteration or disclosure. Access to the Lead Engine is restricted to authorised founders and protected by authentication controls.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            Depending on the circumstances, you may have rights to ask for access to your personal data, correction, deletion, restriction of use, objection to processing and data portability. You also have an absolute right to object to the use of your personal data for direct marketing.
          </p>
          <p>
            To exercise a right or raise a privacy concern, email cleanupcentral@outlook.com. You also have the right to complain to the UK Information Commissioner’s Office if you are unhappy with how your information has been handled.
          </p>
        </Section>

        <Section title="Cookies and website technology">
          <p>
            Our website uses essential technology needed to operate and secure the site. If you choose to accept analytics, we use Google Analytics 4 to understand website visits and successful quote requests. Analytics is optional: you can reject it and still use the website. You can change your choice using the Cookie settings button on the website. We do not send your quote form contact details to Google Analytics.
          </p>
        </Section>

        <Section title="Google Maps Platform">
          <p>
            Parts of our internal business-development tooling use Google Maps Platform services, including Google Places. Use of Google Maps Platform features is also subject to Google’s applicable terms and privacy information.
          </p>
        </Section>

        <Section title="Changes to this notice">
          <p>
            We may update this notice when our services, systems or legal obligations change. The latest version will be published on this page with its updated date.
          </p>
        </Section>
      </article>
    </main>
  );
}
