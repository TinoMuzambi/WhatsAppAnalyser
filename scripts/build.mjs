import { cp, mkdir, rm, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
await rm(`${root}dist`, { recursive: true, force: true });
await mkdir(`${root}dist`, { recursive: true });
// Explicit allowlist: never copy _server, api, env files, tests, source, or documentation.
for (const name of ["index.html", "privacy.html", "terms.html", "static", "favicon.ico", "manifest.json", "android-icon-192x192.png"]) {
  await access(`${root}${name}`);
  await cp(`${root}${name}`, `${root}dist/${name}`, { recursive: true });
}
console.log("Built public assets in dist; paid report design is server-only.");
