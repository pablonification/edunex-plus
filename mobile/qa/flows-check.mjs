// Does every id a Maestro flow or QA script taps, asserts or waits for still exist in the phone app's source?
//
//   node mobile/qa/flows-check.mjs            every flow, its ids, what's missing (and the closest id that exists); exit 1 on a miss
//   node mobile/qa/flows-check.mjs --missing  only the flows with a miss
//   node mobile/qa/flows-check.mjs --ids      writes mobile/qa/testids-now.txt (every id the app draws, sorted; a templated one as
//                                             `row.task.<id>`) and prints nothing else
//   node mobile/qa/flows-check.mjs --json     the whole result as JSON
//
// The app's ids are found in mobile/src and mobile/app: every `testID=`/`testID:` (a string or a template, `${x}` kept as `<x>`), and
// every other string or template that starts like one (`home.search` in a constant, an id passed down as a prop). Two lists are
// read from their own files because the id is built from a list at run time: the tabs (`tab.<id>`, in app/(tabs)/_layout.tsx) and the
// services (`action.service.<id>`, in src/screens/services/list.ts). If another id is built that way tonight, add it to ENUMS.
//
// A flow's id is a Maestro regex matched whole (`row\.module\..*`); a `${VAR}` or `{{n}}` in it stands for any text. It is found when
// an id of the app is matched by it, or the other way (a templated id of the app matches the flow's literal id).
//
// A file whose first lines say `# history: <why>` is a snapshot of an older app (round 1's tabs, the baseline's pictures): read, listed
// as history, never failed. A file that belongs to another child tonight is in OWNED below: its misses are listed under that child.
//
// An id only an `assertNotVisible` / `notVisible:` names is a check that something is gone: if the app no longer draws it, the check
// holds, so it's listed as "absent" and doesn't fail.
//
// A step that waits for a screen that isn't built yet carries `# pending: <who>` on its line or in the comment lines right above it
// (YAML) or on its line (a script): it's reported on its own, and doesn't fail the check.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const at = (p) => path.join(root, p);

const walk = (dir, keep, out = []) => {
  if (!fs.existsSync(at(dir))) return out;
  for (const entry of fs.readdirSync(at(dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") walk(rel, keep, out);
    } else if (keep(rel)) out.push(rel);
  }
  return out;
};

// ---------------------------------------------------------------------------------------------------- the app's ids

/** Ids built from a list at run time: the template as the checker writes it (`<x>` for a `${..}`), and where the list is (a regex whose first group is an id). */
const ENUMS = [
  { template: "tab.<id>", file: "mobile/app/(tabs)/_layout.tsx", re: /\bid:\s*"(\w+)"/g, prefix: "tab." },
  {
    template: "action.service.<id>",
    file: "mobile/src/screens/services/list.ts",
    // `id: "x", label:` (the group's `id:` is followed by `title:`, a service's by `label:`).
    re: /\bid:\s*"(\w+)",\s*label:/g,
    prefix: "action.service.",
  },
];

/** Files another child edits tonight: their misses are that child's to fix, so they're reported with its name and don't fail. */
const OWNED = {
  "mobile/flows/round2/w15-onboarding.yaml": "the first minute",
  "mobile/flows/judge/first-run.yaml": "the first minute",
  "mobile/qa/flows/before-welcome.yaml": "the first minute",
};

/** Ids a flow names so that nothing matches (a wait for "nothing" is Maestro's sleep). */
const NEVER = new Set(["nothing.here"]);

const FILE_KINDS = /\.(?:tsx?|mjs)$/;
const sourceFiles = [...walk("mobile/src", (f) => FILE_KINDS.test(f)), ...walk("mobile/app", (f) => FILE_KINDS.test(f))];
const TESTID = /testID(?:=|:\s*)\s*(?:"([^"\n]+)"|\{?`([^`\n]+)`\}?)/g;
const LITERAL = /"([^"\n]+)"|'([^'\n]+)'|`([^`\n]+)`/g;

/** `a.${b.c}.d` -> `a.<b.c>.d`: the templated parts as a placeholder. */
const readable = (text) =>
  text.replace(
    /\$\{([^}]*)\}/g,
    (_, expr) =>
      `<${
        expr
          .trim()
          .split(/[^\w]+/)
          .filter(Boolean)
          .pop() ?? "x"
      }>`,
  );

/** Every key of the words (src/core/strings): `home.now.free` is a text, not an id, however much it reads like one. */
function stringKeys() {
  const keys = new Set();
  for (const file of walk("src/core/strings", (f) => f.endsWith(".ts")))
    for (const m of fs.readFileSync(at(file), "utf8").matchAll(/"([\w.]+)":\s*\{/g)) keys.add(m[1]);
  return keys;
}

function sourceIds() {
  const direct = new Set();
  const loose = new Set();
  for (const file of sourceFiles) {
    const code = fs.readFileSync(at(file), "utf8");
    for (const m of code.matchAll(TESTID)) direct.add(m[1] ?? m[2]);
    for (const m of code.matchAll(LITERAL)) {
      const s = m[1] ?? m[2] ?? m[3];
      if (/^[a-z][A-Za-z]*\.[^\s]+$/.test(s.replace(/\$\{[^}]*\}/g, "x")) && !/\.(?:tsx?|json|png|svg|jpg)$/.test(s)) loose.add(s);
    }
  }
  // Any other string counts only when it starts like an id the app draws (its first part is the first part of a `testID`) and is
  // not one of the words' keys.
  const words = stringKeys();
  const kinds = new Set([...direct].filter((s) => s.includes(".")).map((s) => s.split(".")[0]));
  const ids = new Set(direct);
  for (const s of loose) if (kinds.has(s.split(".")[0]) && !words.has(s)) ids.add(s);
  // A shared control builds ids on the one it's given (`<Segmented testID="segment.theme">` draws `segment.theme.dark`).
  for (const id of [...ids]) if (/^segment\.\w+$/.test(id)) ids.add(`${id}.\${value}`);
  const out = new Map(); // readable -> { templated: bool, re: RegExp | null }
  for (const raw of ids) {
    const text = readable(raw);
    const templated = /\$\{/.test(raw);
    // A whole id that is only a placeholder says nothing.
    if (/^<[^>]*>$/.test(text)) continue;
    // `${testID}.menu`: an id built on one passed in. It counts for `X.menu` when `X` is an id of the app (see `exists`).
    if (/^<[^>]*>\.<[^>]*>$/.test(text)) continue;
    if (/^<[^>]*>\.[\w.]+$/.test(text)) {
      out.set(text, { templated: true, suffix: text.replace(/^<[^>]*>/, ""), re: null });
      continue;
    }
    const re = templated
      ? new RegExp(
          `^${raw
            .split(/\$\{[^}]*\}/)
            .map((p) => p.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&"))
            .join("[^\\s]+")}$`,
        )
      : null;
    out.set(text, { templated, re });
  }
  // The lists: a template built from one is replaced by its members.
  for (const e of ENUMS) {
    if (!fs.existsSync(at(e.file))) continue;
    const members = [...fs.readFileSync(at(e.file), "utf8").matchAll(e.re)].map((m) => m[1]);
    out.delete(e.template);
    for (const member of members) out.set(`${e.prefix}${member}`, { templated: false, re: null });
  }
  return out;
}

const APP = sourceIds();

// ----------------------------------------------------------------------------------------------- matching a flow's id

/** A flow's id as a regex: `${VAR}` and `{{n}}` are any text; an id that isn't a valid regex is taken literally. */
const flowRegex = (id) => {
  const wild = id.replace(/\$\{[^}]*\}/g, ".+").replace(/\{\{[^}]*\}\}/g, ".+");
  try {
    return new RegExp(`^(?:${wild})$`);
  } catch {
    return new RegExp(`^${wild.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
  }
};
/** What a templated id of the app can be, for a flow's regex to try. */
const samples = (readableId) => {
  const fill = (s) => readableId.replace(/<[^>]*>/g, s);
  return [fill("0"), fill("x1"), fill("a-b"), fill("2026-10-08"), fill("PL3002"), fill("PL3002-08-00")];
};

const exists = (id) => {
  const re = flowRegex(id);
  const literal = id.replace(/\\(.)/g, "$1");
  for (const [text, info] of APP) {
    if (info.suffix) {
      if (literal.endsWith(info.suffix) && literal.length > info.suffix.length && exists(literal.slice(0, -info.suffix.length))) return true;
    } else if (!info.templated) {
      if (re.test(text)) return true;
    } else {
      if (samples(text).some((s) => re.test(s))) return true;
      if (info.re.test(literal.replace(/\$\{[^}]*\}|\{\{[^}]*\}\}/g, "0"))) return true;
    }
  }
  return false;
};

const distance = (a, b) => {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
};
/** The id of the app that reads most like this one (as the flow's id with its regex marks taken out). */
const closest = (id) => {
  const plain = id
    .replace(/\\(.)/g, "$1")
    .replace(/\.[*+]/g, "")
    .replace(/\$\{[^}]*\}|\{\{[^}]*\}\}/g, "<x>");
  let best = null;
  for (const text of APP.keys()) {
    const d = distance(plain, text);
    if (!best || d < best.d) best = { text, d };
  }
  return best?.text ?? null;
};

// ------------------------------------------------------------------------------------------------- the flows' ids

const FLOW_KINDS = [...new Set([...APP.keys()].map((s) => s.split(".")[0]))];
const ID_TOKEN = new RegExp(`(?<![\\w.\\-/])((?:${FLOW_KINDS.join("|")})\\\\?\\.[\\w.:\${}()|*+?\\\\-]+)`, "g");
const PENDING = /#\s*pending:\s*(.+?)\s*$/;

/** A YAML flow's `id:` values: each is `{ line, id, pending }`. */
function yamlIds(file) {
  const lines = fs.readFileSync(at(file), "utf8").split("\n");
  const out = [];
  lines.forEach((line, i) => {
    if (/^\s*#/.test(line)) return;
    for (const m of line.matchAll(/(?<![\w])id:\s*(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|((?:\$\{[^}]*\}|[^\s,}#])+))/g)) {
      const id = (m[1] ?? m[2] ?? m[3]).replace(/\\\\/g, "\\");
      if (!id || /^(?:com\.|android:|\$\{?\w+\}?$|true$|false$)/.test(id)) continue;
      // The step's own line, or the comment lines (and a bare `- tapOn:` header) right above it.
      let pending = line.match(PENDING)?.[1] ?? null;
      for (let j = i - 1; j >= 0 && !pending; j -= 1) {
        const above = lines[j];
        if (/^\s*#/.test(above)) pending = above.match(PENDING)?.[1] ?? null;
        else if (/^\s*(?:-\s*)?\w+:\s*(?:\{)?\s*$/.test(above) || /^\s*(?:-\s*)?\w+:\s*$/.test(above)) continue;
        else break;
        if (pending) break;
        if (!/^\s*#/.test(above)) continue;
      }
      // Under an `assertNotVisible:` or a `notVisible:` (a lower indent, within the step): a check that it is gone.
      const indent = line.search(/\S/);
      let negative = false;
      for (let j = i - 1; j >= Math.max(0, i - 4); j -= 1) {
        const above = lines[j];
        if (!above.trim() || /^\s*#/.test(above)) continue;
        if (above.search(/\S/) >= indent) continue;
        negative = /\b(?:assertNotVisible|notVisible)\b/.test(above);
        break;
      }
      out.push({ line: i + 1, id, pending, negative });
    }
    // `TAB: academic` handed to judge/tab.yaml, which taps `tab.${TAB}` and waits for `screen.${TAB}`.
    const tab = line.match(/^\s*TAB:\s*(\w+)\s*(?:#.*)?$/)?.[1];
    if (tab) for (const id of [`tab.${tab}`, `screen.${tab}`]) out.push({ line: i + 1, id, pending: line.match(PENDING)?.[1] ?? null });
  });
  return out;
}

/** screens.json: the `"id": "x"` of its steps. */
function jsonIds(file) {
  const out = [];
  fs.readFileSync(at(file), "utf8")
    .split("\n")
    .forEach((line, i) => {
      for (const m of line.matchAll(/"id":\s*"((?:[^"\\]|\\.)*)"/g)) {
        const id = m[1].replace(/\\\\/g, "\\");
        if (!/^(?:com\.|android:|\$)/.test(id)) out.push({ line: i + 1, id, pending: null });
      }
    });
  return out;
}

/**
 * A script's ids. In a `.mjs`, a string that is exactly an id (`"tab.home"`); in a shell script, a token right next to a quote
 * (`resource-id="tab.home"`); in a plan (`.txt`), any token. Comment lines are skipped.
 */
function tokenIds(file) {
  const out = [];
  const kind = path.extname(file);
  fs.readFileSync(at(file), "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (/^\s*(?:#|\/\/|\*)/.test(line)) return;
      const pending = line.match(PENDING)?.[1] ?? null;
      const found = [];
      if (kind === ".mjs") {
        for (const m of line.matchAll(/(["'`])([^"'`\s]+)\1/g)) if (new RegExp(`^${ID_TOKEN.source}$`).test(m[2])) found.push(m[2]);
      } else if (kind === ".sh") {
        for (const m of line.matchAll(new RegExp(`(?<=["'=])${ID_TOKEN.source}`, "g"))) found.push(m[1]);
      } else for (const m of line.matchAll(ID_TOKEN)) found.push(m[1]);
      for (const raw of found) {
        // A shell variable in it is any text.
        const id = raw.replace(/[.:,;)]+$/, "").replace(/\$\{?\w+\}?/g, ".*");
        if (/\.(?:mjs|js|sh|md|txt|json|yaml|png|xml)$/.test(id)) continue;
        out.push({ line: i + 1, id, pending });
      }
    });
  return out;
}

/** Every file that taps or waits for an id: the flows, the QA scripts, the CI script and the tap plans. */
function flowFiles() {
  const files = [
    ...walk("mobile/flows", (f) => /\.(?:ya?ml|sh)$/.test(f) && !f.includes("/expected/") && !f.includes("/data/")),
    ...walk("mobile/qa", (f) => /\.(?:ya?ml|sh|mjs|txt)$/.test(f) && !/flows-check|superapp-flows|testids-now|words-now\.txt|\/report\//.test(f)),
    "mobile/flows/screens.json",
    "scripts/ci/mobile-e2e.sh",
  ];
  return [...new Set(files)].filter((f) => fs.existsSync(at(f))).sort();
}

export function check() {
  const flows = [];
  for (const file of flowFiles()) {
    const found = /\.ya?ml$/.test(file) ? yamlIds(file) : file.endsWith(".json") ? jsonIds(file) : tokenIds(file);
    const seen = new Set();
    const rows = [];
    for (const f of found) {
      const key = `${f.line}|${f.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ ...f, found: NEVER.has(f.id) || exists(f.id) });
    }
    for (const row of rows) if (!row.found) row.closest = closest(row.id);
    for (const row of rows) if (!row.found && row.negative) row.absentOk = true;
    const history = fs
      .readFileSync(at(file), "utf8")
      .split("\n")
      .slice(0, 4)
      .some((l) => /^\s*(?:#|\/\/)\s*history:/.test(l));
    const owner = OWNED[file] ?? null;
    for (const row of rows) if (!row.found && !row.pending && !row.negative && owner) row.pending = `${owner}'s file`;
    if (history) for (const row of rows) if (!row.found) row.history = true;
    // What fails the check: an id that isn't there, not pending, not in a snapshot, not a check that it's gone.
    for (const row of rows) row.failing = !row.found && !row.pending && !row.history && !row.absentOk;
    flows.push({ file, ids: rows, history, owner });
  }
  return flows;
}

export const idExists = exists;
export const appIds = () => [...APP.keys()].sort();

// ------------------------------------------------------------------------------------------------------------- the CLI
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const args = process.argv.slice(2);
  if (args.includes("--ids")) {
    fs.writeFileSync(at("mobile/qa/testids-now.txt"), `${appIds().join("\n")}\n`);
    process.exit(0);
  }
  const flows = check();
  const missing = flows.flatMap((f) => f.ids.filter((r) => r.failing).map((r) => ({ file: f.file, ...r })));
  const pending = flows.flatMap((f) => f.ids.filter((r) => !r.found && r.pending).map((r) => ({ file: f.file, ...r })));
  if (args.includes("--json")) {
    console.log(JSON.stringify({ flows, missing, pending }, null, 2));
  } else {
    for (const flow of flows) {
      if (!flow.ids.length) continue;
      const miss = flow.ids.filter((r) => r.failing);
      const absent = flow.ids.filter((r) => !r.found && r.absentOk);
      const wait = flow.ids.filter((r) => !r.found && r.pending);
      const old = flow.ids.filter((r) => !r.found && r.history);
      const built = flow.ids.filter((r) => r.found && r.pending && !r.negative);
      if (args.includes("--missing") && !miss.length && !wait.length && !old.length && !absent.length && !built.length) continue;
      const verdict = miss.length ? "MISSING" : wait.length ? "pending" : old.length ? "history" : "ok";
      console.log(
        `${verdict.padEnd(7)} ${flow.file}  (${new Set(flow.ids.map((r) => r.id)).size} ids${miss.length ? `, ${miss.length} missing` : ""}${wait.length ? `, ${wait.length} pending` : ""}${old.length ? `, ${old.length} gone, in a snapshot of an older app` : ""}${absent.length ? `, ${absent.length} checked absent` : ""})`,
      );
      for (const r of miss) console.log(`        ${r.line}: ${r.id}  ->  closest: ${r.closest ?? "none"}`);
      for (const r of built) console.log(`        ${r.line}: ${r.id}  (marked pending: ${r.pending}, but the app draws it now: take the marker off)`);
      for (const r of absent) console.log(`        ${r.line}: ${r.id}  (checked absent, and it is)`);
      for (const r of wait) console.log(`        ${r.line}: ${r.id}  (pending: ${r.pending})`);
    }
    const bad = new Set(missing.map((m) => m.file));
    console.log(
      `\n${flows.filter((f) => f.ids.length).length} files read; ${missing.length} missing id(s) in ${bad.size} file(s); ${pending.length} pending (a screen not built yet).`,
    );
  }
  process.exit(missing.length ? 1 : 0);
}
