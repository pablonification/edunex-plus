// What the relay reads of what the app sends (ADR 0007, 0015): the report and the few lines around
// it. Only the fields the relay uses are checked, loosely: the app can add fields without the relay
// turning its reports away, and the body is kept whole as it came all the same. Then which issue a
// report belongs to (its signature), and whether anything personal is still in it.
import { z } from "zod";
import { PRIVATE_PAGES, personalHits } from "../../test/kit/privacy-rules";
import { sha256 } from "./tokens";

/** "0.1.0-alpha.21": a version the app could have. */
const VERSION = /^\d{1,3}\.\d{1,3}\.\d{1,3}(?:-[0-9A-Za-z.]{1,40})?$/;

const Row = z.looseObject({ row: z.string().max(5000), why: z.string().max(2000) });

const Page = z.looseObject({ system: z.enum(["six", "edunex"]), path: z.string().max(2000), status: z.number(), body: z.string() });

/** Format 2: a row left out, as SIX wrote it (scrubbed), with its table's header row and its shape ("9 · aa9999 · …"). */
const Cell = z.looseObject({ row: z.string().max(5000), html: z.string().max(2000), header: z.string().max(2000).nullable(), shape: z.string().max(5000) });

/** Format 2: what the problem cost the Student. */
const Impact = z.looseObject({
  datasets: z.array(z.string().max(60)).max(40),
  rowsLeftOut: z.number(),
  detailsBlank: z.number(),
  lastGoodAt: z.number().nullable(),
});

const Reproduces = z.enum(["yes", "no", "unknown"]);
export type Reproduces = z.infer<typeof Reproduces>;

const Problem = z.looseObject({
  feed: z.string().regex(/^(?:six|edunex)\.[A-Za-z]{1,40}$/),
  datasets: z.array(z.string().max(60)).max(40),
  kind: z.enum(["changed", "skipped"]),
  check: z.string().max(2000),
  rows: z.array(Row).max(500),
  pages: z.array(Page).max(12),
  // Format 2. A field that doesn't fit is read as missing, not refused: it's only shown.
  reproduces: Reproduces.optional().catch(undefined),
  cells: z.array(Cell).max(100).optional().catch(undefined),
  impact: Impact.optional().catch(undefined),
});
export type Problem = z.infer<typeof Problem>;

const Source = z.looseObject({ source: z.string().max(20), state: z.string().max(20), detail: z.string().max(2000).nullable() });

const Report = z.looseObject({
  format: z.number().int().min(1).max(99),
  version: z.string().regex(VERSION),
  at: z.number(),
  sources: z.array(Source).max(5).optional().catch(undefined),
  problems: z.array(Problem).max(20),
});

/** POST /v1/reports. */
export const Envelope = z.looseObject({
  envelope: z.literal(1),
  report: Report,
  os: z.string().min(1).max(200),
  lang: z.enum(["id", "en"]),
  how: z.enum(["auto", "manual"]),
  note: z.string().max(1000).optional(),
});
export type Envelope = z.infer<typeof Envelope>;

/** POST /v1/reports/{id}/note. */
export const NoteBody = z.looseObject({ note: z.string().max(1000) });

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export const systemOf = (feed: string): "six" | "edunex" => (feed.startsWith("six.") ? "six" : "edunex");

/** Every run of digits as one 9: "course 3" and "course 14" are the same check. */
const nines = (text: string) => text.replace(/\d+/g, "9");

/**
 * Which issue a problem goes to, the same for every Student who meets it: the system, the feed,
 * the kind and the check, numbers aside. For rows left out, their reasons, each once, in order:
 * "course 3/4/5: attendance without its count" is one problem. "six-" or "edunex-" and a hash.
 */
export async function signatureOf(problem: Problem): Promise<string> {
  const checks = problem.kind === "skipped" && problem.rows.length ? [...new Set(problem.rows.map((row) => nines(row.why)))].sort() : [nines(problem.check)];
  const system = systemOf(problem.feed);
  return `${system}-${(await sha256([system, problem.feed, problem.kind, ...checks].join("\n"))).slice(0, 16)}`;
}

/**
 * The kinds of personal detail still anywhere in `value` (every string in it, names of fields too),
 * by the privacy tests' rules (test/kit/privacy-rules.ts): "email", "student number". None: nothing.
 */
export function personalIn(value: unknown): string[] {
  const found = new Set<string>();
  // Without recursion, one item at a time: a body is JSON from anyone, and could nest deeper, or
  // list more items, than a call can take.
  const stack = [value];
  while (stack.length) {
    const item = stack.pop();
    if (typeof item === "string") for (const hit of personalHits(item)) found.add(hit.slice(0, hit.indexOf(": ")));
    else if (Array.isArray(item)) for (const inner of item) stack.push(inner);
    else if (item && typeof item === "object") for (const [key, inner] of Object.entries(item)) stack.push(key, inner);
  }
  return [...found].sort();
}

/** Personal details in a report, and any page of SIX's it carries that it never should. */
export function personalInBody(raw: unknown, envelope: Envelope): string[] {
  const found = personalIn(raw);
  if (envelope.report.problems.some((problem) => problem.pages.some((page) => PRIVATE_PAGES.test(page.path)))) found.push("private page");
  return found.sort();
}
