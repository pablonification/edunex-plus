// Whether a report still shows what went wrong once it's scrubbed (ADR 0014): the scrubbed pages are
// read again the way the feed read them, offline, and must fail the same check, or leave out the
// same rows for the same reasons. Taking a Student's details out can also take out what tripped the
// reader (a value made up in its place), and a report that no longer fails is one the maintainer
// can't fix from.
//
// The read runs on the pages kept in memory, never the network: SIX's pages through SIX's own client
// (its answers checked as they were) and the feed's own code; an Edunex answer through the check its
// call ran on it. The real pages go first, as a control: a read that can't be run again offline (it
// needed a page that wasn't kept, or what the app knew then has changed) says "unknown", not "no".
import type { DatasetName, DatasetValue, Reproduces, SixStudent, SkippedRow } from "../../core/models";
import type { Clock } from "../clock";
import { isEngineError } from "../errors";
import { Pace } from "../http/pace";
import type { AnswerCheck, Transport } from "../http/transport";
import { registerSixCheckInFeed } from "../sources/six/check-in";
import { SIX_ORIGIN, SixClient } from "../sources/six/client";
import { readSchedule } from "../sources/six/feeds";
import type { SixIdentity, SixPages } from "../sources/six/pages";
import { registerSixRecordFeeds } from "../sources/six/records";
import { readNim, readStatusPage } from "../sources/six/status";
import type { FeedSpec, SourceContext } from "../sources/source";
import { isChange, UNNOTED } from "./kept-pages";

/** How a read ended: the check that failed, or none and the rows it left out. */
export interface Outcome {
  check: string | null;
  rows: readonly SkippedRow[];
}

/** A page as the read is given it again: its path and query on its site, its status, its body. */
export interface PageAgain {
  path: string;
  status: number;
  body: string;
  /** For an Edunex answer: the check its call ran on it (KeptPage.check). */
  check?: AnswerCheck;
}

/** One way of reading the pages: as they came (the control), or scrubbed. */
export interface Reading {
  pages: readonly PageAgain[];
  /** Who SIX's pages are about, as these pages name them. Null before the status page first read. */
  who: SixIdentity | null;
  /** How the read should end on these pages: as it did, in these pages' words. */
  expected: Outcome;
}

export interface ReadAgainInput {
  feed: string;
  /** When the read ran: what a time-bound read (this month's timetable, a class on now) went by. */
  at: number;
  /** What the app holds now (the timetable "Tandai Hadir" goes by). */
  get<N extends DatasetName>(name: N): DatasetValue<N> | undefined;
}

/**
 * "yes" when the scrubbed pages end the read as the real ones did (in their own words), "no" when
 * they don't, "unknown" when the read can't be run again from these pages at all.
 */
export async function reproduces(input: ReadAgainInput, real: Reading, scrubbed: Reading): Promise<Reproduces> {
  const control = await readAgain(input, real);
  if (!control || !sameOutcome(control, real.expected)) return "unknown";
  const again = await readAgain(input, scrubbed);
  if (!again) return "unknown";
  return sameOutcome(again, scrubbed.expected) ? "yes" : "no";
}

/** SIX's identity as the app knows it, for its pages' addresses. */
export const sixIdentity = (student: SixStudent | undefined): SixIdentity | null =>
  student ? { nim: student.nim, studentId: student.studentId, term: student.term } : null;

/** Nothing is asked of the network: no request leaves to say who's asking. */
const USER_AGENT = "EdunexPlus (report)";

/** The read asked for a page that wasn't kept: it can't run again offline. */
class NotKept extends Error {}

/** The feed's read on `reading`'s pages: how it ended, or null when it can't run on them. */
async function readAgain(input: ReadAgainInput, reading: Reading): Promise<Outcome | null> {
  if (input.feed.startsWith("edunex.")) return checkAgain(reading);
  if (!input.feed.startsWith("six.")) return null;
  const rows: SkippedRow[] = [];
  try {
    await readSixAgain(input, reading, rows);
  } catch (error) {
    // A page change, as the engine counts one; anything else (a page not kept, signed out) isn't the page's.
    return isChange(error) ? { check: error.message, rows: [] } : null;
  }
  return { check: null, rows };
}

/** An Edunex answer, checked again the way its call checked it. */
function checkAgain(reading: Reading): Outcome | null {
  for (const page of reading.pages) {
    if (!page.check) continue;
    try {
      page.check({ path: new URL(page.path, "https://edunex.invalid").pathname, status: page.status, body: page.body });
    } catch (error) {
      if (isEngineError(error)) return { check: error.message, rows: [] };
      return null;
    }
    return { check: null, rows: [] };
  }
  return null;
}

/** "/app/…?bulan=202610" however it's written (encoded or not), to find a kept page by. */
const normal = (path: string) => {
  const url = new URL(path, SIX_ORIGIN);
  return `${url.pathname}${url.search}`;
};

async function readSixAgain({ feed, at, get }: ReadAgainInput, { pages, who }: Reading, rows: SkippedRow[]): Promise<void> {
  const kept = new Map(pages.map((page) => [normal(page.path), page]));
  const transport: Transport = {
    async request(request) {
      const page = kept.get(normal(request.url));
      if (!page) throw new NotKept(`${new URL(request.url).pathname} wasn't kept`);
      return { status: page.status, headers: {}, body: page.body, url: request.url };
    },
  };
  // The read's own moment, standing still: SIX's two seconds between pages pass at once.
  const clock: Clock = {
    now: () => at,
    setTimeout: (fn) => {
      queueMicrotask(fn);
      return { id: 0 };
    },
    clearTimeout: () => undefined,
  };
  // SIX's own client, so each answer is checked as it was (an error status, SIX's sign-in page).
  const client = new SixClient(transport, clock, "", USER_AGENT, new Pace(clock));
  const known = (): Promise<SixIdentity> => (who ? Promise.resolve(who) : Promise.reject(new NotKept("who the Student is")));
  const six: SixPages = { who: known, page: (path, options) => client.page(path, options) };

  if (feed === "six.status") {
    // As SIX's client reads it: the NIM it knows, or the one on SIX's home page before its first read.
    const home = kept.get("/home");
    const nim = who?.nim ?? (home ? readNim(home.body) : (await known()).nim);
    rows.push(...readStatusPage(await six.page(`/app/mahasiswa:${nim}/statusmhs`), nim).skipped);
    return;
  }
  if (feed === "six.schedule") {
    await readSchedule(six, at);
    return;
  }
  // The other feeds as they're registered: their own code, storing nothing.
  const specs = new Map<string, FeedSpec>();
  const context: SourceContext = {
    transport,
    clock,
    userAgent: USER_AGENT,
    settings: () => {
      throw new NotKept("settings");
    },
    get,
    set: async (_name, _value, skipped = []) => {
      rows.push(...skipped);
      return false;
    },
    remove: async () => undefined,
    feed: (spec) => void specs.set(spec.name, spec),
    runNow: async () => undefined,
    pace: () => new Pace(clock),
    // Nothing is noted: this read is the report's own.
    for: () => context,
  };
  registerSixRecordFeeds(context, six);
  registerSixCheckInFeed(context, six);
  const spec = specs.get(feed);
  if (!spec) throw new NotKept(`${feed} can't be read again`);
  await spec.run(() => true, UNNOTED);
}

/** The same check, or the same rows for the same reasons (a row cut at its length matches up to the cut). */
function sameOutcome(a: Outcome, b: Outcome): boolean {
  return a.check === b.check && a.rows.length === b.rows.length && a.rows.every((row, i) => sameText(row.row, b.rows[i]!.row) && row.why === b.rows[i]!.why);
}

export function sameText(a: string, b: string): boolean {
  if (a === b) return true;
  // A row is kept cut to its length ("…"), before it's scrubbed in the report and after on the page.
  const cut = (text: string) => (text.endsWith("…") ? text.slice(0, -1) : null);
  const [x, y] = [cut(a) ?? a, cut(b) ?? b];
  if (!cut(a) && !cut(b)) return false;
  // Scrubbing changes a cut row's length by a name or two, never by half: a short one is another row.
  const length = Math.min(x.length, y.length);
  return length >= SAME_FROM && x.slice(0, length) === y.slice(0, length);
}

/** As much of a cut row as must match: half of what a reader keeps (src/engine/sources/skipped.ts). */
const SAME_FROM = 60;
