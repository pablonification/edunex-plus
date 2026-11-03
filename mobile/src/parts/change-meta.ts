// A change's one meta line on Yang berubah (Perlu kamu urus) and Notifikasi. A few of the desktop's bodies don't fit on
// one line beside the row's time ("Kam, 8 Okt 08:00–10:00 · biasanya 08:00–09:30"), so the row shows the phone's
// shorter line, and the whole of the desktop's is in what TalkBack reads.
import type { Translate } from "../../../src/app/i18n";
import type { AlertText } from "../../../src/core/models/alerts";
import type { StringKey } from "../../../src/core/strings";

/** The desktop's bodies too long for one line, and the phone's short line for each (src/core/strings/mobile.ts). */
const SHORT: Partial<Record<StringKey, StringKey>> = {
  "home.change.moved.time": "mobile.change.moved.time",
  "home.change.moved.room": "mobile.change.moved.room",
  "home.change.meeting.body": "mobile.change.meeting.body",
};

/** The row's meta line (`shown`) and its whole text for TalkBack (`full`); null without a body. */
export function changeMeta(t: Translate, body: AlertText | null | undefined): { shown: string; full: string } | null {
  if (!body) return null;
  const full = t(body.key, body.vars);
  const short = SHORT[body.key];
  return { shown: short ? t(short, body.vars) : full, full };
}
