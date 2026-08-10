import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const outputRoot = resolve("dist");

for (const route of ["ops", "ops/leads"]) {
  const routeDirectory = resolve(outputRoot, route);
  await mkdir(routeDirectory, { recursive: true });
  await copyFile(
    resolve(outputRoot, "index.html"),
    resolve(routeDirectory, "index.html"),
  );
}
