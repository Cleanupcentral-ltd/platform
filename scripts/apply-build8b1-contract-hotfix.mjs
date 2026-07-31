import fs from "node:fs";

const path = "src/app/Quote.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(label, before, after) {
  const matches = source.split(before).length - 1;
  if (matches !== 1) {
    throw new Error(
      `Build 8B.1 stopped: expected one ${label}, found ${matches}.`,
    );
  }
  source = source.replace(before, after);
}

replaceOnce(
  "backend mapper import",
  'import { createQuotePayload } from "./quotePayload.js";\n',
  'import { createQuotePayload } from "./quotePayload.js";\nimport { createBackendQuotePayload } from "./quoteRequestMapper.js";\n',
);

replaceOnce(
  "live submission payload",
  `      const payload = createQuotePayload(data, {\n        distanceMiles: null,\n        travelFee: null,\n      });\n\n      const response = await submitQuoteRequest({`,
  `      const payload = createBackendQuotePayload(\n        data,\n        estimate,\n      );\n\n      const response = await submitQuoteRequest({`,
);

fs.writeFileSync(path, source);
console.log(
  "Build 8B.1 backend contract hotfix applied to src/app/Quote.tsx",
);
