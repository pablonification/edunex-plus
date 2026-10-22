// Human-friendly times and numbers in the Student's language, in the
// computer's own time zone ("Besok, 23:59 · dalam 6 jam", never a raw
// timestamp). `now` is passed in so screens and tests agree on the moment.
import { type Lang, translate } from "../../core/strings";

export type When = number | string | Date;

const DAY = 86_400_000;
const ms = (when: When) => (when instanceof Date ? when.getTime() : typeof when === "number" ? when : Date.parse(when));

export interface Format {
  /** "08:00" */
  time(when: When): string;
  /** "08:00–09:30" */
  timeRange(start: When, end: When): string;
  /** "Kamis" / "Thursday" */
  weekday(when: When): string;
  /** "Kam" / "Thu" */
  weekdayShort(when: When): string;
  /** "8 Okt" / "8 Oct" */
  dayMonth(when: When): string;
  /** Two days ("YYYY-MM-DD", WIB) as one span: "12–16 Okt", "30 Nov – 11 Des"; one day: "12 Okt". */
  dayRange(first: string, last: string): string;
  /** "Kamis, 8 Oktober" / "Thursday, 8 October" */
  dateLong(when: When): string;
  /** "Hari ini" / "Besok" / "Kemarin", else "Kam, 8 Okt" */
  relativeDay(when: When): string;
  /** "Besok, 23:59" */
  dueLabel(when: When): string;
  /** Mid-sentence, with its day only when it isn't today: "23:00", "besok, 23:00", "Sen, 12 Okt, 23:00". */
  dayTime(when: When): string;
  /** "dalam 6 jam" / "6 hours ago" / "baru saja" */
  fromNow(when: When): string;
  /** "18 mnt" / "1 jam 5 mnt"; "18 min" / "1h 05m" */
  countdown(when: When): string;
  /** Whole days from today to that day: 0 today, 1 tomorrow, -1 yesterday. */
  dayOffset(when: When): number;
  /** "Selamat pagi" … from the current hour. */
  greeting(): string;
  /** SIX term code "2026-1" → "Semester 1 2026/2027". */
  term(code: string): string;
  /** "1,9 MB" / "1.9 MB" */
  fileSize(bytes: number): string;
  number(value: number, digits?: number): string;
  /** "UTS, Tugas, dan UAS" / "UTS, Tasks and UAS"; one item as it is. */
  list(items: readonly string[]): string;
}

export function makeFormat(lang: Lang, now: number): Format {
  const locale = lang === "id" ? "id-ID" : "en-GB";
  const dtf = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, options);
  const timeFmt = dtf({ hour: "2-digit", minute: "2-digit", hour12: false });
  const weekdayFmt = dtf({ weekday: "long" });
  const weekdayShortFmt = dtf({ weekday: "short" });
  const dayMonthFmt = dtf({ day: "numeric", month: "short" });
  const dateLongFmt = dtf({ weekday: "long", day: "numeric", month: "long" });
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  const listFmt = new Intl.ListFormat(locale, { type: "conjunction" });
  const t = (key: Parameters<typeof translate>[1], vars?: Parameters<typeof translate>[2]) => translate(lang, key, vars);

  const time = (when: When) => timeFmt.format(ms(when)).replace(".", ":");
  const startOfDay = (when: When) => {
    const d = new Date(ms(when));
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const dayOffset = (when: When) => Math.round((startOfDay(when) - startOfDay(now)) / DAY);
  const weekdayShort = (when: When) => weekdayShortFmt.format(ms(when)).replace(".", "");
  const dayMonth = (when: When) => dayMonthFmt.format(ms(when)).replace(".", "");
  const relativeDay = (when: When) => {
    const offset = dayOffset(when);
    if (offset === 0) return t("time.today");
    if (offset === 1) return t("time.tomorrow");
    if (offset === -1) return t("time.yesterday");
    return `${weekdayShort(when)}, ${dayMonth(when)}`;
  };

  return {
    time,
    timeRange: (start, end) => `${time(start)}–${time(end)}`,
    weekday: (when) => weekdayFmt.format(ms(when)),
    weekdayShort,
    dayMonth,
    dayRange: (first, last) => {
      const noon = (day: string) => Date.parse(`${day}T12:00:00+07:00`);
      if (first === last) return dayMonth(noon(first));
      return first.slice(0, 7) === last.slice(0, 7)
        ? `${Number(first.slice(8, 10))}–${dayMonth(noon(last))}`
        : `${dayMonth(noon(first))} – ${dayMonth(noon(last))}`;
    },
    dateLong: (when) => dateLongFmt.format(ms(when)),
    relativeDay,
    dueLabel: (when) => `${relativeDay(when)}, ${time(when)}`,
    dayTime: (when) => {
      const offset = dayOffset(when);
      if (offset === 0) return time(when);
      // Mid-sentence, so "besok", not "Besok".
      const day = offset === 1 ? t("time.tomorrowWord") : offset === -1 ? t("time.yesterdayWord") : relativeDay(when);
      return `${day}, ${time(when)}`;
    },
    fromNow: (when) => {
      const diff = ms(when) - now;
      const abs = Math.abs(diff);
      if (abs < 60_000) return t("time.justNow");
      if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
      if (abs < DAY) return rtf.format(Math.round(diff / 3_600_000), "hour");
      return rtf.format(dayOffset(when), "day");
    },
    countdown: (when) => {
      const minutes = Math.max(0, Math.round((ms(when) - now) / 60_000));
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      if (lang === "id") return h ? `${h} jam ${m} mnt` : `${m} mnt`;
      return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m} min`;
    },
    dayOffset,
    greeting: () => {
      const hour = new Date(now).getHours();
      if (lang === "id") {
        if (hour < 11) return t("time.greeting.morning");
        if (hour < 15) return t("time.greeting.midday");
        if (hour < 18) return t("time.greeting.afternoon");
        return t("time.greeting.evening");
      }
      if (hour < 12) return t("time.greeting.morning");
      if (hour < 18) return t("time.greeting.afternoon");
      return t("time.greeting.evening");
    },
    term: (code) => {
      const match = /^(\d{4})-([123])$/.exec(code);
      if (!match) return code;
      const year = Number(match[1]);
      const years = `${year}/${year + 1}`;
      return match[2] === "3" ? t("term.short", { years }) : t("term.label", { n: match[2], years });
    },
    fileSize: (bytes) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
      return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`;
    },
    number: (value, digits = 2) => new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value),
    list: (items) => listFmt.format(items),
  };
}
