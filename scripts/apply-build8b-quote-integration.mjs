import fs from "node:fs";

const path = "src/app/Quote.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(label, before, after) {
  if (!source.includes(before)) {
    throw new Error(`Build 8B patch stopped: ${label} was not found.`);
  }

  source = source.replace(before, after);
}

replaceOnce(
  "quote submission import",
  'import { createQuotePayload } from "./quotePayload.js";\n',
  'import { createQuotePayload } from "./quotePayload.js";\nimport { createQuoteSubmissionId, resolveQuoteApiBaseUrl, submitQuoteRequest, uploadQuoteAttachments } from "./quoteSubmission.js";\n',
);

replaceOnce(
  "submission state",
  '  const [reference, setReference] = useState("");\n',
  '  const [reference, setReference] = useState("");\n  const [isSubmitting, setIsSubmitting] = useState(false);\n  const [submissionId, setSubmissionId] = useState("");\n',
);

replaceOnce(
  "route reset state",
  '    setStep(nextEntryRoute.step);\n    setErrors([]);\n',
  '    setStep(nextEntryRoute.step);\n    setErrors([]);\n    setReference("");\n    setSubmissionId("");\n    setIsSubmitting(false);\n',
);

replaceOnce(
  "local-only submit handler",
  `  const submit = () => {\n    const payload = createQuotePayload(data, { distanceMiles: null, travelFee: null });\n    const ref = \`CUC-\${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-\${crypto.randomUUID().slice(0, 6).toUpperCase()}\`;\n    const stored = { reference: ref, ...payload };\n    localStorage.setItem("cuc:lastPreparedQuote", JSON.stringify(stored));\n    window.dispatchEvent(new CustomEvent("cuc:quote-prepared", { detail: stored }));\n    setReference(ref); go("submitted");\n  };\n`,
  `  const submit = async () => {\n    if (isSubmitting) return;\n\n    setErrors([]);\n    setIsSubmitting(true);\n\n    const activeSubmissionId = submissionId || createQuoteSubmissionId();\n    setSubmissionId(activeSubmissionId);\n\n    const apiBaseUrl = resolveQuoteApiBaseUrl(\n      import.meta.env.VITE_API_BASE_URL,\n    );\n\n    try {\n      const payload = createQuotePayload(data, {\n        distanceMiles: null,\n        travelFee: null,\n      });\n\n      const response = await submitQuoteRequest({\n        apiBaseUrl,\n        submissionId: activeSubmissionId,\n        payload,\n      });\n\n      if (data.files.length > 0) {\n        await uploadQuoteAttachments({\n          apiBaseUrl,\n          submissionId: activeSubmissionId,\n          files: data.files,\n        });\n      }\n\n      setReference(response.confirmation.quoteNumber);\n      go("submitted");\n    } catch (error) {\n      setErrors([\n        error instanceof Error\n          ? error.message\n          : "We could not submit your quote request. Please try again.",\n      ]);\n    } finally {\n      setIsSubmitting(false);\n    }\n  };\n`,
);

replaceOnce(
  "QuoteStep props",
  'submit={submit} reference={reference} />',
  'submit={submit} reference={reference} isSubmitting={isSubmitting} />',
);

replaceOnce(
  "QuoteStep signature",
  'function QuoteStep({ step, data, update, go, errors, setErrors, chooseCategory, validateAddress, validateCustomer, estimate, customQuote, appointmentRequired, submit, reference }: { step: Step; data: QuoteData; update: <K extends keyof QuoteData>(key: K, value: QuoteData[K]) => void; go: (step: Step) => void; errors: string[]; setErrors: (errors: string[]) => void; chooseCategory: (category: Category) => void; validateAddress: () => void; validateCustomer: () => void; estimate: any; customQuote: boolean; appointmentRequired: boolean; submit: () => void; reference: string }) {',
  'function QuoteStep({ step, data, update, go, errors, setErrors, chooseCategory, validateAddress, validateCustomer, estimate, customQuote, appointmentRequired, submit, reference, isSubmitting }: { step: Step; data: QuoteData; update: <K extends keyof QuoteData>(key: K, value: QuoteData[K]) => void; go: (step: Step) => void; errors: string[]; setErrors: (errors: string[]) => void; chooseCategory: (category: Category) => void; validateAddress: () => void; validateCustomer: () => void; estimate: any; customQuote: boolean; appointmentRequired: boolean; submit: () => Promise<void>; reference: string; isSubmitting: boolean }) {',
);

replaceOnce(
  "summary component call",
  'if (step === "summary") return <Summary data={data} estimate={estimate} customQuote={customQuote} back={() => go(data.category === "Commercial Cleaning" || data.category === "Property Support" ? "customSupporting" : "customer")} submit={submit} />;',
  'if (step === "summary") return <Summary data={data} estimate={estimate} customQuote={customQuote} back={() => go(data.category === "Commercial Cleaning" || data.category === "Property Support" ? "customSupporting" : "customer")} submit={submit} errors={errors} isSubmitting={isSubmitting} />;',
);

replaceOnce(
  "submitted confirmation",
  'return <section className="mx-auto mt-10 max-w-3xl text-center"><span className="mx-auto grid size-14 place-items-center rounded-full bg-[#176B45] text-white"><CheckCircle2 size={28} /></span><Heading eyebrow="Prepared for Submission" title="Your request is ready" copy="The complete quote payload has been created and checked in this Headless-ready test build." /><Panel><p className="text-left text-sm leading-6">Reference: <b>{reference}</b><br />The request is stored locally for testing. When Wix Headless is connected, this same submission action will save it to Wix and upload the selected files.</p><div className="mt-6"><Button onClick={() => window.location.reload()}>Start Another Quote</Button></div></Panel></section>;',
  'return <section className="mx-auto mt-10 max-w-3xl text-center"><span className="mx-auto grid size-14 place-items-center rounded-full bg-[#176B45] text-white"><CheckCircle2 size={28} /></span><Heading eyebrow="Request Received" title="Your quote request has been submitted" copy="We have received your details and will review the request before confirming availability or a booking." /><Panel><p className="text-left text-sm leading-6">Quote reference: <b>{reference}</b><br />This is not a confirmed booking. Clean Up Central will contact you after reviewing the information supplied.</p><div className="mt-6"><Button onClick={() => window.location.reload()}>Start Another Quote</Button></div></Panel></section>;',
);

replaceOnce(
  "Summary signature",
  'function Summary({ data, estimate, customQuote, back, submit }: { data: QuoteData; estimate: any; customQuote: boolean; back: () => void; submit: () => void }) {',
  'function Summary({ data, estimate, customQuote, back, submit, errors, isSubmitting }: { data: QuoteData; estimate: any; customQuote: boolean; back: () => void; submit: () => Promise<void>; errors: string[]; isSubmitting: boolean }) {',
);

replaceOnce(
  "custom summary call",
  'if (customQuote) return <CustomQuoteSummary data={data} back={back} submit={submit} />;',
  'if (customQuote) return <CustomQuoteSummary data={data} back={back} submit={submit} errors={errors} isSubmitting={isSubmitting} />;',
);

replaceOnce(
  "standard summary panel",
  '    <Panel>\n      {estimate &&',
  '    <Panel>\n      <ErrorBox errors={errors} />\n      {estimate &&',
);

replaceOnce(
  "standard submit button",
  '<Button onClick={submit}>Submit for Review</Button>',
  '<Button onClick={() => void submit()} disabled={isSubmitting}>{isSubmitting ? "Submitting…" : "Submit for Review"}</Button>',
);

replaceOnce(
  "custom summary signature",
  'function CustomQuoteSummary({ data, back, submit }: { data: QuoteData; back: () => void; submit: () => void }) {',
  'function CustomQuoteSummary({ data, back, submit, errors, isSubmitting }: { data: QuoteData; back: () => void; submit: () => Promise<void>; errors: string[]; isSubmitting: boolean }) {',
);

replaceOnce(
  "custom summary panel",
  '<Panel><div className="divide-y divide-[#D8D5CF] border-y border-[#D8D5CF] text-sm">',
  '<Panel><ErrorBox errors={errors} /><div className="divide-y divide-[#D8D5CF] border-y border-[#D8D5CF] text-sm">',
);

const customButton = '<Button onClick={submit}>Submit for Review</Button>';
if (source.includes(customButton)) {
  source = source.replace(
    customButton,
    '<Button onClick={() => void submit()} disabled={isSubmitting}>{isSubmitting ? "Submitting…" : "Submit for Review"}</Button>',
  );
}

replaceOnce(
  "upload helper copy",
  'Files will be uploaded when Wix is connected.',
  'Selected files will be uploaded securely when the request is submitted.',
);

fs.writeFileSync(path, source);
console.log("Build 8B quote integration applied to src/app/Quote.tsx");
