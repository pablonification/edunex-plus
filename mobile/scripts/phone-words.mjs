// The desktop's Indonesian words the phone says its own way (phoneWording in src/core/strings/mobile.ts), as
// mobile/flows/phone-words.json: the same-data flows (./flows-from-inventory.mjs) take a desktop text filled
// from one of them as found when the phone shows it in either wording, with the same values. Kept current by
// test/kit/phone-wording.test.ts; the flows read the file, as their CI job has no node_modules.
//
//   node mobile/scripts/phone-words.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
export const PHONE_WORDS = path.join(ROOT, "mobile", "flows", "phone-words.json");

/** Each reworded key's Indonesian: { key, desktop, phone }, by key. */
export function phoneWordPairs(strings, phoneWording) {
  return Object.entries(phoneWording)
    .map(([key, entry]) => ({ key, desktop: strings[key]?.id, phone: entry.id }))
    .filter((pair) => typeof pair.desktop === "string" && typeof pair.phone === "string" && pair.desktop !== pair.phone)
    .sort((a, b) => a.key.localeCompare(b.key));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { build } = await import("esbuild");
  const { outputFiles } = await build({
    stdin: {
      contents: 'export { STRINGS } from "./src/core/strings.ts"; export { phoneWording } from "./src/core/strings/mobile.ts";',
      resolveDir: ROOT,
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    platform: "neutral",
    write: false,
    logLevel: "silent",
  });
  const { STRINGS, phoneWording } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);
  const pairs = phoneWordPairs(STRINGS, phoneWording);
  fs.writeFileSync(PHONE_WORDS, `${JSON.stringify(pairs, null, 2)}\n`);
  console.log(`${pairs.length} reworded keys in ${path.relative(ROOT, PHONE_WORDS)}`);
}
