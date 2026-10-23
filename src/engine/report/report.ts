// "Laporkan masalah" (ADR 0007): the report a Student can send about a page the app couldn't read,
// built from the pages kept for it (./kept-pages.ts) and scrubbed here (./scrub.ts) before it goes
// anywhere, even to the window that shows it. Who the Student is comes from what the app already
// read, and from the pages themselves (a first sign-in whose status page didn't read has nothing
// else); everyone else a page names is found on the page.
//
// Grades, amounts, IP and IPK and Edunex scores are made up for each report, from `seed`: the
// shape stays, so the pages read as the real ones did, and two reports can't be compared to work
// the real values back.
import type { DatasetName, DatasetValue, ProblemReport, ReportAbout, ReportPage, SourceStatus } from "../../core/models";
import type { Kept, KeptPage } from "./kept-pages";
import {
  FAKE_STUDENT,
  FakePeople,
  isPersonObject,
  type MadeUp,
  peopleInEdunex,
  peopleOnSixPage,
  type RecordRules,
  Replacements,
  Shapes,
  scrubEdunexFields,
  scrubPatterns,
  scrubRecordText,
  scrubSixRecords,
  sixStudentIds,
  stableHash,
  studentNameOnSixPage,
  studentNumbers,
  walk,
} from "./scrub";

export interface ReportInput {
  /** What's kept now, the latest first. */
  kept: readonly Kept[];
  about: ReportAbout;
  get<N extends DatasetName>(name: N): DatasetValue<N> | undefined;
  statuses: readonly SourceStatus[];
  version: string;
  now: number;
  /** Picks this report's made-up values. */
  seed: number;
}

/** Made-up grades come out as often as real ones do: mostly A and AB. */
const GRADES = ["A", "A", "A", "AB", "AB", "AB", "B", "B", "BC", "C"];

export function buildReport(input: ReportInput): ProblemReport {
  const { about } = input;
  const chosen = input.kept.filter(
    (kept) =>
      (!about.source || kept.feed.startsWith(`${about.source}.`)) && (!about.datasets?.length || kept.datasets.some((name) => about.datasets!.includes(name))),
  );
  const scrub = new ReportScrubber(input, chosen);
  return {
    format: 1,
    version: input.version,
    at: input.now,
    sources: input.statuses
      .filter((status) => status.source !== "itb")
      .map((status) => ({ source: status.source, state: status.state, detail: status.detail === null ? null : scrub.text(status.detail) })),
    problems: chosen.map((kept) => ({
      feed: kept.feed,
      datasets: [...kept.datasets],
      kind: kept.kind,
      check: scrub.text(kept.check),
      rows: kept.rows.map((row) => ({ row: scrub.text(row.row), why: scrub.text(row.why) })),
      at: kept.at,
      pages: kept.pages.map((page) => scrub.page(kept.feed, page)),
    })),
  };
}

const systemOf = (feed: string) => (feed.startsWith("six.") ? "six" : "edunex");

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** One report's scrubbing: every page, check and row in it gets the same fake for the same real value. */
class ReportScrubber {
  private readonly known = new Replacements();
  private readonly shapes = new Shapes();
  private readonly indexes = new Map<string, string>();
  private readonly rules: RecordRules;
  private readonly madeUp: MadeUp;

  constructor(input: ReportInput, kept: readonly Kept[]) {
    const roll = (key: string) => stableHash(`${input.seed}:${key}`) / 2 ** 32;
    const grade = (key: string) => GRADES[Math.floor(roll(`grade:${key}`) * GRADES.length)]!;
    this.rules = {
      grade: (code) => grade(code),
      // Between half and twice the real amounts: a made-up amount says nothing about the real one.
      amountFactor: 0.5 + 1.5 * roll("amount"),
      index: (real) => {
        let fake = this.indexes.get(real);
        if (!fake) {
          const decimals = real.length - 2;
          fake = (2 + 2 * roll(`index:${real}`)).toFixed(decimals).replace(".", real[1]!);
          this.indexes.set(real, fake);
        }
        return fake;
      },
    };
    this.madeUp = {
      grade,
      number: (real, key) => {
        const fake = 40 + 60 * roll(`score:${key}:${real}`);
        return Number.isInteger(real) ? Math.round(fake) : Math.round(fake * 100) / 100;
      },
    };
    this.learn(input, kept);
  }

  /** Who the pages are about and whom they name, each with their made-up stand-in. */
  private learn(input: ReportInput, kept: readonly Kept[]): void {
    const pages = kept.flatMap((one) => one.pages.map((page) => ({ feed: one.feed, ...page })));
    const six = pages.filter((page) => systemOf(page.feed) === "six");
    const answers = pages.filter((page) => systemOf(page.feed) === "edunex").map((page) => parseJson(page.body));
    const words = kept.flatMap((one) => [one.check, ...one.rows.flatMap((row) => [row.row, row.why])]).join("\n");
    const student = input.get("six.student");
    const account = input.get("edunex.account");

    const names = new Set([student?.name, account?.name, ...six.map((page) => studentNameOnSixPage(page.body))].filter((name): name is string => !!name));
    for (const name of names) {
      this.known.add(name, FAKE_STUDENT.name);
      this.known.add(name.toUpperCase(), FAKE_STUDENT.name.toUpperCase());
      this.known.add(name.split(" ")[0], FAKE_STUDENT.first);
    }

    // The Student's own number first (theirs is in each SIX address), then anyone else's.
    const nims = new Set([student?.nim, account?.nim, ...pages.flatMap((page) => studentNumbers(page.url))].filter((nim): nim is string => !!nim));
    for (const nim of [...pages.flatMap((page) => studentNumbers(page.body)), ...studentNumbers(words)].sort()) nims.add(nim);
    for (const [i, nim] of [...nims].entries()) this.known.add(nim, FAKE_STUDENT.nim + i);

    const sixIds = new Set([student?.studentId, ...six.flatMap((page) => sixStudentIds(`${page.url}\n${page.body}`))].filter((id): id is string => !!id));
    for (const [i, id] of [...sixIds].entries()) this.known.add(id, FAKE_STUDENT.sixId + i);

    // Edunex's ids for the Student, on the records that are theirs.
    const edunexIds = new Set<string>();
    for (const answer of answers)
      walk(answer, (o) => {
        if (!isPersonObject(o) || !(nims.has(String(o.code)) || names.has(String(o.name)))) return;
        for (const id of [o.id, o.user_id, o.student_id, ...(Array.isArray(o.student_ids) ? o.student_ids : [])])
          if (typeof id === "number") edunexIds.add(String(id));
      });
    for (const [i, id] of [...edunexIds].sort().entries()) this.known.add(id, FAKE_STUDENT.edunexId + i);

    const people = new Set([
      input.get("six.krs")?.advisor,
      ...Object.values(input.get("edunex.outline") ?? {}).map((outline) => outline.lecturer),
      ...six.flatMap((page) => peopleOnSixPage(page.body, page.url)),
      ...answers.flatMap((answer) => peopleInEdunex(answer)),
    ]);
    const fakes = new FakePeople();
    for (const person of [...people].filter((name): name is string => !!name && !names.has(name)).sort()) {
      const fake = fakes.next();
      this.known.add(person, fake);
      this.known.add(person.toUpperCase(), fake.toUpperCase());
    }
  }

  /** A check's or a row's words. */
  text(text: string): string {
    return scrubPatterns(this.known.apply(scrubRecordText(text, this.rules)), this.shapes);
  }

  page(feed: string, page: KeptPage): ReportPage {
    const url = new URL(page.url);
    const path = scrubPatterns(this.known.apply(`${url.pathname}${url.search}`), this.shapes);
    const system = systemOf(feed);
    if (system === "six")
      return { system, path, status: page.status, body: scrubPatterns(this.known.apply(scrubSixRecords(page.body, this.rules)), this.shapes) };
    const text = scrubPatterns(this.known.apply(page.body), this.shapes);
    const answer = parseJson(text);
    // Something other than data (Edunex's own error page, say): its words, as for any text.
    return { system, path, status: page.status, body: answer === undefined ? text : JSON.stringify(scrubEdunexFields(answer, this.madeUp), null, 2) };
  }
}
