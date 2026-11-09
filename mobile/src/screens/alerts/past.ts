// Notifikasi's rows that change with time (round 3's third review). A class's "Kuliah sudah mulai · Tandai Hadir · sampai
// 17:50", or an Edunex Presence's "Buka mata kuliahnya di Edunex · tutup 10:00", once its window is over, says what
// happened instead: SIX's count after the class ("Hadir", "Tercatat tidak hadir", "Belum dihitung SIX"), or what
// Edunex recorded ("Hadir", "Tidak tercatat"); five days later the action read as still to do. And an exam SIX lists in
// the class's own slot in both weeks of ITB's exam period (UAS on Kam, 10 Des and Kam, 17 Des, same time, same room)
// is one row with both days: it is the same exam, and SIX hasn't said which week it sits. A class's start, Tandai Hadir
// and closing alerts, once it's over, are one row too (`key`).
import type { AfterClass, ClassResults } from "../../../../src/core/attendance";
import type { Alert, ClassSession, PresenceSession } from "../../../../src/core/models";

const HOUR = 3_600_000;
/** A class or window the data no longer has is taken as over this long after the alert came. */
const ASSUMED_LENGTH = 6 * HOUR;

export type Outcome = AfterClass | "present" | "notRecorded" | null;

export interface PastAlert {
  /** A class SIX counts, or an Edunex Presence window. */
  kind: "class" | "presence";
  /** The course's code (the alert's own). */
  code: string;
  /** The class or window: its start, open and closing alerts are one row once it's over. */
  key: string;
  outcome: Outcome;
}

interface World {
  schedule: readonly ClassSession[] | null;
  presence: Readonly<Record<string, readonly PresenceSession[]>>;
  classResults?: ClassResults;
}

const SIX_CLASS = /^six\.(?:classStart|checkIn|checkInClosing):([^:]+)(?::(\d+))?$/;
const PRESENCE = /^presence\.(open|closing):([^:]+):(\d+)$/;

/** What an alert about a class or a Presence window says once that's over; null while it's on, or for any other alert. */
export function pastAlert(item: Alert, world: World | undefined, now: number): PastAlert | null {
  const code = typeof item.title.vars?.course === "string" ? item.title.vars.course : null;
  if (!code) return null;
  const six = SIX_CLASS.exec(item.id);
  if (six) {
    const id = six[1]!;
    const session = world?.schedule?.find((one) => one.id === id);
    const result = world?.classResults?.[id];
    const start = six[2] ? Number(six[2]) : item.at;
    const end = session?.end ?? result?.end ?? start + ASSUMED_LENGTH;
    if (now < end) return null;
    return { kind: "class", code, key: `six:${id}`, outcome: result?.result ?? null };
  }
  const presence = PRESENCE.exec(item.id);
  if (presence) {
    const [, which, id, at] = presence;
    const session = Object.values(world?.presence ?? {})
      .flat()
      .find((one) => String(one.id) === id);
    // An opening's id carries when it opened; its close is the window's, or (gone from the data) a closing's own.
    const closes = session?.closesAt ?? (which === "closing" ? Number(at) : null);
    if (closes === null || now < closes) return null;
    return { kind: "presence", code, key: `presence:${id}`, outcome: session ? (session.recorded?.present ? "present" : "notRecorded") : null };
  }
  return null;
}

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
