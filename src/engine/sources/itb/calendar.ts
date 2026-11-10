// ITB's academic calendar (Kalender Pendidikan), from the public iCalendar
// feed SIX's home page links to. Read once a day; each event gets a kind the
// rest of the app reasons with (lecture period, exam weeks, registration…).
import { ITB_CALENDAR_FEED } from "../../../core/links";
import type { AcademicCalendar, CalendarEvent, CalendarKind } from "../../../core/models";
import { EngineError } from "../../errors";
import { hashOf } from "../../store/datasets";
import type { SourceContext } from "../source";
import { PublicClient } from "./client";
import { IcsError, type IcsEvent, parseIcs, parseIcsInSlices } from "./ics";

/** The short link on SIX's home page ("Kalender Pendidikan ITB (iCalendar)"); it redirects to the current file. */
export const CALENDAR_URL = ITB_CALENDAR_FEED;

const HOUR = 3_600_000;
/** A copy younger than this is used as is. */
const FRESH = 20 * HOUR;
const WIB = 7 * HOUR;
/**
 * An unchanged calendar is stored again only once the date it says it was checked is this old: each new copy redraws
 * every screen and plan that reads it (100+ ms on a mid-range phone), for a line that says "checked 3 days ago".
 */
const RECHECKED = 3 * 24 * HOUR;

/** Title patterns, checked in order; the first match wins. */
const KINDS: [RegExp, CalendarKind][] = [
  [/hari pertama masa (perkuliahan|kuliah)/, "lecture-start"],
  [/hari terakhir masa (perkuliahan|kuliah)/, "lecture-end"],
  [/ujian tengah semester/, "uts"],
  [/ujian akhir semester/, "uas"],
  [/(perubahan|penggantian) rencana studi|\((urs|prs)\)/, "urs"],
  [/(pendaftaran|pengisian) rencana studi|\(drs\)|pendaftaran semester (antara|pendek)/, "drs"],
  [/pembayaran biaya pendidikan/, "ukt-deadline"],
  [/kuesioner evaluasi perkuliahan/, "questionnaire"],
  // "Pemasukan Nilai Akhir Mata Kuliah", and the older "Pemasukan Nilai Mata Kuliah" (not "Nilai Konversi").
  [/pemasukan nilai (akhir|mata kuliah)/, "grade-deadline"],
  [/perubahan nilai/, "grade-change-deadline"],
  [/pemantauan dan evaluasi (akademik|kemajuan studi)/, "progress-check"],
  [/^libur\b/, "holiday"],
  [/pengajuan cuti/, "leave"],
  [/perpanjangan waktu studi/, "study-extension"],
  [/yudisium|wisuda|penerbitan ijazah|administrasi kelulusan/, "graduation"],
];

export function kindOf(title: string): CalendarKind {
  const lower = title.toLowerCase();
  return KINDS.find(([pattern]) => pattern.test(lower))?.[1] ?? "other";
}

/** "Semester I-2026/2027" → "2026-1", "Semester II-…" → "2026-2", "Semester Antara (Pendek) 2026/2027" → "2026-3". */
export function termOf(title: string): string | null {
  const regular = /semester (II|I)\s*-\s*(\d{4})\/\d{4}/i.exec(title);
  if (regular) return `${regular[2]}-${regular[1]!.toUpperCase() === "II" ? 2 : 1}`;
  const short = /semester (?:antara|pendek)\b[^\d]*(\d{4})\/\d{4}/i.exec(title);
  return short ? `${short[1]}-3` : null;
}

const dayOf = (ms: number) => new Date(ms + WIB).toISOString().slice(0, 10);

/** Anything that isn't a calendar is a vendor change. */
const vendorChange = (error: unknown): never => {
  if (error instanceof IcsError) throw new EngineError("VendorChanged", `ITB's calendar: ${error.message}`);
  throw error;
};

/** Reads the feed's text into the app's calendar. */
export function readCalendar(text: string, checkedAt: number): AcademicCalendar {
  let raw: IcsEvent[];
  try {
    raw = parseIcs(text);
  } catch (error) {
    return vendorChange(error);
  }
  return calendarOf(raw, checkedAt);
}

/** The same, a slice at a time, with the screens given a turn (`breathe`) between slices (the phone). */
export async function readCalendarInSlices(text: string, checkedAt: number, breathe: () => Promise<void>): Promise<AcademicCalendar> {
  const raw = await parseIcsInSlices(text, breathe).catch(vendorChange);
  await breathe();
  return calendarOf(raw, checkedAt);
}

function calendarOf(raw: IcsEvent[], checkedAt: number): AcademicCalendar {
  if (raw.length === 0) throw new EngineError("VendorChanged", "ITB's calendar has no events");
  const events: CalendarEvent[] = raw.map((e) => ({
    id: e.uid,
    title: e.summary,
    kind: kindOf(e.summary),
    term: termOf(e.summary),
    start: e.start,
    end: e.end,
    allDay: e.allDay,
    firstDay: dayOf(e.start),
    lastDay: dayOf(e.end > e.start ? e.end - 1 : e.start),
  }));
  events.sort((a, b) => a.start - b.start || a.title.localeCompare(b.title));
  return { checkedAt, events };
}

export function registerCalendarFeed(context: SourceContext): void {
  const client = new PublicClient(context.transport, context.clock, context.userAgent, "ITB's calendar");
  /** When this run of the app last read the calendar, changed or not (an unchanged one isn't stored again). */
  let checkedAt = 0;
  context.feed({
    name: "itb.calendar",
    every: 24 * HOUR,
    jitter: HOUR,
    // A pull to refresh leaves a calendar read within the day alone (the phone), as the read itself does.
    refreshAfter: FRESH,
    async run(current) {
      const cached = context.get("itb.calendar");
      const now = context.clock.now();
      if (cached && now - Math.max(cached.checkedAt, checkedAt) < FRESH) return;
      const text = await client.text(CALENDAR_URL, "text/calendar");
      if (!current()) return;
      const read = context.breathe ? await readCalendarInSlices(text, context.clock.now(), context.breathe) : readCalendar(text, context.clock.now());
      if (!current()) return;
      checkedAt = read.checkedAt;
      // The same events as stored: the stored copy again, so it counts as read but nothing is redrawn, unless the date it
      // says it was checked is getting old.
      const same = cached && read.checkedAt - cached.checkedAt < RECHECKED && hashOf(read.events) === hashOf(cached.events);
      await context.set("itb.calendar", same ? cached : read);
    },
  });
}
