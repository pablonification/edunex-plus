// Every piece of text the app shows (screens, menus, windows), in Bahasa
// Indonesia and English. Keys name the meaning, not the screen; each area
// keeps its text in its own file under ./strings. "{name}" placeholders are
// filled by translate(). Academic terms follow the glossary in
// docs/design-system.md: SKS, IPK, IP, KRS and UKT stay as they are.

import { academicStrings } from "./strings/academic";
import { alertsStrings } from "./strings/alerts";
import { attendanceStrings } from "./strings/attendance";
import { chatgptStrings } from "./strings/chatgpt";
import { contentStrings } from "./strings/content";
import { coursePageStrings } from "./strings/course-page";
import type { Entry } from "./strings/entry";
import { gradesStrings } from "./strings/grades";
import { homeStrings } from "./strings/home";
import { itbStrings } from "./strings/itb";
import { licencesStrings } from "./strings/licences";
import { phoneStrings } from "./strings/phone";
import { planStrings } from "./strings/plan";
import { scheduleStrings } from "./strings/schedule";
import { searchStrings } from "./strings/search";
import { shellStrings } from "./strings/shell";
import { sixStrings } from "./strings/six";
import { sixRecordsStrings } from "./strings/six-records";
import { snoozeStrings } from "./strings/snooze";
import { tasksStrings } from "./strings/tasks";
import { updatesStrings } from "./strings/updates";

export type { Entry } from "./strings/entry";

export const STRINGS = {
  ...chatgptStrings,
  ...shellStrings,
  ...tasksStrings,
  ...coursePageStrings,
  ...contentStrings,
  ...sixStrings,
  ...sixRecordsStrings,
  ...itbStrings,
  ...alertsStrings,
  ...attendanceStrings,
  ...planStrings,
  ...gradesStrings,
  ...academicStrings,
  ...scheduleStrings,
  ...homeStrings,
  ...searchStrings,
  ...updatesStrings,
  ...snoozeStrings,
  ...licencesStrings,
  ...phoneStrings,
} as const satisfies Record<string, Entry>;

export type StringKey = keyof typeof STRINGS;
export type Lang = "id" | "en";
export type Vars = Record<string, string | number>;

const plural = { id: new Intl.PluralRules("id"), en: new Intl.PluralRules("en") };

export function translate(lang: Lang, key: StringKey, vars?: Vars): string {
  const entry: Entry = STRINGS[key];
  let text = entry[lang];
  if (typeof text !== "string") text = plural[lang].select(Number(vars?.count ?? 0)) === "one" ? text.one : text.other;
  return vars ? text.replace(/\{(\w+)\}/g, (all, name: string) => (name in vars ? String(vars[name]) : all)) : text;
}
