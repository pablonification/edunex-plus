// A change's title and one meta line on Yang berubah (Perlu kamu urus) and Notifikasi. A few of the desktop's bodies
// don't fit on one line beside the row's time ("Kam, 8 Okt 08:00–10:00 · biasanya 08:00–09:30"), so the row shows the
// phone's shorter line, and the whole of the desktop's is in what TalkBack reads. A new material's body is its name
// ("Link Teams Pertemuan 03: Jumat, 9 Oktober 2026"), the part worth reading and too long for a meta line: it leads, on
// the title's two lines, and "Materi baru · II4091" is the meta.
import type { Translate } from "../../../src/app/i18n";
import type { AlertText } from "../../../src/core/models/alerts";
import type { StringKey } from "../../../src/core/strings";

/** The desktop's bodies too long for one line, and the phone's short line for each (src/core/strings/mobile.ts). */
const SHORT: Partial<Record<StringKey, StringKey>> = {
  "home.change.moved.time": "mobile.change.moved.time",
  "home.change.moved.room": "mobile.change.moved.room",
  "home.change.meeting.body": "mobile.change.meeting.body",
};

/** Titles whose body is the item's own name, which then leads the row. */
const NAMED: ReadonlySet<StringKey> = new Set<StringKey>(["alert.newMaterial"]);

export interface ChangeLines {
  /** The row's title, two lines at most. */
  title: string;
  /** The row's one meta line, or null. */
  meta: string | null;
  /** The desktop's title and whole body, in its order, for what TalkBack reads. */
  spoken: readonly [string, string | null];
}

/** What a change's row shows, and what it says in full. */
export function changeLines(t: Translate, item: { title: AlertText; body?: AlertText | null }): ChangeLines {
  const title = t(item.title.key, item.title.vars);
  const body = item.body ? t(item.body.key, item.body.vars) : null;
  const spoken = [title, body] as const;
  if (!item.body || body === null) return { title, meta: null, spoken };
  if (NAMED.has(item.title.key) && item.body.key === "alert.plain") return { title: body, meta: title, spoken };
  const short = SHORT[item.body.key];
  return { title, meta: short ? t(short, item.body.vars) : body, spoken };
}
