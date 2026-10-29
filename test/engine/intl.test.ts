// The Intl pieces the phone's Hermes lacks (src/core/intl.native.ts) give the words the desktop's
// Intl gives (src/core/intl.ts), for both languages and every value the app can ask about.
import { describe, expect, it } from "vitest";
import * as desktop from "../../src/core/intl";
import * as phone from "../../src/core/intl.native";
import type { Lang } from "../../src/core/strings";

const LANGS: Lang[] = ["id", "en"];

describe("Intl on the phone", () => {
  it("picks the plural Intl.PluralRules picks", () => {
    const counts = [-0, 0, 1, -1, 2, 0.5, 1.5, 21, 101, 1_000_000, Number.NaN, Number.POSITIVE_INFINITY];
    for (let n = -50; n <= 50; n++) counts.push(n, n / 4);
    for (const lang of LANGS) {
      const [mine, intl] = [phone.pluralOf(lang), desktop.pluralOf(lang)];
      for (const count of counts) expect(mine(count), `${lang} ${count}`).toBe(intl(count));
    }
  });

  it("says a relative time as Intl.RelativeTimeFormat does with numeric auto", () => {
    const values = [-0, 1_000, -1_000, 12_345, -1_234_567, 999_999];
    for (let n = -400; n <= 400; n++) values.push(n);
    for (const lang of LANGS) {
      const [mine, intl] = [phone.relativeTime(lang), desktop.relativeTime(lang)];
      for (const unit of ["minute", "hour", "day"] as const)
        for (const value of values) expect(mine(value, unit), `${lang} ${value} ${unit}`).toBe(intl(value, unit));
    }
  });

  it("joins a list as Intl.ListFormat does", () => {
    const names = ["UTS", "Tugas", "UAS", "Kuis 1", "Praktikum", "Tugas Besar, bagian 2"];
    for (const locale of ["id-ID", "en-GB"] as const) {
      const [mine, intl] = [phone.listOf(locale), desktop.listOf(locale)];
      for (let length = 0; length <= names.length; length++) expect(mine(names.slice(0, length)), `${locale} ${length}`).toBe(intl(names.slice(0, length)));
    }
  });
});
