import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve("dist");
const sourceEntry = path.join(distDir, "index.html");

const publicRoutes = [
  "home",
  "about",
  "cleaning-services",
  "commercial-cleaning",
  "property-support",
  "quote",
  "get-a-quote",
  "contact",
  "faqs",
  "privacy",
  "terms",
];

if (!fs.existsSync(sourceEntry)) {
  throw new Error(
    "Route entry generation stopped: dist/index.html does not exist. Run the Vite build first.",
  );
}

const html = fs.readFileSync(sourceEntry, "utf8");

for (const route of publicRoutes) {
  const routeDirectory = path.join(distDir, route);
  fs.mkdirSync(routeDirectory, { recursive: true });
  fs.writeFileSync(path.join(routeDirectory, "index.html"), html);
}

console.log(
  `Generated clean route entries for ${publicRoutes.length} public routes.`,
);
