// KRS, UKT and ITB's academic deadlines (#80): what each means for the
// Student. Pure: the KRS and UKT tabs, the Kalender akademik tab and the
// alerts all reason with these, so they always agree. View only: nothing here
// changes a KRS or pays a bill.
import type { AcademicCalendar, Bill, CalendarEvent, CalendarKind, ClassSession, KrsPlan, Progress } from "./models";
import type { StringKey, Vars } from "./strings";

const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

/** The start of a WIB day ("2026-08-23") in ms. */
export const wibDayStart = (day: string) => Date.parse(`${day}T00:00:00+07:00`);
/** A WIB clock time on a day, `offset` days later: alerts go out in the morning, not at midnight. */
export const wibMorning = (day: string, offset = 0) => wibDayStart(day) + offset * DAY + 8 * HOUR;

/** Rupiah as Indonesians write it in both languages: "Rp5.400.000". */
export function rupiah(amount: number): string {
  return `Rp${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(amount)}`;
}

// ------------------------------------------------------------ terms

const TERM = /^(\d{4})-([123])$/;

/** The regular term after this one: 2026-1 → 2026-2, 2026-2 (or the short 2026-3) → 2027-1. */
export function nextTerm(term: string): string {
  const match = TERM.exec(term);
  if (!match) return term;
  const year = Number(match[1]);
  return match[2] === "1" ? `${year}-2` : `${year + 1}-1`;
}

/** "Semester {n} {years}" placeholders for a term code, for alert text. */
export function termVars(term: string): { n: string; years: string } {
  const year = Number(term.slice(0, 4));
  return { n: term.slice(5), years: `${year}/${year + 1}` };
}

/**
 * The term the Student is in: SIX's own (the KRS page or the status page)
 * when known, else from the calendar: the first regular term whose final
 * exams haven't ended.
 */
export function currentTerm(known: string | null | undefined, calendar: AcademicCalendar | undefined, now: number): string | null {
  if (known) return known;
  const today = new Date(now + 7 * HOUR).toISOString().slice(0, 10);
  const uas = calendar?.events.filter((e) => e.kind === "uas" && e.term && !e.term.endsWith("-3") && e.lastDay >= today) ?? [];
  return uas[0]?.term ?? null;
}

// ------------------------------------------------------------ KRS

export type KrsStepKey = "sent" | "approved" | "ukt" | "official";

export interface KrsStep {
  key: KrsStepKey;
  /** When it happened (ms); null while it hasn't, and for the UKT step. */
  at: number | null;
  done: boolean;
  /** The UKT step's amount, when SIX shows it. */
  amount?: number | null;
}

/** The plan round's steps in SIX's order (sent, approved, UKT paid, official), and the change round's (URS) when there is one. */
export function krsTimeline(plan: KrsPlan): { plan: KrsStep[]; change: KrsStep[] | null } {
  const steps: KrsStep[] = [
    { key: "sent", at: plan.plan.sentAt, done: plan.plan.sentAt !== null },
    { key: "approved", at: plan.plan.approvedAt, done: plan.plan.approvedAt !== null },
  ];
  if (plan.ukt) steps.push({ key: "ukt", at: null, done: plan.ukt.paid, amount: plan.ukt.amount });
  steps.push({ key: "official", at: plan.plan.legalizedAt, done: plan.plan.legalizedAt !== null });
  const change = plan.change && [
    { key: "sent" as const, at: plan.change.sentAt, done: plan.change.sentAt !== null },
    { key: "approved" as const, at: plan.change.approvedAt, done: plan.change.approvedAt !== null },
    { key: "official" as const, at: plan.change.legalizedAt, done: plan.change.legalizedAt !== null },
  ];
  return { plan: steps, change };
}

/**
 * What the plan's state asks of the Student.
 * - send: nothing sent yet; the Student fills and sends it in SIX.
 * - advisor: sent, waiting for the academic advisor.
 * - ukt: approved, but UKT isn't paid, so it can't be made official.
 * - official: approved, waiting to be made official (SIX does it).
 * - done: official.
 */
export type KrsStage = "send" | "advisor" | "ukt" | "official" | "done";

export function krsStage(plan: KrsPlan): KrsStage {
  switch (plan.state) {
    case "not-sent":
      return "send";
    case "sent":
      return "advisor";
    case "approved":
      return plan.ukt && !plan.ukt.paid ? "ukt" : "official";
    default:
      return "done";
  }
}

/** The DRS and URS windows for a term on ITB's calendar. */
export function krsWindows(calendar: AcademicCalendar | undefined, term: string): { drs: CalendarEvent | null; urs: CalendarEvent | null } {
  const of = (kind: CalendarKind) => calendar?.events.find((e) => e.kind === kind && e.term === term) ?? null;
  return { drs: of("drs"), urs: of("urs") };
}

/**
 * The next ITB window for this KRS that hasn't closed: the DRS while the plan
 * isn't sent, then the URS (changing it). `open`: it's running now.
 */
export function nextKrsWindow(
  plan: KrsPlan,
  calendar: AcademicCalendar | undefined,
  now: number,
): { kind: "drs" | "urs"; event: CalendarEvent; open: boolean } | null {
  const { drs, urs } = krsWindows(calendar, plan.term);
  for (const [kind, event] of [
    ["drs", plan.state === "not-sent" ? drs : null],
    ["urs", urs],
  ] as const) {
    if (event && event.end > now) return { kind, event, open: event.start <= now };
  }
  return null;
}

/** The Student has a KRS step to take now: nothing sent while the DRS window hasn't closed. */
export function krsNeedsStudent(plan: KrsPlan | undefined, calendar: AcademicCalendar | undefined, now: number): boolean {
  if (plan?.state !== "not-sent") return false;
  const { drs } = krsWindows(calendar, plan.term);
  return drs === null || drs.end > now;
}

/** Two KRS courses whose classes overlap on SIX's timetable (SIX accepts this and never says so). */
export interface Overlap {
  /** Sorted course codes. */
  codes: [string, string];
  /** How many meetings collide. */
  count: number;
  /** The overlapping stretch of the next collision still to come, or of the last one. */
  start: number;
  end: number;
  /** Every collision is still to come or past. */
  upcoming: boolean;
}

/** Overlapping classes between the plan's courses, worst (most collisions) first. */
export function krsOverlaps(codes: readonly string[], schedule: readonly ClassSession[], now: number): Overlap[] {
  const wanted = new Set(codes);
  const sessions = schedule.filter((s) => wanted.has(s.courseCode) && s.end > s.start).sort((a, b) => a.start - b.start);
  const pairs = new Map<string, { codes: [string, string]; hits: { start: number; end: number }[] }>();
  for (let i = 0; i < sessions.length; i++) {
    const a = sessions[i]!;
    for (let j = i + 1; j < sessions.length && sessions[j]!.start < a.end; j++) {
      const b = sessions[j]!;
      if (b.courseCode === a.courseCode) continue;
      const pair = [a.courseCode, b.courseCode].sort() as [string, string];
      const key = pair.join("|");
      const entry = pairs.get(key) ?? { codes: pair, hits: [] };
      entry.hits.push({ start: Math.max(a.start, b.start), end: Math.min(a.end, b.end) });
      pairs.set(key, entry);
    }
  }
  return [...pairs.values()]
    .map(({ codes: pair, hits }) => {
      const next = hits.find((h) => h.end > now);
      const shown = next ?? hits.at(-1)!;
      return { codes: pair, count: hits.length, start: shown.start, end: shown.end, upcoming: next !== undefined };
    })
    .sort((a, b) => b.count - a.count || a.start - b.start);
}

// ------------------------------------------------------------ bills

/** A week before the deadline counts as soon. */
export const BILL_SOON = 7 * DAY;

/**
 * paid, not-billed: nothing to do. overdue: the next payment's day has
 * passed. soon: due within a week. due: due later. no-date: unpaid, SIX
 * gives no last day.
 */
export type BillUrgency = "paid" | "not-billed" | "overdue" | "soon" | "due" | "no-date";

export function billUrgency(bill: Bill, now: number): BillUrgency {
  if (bill.status === "paid" || bill.status === "not-billed") return bill.status;
  if (bill.nextDueAt === null) return "no-date";
  if (bill.nextDueAt < now) return "overdue";
  return bill.nextDueAt - now <= BILL_SOON ? "soon" : "due";
}

export const billNeedsStudent = (bill: Bill, now: number) => {
  const urgency = billUrgency(bill, now);
  return urgency === "overdue" || urgency === "soon";
};

/** What is still to pay on a bill. */
export const billLeft = (bill: Bill) => Math.max(0, (bill.amount ?? 0) - (bill.paid ?? 0));

/** ITB's UKT deadline for a term (the calendar's "Batas Waktu Pembayaran Biaya Pendidikan"). */
export function uktDeadline(calendar: AcademicCalendar | undefined, term: string): CalendarEvent | null {
  return calendar?.events.find((e) => e.kind === "ukt-deadline" && e.term === term) ?? null;
}

// ------------------------------------------------------------ ITB's academic deadlines

/** The calendar kinds that mean something for a Student, in the list. */
export const DEADLINE_KINDS: readonly CalendarKind[] = [
  "drs",
  "urs",
  "ukt-deadline",
  "lecture-start",
  "uts",
  "questionnaire",
  "lecture-end",
  "uas",
  "grade-deadline",
  "grade-change-deadline",
  "progress-check",
];

/** SKS ITB expects passed by the end of each study year (Peraturan Akademik). */
export const PROGRESS_SKS = [24, 48, 72, 96, 120] as const;

/**
 * The progress check's yardstick: at a check on `day`, the study years
 * completed since the Student started (`entryTerm`), and the SKS expected
 * by then. Null outside years 1–5.
 */
export function progressTarget(entryTerm: string | null, day: string): { year: number; sks: number } | null {
  if (!entryTerm) return null;
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  // An academic year starts in August: a check in Jan 2027 is in 2026/2027.
  const completed = (month >= 8 ? year : year - 1) - Number(entryTerm.slice(0, 4));
  if (completed < 1 || completed > PROGRESS_SKS.length) return null;
  return { year: completed, sks: PROGRESS_SKS[completed - 1]! };
}

export interface Meaning {
  key: StringKey;
  vars?: Vars;
  /** Already done by the Student (sent, paid): said calmly. */
  done?: boolean;
  /** Needs the Student, or isn't on track: said plainly. */
  warn?: boolean;
}

export interface Deadline {
  event: CalendarEvent;
  /** Which variant of a split deadline: grade changes for final projects (TA) and for other courses. */
  variant: "ta" | "non-ta" | null;
  meaning: Meaning | null;
  /** past: ended. now: running today. next: still to come. */
  when: "past" | "now" | "next";
}

export interface DeadlineFacts {
  calendar: AcademicCalendar | undefined;
  /** This term (see currentTerm). */
  term: string | null;
  now: number;
  krs?: KrsPlan;
  bills?: readonly Bill[];
  progress?: Progress;
}

/** What one calendar event means for this Student, in one short line. */
export function deadlineMeaning(event: CalendarEvent, facts: Omit<DeadlineFacts, "calendar" | "term">): Meaning | null {
  const plan = facts.krs?.term === event.term ? facts.krs : undefined;
  switch (event.kind) {
    case "drs":
      if (plan && plan.state !== "not-sent") return { key: "deadline.drs.sent", done: true };
      return { key: "deadline.drs" };
    case "urs":
      if (plan?.change?.sentAt) return { key: "deadline.urs.changed", done: true };
      return { key: "deadline.urs" };
    case "ukt-deadline": {
      const bill = facts.bills?.find((b) => b.term === event.term);
      if (bill?.status === "paid") return { key: "deadline.ukt.paid", done: true };
      if (bill && (bill.status === "unpaid" || bill.status === "partly-paid"))
        return { key: "deadline.ukt.left", vars: { amount: rupiah(billLeft(bill)) }, warn: true };
      return { key: "deadline.ukt" };
    }
    case "questionnaire":
      return { key: "deadline.questionnaire" };
    case "uts":
      return { key: "deadline.uts" };
    case "uas":
      return { key: "deadline.uas" };
    case "lecture-start":
      return { key: "deadline.lectureStart" };
    case "lecture-end":
      return { key: "deadline.lectureEnd" };
    case "grade-deadline":
      return { key: "deadline.grades" };
    case "grade-change-deadline":
      return { key: "deadline.gradeChange" };
    case "progress-check": {
      const target = progressTarget(facts.progress?.entryTerm ?? null, event.firstDay);
      if (!target || !facts.progress) return { key: "deadline.progress" };
      const passed = facts.progress.sksPassed;
      const vars = { target: target.sks, year: target.year, passed, missing: target.sks - passed };
      return passed >= target.sks ? { key: "deadline.progress.ok", vars, done: true } : { key: "deadline.progress.short", vars, warn: true };
    }
    default:
      return null;
  }
}

function variantOf(event: CalendarEvent): Deadline["variant"] {
  if (event.kind !== "grade-change-deadline" || !/TA\/Tesis/i.test(event.title)) return null;
  return /\b(non|bukan)\s+TA/i.test(event.title) ? "non-ta" : "ta";
}

/**
 * ITB's deadlines for this term and the next, with what each means: the
 * ones still to come (and running) first, soonest first; then the past ones,
 * latest first. Progress checks belong to no term: the ones between the two
 * terms' first and last dates count. A deadline for another intake year
 * ("Angkatan 2026") shows only to that intake.
 */
export function academicDeadlines(facts: DeadlineFacts): { upcoming: Deadline[]; past: Deadline[] } {
  const { calendar, term, now } = facts;
  if (!calendar || !term) return { upcoming: [], past: [] };
  const terms = new Set([term, nextTerm(term)]);
  const ofTerms = calendar.events.filter((e) => e.term !== null && terms.has(e.term));
  if (!ofTerms.length) return { upcoming: [], past: [] };
  const from = Math.min(...ofTerms.map((e) => e.start));
  const to = Math.max(...ofTerms.map((e) => e.end));
  const intake = facts.progress?.entryTerm?.slice(0, 4) ?? null;
  const events = calendar.events.filter((e) => {
    if (!DEADLINE_KINDS.includes(e.kind)) return false;
    const cohort = /angkatan (\d{4})/i.exec(e.title)?.[1];
    if (cohort && intake && cohort !== intake) return false;
    return e.term === null ? e.kind === "progress-check" && e.start >= from && e.end <= to : terms.has(e.term);
  });
  const all = events.map(
    (event): Deadline => ({
      event,
      variant: variantOf(event),
      meaning: deadlineMeaning(event, facts),
      when: event.end <= now ? "past" : event.start <= now ? "now" : "next",
    }),
  );
  return {
    upcoming: all.filter((d) => d.when !== "past").sort((a, b) => a.event.start - b.event.start),
    past: all.filter((d) => d.when === "past").sort((a, b) => b.event.start - a.event.start),
  };
}

// ------------------------------------------------------------ the full calendar

/** The filter chips of the full calendar, each a few kinds of event. */
export type CalendarGroup = "exams" | "krs" | "payment" | "lectures" | "holidays" | "graduation" | "other";
export const CALENDAR_GROUPS: readonly CalendarGroup[] = ["exams", "krs", "payment", "lectures", "holidays", "graduation", "other"];

const GROUP_OF: Partial<Record<CalendarKind, CalendarGroup>> = {
  uts: "exams",
  uas: "exams",
  questionnaire: "exams",
  "grade-deadline": "exams",
  "grade-change-deadline": "exams",
  "progress-check": "exams",
  drs: "krs",
  urs: "krs",
  leave: "krs",
  "study-extension": "krs",
  "ukt-deadline": "payment",
  "lecture-start": "lectures",
  "lecture-end": "lectures",
  holiday: "holidays",
  graduation: "graduation",
};

export function calendarGroup(event: CalendarEvent): CalendarGroup {
  const group = GROUP_OF[event.kind];
  if (group) return group;
  // ITB opening its classes for the next term is part of the lecture calendar.
  return /pembukaan kelas/i.test(event.title) ? "lectures" : "other";
}

/** ITB marks a corrected event "(Revisi)" or "(Revisi-02)" and often keeps the old one too. */
const REVISION = /\s*\(\s*revisi(?:\s*-\s*(\d+))?\s*\)\s*$/i;

export interface CalendarEntry {
  event: CalendarEvent;
  /** ITB's title without its "(Revisi…)" mark. */
  title: string;
  /** ITB corrected it: the copy shown is the latest revision. */
  revised: boolean;
  group: CalendarGroup;
  /** What it means for this Student, when the app knows. */
  meaning: Meaning | null;
  when: "past" | "now" | "next";
}

export interface CalendarMonth {
  /** "2026-10", by the event's first day in WIB. */
  month: string;
  entries: CalendarEntry[];
}

export interface FullCalendar {
  months: CalendarMonth[];
  /** Events after merging revisions, before the chips and the search. */
  total: number;
  /** How many of those each chip holds. */
  counts: Record<CalendarGroup, number>;
}

const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** A text's words, folded. */
const wordsOf = (text: string) =>
  fold(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/** Two copies of one event: the same title once the revision mark is off, within two months of each other. */
function mergeRevisions(events: readonly CalendarEvent[]): { event: CalendarEvent; title: string; revised: boolean }[] {
  const read = events.map((event) => {
    const mark = REVISION.exec(event.title);
    return { event, title: event.title.replace(REVISION, "").trim(), revision: mark ? Number(mark[1] ?? 1) : 0 };
  });
  const near = (a: CalendarEvent, b: CalendarEvent) => Math.abs(a.start - b.start) <= 60 * DAY;
  return read
    .filter((x) => !read.some((y) => y !== x && y.title === x.title && near(x.event, y.event) && y.revision > x.revision))
    .map((x) => ({ event: x.event, title: x.title, revised: x.revision > 0 }));
}

/**
 * Every event of ITB's calendar, short semesters and all, each with ITB's
 * own title and, when the app knows, what it means for the Student;
 * "(Revisi)" copies merged into the latest. The chips (`groups`, empty for
 * all) and the search narrow it: the search ignores case and accents,
 * matches a short word only at the start of a word, and also looks in
 * `extra` (the words the screen has for an event). Grouped by month, in
 * time order.
 */
export function fullCalendar(
  facts: Omit<DeadlineFacts, "term">,
  view: { groups?: ReadonlySet<CalendarGroup>; query?: string; extra?: (entry: CalendarEntry) => string } = {},
): FullCalendar {
  const counts = Object.fromEntries(CALENDAR_GROUPS.map((g) => [g, 0])) as Record<CalendarGroup, number>;
  const entries = mergeRevisions(facts.calendar?.events ?? []).map(
    ({ event, title, revised }): CalendarEntry => ({
      event,
      title,
      revised,
      group: calendarGroup(event),
      meaning: deadlineMeaning(event, facts),
      when: event.end <= facts.now ? "past" : event.start <= facts.now ? "now" : "next",
    }),
  );
  for (const entry of entries) counts[entry.group]++;
  const words = wordsOf(view.query ?? "");
  const shown = entries.filter((entry) => {
    if (view.groups?.size && !view.groups.has(entry.group)) return false;
    if (!words.length) return true;
    const text = wordsOf(`${entry.title} ${view.extra?.(entry) ?? ""}`);
    // A short word (UTS, UAS, KRS) has to start a word: "uas" isn't "evaluasi". A longer one is found inside words too,
    // as ITB's titles add to a root ("daftar" in "Pendaftaran", "ubah" in "Perubahan").
    return words.every((w) => text.some((x) => (w.length <= 3 ? x.startsWith(w) : x.includes(w))));
  });
  const months = new Map<string, CalendarEntry[]>();
  for (const entry of shown.sort((a, b) => a.event.start - b.event.start || a.title.localeCompare(b.title))) {
    const month = entry.event.firstDay.slice(0, 7);
    months.set(month, [...(months.get(month) ?? []), entry]);
  }
  return { months: [...months].map(([month, list]) => ({ month, entries: list })), total: entries.length, counts };
}
