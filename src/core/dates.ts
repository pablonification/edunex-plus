// Dates in text that is written once and shown later in either language
// (alert text, Beranda's "what changed"): the app's own words for a day
// (src/app/i18n/format.ts: "Kam, 8 Okt", "Thu, 8 Oct"), worked out for both
// languages at once and on this computer's clock, like the times next to
// them. The catalog's text picks `{dateId}` or `{dateEn}`.
import type { Lang } from "./strings";

const LOCALE: Record<Lang, string> = { id: "id-ID", en: "en-GB" };

const format = (lang: Lang, ms: number, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(LOCALE[lang], options).format(ms).replace(".", "");
const day = (lang: Lang, ms: number) => `${format(lang, ms, { weekday: "short" })}, ${format(lang, ms, { day: "numeric", month: "short" })}`;

/** "Kam, 8 Okt" and "Thu, 8 Oct". */
export const dateVars = (ms: number) => ({ dateId: day("id", ms), dateEn: day("en", ms) });

/** "Kamis" and "Thursday". */
export const weekdayVars = (ms: number) => ({ dayId: format("id", ms, { weekday: "long" }), dayEn: format("en", ms, { weekday: "long" }) });

/** The same day on this computer's clock. */
export const sameLocalDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();
