// Turns the desktop's inventory (mobile/flows/expected/<scenario>.json, from
// ./inventory.mjs) into Maestro flows for the phone: mobile/flows/data/<scenario>/<screen>.yaml.
// Each flow starts the demo app in that scenario, reaches each state of its screen
// the way mobile/flows/screens.json says, and looks for every text of every
// entry (scrolling to it). Each look is an optional assertVisible with a label
// "data|<scenario>|<entry id>|<n>/<of>", so a failed one doesn't stop the run;
// a screen that shows less at once than the desktop (Jadwal's one day of a week)
// reaches each entry's part first with its `byEntry` steps;
// ./flows-from-inventory-report.mjs reads Maestro's output and counts an entry as
// found when all its texts were seen.
//
//   node mobile/scripts/flows-from-inventory.mjs [scenario ...]
//   maestro test --debug-output .scratch/maestro mobile/flows/data/signed-in
//   node mobile/scripts/flows-from-inventory-report.mjs .scratch/maestro
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
export const EXPECTED = path.join(ROOT, "mobile", "flows", "expected");
const DATA = path.join(ROOT, "mobile", "flows", "data");
export const SCREENS = path.join(ROOT, "mobile", "flows", "screens.json");

/** The desktop's items the phone leaves out on purpose (screens.json "phoneSkips": its scope row and why), by entry id. */
export function phoneSkip(config, entryId) {
  return (config.phoneSkips ?? []).find((skip) => new RegExp(skip.entry).test(entryId)) ?? null;
}

/** The label on the look for an entry's `n`th text of `of`. */
export const label = (scenario, id, n, of) => `data|${scenario}|${id}|${n}/${of}`;
export const LABEL = /^data\|([^|]+)\|([^|]+)\|(\d+)\/(\d+)$/;

// Grade letters alone ("A", "AB") match only a text that is exactly that; anything else may sit inside a longer text.
const EXACT = /^(?:[A-E]|AB|BC|T|K)$/;
/** Maestro's text selector: a regex the element's whole text must match (it ignores case; dots match line ends). */
export function pattern(token) {
  // "pada:24 September": the desktop's text read a lecturer's <br> as nothing; the phone breaks the line there.
  const escaped = token
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+")
    .replace(/:(?=\S)/g, ":\\s*");
  return EXACT.test(token) ? escaped : `.*${escaped}.*`;
}

/** Fills {{name}} in every string of `value`; a string that is exactly "{{name}}" takes the value as it is (an object). */
function fill(value, vars) {
  if (typeof value === "string") {
    const whole = /^\{\{(\w+)\}\}$/.exec(value);
    if (whole && whole[1] in vars) return vars[whole[1]];
    return value.replace(/\{\{(\w+)\}\}/g, (all, name) => (name in vars ? String(vars[name]) : all));
  }
  if (Array.isArray(value)) return value.map((v) => fill(v, vars));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v, vars)]));
  return value;
}

/** One Maestro command per line: JSON is YAML's flow style, so a line is a whole command. */
const line = (command) => `- ${JSON.stringify(command)}`;

/** The checks for one entry: scroll to its first text (down, then up), then look for each text. */
function checks(scenario, entry, scroll = 4000) {
  const out = [`# ${entry.kind}: ${entry.label}`.replace(/\s+/g, " ")];
  // Each text is looked for on its own, scrolling down then up to it: an item's first text (a time, a code) is often
  // on the screen higher up too, and anchoring on it left the rest of the item out of view. The flow proves the phone
  // shows each fact of the item, wherever it lays them out.
  entry.tokens.forEach((token, i) => {
    const element = { text: pattern(token) };
    // Scrolled to only when it isn't on screen already (a scroll toward an item above would run to the end first).
    out.push(
      line({ runFlow: { when: { notVisible: element }, commands: [{ scrollUntilVisible: { element, direction: "DOWN", timeout: scroll, optional: true } }] } }),
    );
    out.push(
      line({ runFlow: { when: { notVisible: element }, commands: [{ scrollUntilVisible: { element, direction: "UP", timeout: scroll, optional: true } }] } }),
    );
    out.push(line({ assertVisible: { ...element, optional: true, label: label(scenario, entry.id, i + 1, entry.tokens.length) } }));
  });
  return out;
}

/** The flow for one screen of one scenario. */
function flow(inventory, screen, states, config, appId) {
  const conf = config.screens[screen];
  if (!conf) throw new Error(`mobile/flows/screens.json has no screen "${screen}" (scenario ${inventory.scenario})`);
  // The demo build reads its scenario and variants from the link that opens it (mobile/src/demo/world.ts).
  const query = Object.entries(inventory.demo)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
  const base = { appId, demoArguments: inventory.demo, demoLink: `edunexplusdemo://demo?${query}` };
  // FLOWS_LOCAL=1: the app is already open on a dev build (its state holds Metro's address), so no fresh start:
  // back to Beranda by its tab instead.
  const home = [
    { tapOn: { id: "action.back", optional: true } },
    { tapOn: { id: "action.back", optional: true } },
    { tapOn: { id: "tab.home", optional: true } },
  ];
  const launch = process.env.FLOWS_LOCAL === "1" ? home : fill(conf.launch ?? config.launch, base);
  const count = states.reduce((n, s) => n + s.entries.length, 0);
  const out = [
    `# Generated by mobile/scripts/flows-from-inventory.mjs from mobile/flows/expected/${inventory.scenario}.json: don't edit, regenerate.`,
    `# ${inventory.scenario}: ${inventory.about}`,
    `# ${screen}: ${count} entries in ${states.length} state${states.length === 1 ? "" : "s"}; how it's reached: mobile/flows/screens.json (${conf.status ?? "ready"}).`,
    `appId: ${appId}`,
    `name: ${JSON.stringify(`data ${inventory.scenario} ${screen}`)}`,
    "tags:",
    "  - data",
    `  - data-${inventory.scenario}`,
    "---",
    ...launch.map(line),
  ];
  states.forEach(({ state, about, entries }, index) => {
    const parts = (state ?? "").split("/");
    // The desktop's "todo" list (Belum selesai) is the phone's "open" segment.
    const list = about?.list ?? "todo";
    // The phone's id for an exam (row.exam.<id>): the desktop row's key up to its source ("DK4073-UTS:six:2179909"),
    // or, for one the desktop lists without a key (under its Masa UTS/UAS line), its course and kind from the title.
    const titled = /^(UTS|UAS|Kuis)\b.*?\b([A-Z]{2}\d{4})\b/.exec(about?.title ?? "");
    const exam = state?.includes(":") ? state.split(":")[0] : titled ? `${titled[2]}-${titled[1].toUpperCase()}` : (state ?? "");
    const vars = {
      ...base,
      state: state ?? "",
      list: list === "todo" ? "open" : list,
      exam,
      examKind: /-(UTS|UAS)\b/.exec(exam)?.[1] ?? "",
      // A Task by its id: the state itself, or a take-home's ("DK4073-UTS:task:117764").
      taskId: /(?:^|:task:)(\d+)$/.exec(state ?? "")?.[1] ?? state ?? "",
      ...Object.fromEntries(parts.map((p, i) => [String(i + 1), p])),
    };
    const pick = Object.entries(conf.byState ?? {}).find(([re]) => new RegExp(re).test(state ?? ""));
    out.push("", `# ---- ${screen}${state ? ` ${state}` : ""}${about?.title ? ` (${about.title.replace(/\s+/g, " ").slice(0, 80)})` : ""}`);
    if (conf.relaunch && index > 0) out.push(...launch.map(line));
    out.push(...fill(pick ? pick[1] : conf.steps, vars).map(line));
    for (const entry of entries) {
      // A pattern on "<entry id>|<its context>" (the day it's on): steps that bring it into view first.
      const before = Object.entries(conf.byEntry ?? {}).find(([re]) => new RegExp(re).test(`${entry.id}|${entry.context ?? ""}`));
      if (before) out.push(...fill(before[1], vars).map(line));
      if (phoneSkip(config, entry.id)) continue;
      // A long screen (Settings, Nilai) takes longer to scroll to its end than the 4 s that do for most.
      out.push(...checks(inventory.scenario, entry, conf.scrollTimeout ?? 4000));
    }
  });
  return `${out.join("\n")}\n`;
}

function main() {
  const names = process.argv.slice(2);
  const config = JSON.parse(fs.readFileSync(SCREENS, "utf8"));
  const files = fs
    .readdirSync(EXPECTED)
    .filter((f) => f.endsWith(".json"))
    .filter((f) => !names.length || names.includes(f.replace(/\.json$/, "")));
  if (names.length && files.length !== names.length) throw new Error(`No inventory for some of ${names.join(", ")} (run mobile/scripts/inventory.mjs)`);
  for (const file of files) {
    const inventory = JSON.parse(fs.readFileSync(path.join(EXPECTED, file), "utf8"));
    // States in the order the desktop walk read them, each with its entries.
    const screens = new Map();
    for (const { screen, state, ...about } of inventory.states) {
      if (!screens.has(screen)) screens.set(screen, new Map());
      const key = state ?? "";
      if (!screens.get(screen).has(key)) screens.get(screen).set(key, { state, about, entries: [] });
    }
    for (const entry of inventory.entries)
      screens
        .get(entry.screen)
        ?.get(entry.state ?? "")
        ?.entries.push(entry);
    const dir = path.join(DATA, inventory.scenario);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    let written = 0;
    for (const [screen, states] of screens) {
      const withEntries = [...states.values()].filter((s) => s.entries.length);
      if (!withEntries.length) continue;
      fs.writeFileSync(path.join(dir, `${screen}.yaml`), flow(inventory, screen, withEntries, config, config.appId));
      written++;
    }
    console.log(`${inventory.scenario}: ${written} flows, ${inventory.entries.length} entries`);
  }
}

if (process.argv[1] === import.meta.filename) main();
