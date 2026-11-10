// An exam SIX lists more than once, said as one. SIX lists a UTS or UAS in the class's own slot in both weeks of ITB's
// exam period (UAS on Kam, 10 Des and Kam, 17 Des, same time, same room): it is one exam, and SIX hasn't said which week
// it sits. Notifikasi's "dijadwalkan" alerts for it are one row, Tugas & Ujian's sittings one row (core/todo.ts), and
// both say the days on one line. Pure: the phone and the desktop can both read it.
import type { Format } from "./format";
import type { Alert, ClassSession } from "./models";

const EXAM_SCHEDULED = /^exam\.scheduled:six:(.+)$/;

/**
 * SIX's sittings of one exam said as one row: for each exam with more than one "dijadwalkan" alert from SIX, the row kept
 * (the first in `items`, the newest) with every sitting, soonest first; and the ids of the rows it stands for.
 */
export function examSittings(
  items: readonly Alert[],
  schedule: readonly ClassSession[] | null | undefined,
): { sittings: Map<string, ClassSession[]>; folded: Set<string> } {
  const byExam = new Map<string, Alert[]>();
  for (const item of items) {
    if (!EXAM_SCHEDULED.test(item.id) || item.target.screen !== "exam") continue;
    const list = byExam.get(item.target.examId);
    if (list) list.push(item);
    else byExam.set(item.target.examId, [item]);
  }
  const sittings = new Map<string, ClassSession[]>();
  const folded = new Set<string>();
  for (const list of byExam.values()) {
    if (list.length < 2) continue;
    const sessions = list
      .map((item) => schedule?.find((one) => one.id === EXAM_SCHEDULED.exec(item.id)?.[1]))
      .filter((one): one is ClassSession => one !== undefined)
      .sort((a, b) => a.start - b.start);
    if (sessions.length < 2) continue;
    sittings.set(list[0]!.id, sessions);
    for (const item of list.slice(1)) folded.add(item.id);
  }
  return { sittings, folded };
}

/**
 * An exam's sittings on one line: "Kam, 10 Des dan 17 Des, 11:00 · 9009"; the weekday, the time and the room once when
 * they're the same, a day once. `time` and `room` false leave them out (a row whose page says them).
 */
export function sittingsLine(f: Format, sittings: readonly ClassSession[], { time = true, room = true }: { time?: boolean; room?: boolean } = {}): string {
  const first = sittings[0];
  if (!first) return "";
  const same = <T>(of: (s: ClassSession) => T) => sittings.every((s) => of(s) === of(first));
  const unique = (list: string[]) => [...new Set(list)];
  const days = unique(sittings.map((s) => f.dayMonth(s.start)));
  let line: string;
  if (!time || same((s) => f.time(s.start))) {
    const dayPart = same((s) => f.weekdayShort(s.start))
      ? `${f.weekdayShort(first.start)}, ${f.list(days)}`
      : f.list(unique(sittings.map((s) => f.relativeDay(s.start))));
    line = time ? `${dayPart}, ${f.time(first.start)}` : dayPart;
  } else if (days.length === 1) line = `${f.relativeDay(first.start)}, ${f.list(sittings.map((s) => f.time(s.start)))}`;
  else line = f.list(sittings.map((s) => `${f.relativeDay(s.start)}, ${f.time(s.start)}`));
  return room && first.room && same((s) => s.room) ? `${line} · ${first.room}` : line;
}
