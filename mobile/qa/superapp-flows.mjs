// Which of the phone's Maestro flows depend on the screens tonight's layout changes (Beranda, Profil (once Akademik), the top bar's
// avatar / search / bell, the tab bar), and on what: the testID or text, with file and line. It writes the "by flow" part of
// mobile/qa/superapp-flows.md between its two markers, so the list can be made again once the layout has moved.
//
//   node mobile/qa/superapp-flows.mjs            prints the Markdown
//   node mobile/qa/superapp-flows.mjs --write    puts it into mobile/qa/superapp-flows.md between <!-- flows:start --> and <!-- flows:end -->
//   node mobile/qa/superapp-flows.mjs --stale    only the ids no source file draws (a flow waiting for something gone)
//
// How a surface's testIDs are found: every `testID="…"` and testID={`…${x}`} in the files that draw it (SURFACES below), a
// template cut at its first ${} into a prefix. An id a flow names is a Maestro regex, matched whole; it belongs to a surface
// when it matches one of that surface's ids (a literal id, or a prefix the flow's id starts with). An id that is drawn in
// other files too (`action.checkIn`, `card.firstScan`) is marked "also in …": the flow may be on the other screen.
// Texts are matched by looking the string up in src/core/strings and finding the files that use its key: a guess, marked "?".
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const at = (p) => path.join(root, p);

const walkFiles = (dir, keep, out = []) => {
  if (!fs.existsSync(at(dir))) return out;
  for (const entry of fs.readdirSync(at(dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") walkFiles(rel, keep, out);
    } else if (keep(rel)) out.push(rel);
  }
  return out;
};

/** The surfaces tonight rebuilds: where they're drawn today. `files` draw their testIDs; `extra` are ids by hand. */
const SURFACES = {
  "tab bar": {
    files: [],
    extra: ["tab.home", "tab.schedule", "tab.tasks", "tab.courses", "tab.profile"],
    note: "mobile/app/(tabs)/_layout.tsx draws `tab.<id>` for home, schedule, tasks, courses, profile",
  },
  "top bar": {
    files: [],
    extra: [
      "action.account",
      "action.search",
      "action.alerts",
      "badge.alerts",
      "action.syncStatus",
      "home.header",
      "status.settling",
      "status.firstRead",
      "sheet.sync",
      "action.refreshNow",
    ],
    note: "TabActions, Bell, Avatar and the status line in mobile/src/shell/source-status.tsx; Beranda's own bar in screens/home/header.tsx",
  },
  Beranda: {
    files: ["mobile/app/(tabs)/index.tsx", ...walkFiles("mobile/src/screens/home", (f) => /\.tsx?$/.test(f))],
    extra: [],
    note: "mobile/src/screens/home/*",
  },
  Profil: {
    files: ["mobile/app/(tabs)/profile.tsx", ...walkFiles("mobile/src/screens/academic", (f) => /\.tsx?$/.test(f))],
    extra: [],
    note: "mobile/src/screens/academic/*",
  },
};

// testIDs by file, for "also in".
const sourceFiles = [...walkFiles("mobile/src", (f) => /\.tsx?$/.test(f)), ...walkFiles("mobile/app", (f) => /\.tsx?$/.test(f))];
const idsIn = new Map();
for (const file of sourceFiles) {
  const code = fs.readFileSync(at(file), "utf8");
  const ids = [];
  for (const m of code.matchAll(/testID=(?:"([^"]+)"|\{`([^`]+)`\})/g)) ids.push(m[1] ?? m[2].split("${")[0]);
  // `testID: "x"` in a props object, and `${...}` templates in ids passed down as props.
  for (const m of code.matchAll(/testID:\s*(?:"([^"]+)"|`([^`]+)`)/g)) ids.push(m[1] ?? m[2].split("${")[0]);
  // `tab.${id}` (the tab bar's own, from a list) is a prefix too short to say anything; the tab ids are SURFACES["tab bar"].extra.
  const real = ids.filter((id) => id.length > 4);
  if (real.length) idsIn.set(file, real);
}
const allDrawn = [...new Set([...idsIn.values()].flat())];

const surfaceIds = {};
for (const [name, surface] of Object.entries(SURFACES)) {
  surfaceIds[name] = new Set(surface.extra);
  for (const file of surface.files) for (const id of idsIn.get(file) ?? []) surfaceIds[name].add(id);
}

const regexOf = (value) => {
  try {
    return new RegExp(`^(?:${value})$`);
  } catch {
    return null;
  }
};
/** Does a flow's id (a Maestro regex) name this drawn id (a literal, or a prefix when it ends in a template)? */
const names = (flowId, drawn) => {
  const re = regexOf(flowId);
  if (!re) return false;
  if (re.test(drawn)) return true;
  // A prefix from a template (`row.need.`): the flow's literal id starts with it, or its regex accepts the prefix plus something.
  return /[.:]$/.test(drawn) && (flowId.replace(/\\/g, "").startsWith(drawn) || re.test(`${drawn}0`) || re.test(`${drawn}x`));
};
const surfacesOfId = (flowId) => {
  const hits = [];
  for (const [name, ids] of Object.entries(surfaceIds)) {
    const hit = [...ids].find((id) => names(flowId, id));
    if (hit) hits.push({ surface: name, drawn: hit });
  }
  return hits;
};
const alsoIn = (flowId, surface) => {
  const own = new Set(SURFACES[surface].files);
  const elsewhere = [];
  for (const [file, ids] of idsIn) if (!own.has(file) && ids.some((id) => names(flowId, id))) elsewhere.push(file.replace(/^mobile\/(?:src\/)?/, ""));
  return surface === "tab bar" || surface === "top bar" ? elsewhere.filter((f) => !/source-status|\(tabs\)\/_layout/.test(f)) : elsewhere;
};

// Strings: key -> { id, en }, and where each key is used.
const strings = new Map();
for (const file of walkFiles("src/core/strings", (f) => f.endsWith(".ts"))) {
  for (const m of fs.readFileSync(at(file), "utf8").matchAll(/"([\w.]+)":\s*\{\s*id:\s*"((?:[^"\\]|\\.)*)"\s*,\s*en:\s*"((?:[^"\\]|\\.)*)"/g))
    strings.set(m[1], { id: m[2], en: m[3] });
}
const keyUse = new Map();
for (const file of sourceFiles) {
  const code = fs.readFileSync(at(file), "utf8");
  for (const m of code.matchAll(/["'`]([a-z][\w]*(?:\.[\w]+)+)["'`]/g))
    if (strings.has(m[1])) (keyUse.get(m[1]) ?? keyUse.set(m[1], new Set()).get(m[1])).add(file);
}
const surfaceOfFile = (file) => {
  for (const [name, surface] of Object.entries(SURFACES)) if (surface.files.includes(file)) return name;
  if (file === "mobile/app/(tabs)/_layout.tsx") return "tab bar";
  if (file === "mobile/src/shell/source-status.tsx") return "top bar";
  return null;
};
/** A string's text as a pattern: each {placeholder} stands for any text. */
const patternOf = (text) => new RegExp(`^${text.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{\w+\}/g, ".+")}$`, "i");
/** Does a flow's text matcher (a Maestro regex, matched whole) read like this string? Placeholders count as any text. */
const readsLike = (matcher, text) => {
  const plain = !/[.*+?^$()|[\]\\{}]/.test(matcher.replace(/\.\*/g, ""));
  if (plain && !matcher.includes(".*")) return patternOf(text).test(matcher.trim());
  const re = regexOf(matcher);
  if (re?.test(text.replace(/\{\w+\}/g, "1"))) return true;
  // A matcher with `.*` in it: every literal piece of it, in order, in the string.
  const pieces = matcher
    .split(/\.\*/)
    .map((p) => p.replace(/\\(.)/g, "$1").trim())
    .filter(Boolean);
  if (!pieces.length || pieces.some((p) => /[()|[\]+?{}^$]/.test(p))) return false;
  let from = 0;
  const lower = text.toLowerCase();
  for (const piece of pieces) {
    const found = lower.indexOf(piece.toLowerCase(), from);
    if (found < 0) return false;
    from = found + piece.length;
  }
  return pieces.join("").length >= 4;
};
/** The surfaces whose files use a string the matcher reads like: a guess, marked "?". */
const textSurfaces = (matcher) => {
  const found = new Map();
  for (const [key, text] of strings) {
    // Only strings with no data in them: a template like "{title} · {where}" would read like any text.
    if (/\{\w+\}/.test(text.id + text.en) || text.id.length < 4) continue;
    if (!(readsLike(matcher, text.id) || readsLike(matcher, text.en))) continue;
    for (const file of keyUse.get(key) ?? []) {
      const surface = surfaceOfFile(file);
      if (surface) found.set(surface, [...(found.get(surface) ?? []), key]);
    }
  }
  return [...found].map(([surface, keys]) => ({ surface, keys: [...new Set(keys)].slice(0, 2) }));
};
// Reads the flow's greeting and the tab labels by hand where the strings can't say (built from parts at run time).
const TEXT_BY_HAND = [
  [/^\(Pagi\|Siang\|Sore\|Malam\), Dimas$/, "Beranda", "the greeting, header.tsx"],
  [/^(Beranda|Jadwal|Tugas|Kuliah|Profil)$/, "tab bar", "a tab's label"],
];

// What each flow file is run by: every other file that names it.
const flowFiles = [
  ...walkFiles("mobile/flows", (f) => /\.(yaml|yml|sh)$/.test(f)),
  ...walkFiles("mobile/qa/flows", (f) => /\.(yaml|yml|sh)$/.test(f)),
  "mobile/flows/screens.json",
  ...(fs.existsSync(at(".maestro")) ? walkFiles(".maestro", (f) => /\.(yaml|yml)$/.test(f)) : []),
].sort();
const referrers = walkFiles(
  "mobile",
  (f) => /\.(sh|mjs|md|json|ya?ml)$/.test(f) && !f.includes("/report/") && !f.includes("/node_modules/") && !/judge-r2|r3-board|HANDOFF|PROGRESS/.test(f),
)
  .concat(walkFiles("scripts", (f) => /\.(sh|mjs)$/.test(f)))
  .concat(walkFiles(".github/workflows", (f) => /\.ya?ml$/.test(f)));
const runBy = (flow) => {
  const base = path.posix.basename(flow);
  const by = new Set();
  if (/^mobile\/flows\/[^/]+\.ya?ml$/.test(flow))
    by.add(
      "CI `e2e (app)`: .github/workflows/mobile.yml, through scripts/ci/mobile-e2e.sh (`*.yaml` of mobile/flows), on a pull request or push that changes mobile/, every night and by hand",
    );
  if (flow === "mobile/flows/screens.json")
    by.add(
      "CI `e2e (<scenario>)` (nightly and full runs): mobile/scripts/flows-from-inventory.mjs makes mobile/flows/data/<scenario>/*.yaml from it and mobile/flows/expected/*.json",
    );
  if (/^mobile\/flows\/judge\//.test(flow)) by.add("not run on its own (mobile-e2e.sh skips `judge/`)");
  for (const file of referrers) {
    if (file === flow || file.startsWith("mobile/flows/expected/")) continue;
    const code = fs.readFileSync(at(file), "utf8");
    const mentions = code.split("\n").some((line) => (line.includes(base) || line.includes(flow)) && !/^\s*#\s*$/.test(line));
    if (mentions) by.add(file === "mobile/flows/screens.json" ? "screens.json" : file);
  }
  return [...by];
};

// A line's selectors.
const SELECTOR =
  /\b(id|text|tapOn|assertVisible|assertNotVisible|doubleTapOn|longPressOn|visible|notVisible):\s*(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|([^\s{][^\n]*))/g;
const unquote = (value) => value.replace(/\\\\/g, "\\");
function selectorsOf(file) {
  const out = [];
  fs.readFileSync(at(file), "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (/^\s*#/.test(line)) return;
      const code = file.endsWith(".yaml") || file.endsWith(".yml") ? line.replace(/\s#.*$/, "") : line;
      if (file.endsWith(".sh")) {
        for (const m of code.matchAll(/\b((?:tab|screen|action|row|card|section|list|sheet|home|segment|status|badge)\.[\w.:${}()|*\\-]+)/g))
          out.push({ line: i + 1, kind: "id", value: m[1].replace(/\$\{?\w+\}?/g, ".*") });
        return;
      }
      for (const m of code.matchAll(SELECTOR)) {
        const value = unquote((m[2] ?? m[3] ?? m[4] ?? "").trim().replace(/^["']|["']$/g, ""));
        if (!value || value === "true" || value === "false") continue;
        out.push({ line: i + 1, kind: m[1] === "id" ? "id" : "text", value, how: m[1] });
      }
      // JSON (screens.json): "id": "x", "text": "y".
      if (file.endsWith(".json")) {
        for (const m of line.matchAll(/"(id|text)":\s*"((?:[^"\\]|\\.)*)"/g)) out.push({ line: i + 1, kind: m[1], value: unquote(m[2]), how: m[1] });
      }
    });
  return out;
}

/** What a tab bar id leads to, for the text that follows it. */
const TAB_SURFACE = { "tab.home": "Beranda", "tab.profile": "Profil" };
const dependencies = (file) => {
  const found = [];
  const seen = new Set();
  // Where the flow probably is: after a tap on a tab, until the next id that belongs to no surface (a row, a course) moves it on.
  let here = null;
  for (const sel of selectorsOf(file)) {
    const key = `${sel.line}|${sel.kind}|${sel.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (sel.kind === "id") {
      const hits = surfacesOfId(sel.value);
      for (const { surface, drawn } of hits) {
        const also = alsoIn(sel.value, surface);
        found.push({
          line: sel.line,
          what: `\`${sel.value}\``,
          surface,
          note: also.length ? `also drawn in ${also.slice(0, 3).join(", ")}${also.length > 3 ? ", …" : ""}` : "",
          drawn,
        });
      }
      if (hits.some((h) => h.surface === "tab bar")) here = TAB_SURFACE[sel.value] ? { surface: TAB_SURFACE[sel.value], line: sel.line, via: sel.value } : null;
      else if (hits.some((h) => h.surface === "Beranda" || h.surface === "Profil"))
        here = here ?? { surface: hits[0].surface, line: sel.line, via: sel.value };
      else if (!/^(?:screen|status)\./.test(sel.value)) here = null;
    } else {
      const hand = TEXT_BY_HAND.find(([re]) => re.test(sel.value));
      if (hand) {
        found.push({ line: sel.line, what: `text "${sel.value}"`, surface: hand[1], note: hand[2] });
        continue;
      }
      const guessed = textSurfaces(sel.value);
      for (const { surface, keys } of guessed)
        found.push({
          line: sel.line,
          what: `text "${sel.value}"`,
          surface: `${surface}?`,
          note: `string ${keys.map((k) => `\`${k}\``).join(", ")} is used there`,
        });
      if (!guessed.length && here)
        found.push({
          line: sel.line,
          what: `text "${sel.value}"`,
          surface: `${here.surface}?`,
          note: `after \`${here.via}\` at line ${here.line}, nothing else tapped since`,
        });
    }
  }
  return found;
};

const staleIds = () => {
  const out = [];
  for (const file of flowFiles) {
    if (file.endsWith(".sh")) continue;
    for (const sel of selectorsOf(file)) {
      if (sel.kind !== "id" || /^(?:com\.|android:|\$|.*\$\{)/.test(sel.value)) continue;
      // An id built inside a shared control (`segment.theme` + `.dark`) isn't written out: a drawn id the flow's id extends is fine.
      const extended = allDrawn.some((id) => sel.value.replace(/\\/g, "").startsWith(`${id}.`));
      if (!allDrawn.some((id) => names(sel.value, id)) && !extended && !SURFACES["tab bar"].extra.some((id) => names(sel.value, id)))
        out.push({ file, line: sel.line, id: sel.value });
    }
  }
  return out;
};

if (process.argv.includes("--stale")) {
  for (const s of staleIds()) console.log(`${s.file}:${s.line}  ${s.id}`);
  process.exit(0);
}

const lines = [];
const flowsWith = [];
const flowsWithout = [];
for (const file of flowFiles) {
  const deps = dependencies(file);
  (deps.length ? flowsWith : flowsWithout).push({ file, deps });
}
for (const { file, deps } of flowsWith) {
  const by = runBy(file);
  lines.push(
    `### \`${file}\``,
    "",
    `Run by: ${by.length ? by.map((b) => (b.startsWith("CI") || b.startsWith("not run") ? b : `\`${b}\``)).join("; ") : "nothing in the repository names it (run by hand)"}`,
    "",
  );
  const order = ["tab bar", "top bar", "Beranda", "Profil"];
  const merged = new Map();
  for (const dep of deps.sort((a, b) => a.line - b.line || order.indexOf(a.surface.replace("?", "")) - order.indexOf(b.surface.replace("?", "")))) {
    const key = `${dep.line}|${dep.what}`;
    const old = merged.get(key);
    if (!old) merged.set(key, { ...dep, surfaces: [dep.surface], notes: dep.note ? [dep.note] : [] });
    else {
      old.surfaces.push(dep.surface);
      if (dep.note && !old.notes.includes(dep.note)) old.notes.push(dep.note);
    }
  }
  if (file.endsWith(".json")) {
    // One line per id: the file is thousands of lines long.
    const byWhat = new Map();
    for (const dep of merged.values()) {
      const key = `${dep.what}|${dep.surfaces.join(" and ")}`;
      const old = byWhat.get(key) ?? { ...dep, lines: [] };
      old.lines.push(dep.line);
      byWhat.set(key, old);
    }
    for (const dep of byWhat.values())
      lines.push(`- ${file}:${dep.lines.join(", ")}: ${dep.what}, ${dep.surfaces.join(" and ")}${dep.notes.length ? ` (${dep.notes.join("; ")})` : ""}`);
  } else
    for (const dep of merged.values())
      lines.push(`- ${file}:${dep.line}: ${dep.what}, ${dep.surfaces.join(" and ")}${dep.notes.length ? ` (${dep.notes.join("; ")})` : ""}`);
  lines.push("");
}
// Who uses what: the ids the flows lean on most, across every flow.
const tally = new Map();
for (const { file, deps } of flowsWith) {
  for (const dep of deps) {
    if (!dep.what.startsWith("`")) continue;
    const row = tally.get(dep.what) ?? { surface: dep.surface, files: new Set(), uses: 0 };
    row.files.add(file);
    row.uses += 1;
    tally.set(dep.what, row);
  }
}
const tallied = [...tally].sort((a, b) => b[1].files.size - a[1].files.size || b[1].uses - a[1].uses);
lines.push("### The ids most used (how many flow files name each)", "", "| id | on | flow files | mentions |", "| --- | --- | ---: | ---: |");
for (const [what, row] of tallied.slice(0, 30)) lines.push(`| ${what} | ${row.surface} | ${row.files.size} | ${row.uses} |`);
lines.push("", "### Flows with nothing on those surfaces", "");
for (const { file } of flowsWithout) lines.push(`- \`${file}\``);
const stale = staleIds();
lines.push("", "### Ids no source file draws today (flows already waiting for something gone)", "");
if (!stale.length) lines.push("None.");
for (const s of stale) lines.push(`- ${s.file}:${s.line}: \`${s.id}\``);
const markdown = `${lines.join("\n")}\n`;

if (process.argv.includes("--write")) {
  const target = at("mobile/qa/superapp-flows.md");
  const text = fs.readFileSync(target, "utf8");
  const start = text.indexOf("<!-- flows:start -->");
  const end = text.indexOf("<!-- flows:end -->");
  if (start < 0 || end < 0) throw new Error("mobile/qa/superapp-flows.md has no flows:start / flows:end markers");
  fs.writeFileSync(target, `${text.slice(0, start)}<!-- flows:start -->\n\n${markdown}\n${text.slice(end)}`);
} else process.stdout.write(markdown);
