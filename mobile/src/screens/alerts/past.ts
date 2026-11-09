// Notifikasi's rows that change with time (round 3's third review). A class's "Kuliah sudah mulai · Tandai Hadir · sampai
// 17:50", or an Edunex Presence's "Buka mata kuliahnya di Edunex · tutup 10:00", once its window is over, says what
// happened instead: SIX's count after the class ("Hadir", "Tercatat tidak hadir", "Belum dihitung SIX"), or what
// Edunex recorded ("Hadir", "Tidak tercatat"); five days later the action read as still to do. A class's start, Tandai
// Hadir and closing alerts, once it's over, are one row (`key`). A Task's "Tenggat 1 jam lagi" (and its 48, 24 and
// 3-hour reminders) once the deadline has passed: "Tenggat lewat · {Task}", "Terkumpul" or "Belum dikumpulkan", one row
// for all of them. An exam SIX lists in both weeks is one row too (src/core/exam-sittings.ts).
import type { AfterClass, ClassResults } from "../../../../src/core/attendance";
import type { Alert, ClassSession, PresenceSession, Task } from "../../../../src/core/models";
import { submittedAt } from "../../../../src/core/tasks";

const HOUR = 3_600_000;
/** A class or window the data no longer has is taken as over this long after the alert came. */
const ASSUMED_LENGTH = 6 * HOUR;

export type Outcome = AfterClass | "present" | "notRecorded" | "handedIn" | "notHandedIn" | null;

export interface PastAlert {
  /** A class SIX counts, an Edunex Presence window, or a Task's deadline. */
  kind: "class" | "presence" | "deadline";
  /** The course's code (the alert's own). */
  code: string;
  /** The class or window: its start, open and closing alerts are one row once it's over. */
  key: string;
  outcome: Outcome;
  /** A deadline's Task, by its name now (else the alert's). */
  task?: string;
}

interface World {
  schedule: readonly ClassSession[] | null;
  presence: Readonly<Record<string, readonly PresenceSession[]>>;
  classResults?: ClassResults;
  tasks?: readonly Task[];
}

const SIX_CLASS = /^six\.(?:classStart|checkIn|checkInClosing):([^:]+)(?::(\d+))?$/;
const PRESENCE = /^presence\.(open|closing):([^:]+):(\d+)$/;
const DEADLINE = /^task\.due\d+:(\d+):(\d+)$/;

/** What an alert about a class, a Presence window or a deadline says once that's over; null while it's on, or for any other alert. */
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
  const deadline = DEADLINE.exec(item.id);
  if (deadline) {
    const [, id, due] = deadline;
    const task = world?.tasks?.find((one) => String(one.id) === id);
    // A deadline Edunex moved later since is still ahead: the alert stays as it came.
    if (now < (task ? (task.dueAt ?? Number(due)) : Number(due))) return null;
    const named = item.body?.vars?.title;
    return {
      kind: "deadline",
      code,
      key: `task:${id}`,
      outcome: task ? (submittedAt(task) !== null ? "handedIn" : "notHandedIn") : null,
      task: task?.title ?? (typeof named === "string" ? named : undefined),
    };
  }
  return null;
}
