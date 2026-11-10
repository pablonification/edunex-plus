// One thing, one name, on every screen the phone shows it (mobile/qa/superapp-names.md): the words the phone takes
// (its own wording first, then the catalog's) for each pair of keys that name the same thing must stay the same, so a
// later change to one can't leave the other behind.
import { describe, expect, it } from "vitest";
import { type Entry, STRINGS, type StringKey } from "../../src/core/strings";
import { phoneWording } from "../../src/core/strings/mobile";

/** What the phone says for a key, in each language (the plural's "other" for English). */
function phone(key: StringKey): { id: string; en: string } {
  const entry: Entry = phoneWording[key] ?? STRINGS[key];
  return { id: entry.id, en: typeof entry.en === "string" ? entry.en : entry.en.other };
}

/** Keys that name the same thing: the phone must call it one name in each. */
const SAME: Record<string, StringKey[]> = {
  "the Tugas tab and its page": ["mobile.tab.tasks", "nav.tasks", "mobile.course.tab.tasks"],
  "the list to handle": ["mobile.home.toHandle", "home.needs", "mobile.service.needs"],
  "the bell's history": ["alerts.title", "home.changes"],
  "a course's material": ["search.group.material", "course.tab.modules"],
};

/** A name and the sentences that must use it, in both languages (case aside). */
const USED_IN: Record<string, [StringKey, StringKey[]]> = {
  "a Task handed in": ["taskStatus.submitted", ["handIn.final"]],
  "the month view": ["mobile.service.month", ["mobile.schedule.month"]],
  "the Tugas tab, from a Task": ["mobile.tab.tasks", ["task.backToTasks"]],
};

/** Different things that must not share a name. */
const APART: Record<string, StringKey[]> = {
  "Beranda's list and Profil's KRS and UKT": ["mobile.home.toHandle", "mobile.academic.todo"],
  "Kuliah's courses at risk and the list to handle": ["mobile.kuliah.attention", "mobile.home.toHandle"],
};

describe("one name per thing on the phone", () => {
  for (const [thing, keys] of Object.entries(SAME))
    it(`${thing}: ${keys.join(", ")} say the same`, () => {
      const first = phone(keys[0]!);
      for (const key of keys.slice(1)) expect(phone(key), key).toEqual(first);
    });

  for (const [thing, [name, keys]] of Object.entries(USED_IN))
    it(`${thing}: ${keys.join(", ")} use "${phone(name).id}"`, () => {
      const word = phone(name);
      for (const key of keys) {
        expect(phone(key).id.toLowerCase(), key).toContain(word.id.toLowerCase());
        expect(phone(key).en.toLowerCase(), key).toContain(word.en.toLowerCase());
      }
    });

  for (const [things, keys] of Object.entries(APART))
    it(`${things} are told apart`, () => {
      const names = keys.map((key) => phone(key).id);
      expect(new Set(names).size).toBe(names.length);
    });

  it("a class on Beranda's free line isn't the Kuliah tab's word", () => {
    expect(phone("mobile.home.free").id.toLowerCase()).not.toContain("kuliah");
  });
});
