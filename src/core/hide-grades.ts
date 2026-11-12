// "Sembunyikan nilai" on the phone (Settings.hideGrades): what a grade prints, and what a screen reader hears, while
// grades are hidden; and a grade alert's words without its grade. Pure, so the phone's screens, its notifications and
// the tests say the same thing. Like a banking app hiding a balance: the figure keeps its place, as dots.
import type { StringKey } from "./strings";

/** What stands where a hidden figure was: three dots, in the figure's own size and weight. */
export const HIDDEN_FIGURE = "•••";

/** Whether grades are hidden. Hidden wins until the setting is known (`settings` not read yet). */
export function gradesHidden(settings: { hideGrades?: boolean } | null | undefined): boolean {
  return settings ? settings.hideGrades === true : true;
}

/**
 * What a figure prints (`text`) and what a screen reader hears (`label`): the figure itself, or the dots and
 * "IPK disembunyikan". `said` is the phone's "mobile.hideGrades.said" for `name`. Hidden, neither holds the number.
 */
export function shownFigure(figure: string, name: string, hidden: boolean, said: (name: string) => string): { text: string; label: string } {
  return hidden ? { text: HIDDEN_FIGURE, label: said(name) } : { text: figure, label: `${name} ${figure}` };
}

interface Words {
  key: StringKey;
  vars?: Record<string, string | number>;
}

/**
 * An alert's words with no grade in them: a new or changed grade names its course only ("Nilai baru · IF2110"), and
 * its second line the course's name, without "IPK sekarang 3,42". Any other alert is as it was.
 */
export function withoutGrades<A extends { title: Words; body?: Words | null | undefined }>(alert: A): A {
  const key = alert.title.key;
  if (key !== "alert.grade.new" && key !== "alert.grade.changed") return alert;
  const course = alert.title.vars?.course ?? "";
  const name = alert.body?.vars?.name;
  const { body: _body, ...rest } = alert;
  return {
    ...rest,
    title: { key: key === "alert.grade.new" ? "mobile.alert.grade.new" : "mobile.alert.grade.changed", vars: { course } },
    ...(name === undefined ? {} : { body: { key: "alert.plain", vars: { title: name } } }),
  } as unknown as A;
}
