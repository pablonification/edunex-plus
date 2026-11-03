// What the phone books with Android ahead of time, worked out without touching Android (so it's
// tested on its own, test/mobile/booking.test.ts). The engine only raises a timed alert (a class
// starting soon, a deadline in an hour, an Edunex Presence opening) while the app is alive, and
// Android freezes a closed app. So every planned alert still to come is booked as a notification
// with a date, which Android shows with the app closed (./reminders.ts does the booking). Rules:
// - the nearest LIMIT within HORIZON are booked: Android caps the alarms an app may hold;
// - a booking's identifier is its alert's id: booking it again replaces it, and the live one
//   lands on the same notification;
// - what left the plan (handed in, muted, moved) or changed is cancelled, and booked again if changed;
// - once its time came, a booking is kept until its alert is over (`until`), so the live one is
//   skipped: Android showed it already. One still waiting (Android may be a few minutes late) is
//   cancelled and the live one shows instead;
// - inside LEAD the app is running and its own timer raises it: nothing is booked that close.
import { z } from "zod";
import { ALERT_GROUP, type AlertGroup, type AlertKind, type Lang } from "../../../src/core/models";
import { type StringKey, translate } from "../../../src/core/strings";
import type { AlertNotice } from "../../../src/engine/alerts/center";
import type { PlannedAlert } from "../../../src/engine/alerts/detector";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
/** Android lets an app hold a few hundred alarms, some makers far fewer: the nearest 48 are plenty for days. */
export const LIMIT = 48;
/** Further ahead than this, the plan has time to change: it's booked on a later replan. */
export const HORIZON = 14 * DAY;
/** Closer than this, the running app raises it itself (the alert center has a timer set for it). */
export const LEAD = MINUTE;

export const CHANNELS = { urgent: "presence", normal: "alerts" } as const;
/** The notification category of an alert about a class to mark present in: Android shows its "Tandai Hadir" button. */
export const CHECK_IN_CATEGORY = "checkIn";
/** Presence opening or closing goes on a channel of its own that may break through, the way the desktop marks it critical. */
const URGENT = new Set<AlertKind>(["presenceOpen", "presenceClosing"]);

/**
 * A booked alert's last line, by group, as ntfy's (src/engine/alerts/phone.ts): booked hours
 * ahead, it may come after the Student did it on Edunex or SIX with the app closed.
 */
const FOOTNOTE: Partial<Record<AlertGroup, StringKey>> = {
  deadline: "phone.footnote.deadline",
  presence: "phone.footnote.presence",
};

/** What a tap on a notification carries back to the app (see useNotificationTaps). */
export interface NoticeData {
  target: AlertNotice["target"];
  checkIn?: AlertNotice["checkIn"];
}

export interface NoticeContent {
  title: string;
  body: string | null;
  data: NoticeData;
  channelId: string;
  /** CHECK_IN_CATEGORY on an alert about a class to mark present in (its "Tandai Hadir" button). */
  categoryId?: typeof CHECK_IN_CATEGORY;
}

type Shown = Pick<AlertNotice, "kind" | "title" | "body" | "target" | "checkIn">;

/** An alert as Android shows it, in the Student's language. `ahead`: booked before its time. */
export function noticeContent(notice: Shown, lang: Lang, ahead = false): NoticeContent {
  const footnote = ahead ? FOOTNOTE[ALERT_GROUP[notice.kind]] : undefined;
  const lines = [notice.body ? translate(lang, notice.body.key, notice.body.vars) : null, footnote ? translate(lang, footnote) : null].filter(
    (line) => line !== null,
  );
  return {
    title: translate(lang, notice.title.key, notice.title.vars),
    body: lines.length ? lines.join("\n") : null,
    data: { target: notice.target, ...(notice.checkIn ? { checkIn: notice.checkIn } : {}) },
    channelId: URGENT.has(notice.kind) ? CHANNELS.urgent : CHANNELS.normal,
    ...(notice.checkIn ? { categoryId: CHECK_IN_CATEGORY } : {}),
  };
}

const Booking = z.object({
  /** When Android shows it. */
  at: z.number(),
  /** After this the engine never raises it: the booking is forgotten. */
  until: z.number(),
  /** Its time and words: a change books it again. */
  hash: z.string().max(16),
});
export type Booking = z.infer<typeof Booking>;
/** By alert id, which is also the notification's identifier. */
export type Booked = Record<string, Booking>;

const Saved = z.object({ format: z.literal(1), booked: z.record(z.string().max(500), Booking) });

/** What was booked, as saved; nothing when it can't be read. */
export function readBooked(text: string | null): Booked {
  if (!text) return {};
  try {
    const saved = Saved.safeParse(JSON.parse(text));
    return saved.success ? saved.data.booked : {};
  } catch {
    return {};
  }
}

export const writeBooked = (booked: Booked) => JSON.stringify({ format: 1, booked });

/** FNV-1a: a short, stable fingerprint, not a secret. */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return (hash >>> 0).toString(16);
}

export interface ToBook {
  id: string;
  at: number;
  content: NoticeContent;
  booking: Booking;
}

export interface Rebooking {
  /** Identifiers to cancel with Android first. */
  cancel: string[];
  /** Then these, nearest first. */
  book: ToBook[];
  /** What stays booked; each of `book` joins it once Android took it. */
  kept: Booked;
}

/**
 * From the plan, what's booked and what Android still holds (`waiting`: its pending
 * identifiers, every one the app's: it books nothing else ahead), what to cancel and book.
 */
export function rebook(input: { planned: readonly PlannedAlert[]; booked: Booked; waiting: ReadonlySet<string>; now: number; lang: Lang }): Rebooking {
  const { booked, waiting, now, lang } = input;
  const wanted = new Map<string, ToBook>();
  const nearest = [...input.planned]
    .filter((planned) => planned.at - now >= LEAD && planned.at - now <= HORIZON && planned.until > planned.at)
    .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  for (const planned of nearest) {
    if (wanted.size >= LIMIT) break;
    if (wanted.has(planned.id)) continue;
    const content = noticeContent(planned, lang, true);
    const hash = fingerprint(JSON.stringify([planned.at, content]));
    wanted.set(planned.id, { id: planned.id, at: planned.at, content, booking: { at: planned.at, until: planned.until, hash } });
  }

  const kept: Booked = {};
  const cancel = new Set<string>();
  for (const [id, booking] of Object.entries(booked)) {
    // Over: the engine won't raise it again, so there's nothing left to skip.
    if (booking.until <= now) {
      if (waiting.has(id)) cancel.add(id);
      continue;
    }
    // Its time came: shown by Android, or about to be. Kept, so the live one is skipped (liveCheck).
    if (booking.at <= now) {
      kept[id] = booking;
      continue;
    }
    if (wanted.get(id)?.booking.hash === booking.hash && waiting.has(id)) kept[id] = booking;
    // Gone from the plan, changed, or no longer held by Android: cancelled (and booked again below if still wanted).
    else if (waiting.has(id)) cancel.add(id);
  }
  // Held by Android but booked by no one the app remembers (its record was lost): let go.
  for (const id of waiting) if (!Object.hasOwn(kept, id) && !wanted.has(id)) cancel.add(id);
  const book = [...wanted.values()].filter(({ id }) => !Object.hasOwn(kept, id));
  return { cancel: [...cancel], book, kept };
}

/**
 * The engine raised `notice` live. Shown unless Android showed every alert in it already (booked,
 * and no longer waiting). Bookings still waiting are cancelled: the live one comes first.
 */
export function liveCheck(notice: Pick<AlertNotice, "ids">, booked: Booked, waiting: ReadonlySet<string>): { show: boolean; cancel: string[] } {
  const cancel = notice.ids.filter((id) => Object.hasOwn(booked, id) && waiting.has(id));
  const shownAhead = notice.ids.filter((id) => Object.hasOwn(booked, id) && !waiting.has(id));
  return { show: !(notice.ids.length > 0 && shownAhead.length === notice.ids.length), cancel };
}
