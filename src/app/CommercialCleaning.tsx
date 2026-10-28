import { useState } from "react";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Dumbbell,
  Menu,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { Link } from "react-router";
import horizontalFullColour from "@/imports/IMG_1776556945431__2_.png";

const navigation = [
  ["Home", "/home"],
  ["About", "/about"],
  ["Cleaning Services", "/cleaning-services"],
  ["Commercial Cleaning", "/commercial-cleaning"],
  ["Property Support", "/property-support"],
  ["Contact Us", "/contact"],
] as const;

const commercialQuote = "/quote?service=commercial-cleaning";
const officeImage =
  "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1400&h=1100&fit=crop&auto=format";

const premises = [
  {
    title: "Offices and workplaces",
    description: "Regular and one-off cleaning for offices, meeting rooms and shared work areas.",
    Icon: Building2,
  },
  {
    title: "Gyms and fitness studios",
    description: "Equipment surfaces, mirrors, floors and communal areas cleaned to an agreed specification.",
    Icon: Dumbbell,
  },
  {
    title: "Coworking spaces",
    description: "Practical cleaning for desks, shared facilities and high-use communal spaces.",
    Icon: Users,
  },
  {
    title: "Communal areas",
    description: "Hallways, shared entrances and common areas in managed buildings.",
    Icon: ClipboardCheck,
  },
];

const tasks = [
  "Dusting and wiping accessible surfaces",
  "Vacuuming, sweeping and mopping appropriate floors",
  "Cleaning doors, handles and commonly touched areas",
  "Emptying general waste bins and replacing liners where agreed",
  "Cleaning kitchens and washrooms where included in the specification",
  "Cleaning mirrors, visible glass and other agreed fixtures",
];

const approach = [
  {
    number: "01",
    title: "Tell us about your premises",
    copy: "Share the location, layout, cleaning requirements and preferred frequency.",
  },
  {
    number: "02",
    title: "Receive a tailored quotation",
    copy: "We assess the work and agree the service scope and schedule before confirming arrangements.",
  },
  {
    number: "03",
    title: "We coordinate your cleaning",
    copy: "Your cleaning is organised around the agreed specification, with a clear point of contact.",
  },
  {
    number: "04",
    title: "Quality and communication",
    copy: "We review service feedback and address any concerns against the agreed scope.",
  },
];

const faqs = [
  {
    question: "Do you offer regular commercial cleaning?",
    answer: "Yes. We can discuss weekly, multiple-times-weekly and other recurring arrangements depending on the premises, required tasks and availability.",
  },
  {
    question: "Can you provide a one-off commercial clean?",
    answer: "Yes. One-off and deeper cleaning requests are assessed individually so the time, equipment and scope can be agreed in advance.",
  },
  {
    question: "Do you supply cleaning products and equipment?",
    answer: "We can include cleaning products and equipment in a tailored arrangement. Please tell us about any premises-specific requirements when requesting a quote.",
  },
  {
    question: "How is commercial cleaning priced?",
    answer: "Pricing depends on the size and layout of the premises, the tasks required and how often the cleaning is needed. We provide an individual quotation rather than a fixed public price.",
  },
  {
    question: "Can cleaning be arranged outside normal business hours?",
    answer: "Tell us your preferred times when enquiring. We will confirm what can be accommodated before any booking is agreed.",
  },
];

function Header() {
  const [drawer, setDrawer] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-[#D8D5CF] bg-white/95 backdrop-blur">
      <div className="relative mx-auto flex h-[68px] max-w-[1440px] items-center justify-between px-5 sm:h-20 sm:px-10 lg:px-16">
        <Link to="/home" aria-label="Clean Up Central home">
          <span className="block h-10 w-[145px] overflow-hidden sm:h-11 sm:w-[180px]">
            <img src={horizontalFullColour} alt="Clean Up Central" className="size-full scale-[1.65] object-contain" />
          </span>
        </Link>
        <nav aria-label="Main navigation" className="absolute left-1/2 hidden h-full -translate-x-1/2 items-center gap-4 lg:flex">
          {navigation.map(([label, route]) => (
            <Link key={route} to={route} aria-current={route === "/commercial-cleaning" ? "page" : undefined}
              className={"flex h-full items-center border-b-2 text-[10px] font-bold uppercase tracking-[.06em] transition-colors " +
                (route === "/commercial-cleaning" ? "border-[#B08A3C]" : "border-transparent text-[#66635E] hover:text-[#121212]")}>
              {label}
            </Link>
          ))}
        </nav>
        <Link className="hidden min-h-12 items-center bg-[#B08A3C] px-5 text-[11px] font-bold uppercase tracking-[.08em] text-white hover:bg-[#7A5A1E] lg:inline-flex" to={commercialQuote}>
          Request a Quote
        </Link>
        <button type="button" onClick={() => setDrawer(!drawer)} aria-expanded={drawer} aria-label="Toggle navigation"
          className="grid size-11 place-items-center border border-[#D8D5CF] lg:hidden">
          {drawer ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {drawer && (
        <nav aria-label="Mobile navigation" className="border-t border-[#D8D5CF] bg-white px-5 pb-5 lg:hidden">
          {navigation.map(([label, route]) => (
            <Link key={route} to={route} onClick={() => setDrawer(false)}
              className="block border-b border-[#D8D5CF] py-4 text-xs font-bold uppercase tracking-[.1em]">
              {label}
            </Link>
          ))}
          <Link to={commercialQuote} onClick={() => setDrawer(false)}
            className="mt-4 flex min-h-12 items-center justify-center bg-[#B08A3C] text-xs font-bold uppercase text-white">
            Request a Commercial Quote
          </Link>
        </nav>
      )}
    </header>
  );
}

function QuoteLink({ label = "Request a Commercial Quote" }: { label?: string }) {
  return (
    <Link to={commercialQuote}
      className="inline-flex min-h-12 items-center justify-center gap-3 rounded-[4px] bg-[#B08A3C] px-6 text-[11px] font-bold uppercase tracking-[.08em] text-white transition-colors hover:bg-[#7A5A1E]">
      {label} <ArrowRight size={17} aria-hidden="true" />
    </Link>
  );
}

export default function CommercialCleaningPage() {
  return (
    <main className="min-h-screen bg-[#FAF9F6] font-sans text-[#121212]">
      <Header />
      <section className="mx-auto grid max-w-[1440px] border-b border-[#D8D5CF] lg:grid-cols-2" aria-labelledby="commercial-title">
        <div className="flex min-h-[430px] flex-col justify-center px-5 py-16 sm:px-10 lg:px-20">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#7A5A1E]">Cleaning for London businesses</p>
          <h1 id="commercial-title" className="mt-6 max-w-xl font-serif text-[48px] leading-[.98] tracking-[-.035em] sm:text-[62px]">
            Reliable Cleaning for <span className="text-[#B08A3C]">Every Working Environment.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-[#343434]">
            Reliable, professionally coordinated cleaning for offices, workplaces and shared commercial spaces across London. One-off or ongoing support, with a clear scope of work and straightforward communication.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <QuoteLink />
            <Link to="/contact" className="inline-flex min-h-12 items-center gap-2 text-xs font-bold uppercase tracking-[.08em] hover:text-[#7A5A1E]">
              Speak to our team <ArrowRight size={16} />
            </Link>
          </div>
        </div>
        <div className="min-h-[300px] lg:min-h-[540px]">
          <img src={officeImage} alt="Illustrative photograph of a contemporary office interior"
            className="h-full w-full object-cover" />
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 py-16 sm:px-10 lg:px-16" aria-labelledby="premises-title">
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#66635E]">Who we work with</p>
        <h2 id="premises-title" className="mt-3 max-w-3xl font-serif text-[42px] leading-[1.05] sm:text-[50px]">
          Practical cleaning for the spaces your business depends on.
        </h2>
        <div className="mt-9 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {premises.map(({ title, description, Icon }) => (
            <article key={title} className="border border-[#D8D5CF] bg-white p-6">
              <span className="grid size-11 place-items-center border border-[#B08A3C] text-[#B08A3C]">
                <Icon size={21} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-base font-bold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#66635E]">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[#D8D5CF] bg-white" aria-labelledby="scope-title">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-16 sm:px-10 lg:grid-cols-[.85fr_1.15fr] lg:px-16">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#66635E]">Cleaning specification</p>
            <h2 id="scope-title" className="mt-3 font-serif text-[42px] leading-[1.05]">What's included?</h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-[#66635E]">
              Every premises is different. We agree a cleaning specification before work begins, so you know what is included, which areas are covered and which additional tasks require a separate quotation.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {tasks.map((task) => (
              <div key={task} className="flex items-start gap-3 border-b border-[#D8D5CF] pb-4">
                <CheckCircle2 size={20} strokeWidth={1.75} aria-hidden="true" className="mt-1 shrink-0 text-[#B08A3C]" />
                <p className="text-sm leading-6">{task}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 py-16 sm:px-10 lg:px-16" aria-labelledby="scheduling-title">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="border border-[#D8D5CF] bg-[#F1EDE4] p-8">
            <CalendarDays aria-hidden="true" size={28} strokeWidth={1.5} className="text-[#B08A3C]" />
            <h2 id="scheduling-title" className="mt-5 font-serif text-[36px]">Flexible cleaning schedules</h2>
            <p className="mt-3 text-sm leading-7 text-[#343434]">
              From a one-off clean to a recurring service, we'll discuss the frequency and preferred times that suit your premises and confirm an achievable schedule.
            </p>
          </div>
          <div className="border border-[#D8D5CF] bg-white p-8">
            <ShieldCheck aria-hidden="true" size={28} strokeWidth={1.5} className="text-[#B08A3C]" />
            <h2 className="mt-5 font-serif text-[36px]">Clear standards and oversight</h2>
            <p className="mt-3 text-sm leading-7 text-[#343434]">
              We work to an agreed specification, coordinate the cleaning arrangements and provide a point of contact for questions, feedback and quality concerns.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-[#D8D5CF] bg-white" aria-labelledby="approach-title">
        <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-10 lg:px-16">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#66635E]">Our approach</p>
          <h2 id="approach-title" className="mt-3 font-serif text-[42px]">How commercial cleaning works</h2>
          <div className="mt-9 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {approach.map(({ number, title, copy }) => (
              <div key={number} className="border-t-2 border-[#121212] pt-5">
                <span className="font-serif text-3xl text-[#B08A3C]">{number}</span>
                <h3 className="mt-5 font-bold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#66635E]">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-5 py-16 sm:px-10" aria-labelledby="commercial-faq-title">
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#66635E]">Useful information</p>
        <h2 id="commercial-faq-title" className="mt-3 font-serif text-[42px]">Commercial cleaning FAQs</h2>
        <div className="mt-8 divide-y divide-[#D8D5CF] border-y border-[#D8D5CF]">
          {faqs.map(({ question, answer }) => (
            <details key={question} className="group py-5">
              <summary className="cursor-pointer pr-3 text-sm font-bold marker:text-[#B08A3C]">{question}</summary>
              <p className="mt-3 max-w-3xl pl-4 text-sm leading-7 text-[#66635E]">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="bg-[#121212]" aria-labelledby="commercial-final-title">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-5 py-12 sm:px-10 lg:flex-row lg:items-center lg:justify-between lg:px-16">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#D6B875]">Let's discuss your premises</p>
            <h2 id="commercial-final-title" className="mt-3 font-serif text-[38px] leading-[1.08] text-white">A cleaning service built around your business.</h2>
            <p className="mt-3 max-w-2xl text-sm text-[#D8D5CF]">Tell us what you need and we'll assess the most suitable arrangement.</p>
          </div>
          <QuoteLink />
        </div>
      </section>

      <footer className="border-b border-[#D8D5CF] bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-5 px-5 py-9 sm:px-10 md:flex-row lg:px-16">
          <div>
            <Link to="/home" className="text-sm font-bold uppercase tracking-[.08em]">Clean Up Central</Link>
            <p className="mt-2 max-w-md text-xs leading-6 text-[#66635E]">Professional cleaning and considered property support across London.</p>
          </div>
          <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-5 text-xs">
            <Link className="hover:text-[#B08A3C]" to="/cleaning-services">Cleaning Services</Link>
            <Link className="hover:text-[#B08A3C]" to="/property-support">Property Support</Link>
            <Link className="hover:text-[#B08A3C]" to="/contact">Contact Us</Link>
            <Link className="hover:text-[#B08A3C]" to="/privacy">Privacy Policy</Link>
          </nav>
        </div>
        <p className="mx-auto max-w-[1440px] border-t border-[#D8D5CF] px-5 py-4 text-[10px] font-bold uppercase tracking-[.1em] text-[#66635E] sm:px-10 lg:px-16">
          © 2026 Clean Up Central Ltd. All rights reserved.
        </p>
      </footer>
    </main>
  );
}
