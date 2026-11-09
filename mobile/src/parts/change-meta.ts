// A change's title and one meta line on Yang berubah (Perlu kamu urus) and Notifikasi. A few of the desktop's bodies
// don't fit on one line ("Kam, 8 Okt 08:00–10:00 · biasanya 08:00–09:30"), or say how instead of what ("Tekan Tandai
// Hadir di SIX saat tombolnya muncul"), so the row shows the phone's shorter line: the new value first, the action and
// its deadline only. The whole of the desktop's is in what TalkBack reads. A new material's body is its name ("Link
// Teams Pertemuan 03: Jumat, 9 Oktober 2026"), the part worth reading and too long for a meta line: it leads, on the
// title's two lines, and "Materi baru · Proposal TA" is the meta. A course is named as the rest of the app names it
// (`name`: its short name), never by its code.
import type { Translate } from "../../../src/app/i18n";
import type { AlertText } from "../../../src/core/models/alerts";
import type { StringKey } from "../../../src/core/strings";

/** The desktop's bodies too long for one line or saying how, and the phone's short line for each (src/core/strings/mobile.ts). */
const SHORT: Partial<Record<StringKey, StringKey>> = {
  "home.change.moved.time": "mobile.change.moved.time",
  "home.change.moved.room": "mobile.change.moved.room",
  "home.change.meeting.body": "mobile.change.meeting.body",
  "alert.moved.body": "mobile.change.moved.new",
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
  const titleText = named(item.title, name);
  const bodyText = item.body ? named(item.body, name) : null;
  const title = t(titleText.key, titleText.vars);
  const body = bodyText ? t(bodyText.key, bodyText.vars) : null;
  const spoken = [title, body] as const;
  if (!bodyText || body === null) return { title, meta: null, spoken };
  if (NAMED.has(item.title.key) && bodyText.key === "alert.plain") return { title: body, meta: title, spoken };
  const short = SHORT[bodyText.key];
  return { title, meta: short ? t(short, bodyText.vars) : body, spoken };
}
