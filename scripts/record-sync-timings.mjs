// Times one sync on the real Edunex, SIX and ITB, request by request, as the phone runs it at a start
// with nothing saved: test/kit/sync-timings.ts. Only reads go out (anything else is refused and
// logged); what it writes has no page, id or name, so it can be committed as the pretend world's
// network (test/fixtures/real-timings.json, test/pretend/network.ts).
//
// Usage:
//   npm run timings:record -- <session.json> [out.json]
//   <session.json>: {"edunex": "<Edunex token>", "six": "khongguan=…"}. Never commit it: it signs in as you.
//   out.json: test/fixtures/real-timings.json by default.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const [sessionFile, outFile = path.join(root, "test/fixtures/real-timings.json")] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
if (!sessionFile) {
  console.error('Which session? npm run timings:record -- <session.json> [out.json], with {"edunex": "<token>", "six": "khongguan=…"}');
  process.exit(2);
}
const session = JSON.parse(fs.readFileSync(sessionFile, "utf8"));
if (typeof session.edunex !== "string" && typeof session.six !== "string") {
  console.error(`${sessionFile} has neither "edunex" nor "six".`);
  process.exit(2);
}

// The engine is TypeScript: bundled for this run, next to the packages it imports.
const out = path.join(root, "node_modules", ".cache", "record-sync-timings.mjs");
await build({
  entryPoints: [path.join(root, "test/kit/sync-timings.ts")],
  outfile: out,
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  logLevel: "error",
});
const { recordSync, nodeTransport, systemClock } = await import(pathToFileURL(out).href);

const timings = await recordSync({
  transport: nodeTransport,
  clock: systemClock,
  sessions: { edunex: session.edunex, six: session.six },
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  note: `Recorded ${new Date().toISOString().slice(0, 10)} from Node on the recorder's network.`,
});
fs.writeFileSync(outFile, `${JSON.stringify(timings, null, 2)}\n`);
console.log(`${timings.requests.length} requests, the sync done in ${(timings.totalMs / 1000).toFixed(1)} s → ${path.relative(root, outFile)}`);
for (const feed of timings.feeds) console.log(`  ${(feed.doneAtMs / 1000).toFixed(1).padStart(5)} s  ${feed.name}${feed.ok ? "" : "  (failed)"}`);
if (timings.refused.length) {
  console.error(`Refused ${timings.refused.length} request(s) that would have written: a bug, please report it.`);
  process.exit(1);
}
// The engine's own timers (alerts, the next runs) would keep Node up.
process.exit(0);
