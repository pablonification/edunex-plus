// No English left on an Indonesian screen: every string the phone can show (the desktop's catalog it reads, the phone's own
// files src/core/strings/mobile*.ts and phone.ts, and the phone's rewordings) says both languages, leaves neither empty, and
// has an Indonesian value that isn't the English one unless what's left, once {placeholders} and punctuation are taken
// out, is only names and words that are written the same in both. Written with the copywriting skill.
import { describe, expect, it } from "vitest";
import { type Entry, STRINGS } from "../../src/core/strings";
import { phoneWording } from "../../src/core/strings/mobile";

/** Words that are the same in Indonesian and English: names, ITB's own terms, loanwords Indonesian uses as they are. */
const SAME_IN_BOTH = new Set(
  [
    // names
    "Edunex",
    "Plus",
    "SIX",
    "ITB",
    "iPhone",
    "Android",
    "Menu",
    // ITB's terms
    "KRS",
    "UKT",
    "IPK",
    "IP",
    "SKS",
    "UTS",
    "UAS",
    "PDF",
    "Tandai",
    "Hadir",
    "Semester",
    "Minor",
    "Target",
    "Info",
    "OK",
    // loanwords and Latin
    "Video",
    "Audio",
    "Data",
    "Take-home",
    "Total",
    "Summa",
    "Magna",
    "Cum",
    "laude",
    "Magenta",
    "Lavender",
  ].map((word) => word.toLowerCase()),
);

const forms = (text: Entry["en"]) => (typeof text === "string" ? [text] : [text.one, text.other]);
/** The words a Student reads, without {placeholders}, numbers and punctuation. */
const wordsOf = (text: string) => text.replace(/\{\w+\}/g, " ").match(/[\p{L}][\p{L}-]*/gu) ?? [];

const catalog = { ...STRINGS, ...phoneWording } as Record<string, Entry>;
const entries = Object.entries(catalog);

describe("the phone's words, in two languages", () => {
  it("has an Indonesian and an English value, neither empty", () => {
    const missing = entries.filter(([, entry]) => !entry.id?.trim() || forms(entry.en ?? "").some((text) => !text?.trim())).map(([key]) => key);
    expect(missing).toEqual([]);
  });

  it("gives an English entry that counts both of its forms", () => {
    const partial = entries.filter(([, entry]) => typeof entry.en !== "string" && (!entry.en?.one?.trim() || !entry.en?.other?.trim())).map(([key]) => key);
    expect(partial).toEqual([]);
  });

  it("says nothing in Indonesian that is just the English, except names and words written the same", () => {
    const english = entries
      .filter(([, entry]) => forms(entry.en).some((text) => text === entry.id))
      .filter(([, entry]) => wordsOf(entry.id).some((word) => !SAME_IN_BOTH.has(word.toLowerCase())))
      .map(([key, entry]) => `${key}: ${entry.id}`);
    expect(english).toEqual([]);
  });

  it("has no English word in an Indonesian value that the Student would read as English", () => {
    const ENGLISH = /\b(?:the|and|you|your|with|please|loading|failed|error|retry|cancel|sign in|sign out)\b/i;
    const found = entries.filter(([, entry]) => ENGLISH.test(entry.id.replace(/\{\w+\}/g, ""))).map(([key, entry]) => `${key}: ${entry.id}`);
    expect(found).toEqual([]);
  });

  it("has no Indonesian word left in an English value, except a screen's or a source's own name", () => {
    const INDONESIAN = /\b(?:yang|dan|untuk|tidak|belum|sudah|akan|dengan|tenggat|presensi|berkas|gagal|coba|tampilkan|lihat)\b/i;
    // Names kept inside an English sentence: "Open Nilai" (the Nilai screen), SIX's own "Hadir X dari Y pertemuan".
    const KEPT = new Set(["mobile.academic.openGrades", "presence.how.six"]);
    const found = entries
      .filter(([key]) => !KEPT.has(key))
      .flatMap(([key, entry]) =>
        forms(entry.en)
          .filter((text) => INDONESIAN.test(text.replace(/\{\w+\}/g, "")))
          .map((text) => `${key}: ${text}`),
      );
    expect(found).toEqual([]);
  });
});
