import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, CloudUpload, FileText, KeyRound, Menu, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import horizontalFullColour from "@/imports/IMG_1776556945431__2_.png";
import { PRICES, calculateSelectedRoomsEstimate, calculateWholePropertyEstimate, formatGBP } from "./pricing.js";
import { createQuotePayload } from "./quotePayload.js";
import { createQuoteSubmissionId, resolveQuoteApiBaseUrl, submitQuoteRequest, uploadQuoteAttachments } from "./quoteSubmission.js";
import { bookingDateBounds, validateBookingDate } from "./bookingValidation.js";

type Category = "Residential Cleaning" | "Airbnb Turnover" | "Commercial Cleaning" | "Property Support";
type CleaningService = "Standard Clean" | "Deep Clean" | "End of Tenancy";
type Scope = "Whole Property" | "Selected Rooms";
type Room = "Bathroom" | "Bedroom" | "Kitchen" | "Living Room" | "Hallway" | "Stairs";
type Extra = "Oven" | "Fridge" | "Interior Windows" | "Grout Cleaning" | "Laundry" | "Standard Consumables Package";
type Step = "service" | "propertyType" | "cleaningService" | "scope" | "property" | "rooms" | "condition" | "supportServices" | "customDetails" | "customArrangement" | "customSupporting" | "extras" | "address" | "customer" | "summary" | "submitted";

type QuoteData = {
  category: Category | ""; propertyType: string; propertyTypeOther: string; serviceType: CleaningService | ""; cleaningScope: Scope | "";
  bedrooms: number; bathrooms: number; rooms: Record<Room, number>; extras: Record<Extra, number>;
  airbnbCondition: "Good" | "Moderate" | "Dirty" | ""; premisesDescription: string; currentCondition: string;
  requirements: string; operationalRequirements: string; supportServices: string[]; propertyCount: number; propertyStatus: string;
  arrangement: "One-off" | "Recurring"; frequency: string; otherFrequency: string; preferredSchedule: string;
  address: string; postcode: string; preferredDate: string; arrivalWindow: string; preferredStartDate: string;
  requiredCompletionDate: string; parkingDetails: string; pets: string; accessNotes: string; sameDay: boolean;
  urgency: string; fullName: string; email: string; phone: string; company: string;
  customerType: string; preferredContactMethod: string; privacyConsent: boolean;
  safetyWarnings: string; additionalNotes: string; files: File[];
};

const rooms: Room[] = ["Bathroom", "Bedroom", "Kitchen", "Living Room", "Hallway", "Stairs"];
const residentialExtras: Extra[] = ["Oven", "Fridge", "Interior Windows", "Grout Cleaning"];
const airbnbExtras: Extra[] = [...residentialExtras, "Laundry", "Standard Consumables Package"];
const arrivalWindows = ["08:00–11:00", "11:00–14:00", "14:00–17:00", "17:00–20:00"];
const supportOptions = ["Key Holding", "Property Inspection", "Contractor Access", "Inventory Check", "Emergency Attendance", "Not Sure"];
const commercialFrequencies = ["Daily", "Five times weekly", "Three times weekly", "Twice weekly", "Weekly", "Fortnightly", "Monthly", "Ad hoc", "Other / Not sure"];
const supportFrequencies = ["Weekly", "Fortnightly", "Monthly", "Ad hoc", "Other"];
const propertyStatuses = ["Occupied", "Vacant", "Short-let / holiday let", "Other / not sure"];
const stages = ["Service Type", "Property Details", "Your Details", "Summary"];
const navigation = [["Home", "/home"], ["About", "/about"], ["Cleaning Services", "/cleaning-services"], ["Property Support", "/property-support"], ["Contact Us", "/contact"]] as const;

const initialData: QuoteData = {
  category: "", propertyType: "", propertyTypeOther: "", serviceType: "", cleaningScope: "", bedrooms: 0, bathrooms: 1,
  rooms: { Bathroom: 0, Bedroom: 0, Kitchen: 0, "Living Room": 0, Hallway: 0, Stairs: 0 },
  extras: { Oven: 0, Fridge: 0, "Interior Windows": 0, "Grout Cleaning": 0, Laundry: 0, "Standard Consumables Package": 0 },
  airbnbCondition: "", premisesDescription: "", currentCondition: "", requirements: "", operationalRequirements: "",
  supportServices: [], propertyCount: 1, propertyStatus: "", arrangement: "One-off", frequency: "", otherFrequency: "", preferredSchedule: "",
  address: "", postcode: "", preferredDate: "", arrivalWindow: "", preferredStartDate: "", requiredCompletionDate: "",
  parkingDetails: "", pets: "", accessNotes: "", sameDay: false, urgency: "Standard", fullName: "", email: "", phone: "",
  company: "", customerType: "", preferredContactMethod: "", privacyConsent: false, safetyWarnings: "", additionalNotes: "", files: [],
};

function Logo() { return <span className="block h-10 w-[145px] overflow-hidden sm:h-11 sm:w-[180px]"><img src={horizontalFullColour} className="size-full scale-[1.65] object-contain" alt="Clean Up Central" /></span>; }
function Eyebrow({ children }: { children: React.ReactNode }) { return <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#66635E]">{children}</p>; }
function Stepper({ stage }: { stage: number }) { return <><div className="hidden items-center justify-center md:flex">{stages.map((label, i) => <div key={label} className="flex items-center"><div className="flex flex-col items-center"><span className={`grid size-8 place-items-center rounded-full text-[10px] font-bold ${i < stage ? "bg-[#176B45] text-white" : i === stage ? "bg-[#B08A3C] text-white" : "border border-[#D8D5CF] bg-white text-[#66635E]"}`}>{i < stage ? <Check size={14} /> : i + 1}</span><span className={`mt-2 text-[10px] font-bold uppercase tracking-[.08em] ${i === stage ? "text-[#B08A3C]" : "text-[#66635E]"}`}>{label}</span></div>{i < 3 && <span className={`mb-6 h-px w-14 lg:w-24 ${i < stage ? "bg-[#176B45]" : "bg-[#D8D5CF]"}`} />}</div>)}</div><p className="text-center text-[11px] font-bold uppercase tracking-[.1em] text-[#B08A3C] md:hidden">Step {stage + 1} of 4 · {stages[stage]}</p></>; }
function Heading({ title, copy }: { eyebrow: string; title: string; copy: string }) { return <><h1 className="font-serif text-[42px] leading-[.98] tracking-[-.03em] sm:text-[54px]">{title}</h1><p className="mt-5 max-w-2xl text-[16px] leading-7 text-[#66635E]">{copy}</p></>; }
function Button({ children, onClick, disabled, variant = "gold", left = false }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: "gold" | "outline" | "text"; left?: boolean }) { const styles = { gold: "bg-[#B08A3C] text-white hover:bg-[#7A5A1E]", outline: "border border-[#121212] bg-white", text: "text-[#121212] hover:text-[#7A5A1E]" }[variant]; return <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-[4px] px-5 text-[11px] font-bold uppercase tracking-[.08em] transition ${styles} ${disabled ? "cursor-not-allowed opacity-40" : ""}`}>{left && <ArrowLeft size={16} />} {children}{!left && variant !== "text" && <ArrowRight size={16} />}</button>; }
function Panel({ children }: { children: React.ReactNode }) { return <div className="mt-8 border border-[#D8D5CF] bg-white p-6 sm:p-8">{children}</div>; }
function ErrorBox({ errors }: { errors: string[] }) { return errors.length ? <div role="alert" className="mb-6 border-l-4 border-[#B42318] bg-[#FFF5F4] p-4 text-sm"><b>Please check the following:</b><ul className="mt-2 list-disc pl-5">{errors.map(error => <li key={error}>{error}</li>)}</ul></div> : null; }
function Choice({ label, selected, onClick, copy }: { label: string; selected: boolean; onClick: () => void; copy?: string }) { return <button type="button" onClick={onClick} className={`relative min-h-20 border bg-white p-4 text-left text-sm font-bold ${selected ? "border-2 border-[#B08A3C]" : "border-[#D8D5CF] hover:border-[#66635E]"}`}>{label}{copy && <span className="mt-2 block text-xs font-normal leading-5 text-[#66635E]">{copy}</span>}{selected && <Check className="absolute right-4 top-4 text-[#B08A3C]" size={17} />}</button>; }
function Field({ label, value, onChange, type = "text", required, textarea, placeholder, min, max }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; textarea?: boolean; placeholder?: string; min?: string; max?: string }) { const common = "mt-2 w-full rounded-[4px] border border-[#D8D5CF] bg-white px-3 text-sm outline-none focus:border-2 focus:border-[#B08A3C]"; return <label><span className="block text-[11px] font-bold">{label}{required && " *"}</span>{textarea ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`${common} min-h-28 py-3`} /> : <input type={type} min={min} max={max} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`${common} h-[52px]`} />}</label>; }
function SelectField({ label, value, onChange, options, required }: { label: string; value: string; onChange: (value: string) => void; options: string[]; required?: boolean }) { return <label><span className="block text-[11px] font-bold">{label}{required && " *"}</span><select value={value} onChange={e => onChange(e.target.value)} className="mt-2 h-[52px] w-full rounded-[4px] border border-[#D8D5CF] bg-white px-3 text-sm"><option value="">Select an option</option>{options.map(option => <option key={option} value={option}>{option}</option>)}</select></label>; }
function Quantity({ label, detail, value, onChange, min = 0 }: { label: string; detail?: string; value: number; onChange: (value: number) => void; min?: number }) { return <div className="flex h-[52px] items-center justify-between border border-[#D8D5CF] bg-white px-3"><span className="min-w-0"><b className="block truncate text-sm">{label}</b>{detail && <span className="block text-[10px] font-bold text-[#7A5A1E]">{detail}</span>}</span><span className="ml-3 flex shrink-0 items-center gap-3"><button type="button" aria-label={`Remove one ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} className="grid size-8 place-items-center border border-[#D8D5CF] disabled:opacity-30">−</button><b className="w-4 text-center text-sm">{value}</b><button type="button" aria-label={`Add one ${label}`} onClick={() => onChange(value + 1)} className="grid size-8 place-items-center border border-[#B08A3C] text-[#B08A3C]">+</button></span></div>; }

function UploadControl({ files, onChange, required }: { files: File[]; onChange: (files: File[]) => void; required?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const acceptFiles = (list: FileList | null) => {
    const incoming = Array.from(list || []);
    const allowed = incoming.filter(file => file.type.startsWith("image/") || file.type === "application/pdf");
    onChange([...files, ...allowed].slice(0, 10));
    if (input.current) input.current.value = "";
  };
  return <div onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); acceptFiles(event.dataTransfer.files); }} className="border border-dashed border-[#D8D5CF] bg-[#FAF9F6] p-4"><div className="flex gap-3"><CloudUpload size={20} className={files.length ? "text-[#176B45]" : ""} /><div><p className="text-sm font-bold">Photos or documents {required ? "required" : "optional"}</p><p className="mt-1 text-xs text-[#66635E]">{files.length ? `Upload complete · ${files.length} file${files.length === 1 ? "" : "s"} selected` : "Empty upload area · Drag & Drop or Browse Files"}</p><p className="mt-1 text-[10px] text-[#66635E]">Up to 10 JPG, PNG, HEIC or PDF files. Selected files will be uploaded securely when the request is submitted.</p></div></div><input ref={input} type="file" multiple accept="image/*,.pdf" className="sr-only" onChange={e => acceptFiles(e.target.files)} /><button type="button" onClick={() => input.current?.click()} className="mt-3 min-h-9 border border-[#121212] px-3 text-[10px] font-bold uppercase tracking-[.08em]">Browse files</button>{files.length > 0 && <ul className="mt-4 space-y-2">{files.map((file, index) => <li key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between gap-3 bg-white px-3 py-2 text-xs"><span className="min-w-0 truncate">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => onChange(files.filter((_, i) => i !== index))}><Trash2 size={15} /></button></li>)}</ul>}</div>;
}

function stageForStep(step: Step) { if (step === "service" || step === "supportServices") return 0; if (["address", "customer", "customSupporting"].includes(step)) return 2; if (["summary", "submitted"].includes(step)) return 3; return 1; }

type EntryRoute = { preset: Partial<QuoteData>; step: Step };

const defaultEntryRoute: EntryRoute = { preset: {}, step: "service" };
const serviceEntryRoutes: Record<string, EntryRoute> = {
  "standard-clean": {
    preset: { category: "Residential Cleaning", serviceType: "Standard Clean" },
    step: "cleaningService",
  },
  "deep-clean": {
    preset: { category: "Residential Cleaning", serviceType: "Deep Clean" },
    step: "cleaningService",
  },
  "end-of-tenancy": {
    preset: { category: "Residential Cleaning", serviceType: "End of Tenancy" },
    step: "cleaningService",
  },
  "airbnb-turnover": {
    preset: { category: "Airbnb Turnover" },
    step: "propertyType",
  },
  "commercial-cleaning": {
    preset: { category: "Commercial Cleaning" },
    step: "customDetails",
  },
  "property-support": {
    preset: { category: "Property Support" },
    step: "supportServices",
  },
};

function normaliseServiceParam(value: string | null) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// This table is the single authority for quote-page entry routes.
// General entry shows the four service categories. Residential service CTAs
// show the cleaning-service screen with the clicked option preselected.
function entryRouteForService(serviceParam: string | null): EntryRoute {
  return serviceEntryRoutes[normaliseServiceParam(serviceParam)] ?? defaultEntryRoute;
}

export default function QuotePage() {
  const [params] = useSearchParams();
  const serviceParam = params.get("service");
  const entryRoute = entryRouteForService(serviceParam);
  const [data, setData] = useState<QuoteData>({ ...initialData, ...entryRoute.preset });
  const [step, setStep] = useState<Step>(entryRoute.step);
  const [errors, setErrors] = useState<string[]>([]);
  const [drawer, setDrawer] = useState(false);
  const [reference, setReference] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionId, setSubmissionId] = useState("");
  useEffect(() => {
    const nextEntryRoute = entryRouteForService(serviceParam);
    setData({ ...initialData, ...nextEntryRoute.preset });
    setStep(nextEntryRoute.step);
    setErrors([]);
    setReference("");
    setSubmissionId("");
    setIsSubmitting(false);
  }, [serviceParam]);
  const update = <K extends keyof QuoteData>(key: K, value: QuoteData[K]) => setData(current => ({ ...current, [key]: value }));
  const go = (next: Step) => { setErrors([]); setStep(next); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const customQuote = data.category === "Commercial Cleaning" || data.category === "Property Support" || data.serviceType === "End of Tenancy";
  const appointmentRequired = !customQuote || data.serviceType === "End of Tenancy";
  const estimate = useMemo(() => {
    try {
      if (data.category === "Residential Cleaning" && data.cleaningScope === "Selected Rooms") return calculateSelectedRoomsEstimate({ cleaningLevel: data.serviceType, rooms: data.rooms, extras: data.extras, travelFee: null });
      if (data.category === "Residential Cleaning" && data.serviceType && data.serviceType !== "End of Tenancy") return calculateWholePropertyEstimate({ service: data.serviceType, bedrooms: data.bedrooms, bathrooms: data.bathrooms, extras: data.extras, isNewCustomer: data.customerType === "New customer", travelFee: null });
      if (data.category === "Airbnb Turnover" && data.airbnbCondition) return calculateWholePropertyEstimate({ service: "Airbnb Turnover", bedrooms: data.bedrooms, bathrooms: data.bathrooms, extras: data.extras, isNewCustomer: data.customerType === "New customer", airbnbCondition: data.airbnbCondition as any, travelFee: null });
    } catch { return null; }
    return null;
  }, [data]);

  const chooseCategory = (category: Category) => { setData(current => current.category === category ? current : { ...initialData, category }); go(category === "Residential Cleaning" ? "cleaningService" : category === "Airbnb Turnover" ? "propertyType" : category === "Property Support" ? "supportServices" : "customDetails"); };
  const validateAddress = () => { const dateError = appointmentRequired ? validateBookingDate(data.preferredDate, data.arrivalWindow) : ""; const e = [!data.address.trim() && "Enter the property address.", !data.postcode.trim() && "Enter the postcode.", appointmentRequired && !data.arrivalWindow && "Choose a preferred arrival window.", dateError].filter(Boolean) as string[]; setErrors(e); if (!e.length) go("customer"); };
  const validateCustomer = () => { const e = [!data.fullName.trim() && "Enter your full name.", !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()) && "Enter a valid email address.", !/^[+()\d\s-]{7,20}$/.test(data.phone.trim()) && "Enter a valid phone number.", !data.customerType && "Choose whether you are a new or existing customer.", !data.preferredContactMethod && "Choose a preferred contact method.", !data.privacyConsent && "Privacy consent is required."].filter(Boolean) as string[]; setErrors(e); if (!e.length) go("summary"); };
  const submit = async () => {
    if (isSubmitting) return;

    setErrors([]);
    setIsSubmitting(true);

    const activeSubmissionId = submissionId || createQuoteSubmissionId();
    setSubmissionId(activeSubmissionId);

    const apiBaseUrl = resolveQuoteApiBaseUrl(
      import.meta.env.VITE_API_BASE_URL,
    );

    try {
      const payload = createQuotePayload(data, {
        distanceMiles: null,
        travelFee: null,
      });

      const response = await submitQuoteRequest({
        apiBaseUrl,
        submissionId: activeSubmissionId,
        payload,
      });

      if (data.files.length > 0) {
        await uploadQuoteAttachments({
          apiBaseUrl,
          submissionId: activeSubmissionId,
          files: data.files,
        });
      }

      setReference(response.confirmation.quoteNumber);
      go("submitted");
    } catch (error) {
      setErrors([
        error instanceof Error
          ? error.message
          : "We could not submit your quote request. Please try again.",
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return <main className="min-h-screen bg-[#FAF9F6] font-sans text-[#121212]"><header className="sticky top-0 z-30 border-b border-[#D8D5CF] bg-white/95 backdrop-blur"><div className="relative mx-auto flex h-[68px] max-w-[1440px] items-center justify-between px-5 sm:h-20 sm:px-10 lg:px-16"><Link to="/home"><Logo /></Link><nav className="absolute left-1/2 hidden h-full -translate-x-1/2 items-center gap-6 lg:flex">{navigation.map(([name, to]) => <Link key={name} to={to} className="flex h-full items-center border-b-2 border-transparent text-[10px] font-bold uppercase tracking-[.09em] text-[#66635E] hover:text-[#121212]">{name}</Link>)}</nav><span className="hidden min-h-12 items-center rounded-[4px] bg-[#B08A3C] px-5 text-[11px] font-bold uppercase tracking-[.08em] text-white lg:inline-flex">Get a Quote</span><button type="button" onClick={() => setDrawer(!drawer)} className="grid size-11 place-items-center border border-[#D8D5CF] lg:hidden" aria-label="Toggle navigation">{drawer ? <X size={20} /> : <Menu size={20} />}</button></div>{drawer && <div className="border-t border-[#D8D5CF] bg-white px-5 pb-5 lg:hidden">{navigation.map(([name, to]) => <Link key={name} to={to} onClick={() => setDrawer(false)} className="block border-b border-[#D8D5CF] py-4 text-xs font-bold uppercase tracking-[.1em]">{name}</Link>)}</div>}</header><div className="mx-auto max-w-[1240px] px-5 py-8 sm:px-10"><div className="mx-auto mt-10 max-w-4xl"><Stepper stage={stageForStep(step)} /><QuoteStep step={step} data={data} update={update} go={go} errors={errors} setErrors={setErrors} chooseCategory={chooseCategory} validateAddress={validateAddress} validateCustomer={validateCustomer} estimate={estimate} customQuote={customQuote} appointmentRequired={appointmentRequired} submit={submit} reference={reference} isSubmitting={isSubmitting} /></div></div><footer className="border-t border-[#D8D5CF] bg-white"><div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-6 sm:px-10 lg:px-16"><Logo /><p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#66635E]">Clean Up Central · Quote Generator UI Reference</p></div></footer></main>;
}

function QuoteStep({ step, data, update, go, errors, setErrors, chooseCategory, validateAddress, validateCustomer, estimate, customQuote, appointmentRequired, submit, reference, isSubmitting }: { step: Step; data: QuoteData; update: <K extends keyof QuoteData>(key: K, value: QuoteData[K]) => void; go: (step: Step) => void; errors: string[]; setErrors: (errors: string[]) => void; chooseCategory: (category: Category) => void; validateAddress: () => void; validateCustomer: () => void; estimate: any; customQuote: boolean; appointmentRequired: boolean; submit: () => Promise<void>; reference: string; isSubmitting: boolean }) {
  if (step === "service") return <section className="mt-10 text-center"><Heading eyebrow="Service Type / Default" title="Let’s get you an instant quote" copy="Choose the type of support you are looking for to begin." /><div className="mt-8 grid gap-4 text-left sm:grid-cols-2">{[["Residential Cleaning", "Routine cleaning for your property.", Sparkles], ["Airbnb Turnover", "Guest-ready preparation between stays.", KeyRound], ["Commercial Cleaning", "Cleaning for offices and light commercial premises.", Building2], ["Property Support", "Practical help for property details.", ShieldCheck]].map(([label, copy, Icon]) => <button type="button" key={label as string} onClick={() => update("category", label as Category)} className={`relative min-h-40 border bg-white p-6 ${data.category === label ? "border-2 border-[#B08A3C]" : "border-[#D8D5CF]"}`}><span className="grid size-10 place-items-center border border-[#B08A3C] text-[#B08A3C]"><Icon size={20} /></span><b className="mt-5 block">{label as string}</b><span className="mt-2 block text-sm leading-5 text-[#66635E]">{copy as string}</span>{data.category === label && <span className="absolute right-4 top-4 grid size-5 place-items-center rounded-full bg-[#B08A3C] text-white"><Check size={13} /></span>}</button>)}</div><div className="mt-8"><Button disabled={!data.category} onClick={() => data.category && chooseCategory(data.category)}>Continue</Button></div></section>;

  if (step === "propertyType") return <section className="mx-auto mt-10 max-w-2xl"><Heading eyebrow={`${data.category} · Property`} title="What type of property is it?" copy="Choose the option that best describes the property." /><div className="mt-8 grid gap-3 sm:grid-cols-2">{["House", "Flat / Apartment"].map(option => <Choice key={option} label={option} selected={data.propertyType === option} onClick={() => update("propertyType", option)} />)}</div><Nav back={() => go(data.category === "Residential Cleaning" ? "cleaningService" : "service")} next={() => !data.propertyType ? setErrors(["Choose a property type."]) : go(data.category === "Residential Cleaning" ? (data.serviceType === "End of Tenancy" ? "customDetails" : "scope") : "property")} errors={errors} /></section>;

  if (step === "cleaningService") return <section className="mx-auto mt-10 max-w-2xl"><Heading eyebrow="Residential Cleaning · Service" title="Which cleaning service do you need?" copy="Select one service to continue." /><div className="mt-8 grid gap-3 sm:grid-cols-2">{(["Standard Clean", "Deep Clean", "End of Tenancy"] as CleaningService[]).map(option => <Choice key={option} label={option} selected={data.serviceType === option} onClick={() => update("serviceType", option)} />)}</div><Nav back={() => go("service")} next={() => data.serviceType ? go("propertyType") : setErrors(["Choose a cleaning service."])} errors={errors} /></section>;

  if (step === "scope") return <section className="mx-auto mt-10 max-w-2xl"><Heading eyebrow={`Residential · ${data.serviceType}`} title="What should we include?" copy="The cleaning level is selected once and applies throughout." /><div className="mt-8 grid gap-3 sm:grid-cols-2">{(["Whole Property", "Selected Rooms"] as Scope[]).map(option => <Choice key={option} label={option} selected={data.cleaningScope === option} onClick={() => update("cleaningScope", option)} />)}</div><Nav back={() => go("propertyType")} next={() => data.cleaningScope ? go(data.cleaningScope === "Selected Rooms" ? "rooms" : "property") : setErrors(["Choose a cleaning scope."])} errors={errors} /></section>;

  if (step === "property") return <section className="mx-auto mt-10 max-w-3xl"><Heading eyebrow={`${data.category} · Property Details`} title="Tell us about the property" copy="Use the quantity controls to describe the property size and bathrooms." /><Panel><div className="grid gap-5 sm:grid-cols-2"><Quantity label="Number of bedrooms" value={data.bedrooms} onChange={value => update("bedrooms", value)} /><Quantity label="Number of bathrooms" value={data.bathrooms} min={1} onChange={value => update("bathrooms", value)} /></div><p className="mt-4 text-xs text-[#66635E]">Property size: {data.bedrooms === 0 ? "Studio" : `${data.bedrooms} bedroom${data.bedrooms === 1 ? "" : "s"}`}</p><Nav back={() => go(data.category === "Airbnb Turnover" ? "propertyType" : "scope")} next={() => go(data.category === "Airbnb Turnover" ? "condition" : "extras")} errors={errors} /></Panel></section>;

  if (step === "rooms") { const count = Object.values(data.rooms).reduce((a, b) => a + b, 0); return <section className="mx-auto mt-10 max-w-3xl"><Heading eyebrow={`Residential · ${data.serviceType} · Selected Rooms`} title="Which rooms would you like cleaned?" copy="Choose the rooms and quantities required. Your selected cleaning level applies to every room." /><Panel><div className="grid gap-3 sm:grid-cols-2">{rooms.map(room => <Quantity key={room} label={room} detail={`${formatGBP((data.serviceType === "Deep Clean" ? PRICES.selectedRooms.deep : PRICES.selectedRooms.standard)[room])} each`} value={data.rooms[room]} onChange={value => update("rooms", { ...data.rooms, [room]: value })} />)}</div><p className="mt-5 border-l-4 border-[#B08A3C] bg-[#F1EDE4] p-4 text-sm leading-6">A £40 minimum applies only when Hallway and/or Stairs are booked without any other room type. Other selected-room requests have no minimum, and normal travel charges apply where relevant.</p><Nav back={() => go("scope")} next={() => count ? go("extras") : setErrors(["Select at least one room."])} errors={errors} /></Panel></section>; }

  if (step === "condition") return <section className="mx-auto mt-10 max-w-3xl"><Heading eyebrow="Airbnb · Condition" title="What is the property condition?" copy="Choose the option that best reflects the property today." /><Panel><div className="grid gap-3 sm:grid-cols-3">{(["Good", "Moderate", "Dirty"] as const).map(option => <Choice key={option} label={option} copy={`Condition charge: ${formatGBP(PRICES.airbnbCondition[option])}`} selected={data.airbnbCondition === option} onClick={() => update("airbnbCondition", option)} />)}</div>{data.airbnbCondition === "Dirty" && <div className="mt-6"><div className="mb-5 border-l-4 border-[#B08A3C] bg-[#F1EDE4] p-4 text-sm leading-6"><b>Provisional estimate.</b> A £20 Dirty-condition charge will be included initially. We will review the photographs and may revise that charge if the condition or required work is materially different.</div><UploadControl files={data.files} onChange={value => update("files", value)} required /></div>}<Nav back={() => go("property")} next={() => !data.airbnbCondition ? setErrors(["Choose the property condition."]) : data.airbnbCondition === "Dirty" && !data.files.length ? setErrors(["Upload at least one property photograph for a Dirty Airbnb request."]) : go("extras")} errors={errors} /></Panel></section>;

  if (step === "supportServices") return <section className="mx-auto mt-10 max-w-3xl"><Heading eyebrow="Property Support · Service Selection" title="What support do you need?" copy="Select all services that apply to your property support request." /><Panel><div className="grid gap-3 sm:grid-cols-2">{supportOptions.map(option => <Choice key={option} label={option} selected={data.supportServices.includes(option)} onClick={() => update("supportServices", data.supportServices.includes(option) ? data.supportServices.filter(x => x !== option) : [...data.supportServices, option])} />)}</div><p className="mt-4 text-xs text-[#66635E]">Select all services that apply. More than one option may be chosen.</p><Nav back={() => go("service")} next={() => data.supportServices.length ? go("customDetails") : setErrors(["Select at least one Property Support service."])} errors={errors} /></Panel></section>;

  if (step === "customDetails") return <CustomDetails data={data} update={update} errors={errors} setErrors={setErrors} go={go} />;
  if (step === "customArrangement") return <CustomArrangement data={data} update={update} errors={errors} setErrors={setErrors} go={go} />;
  if (step === "customSupporting") return <CustomSupporting data={data} update={update} go={go} />;

  if (step === "extras") { const options = data.category === "Airbnb Turnover" ? airbnbExtras : residentialExtras; return <section className="mx-auto mt-10 max-w-3xl"><Heading eyebrow={`${data.category} · Extras`} title="Eligible extras" copy="Select any eligible extras required for your service." /><Panel><div className="grid gap-3 sm:grid-cols-2">{options.map(extra => <Quantity key={extra} label={extra} detail={`${formatGBP(PRICES.extras[extra])}${extra === "Interior Windows" ? " per window" : extra === "Laundry" ? " per load" : ""}`} value={data.extras[extra]} onChange={value => update("extras", { ...data.extras, [extra]: value })} />)}</div><p className="mt-4 text-xs text-[#66635E]">Select any eligible extras required for your service. You may choose more than one.</p><Nav back={() => go(data.cleaningScope === "Selected Rooms" ? "rooms" : data.category === "Airbnb Turnover" ? "condition" : "property")} next={() => go("address")} errors={errors} /></Panel></section>; }

  if (step === "address") { const bounds = bookingDateBounds(); return <section className="mx-auto mt-10 max-w-3xl"><Heading eyebrow="Address and Appointment" title="Address and appointment" copy="Add the practical details needed to prepare your quote." /><Panel><ErrorBox errors={errors} /><div className="grid gap-5 sm:grid-cols-2"><Field required label="Address" value={data.address} onChange={value => update("address", value)} /><Field required label="Postcode" value={data.postcode} onChange={value => update("postcode", value)} />{appointmentRequired && <><Field required label="Preferred date" type="date" min={bounds.min} max={bounds.max} value={data.preferredDate} onChange={value => update("preferredDate", value)} /><SelectField required label="Preferred arrival window" value={data.arrivalWindow} onChange={value => update("arrivalWindow", value)} options={arrivalWindows} /></>}<Field label="Parking details" value={data.parkingDetails} onChange={value => update("parkingDetails", value)} textarea /><SelectField label="Pets at the property" value={data.pets} onChange={value => update("pets", value)} options={["Yes", "No"]} /><Field label="Access notes" value={data.accessNotes} onChange={value => update("accessNotes", value)} textarea /><Field label="Safety concerns (if any)" value={data.safetyWarnings} onChange={value => update("safetyWarnings", value)} textarea placeholder="For example: sharps, pests, heavy mould or biohazards" />{appointmentRequired && <label className="flex items-start gap-3 text-sm sm:col-span-2"><input type="checkbox" checked={data.sameDay} onChange={e => update("sameDay", e.target.checked)} className="mt-1 size-4" /> This is a same-day request</label>}</div>{appointmentRequired && <p className="mt-5 text-xs leading-5 text-[#66635E]">Dates must be within the next 90 days. Same-day requests require at least three hours’ notice before the selected arrival window begins.</p>}<div className="mt-8 flex justify-between"><Button variant="text" left onClick={() => go(data.serviceType === "End of Tenancy" ? "customDetails" : customQuote ? "customSupporting" : "extras")}>Back</Button><Button onClick={validateAddress}>Continue</Button></div></Panel></section>; }

  if (step === "customer") return <section className="mx-auto mt-10 max-w-3xl"><Heading eyebrow="Your Details" title="Your details" copy="Add your contact details so we can review your request and share the next steps." /><Panel><ErrorBox errors={errors} /><div className="grid gap-5 sm:grid-cols-2"><Field required label="Full name" value={data.fullName} onChange={value => update("fullName", value)} /><Field required label="Email address" type="email" value={data.email} onChange={value => update("email", value)} /><Field required label="Phone number" type="tel" value={data.phone} onChange={value => update("phone", value)} /><Field label="Company or agency" value={data.company} onChange={value => update("company", value)} /><SelectField required label="New or existing customer" value={data.customerType} onChange={value => update("customerType", value)} options={["New customer", "Existing customer"]} /><SelectField required label="Preferred contact method" value={data.preferredContactMethod} onChange={value => update("preferredContactMethod", value)} options={["Email", "Phone"]} /><Field label="Anything else we should review?" value={data.additionalNotes} onChange={value => update("additionalNotes", value)} textarea /><label className="flex items-start gap-3 text-sm sm:col-span-2"><input type="checkbox" checked={data.privacyConsent} onChange={e => update("privacyConsent", e.target.checked)} className="mt-1 size-4" /> I consent to Clean Up Central using these details to prepare and contact me about this quote. *</label></div><div className="mt-8 flex justify-between"><Button variant="text" left onClick={() => go("address")}>Back</Button><Button onClick={validateCustomer}>Review Quote</Button></div></Panel></section>;

  if (step === "summary") return <Summary data={data} estimate={estimate} customQuote={customQuote} back={() => go(data.category === "Commercial Cleaning" || data.category === "Property Support" ? "customSupporting" : "customer")} submit={submit} errors={errors} isSubmitting={isSubmitting} />;
  return <section className="mx-auto mt-10 max-w-3xl text-center"><span className="mx-auto grid size-14 place-items-center rounded-full bg-[#176B45] text-white"><CheckCircle2 size={28} /></span><Heading eyebrow="Request Received" title="Your quote request has been submitted" copy="We have received your details and will review the request before confirming availability or a booking." /><Panel><p className="text-left text-sm leading-6">Quote reference: <b>{reference}</b><br />This is not a confirmed booking. Clean Up Central will contact you after reviewing the information supplied.</p><div className="mt-6"><Button onClick={() => window.location.reload()}>Start Another Quote</Button></div></Panel></section>;
}

function CustomDetails({ data, update, errors, setErrors, go }: { data: QuoteData; update: <K extends keyof QuoteData>(key: K, value: QuoteData[K]) => void; errors: string[]; setErrors: (e: string[]) => void; go: (s: Step) => void }) {
  const isEnd = data.serviceType === "End of Tenancy"; const isCommercial = data.category === "Commercial Cleaning"; const isSupport = data.category === "Property Support";
  const validate = () => {
    const e = (isEnd ? [
      !data.currentCondition.trim() && "Describe the property's current condition.",
      !data.requirements.trim() && "Add any requirements or notes.",
      !data.files.length && "Upload at least one relevant property photograph.",
    ] : isCommercial ? [
      !data.premisesDescription.trim() && "Describe the commercial premises.",
      !data.currentCondition.trim() && "Describe its current condition.",
      !data.requirements.trim() && "Describe the cleaning requirements.",
    ] : [
      !data.propertyType.trim() && "Describe the property type.",
      !data.address.trim() && "Enter the property address and postcode.",
      !data.propertyStatus && "Choose the property's occupancy status.",
      !data.requirements.trim() && "Describe the support required.",
    ]).filter(Boolean) as string[];
    setErrors(e); if (!e.length) go(isEnd ? "address" : "customArrangement");
  };
  return <section className="mx-auto mt-10 max-w-3xl"><Heading eyebrow={`${isEnd ? "End of Tenancy" : data.category} · Requirements`} title={isCommercial ? "Tell us about the commercial requirement" : isSupport ? "Tell us about the property and requirements" : "Tell us about the move-out clean"} copy={isEnd ? "A tailored quotation is prepared after review. No instant price is shown." : isCommercial ? "This request will be reviewed for a tailored quotation." : "Only information relevant to the agreed support scope is requested."} /><Panel><ErrorBox errors={errors} /><div className="grid gap-5 sm:grid-cols-2">{isEnd ? <><Quantity label="Number of bedrooms" value={data.bedrooms} onChange={value => update("bedrooms", value)} /><Quantity label="Number of bathrooms" value={data.bathrooms} min={1} onChange={value => update("bathrooms", value)} /><div className="sm:col-span-2"><Field required label="Describe the property’s current condition" value={data.currentCondition} onChange={value => update("currentCondition", value)} textarea /></div><div className="sm:col-span-2"><Field required label="Additional requirements or notes" value={data.requirements} onChange={value => update("requirements", value)} textarea /></div><div className="sm:col-span-2"><UploadControl files={data.files} onChange={value => update("files", value)} required /></div></> : isCommercial ? <><Field required label="Premises description" value={data.premisesDescription} onChange={value => update("premisesDescription", value)} textarea /><Field required label="Current condition" value={data.currentCondition} onChange={value => update("currentCondition", value)} textarea /><Field required label="Cleaning requirements" value={data.requirements} onChange={value => update("requirements", value)} textarea /><Field label="Operational requirements" value={data.operationalRequirements} onChange={value => update("operationalRequirements", value)} textarea /></> : <><Field required label="Property type" value={data.propertyType} onChange={value => update("propertyType", value)} placeholder="For example: house, flat, maisonette or mixed-use property" /><Field required label="Address and postcode" value={data.address} onChange={value => update("address", value)} /><Quantity label="Number of properties" value={data.propertyCount} min={1} onChange={value => update("propertyCount", value)} /><SelectField required label="Property status" value={data.propertyStatus} onChange={value => update("propertyStatus", value)} options={propertyStatuses} /><Field label="Access arrangements" value={data.accessNotes} onChange={value => update("accessNotes", value)} textarea /><Field required label="Description of support required" value={data.requirements} onChange={value => update("requirements", value)} textarea /></>}</div><div className="mt-8 flex justify-between"><Button variant="text" left onClick={() => go(isEnd ? "propertyType" : isSupport ? "supportServices" : "service")}>Back</Button><Button onClick={validate}>Continue</Button></div></Panel></section>;
}

function CustomArrangement({ data, update, errors, setErrors, go }: { data: QuoteData; update: <K extends keyof QuoteData>(key: K, value: QuoteData[K]) => void; errors: string[]; setErrors: (e: string[]) => void; go: (s: Step) => void }) {
  const isCommercial = data.category === "Commercial Cleaning"; const isSupport = data.category === "Property Support"; const bounds = bookingDateBounds();
  const validate = () => { const e = [isSupport && !data.preferredStartDate && "Choose a preferred start date.", isSupport && data.preferredStartDate && (data.preferredStartDate < bounds.min || data.preferredStartDate > bounds.max) && "Choose a preferred start date within the next 90 days.", isSupport && data.arrangement === "One-off" && !data.requiredCompletionDate && "Choose the required completion date.", isSupport && data.requiredCompletionDate && (data.requiredCompletionDate < bounds.min || data.requiredCompletionDate > bounds.max) && "Choose a completion date within the next 90 days.", data.arrangement === "Recurring" && !data.frequency && "Choose a recurring frequency.", data.frequency.startsWith("Other") && !data.otherFrequency.trim() && "Describe the recurring frequency."].filter(Boolean) as string[]; setErrors(e); if (!e.length) go("customSupporting"); };
  return <section className="mx-auto mt-10 max-w-3xl"><Heading eyebrow={`${data.category} · Arrangement`} title={isCommercial ? "Frequency" : "How should support be arranged?"} copy="Choose a one-off or recurring arrangement and provide the practical timing details." /><Panel><ErrorBox errors={errors} /><p className="text-[11px] font-bold">One-off or Recurring</p><div className="mt-2 grid gap-3 sm:grid-cols-2">{(["One-off", "Recurring"] as const).map(option => <Choice key={option} label={option} selected={data.arrangement === option} onClick={() => update("arrangement", option)} />)}</div>{data.arrangement === "Recurring" && <div className="mt-6 border-t border-[#D8D5CF] pt-6"><p className="text-[11px] font-bold">How often will you require the service?</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{(isCommercial ? commercialFrequencies : supportFrequencies).map(option => <Choice key={option} label={option} selected={data.frequency === option} onClick={() => update("frequency", option)} />)}</div>{data.frequency.startsWith("Other") && <div className="mt-5"><Field required label="Please describe the required frequency" value={data.otherFrequency} onChange={value => update("otherFrequency", value)} /></div>}</div>}<div className="mt-6 grid gap-5 sm:grid-cols-2">{isSupport && <><Field required label="Preferred start date" type="date" min={bounds.min} max={bounds.max} value={data.preferredStartDate} onChange={value => update("preferredStartDate", value)} />{data.arrangement === "One-off" && <Field required label="Required completion date" type="date" min={bounds.min} max={bounds.max} value={data.requiredCompletionDate} onChange={value => update("requiredCompletionDate", value)} />}<SelectField label="Urgency" value={data.urgency} onChange={value => update("urgency", value)} options={["Standard", "Urgent", "Emergency"]} /></>}<Field label="Preferred days and times" value={data.preferredSchedule} onChange={value => update("preferredSchedule", value)} /></div><div className="mt-8 flex justify-between"><Button variant="text" left onClick={() => go("customDetails")}>Back</Button><Button onClick={validate}>Continue</Button></div></Panel></section>;
}

function CustomSupporting({ data, update, go }: { data: QuoteData; update: <K extends keyof QuoteData>(key: K, value: QuoteData[K]) => void; go: (s: Step) => void }) {
  const isCommercial = data.category === "Commercial Cleaning"; const bounds = bookingDateBounds();
  return <section className="mx-auto mt-10 max-w-3xl"><Heading eyebrow={`${data.category} · Supporting Details`} title="Add supporting details" copy="Supporting photographs or documents help the team review the request." /><Panel><div className="grid gap-5 sm:grid-cols-2"><UploadControl files={data.files} onChange={value => update("files", value)} />{isCommercial && <><Field label="Property address" value={data.address} onChange={value => update("address", value)} /><Field label="Preferred start date" type="date" min={bounds.min} max={bounds.max} value={data.preferredStartDate} onChange={value => update("preferredStartDate", value)} /></>}<Field label="Company and contact details" value={data.company} onChange={value => update("company", value)} /><SelectField label="Preferred contact method" value={data.preferredContactMethod} onChange={value => update("preferredContactMethod", value)} options={["Email", "Phone"]} /><Field label="Access notes and additional comments" value={data.additionalNotes} onChange={value => update("additionalNotes", value)} textarea /></div><div className="mt-8 flex justify-between"><Button variant="text" left onClick={() => go("customArrangement")}>Back</Button><Button onClick={() => go("summary")}>Continue</Button></div></Panel></section>;
}

function Nav({ back, next, errors }: { back: () => void; next: () => void; errors: string[] }) { return <><div className="mt-6"><ErrorBox errors={errors} /></div><div className="mt-8 flex justify-between"><Button variant="text" left onClick={back}>Back</Button><Button onClick={next}>Continue</Button></div></>; }
function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) { return <div className="grid gap-1 py-3 sm:grid-cols-[.9fr_1.1fr]"><span className={strong ? "font-bold" : "text-[#66635E]"}>{label}</span><b>{value}</b></div>; }

function Summary({ data, estimate, customQuote, back, submit, errors, isSubmitting }: { data: QuoteData; estimate: any; customQuote: boolean; back: () => void; submit: () => Promise<void>; errors: string[]; isSubmitting: boolean }) {
  if (customQuote) return <CustomQuoteSummary data={data} back={back} submit={submit} errors={errors} isSubmitting={isSubmitting} />;

  const selectedRooms = Object.entries(data.rooms).filter(([, quantity]) => quantity).map(([name, quantity]) => `${quantity} × ${name}`).join(", ");
  const selectedExtras = Object.entries(data.extras).filter(([, quantity]) => quantity).map(([name, quantity]) => `${quantity} × ${name}`).join(", ") || "None";
  const payload = createQuotePayload(data, { distanceMiles: null, travelFee: null });
  const customSchedule = data.serviceType !== "End of Tenancy" && customQuote;
  const schedule = customSchedule ? [data.preferredStartDate, data.preferredSchedule].filter(Boolean).join(" · ") || "To be discussed" : `${data.preferredDate} · ${data.arrivalWindow}`;
  const address = [data.address, data.postcode].filter(Boolean).join(", ");
  return <section className="mx-auto mt-10 max-w-3xl">
    <Heading eyebrow={customQuote ? "Custom Quote Required" : data.category === "Airbnb Turnover" && data.airbnbCondition === "Dirty" ? "Provisional Estimate" : "Estimated Quote"} title={customQuote ? "Review your request" : data.category === "Airbnb Turnover" && data.airbnbCondition === "Dirty" ? "Review your provisional estimate" : "Review your estimated quote"} copy={customQuote ? "We’ll prepare a tailored quote after reviewing the information below." : "The calculated cleaning amount is shown below. Travel remains pending until driving distance is verified."} />
    <Panel>
      <ErrorBox errors={errors} />
      {estimate && <><p className="font-serif text-[60px] leading-none text-[#B08A3C]">{formatGBP(estimate.estimatedTotal)}</p><p className="mt-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#7A5A1E]">Calculated amount · Travel fee pending review</p></>}
      <div className="mt-7 divide-y divide-[#D8D5CF] border-y border-[#D8D5CF] text-sm">
        <Row label="Service" value={`${data.category}${data.serviceType ? ` · ${data.serviceType}` : ""}`} />
        {data.cleaningScope && <Row label="Scope" value={data.cleaningScope} />}<Row label="Property" value={`${data.propertyType === "Other / Not sure" ? data.propertyTypeOther : data.propertyType || data.premisesDescription}${data.cleaningScope !== "Selected Rooms" && data.bedrooms >= 0 && !customSchedule ? ` · ${data.bedrooms === 0 ? "Studio" : `${data.bedrooms} bedroom(s)`} · ${data.bathrooms} bathroom(s)` : ""}`} />
        {selectedRooms && <Row label="Rooms" value={selectedRooms} />}<Row label="Extras" value={selectedExtras} /><Row label="Address" value={address || "To be supplied"} /><Row label={customSchedule ? "Preferred schedule" : "Requested appointment"} value={schedule} />{(data.fullName || data.email || data.company) && <Row label="Customer" value={[data.fullName, data.email, data.company].filter(Boolean).join(" · ")} />}
        {estimate && <><Row label="Cleaning / room price" value={formatGBP(estimate.basePrice ?? estimate.roomSubtotal)} />
          {Number(estimate.minimumAdjustment ?? 0) > 0 && (
            <Row
              label="Minimum booking adjustment"
              value={formatGBP(estimate.minimumAdjustment)}
            />
          )}<Row label="Additional bathrooms" value={formatGBP(estimate.bathroomCharge ?? 0)} /><Row label="Condition charge" value={formatGBP(estimate.conditionCharge ?? 0)} /><Row label="Extras" value={formatGBP(estimate.extrasCharge ?? 0)} /><Row label="New-customer discount" value={estimate.discountAmount ? `−${formatGBP(estimate.discountAmount)}` : formatGBP(0)} /><Row label="Travel fee" value="Pending review" /><Row label="Current calculated amount" value={formatGBP(estimate.estimatedTotal)} strong /></>}
      </div>
      {payload.manualReviewReasons.length > 0 && <div className="mt-6 border-l-4 border-[#B08A3C] bg-[#F1EDE4] p-4 text-sm"><b>Review required:</b> {payload.manualReviewReasons.join("; ")}.</div>}
      {data.category === "Airbnb Turnover" && data.airbnbCondition === "Dirty" && <p className="mt-6 border-l-4 border-[#B08A3C] bg-[#F1EDE4] p-4 text-sm leading-6"><b>Provisional estimate.</b> The £20 Dirty-condition charge and supplied photographs will be reviewed. The charge may be revised if the actual condition or work required is materially different.</p>}
      {data.cleaningScope === "Selected Rooms" && <p className="mt-6 border-l-4 border-[#B08A3C] bg-[#F1EDE4] p-4 text-sm leading-6">Room prices are based on the information supplied and may be revised after review if the actual condition materially differs.</p>}
      <p className="mt-6 text-sm leading-6 text-[#66635E]">This is not a confirmed booking. The requested date is secured only after review, approval and receipt of the required upfront payment.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between"><Button variant="outline" left onClick={back}>Back and Edit</Button><Button onClick={() => void submit()} disabled={isSubmitting}>{isSubmitting ? "Submitting…" : "Submit for Review"}</Button></div>
    </Panel>
  </section>;
}

function CustomQuoteSummary({ data, back, submit, errors, isSubmitting }: { data: QuoteData; back: () => void; submit: () => Promise<void>; errors: string[]; isSubmitting: boolean }) {
  const isEndOfTenancy = data.serviceType === "End of Tenancy";
  const isCommercial = data.category === "Commercial Cleaning";
  const valueOrFallback = (value: string | number | boolean) => {
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value).trim() || "Not supplied";
  };
  const propertyType = data.propertyType === "Other / Not sure" ? data.propertyTypeOther : data.propertyType;
  const arrangement = data.arrangement === "Recurring"
    ? `Recurring · ${data.frequency.startsWith("Other") ? data.otherFrequency : data.frequency}`
    : "One-off";
  const files = data.files.length ? `${data.files.length} file${data.files.length === 1 ? "" : "s"} attached` : "None supplied";

  const rows: Array<[string, string]> = isEndOfTenancy ? [
    ["Service", "End of Tenancy"],
    ["Property type", valueOrFallback(propertyType)],
    ["Property size", data.bedrooms === 0 ? "Studio" : `${data.bedrooms} bedroom${data.bedrooms === 1 ? "" : "s"}`],
    ["Number of bathrooms", String(data.bathrooms)],
    ["Current property condition", valueOrFallback(data.currentCondition)],
    ["Additional requirements or notes", valueOrFallback(data.requirements)],
    ["Property photographs", files],
    ["Address and postcode", valueOrFallback([data.address, data.postcode].filter(Boolean).join(", "))],
    ["Preferred date and arrival window", valueOrFallback([data.preferredDate, data.arrivalWindow].filter(Boolean).join(" · "))],
    ["Parking information", valueOrFallback(data.parkingDetails)],
    ["Access instructions", valueOrFallback(data.accessNotes)],
    ["Same-day request", valueOrFallback(data.sameDay)],
    ["Name", valueOrFallback(data.fullName)],
    ["Email", valueOrFallback(data.email)],
    ["Phone number", valueOrFallback(data.phone)],
    ["New or existing customer", valueOrFallback(data.customerType)],
    ["Preferred contact method", valueOrFallback(data.preferredContactMethod)],
    ["Privacy consent", valueOrFallback(data.privacyConsent)],
  ] : isCommercial ? [
    ["Service", "Commercial Cleaning"],
    ["Premises type or property details", valueOrFallback(data.premisesDescription)],
    ["Current condition", valueOrFallback(data.currentCondition)],
    ["Cleaning requirements", valueOrFallback(data.requirements)],
    ["Access or operational requirements", valueOrFallback(data.operationalRequirements)],
    ["One-off or recurring arrangement", arrangement],
    ["Preferred days and times", valueOrFallback(data.preferredSchedule)],
    ["Property address", valueOrFallback(data.address)],
    ["Preferred start date", valueOrFallback(data.preferredStartDate)],
    ["Business and contact details", valueOrFallback(data.company)],
    ["Preferred contact method", valueOrFallback(data.preferredContactMethod)],
    ["Access notes and additional comments", valueOrFallback(data.additionalNotes)],
    ["Uploaded photographs or documents", files],
  ] : [
    ["Service", "Property Support"],
    ["Support services", valueOrFallback(data.supportServices.join(", "))],
    ["Property type", valueOrFallback(propertyType)],
    ["Address and postcode", valueOrFallback(data.address)],
    ["Number of properties", String(data.propertyCount)],
    ["Property status", valueOrFallback(data.propertyStatus)],
    ["Description of support required", valueOrFallback(data.requirements)],
    ["One-off or recurring arrangement", arrangement],
    ["Preferred start date", valueOrFallback(data.preferredStartDate)],
    ["Required completion date", data.arrangement === "One-off" ? valueOrFallback(data.requiredCompletionDate) : "Not applicable"],
    ["Urgency", valueOrFallback(data.urgency)],
    ["Preferred days and times", valueOrFallback(data.preferredSchedule)],
    ["Access arrangements", valueOrFallback(data.accessNotes)],
    ["Company and contact details", valueOrFallback(data.company)],
    ["Preferred contact method", valueOrFallback(data.preferredContactMethod)],
    ["Additional comments", valueOrFallback(data.additionalNotes)],
    ["Uploaded photographs or documents", files],
  ];

  const explanation = isEndOfTenancy
    ? "End of Tenancy services are priced individually because the property’s size, condition, photographs and requirements must be reviewed."
    : isCommercial
      ? "Commercial Cleaning requires a tailored quote based on the premises, service requirements, schedule and frequency."
      : "Your Property Support request will be reviewed before a tailored quote is prepared.";

  return <section className="mx-auto mt-10 max-w-3xl">
    <Eyebrow>Custom Quote Required</Eyebrow>
    <h1 className="mt-5 font-serif text-[46px] leading-[.98] tracking-[-.03em] sm:text-[60px]">CUSTOM QUOTE REQUIRED</h1>
    <p className="mt-5 max-w-2xl text-[16px] leading-7 text-[#66635E]">We’ll review your requirements and prepare a personalised quote tailored to your property and service needs.</p>
    <Panel>
      <ErrorBox errors={errors} />
      <FileText className="text-[#B08A3C]" size={26} />
      <h2 className="mt-5 text-base font-bold">Request summary</h2>
      <div className="mt-4 divide-y divide-[#D8D5CF] border-y border-[#D8D5CF]">
        {rows.map(([label, value]) => <Row key={label} label={label} value={value} />)}
      </div>
      <p className="mt-6 text-sm leading-6 text-[#66635E]">{explanation}</p>
      <div className="mt-6 border-l-4 border-[#B08A3C] bg-[#F1EDE4] p-4 text-sm leading-6">This is a quote request, not a confirmed booking. Our team will review the information provided and contact you with the next step. The requested date and booking remain unconfirmed until review, approval and the required payment.</div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between"><Button variant="outline" left onClick={back}>Back and Edit Details</Button><Button onClick={() => void submit()} disabled={isSubmitting}>{isSubmitting ? "Submitting…" : "Submit Request for Review"}</Button></div>
    </Panel>
  </section>;
}