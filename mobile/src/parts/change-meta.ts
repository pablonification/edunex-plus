// A change's title and one meta line on Yang berubah (Perlu kamu urus) and Notifikasi. A few of the desktop's bodies
// don't fit on one line ("Kam, 8 Okt 08:00–10:00 · biasanya 08:00–09:30"), or say how instead of what ("Tekan Tandai
// Hadir di SIX saat tombolnya muncul"), so the row shows the phone's shorter line: the new value first, the action and
// its deadline only. The whole of the desktop's is in what TalkBack reads. A new material's body is its name ("Link
// Teams Pertemuan 03: Jumat, 9 Oktober 2026"), the part worth reading and too long for a meta line: it leads, on the
// title's two lines, and "Materi baru · Proposal TA" is the meta. A course is named as the rest of the app names it
// (`name`: its short name), never by its code. A moved class says what moved, old → new: the day, the time or the room,
// after the day it's on when the day itself didn't move ("Kam, 19 Nov · 08:00–09:30 → 08:00–10:00"): without it the
// row didn't say which week. Two classes that clash are the desktop's "Kelas bentrok · TPMT dan Ekon. Infrastruktur"
// with short names (round 3's third review read it at once, where "Bentrok · A × B" meant nothing). A row's time is
// when the thing itself happened (`eventTime`), never when the app read it.
import type { Translate } from "../../../src/app/i18n";
import type { Alert, AlertText } from "../../../src/core/models/alerts";
import type { HomeWorld } from "../../../src/core/needs";
import type { StringKey } from "../../../src/core/strings";

/** The desktop's bodies too long for one line or saying how, and the phone's short line for each (src/core/strings/mobile.ts). */
const SHORT: Partial<Record<StringKey, StringKey>> = {
  "home.change.moved.time": "mobile.change.moved.time",
  "home.change.moved.room": "mobile.change.moved.room",
  "home.change.meeting.body": "mobile.change.meeting.body",
  "alert.checkIn.body": "mobile.change.checkIn",
  "mobile.alert.classStarted.body": "mobile.change.classStarted",
};

/** Titles whose body is the item's own name, which then leads the row. */
const NAMED: ReadonlySet<StringKey> = new Set<StringKey>(["alert.newMaterial"]);

/** The placeholders that hold a course's code ("Kelas bentrok · {a} dan {b}"). */
const COURSE_VARS = ["course", "a", "b"] as const;

export interface ChangeLines {
  /** The row's title, two lines at most. */
  title: string;
  /** The row's one meta line, or null. */
  meta: string | null;
  /** The desktop's title and whole body, in its order, for what TalkBack reads. */
  spoken: readonly [string, string | null];
}

/** `text` with each course code in it put as the course's name. */
function named(text: AlertText, name: ((code: string) => string) | undefined): AlertText {
  if (!name || !text.vars) return text;
  const vars = { ...text.vars };
  for (const key of COURSE_VARS) {
    const value = vars[key];
    if (typeof value === "string" && value) vars[key] = name(value);
  }
  return { ...text, vars };
}

/** What a change's row shows, and what it says in full. `name`: a course code to the name the row shows. */
export function changeLines(t: Translate, item: { title: AlertText; body?: AlertText | null }, name?: (code: string) => string): ChangeLines {
  const asked = named(item.title, name);
  const bodyText = item.body ? named(item.body, name) : null;
  const title = t(asked.key, asked.vars);
  const body = bodyText ? t(bodyText.key, bodyText.vars) : null;
  // What TalkBack reads: the desktop's whole title and body ("Kelas bentrok · A dan B" is clear when heard).
  const spoken = [t(asked.key, asked.vars), body] as const;
  if (!bodyText || body === null) return { title, meta: null, spoken };
  if (NAMED.has(item.title.key) && bodyText.key === "alert.plain") return { title: body, meta: title, spoken };
  const moved = movedVars(bodyText);
  if (moved) return { title, meta: t(moved.dayId ? "mobile.change.moved.onDay" : "mobile.change.moved.diff", moved), spoken };
  const short = SHORT[bodyText.key];
  return { title, meta: short ? t(short, bodyText.vars) : body, spoken };
}

// ---------------------------------------------------------------- a moved class, old → new

interface Slot {
  /** "Kam, 19 Nov", "Kamis"; "" when the text names no day (the same day as the other side). */
  day: string;
  time: string;
  room: string;
}

const TIME = /\d{2}:\d{2}–\d{2}:\d{2}/;

/** "Kam, 19 Nov, 08:00–09:30 · R.7602" (or a part of it) as its day, time and room. Null when it isn't a slot. */
function slotOf(text: string): Slot | null {
  const [when = "", ...rest] = text.split(" · ");
  const room = rest.join(" · ");
  const time = TIME.exec(when)?.[0];
  if (!time) return when && !rest.length ? { day: "", time: "", room: when } : null;
  const day = when.slice(0, when.indexOf(time)).replace(/[,\s]+$/, "");
  return { day, time, room };
}

/**
 * Each side with only what changed (the day, the time, the room), and the day it's on when the day didn't change ("" when
 * neither side names one). Null when nothing can be told apart.
 */
function diff(oldText: string, newText: string): [string, string, string] | null {
  const before = slotOf(oldText);
  const after = slotOf(newText);
  if (!before || !after) return null;
  // A side naming no day is on the other's day.
  const day = after.day !== "" && before.day !== "" && after.day !== before.day;
  const time = after.time !== "" && after.time !== before.time;
  const room = after.room !== "" && after.room !== before.room;
  if (!day && !time && !room) return null;
  const side = (slot: Slot) => [[day && slot.day, time && slot.time].filter(Boolean).join(", "), room && slot.room].filter(Boolean).join(" · ") || "-";
  return [side(before), side(after), day ? "" : after.day || before.day];
}

/**
 * The vars of "{oldId} → {newId}" for a moved class's body, old and new trimmed to what changed, and `day` when the day
 * didn't (in the language shown: each side's own text names it the same way); null for any other body.
 */
function movedVars(body: AlertText): Record<string, string> | null {
  const vars = body.vars ?? {};
  const pair = (oldText: unknown, newText: unknown) => (typeof oldText === "string" && typeof newText === "string" ? diff(oldText, newText) : null);
  let id: [string, string, string] | null = null;
  let en: [string, string, string] | null = null;
  if (body.key === "alert.moved.body") {
    id = pair(vars.oldId, vars.newId);
    en = pair(vars.oldEn, vars.newEn);
  } else if (body.key === "home.change.moved.time") {
    id = pair(vars.usualId, `${vars.dateId}, ${vars.time}`);
    en = pair(vars.usualEn, `${vars.dateEn}, ${vars.time}`);
  } else if (body.key === "home.change.moved.room") {
    id = pair(vars.usualId, `${vars.room}`);
    en = pair(vars.usualEn, `${vars.room}`);
  } else return null;
  if (!id || !en) return null;
  // A class off its usual slot this week: the week's date is its own var.
  const dayId = id[2] || (typeof vars.dateId === "string" ? vars.dateId : "");
  const dayEn = en[2] || (typeof vars.dateEn === "string" ? vars.dateEn : "");
  return { oldId: id[0], newId: id[1], oldEn: en[0], newEn: en[1], dayId, dayEn };
}

// ---------------------------------------------------------------- when it happened

const HOUR_PARTS = /^(?:presence\.open|six\.classStart):[^:]+:(\d+)$/;

/**
 * When the thing itself happened, for the row's time: a Task or a material posted, an edit, a hand-back, a Presence
 * opening, a class starting. Null when only the read's time is known (a class moved in SIX, a grade): then the row shows
 * no time. `raised`: the alert came from the history (its `at` is when the app saw it); a change read off the data
 * carries its own moment, except a moved class, which SIX never dates.
 */
export function eventTime(item: Alert, raised: boolean, world: Pick<HomeWorld, "tasks" | "materials"> | undefined): number | null {
  if (!raised) return item.kind === "scheduleChanged" ? null : item.at;
  const [kind, a, b] = item.id.split(":");
  switch (kind) {
    case "task.new": {
      const task = world?.tasks.find((one) => String(one.id) === a);
      return task?.postedAt ?? null;
    }
    case "task.edited":
    case "task.handedBack": {
      const at = Number(b);
      return Number.isFinite(at) && at > 0 ? at : null;
    }
    case "material.posted":
      for (const list of Object.values(world?.materials ?? {})) {
        const found = list.find((one) => String(one.id) === a);
        if (found) return found.postedAt;
      }
      return null;
    case "material.new": {
      // Edunex's feed key: type, object and its UTC date.
      const at = Date.parse(item.id.split(":").slice(3).join(":"));
      return Number.isNaN(at) ? null : at;
    }
    default: {
      const at = HOUR_PARTS.exec(item.id)?.[1];
      return at ? Number(at) : null;
    }
  }
}
