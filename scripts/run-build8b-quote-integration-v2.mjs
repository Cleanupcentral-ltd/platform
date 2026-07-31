import fs from "node:fs";

const patchPath =
  "scripts/apply-build8b-quote-integration.mjs";

let patch = fs.readFileSync(
  patchPath,
  "utf8",
);

const oldPanelBlock = `replaceOnce(
  "custom summary panel",
  '<Panel><div className="divide-y divide-[#D8D5CF] border-y border-[#D8D5CF] text-sm">',
  '<Panel><ErrorBox errors={errors} /><div className="divide-y divide-[#D8D5CF] border-y border-[#D8D5CF] text-sm">',
);`;

const newPanelBlock = `replaceOnce(
  "custom summary panel",
  '    <Panel>\\n      <FileText className="text-[#B08A3C]" size={26} />',
  '    <Panel>\\n      <ErrorBox errors={errors} />\\n      <FileText className="text-[#B08A3C]" size={26} />',
);`;

if (!patch.includes(oldPanelBlock)) {
  throw new Error(
    "Build 8B v2 stopped: the original custom panel patch was not found.",
  );
}

patch = patch.replace(
  oldPanelBlock,
  newPanelBlock,
);

const oldButtonBlock = `const customButton = '<Button onClick={submit}>Submit for Review</Button>';
if (source.includes(customButton)) {
  source = source.replace(
    customButton,
    '<Button onClick={() => void submit()} disabled={isSubmitting}>{isSubmitting ? "Submitting…" : "Submit for Review"}</Button>',
  );
}`;

const newButtonBlock = `replaceOnce(
  "custom submit button",
  '<Button onClick={submit}>Submit Request for Review</Button>',
  '<Button onClick={() => void submit()} disabled={isSubmitting}>{isSubmitting ? "Submitting…" : "Submit Request for Review"}</Button>',
);`;

if (!patch.includes(oldButtonBlock)) {
  throw new Error(
    "Build 8B v2 stopped: the original custom button patch was not found.",
  );
}

patch = patch.replace(
  oldButtonBlock,
  newButtonBlock,
);

fs.writeFileSync(
  patchPath,
  patch,
);

await import(
  `./apply-build8b-quote-integration.mjs?v=${Date.now()}`
);
