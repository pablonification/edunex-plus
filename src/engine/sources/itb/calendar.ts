// ITB's academic calendar (Kalender Pendidikan), from the public iCalendar
// feed SIX's home page links to. Read once a day; each event gets a kind the
// rest of the app reasons with (lecture period, exam weeks, registration…).
import type { AcademicCalendar, CalendarEvent, CalendarKind } from "../../../core/models";
import { EngineError } from "../../errors";
import type { SourceContext } from "../source";
import { PublicClient } from "./client";
import { IcsError, type IcsEvent, parseIcs } from "./ics";

/** The short link on SIX's home page ("Kalender Pendidikan ITB (iCalendar)"); it redirects to the current file. */
export const CALENDAR_URL = "https://goitb.id/KalenderPendidikan-ics";

const HOUR = 3_600_000;
/** A copy younger than this is used as is. */
const FRESH = 20 * HOUR;
const WIB = 7 * HOUR;

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

/** Reads the feed's text into the app's calendar; anything that isn't a calendar is a vendor change. */
export function readCalendar(text: string, checkedAt: number): AcademicCalendar {
  let raw: IcsEvent[];
  try {
    raw = parseIcs(text);
  } catch (error) {
    if (error instanceof IcsError) throw new EngineError("VendorChanged", `ITB's calendar: ${error.message}`);
    throw error;
  }
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
  context.feed({
    name: "itb.calendar",
    every: 24 * HOUR,
    jitter: HOUR,
    async run(current) {
      const cached = context.get("itb.calendar");
      if (cached && context.clock.now() - cached.checkedAt < FRESH) return;
      const text = await client.text(CALENDAR_URL, "text/calendar");
      if (!current()) return;
      await context.set("itb.calendar", readCalendar(text, context.clock.now()));
    },
  });
}
