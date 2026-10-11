// Every piece of text the app shows (screens, menus, windows), in Bahasa
// Indonesia and English. Keys name the meaning, not the screen; each area
// keeps its text in its own file under ./strings. "{name}" placeholders are
// filled by translate(). Academic terms follow the glossary in
// docs/design-system.md: SKS, IPK, IP, KRS and UKT stay as they are.
import type { Entry } from "./strings/entry";
import { coursePageStrings } from "./strings/course-page";
import { itbStrings } from "./strings/itb";
import { shellStrings } from "./strings/shell";
import { sixStrings } from "./strings/six";
import { sixRecordsStrings } from "./strings/six-records";
import { tasksStrings } from "./strings/tasks";

export type { Entry } from "./strings/entry";

export const STRINGS = {
  ...shellStrings,
  ...tasksStrings,
  ...coursePageStrings,
  ...sixStrings,
  ...sixRecordsStrings,
  ...itbStrings,
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
