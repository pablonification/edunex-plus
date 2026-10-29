// Turns the text a desktop screen shows into the short facts the phone must show
// too: titles, course codes, rooms, percentages, counts, and dates and times as
// src/core/format writes them. The wording around a fact ("Kehadiran 85%",
// "Masa UTS mulai Senin, 12 Okt") comes from src/core/strings, so the templates
// there say which part is wording and which part is the fact.
import path from "node:path";
import { build } from "esbuild";

const ROOT = path.resolve(import.meta.dirname, "..", "..");

/** The app's Indonesian strings, from src/core/strings.ts (bundled on the fly; it's TypeScript). */
export async function loadStrings() {
  const { outputFiles } = await build({
    entryPoints: [path.join(ROOT, "src", "core", "strings.ts")],
    bundle: true,
    format: "esm",
    platform: "neutral",
    write: false,
    logLevel: "silent",
  });
  const { STRINGS } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);
  return Object.values(STRINGS)
    .map((entry) => entry.id)
    .filter((text) => typeof text === "string");
}

export const norm = (text) => text.replace(/\s+/g, " ").trim();
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const WEEKDAY = "(?:Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu)";
const WEEKDAY_SHORT = "(?:Sen|Sel|Rab|Kam|Jum|Sab|Min)";
const MONTH = "(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)";
const MON = "(?:Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des)";
// One date or time as src/core/format writes it, longest first.
const ATOM = [
  `${WEEKDAY}, \\d{1,2} ${MONTH}(?: \\d{4})?`,
  `${WEEKDAY}, \\d{1,2} ${MON}`,
  `${WEEKDAY_SHORT},? \\d{1,2} ${MON}(?: \\d{4})?`,
  `\\d{1,2} ${MONTH} \\d{4}`,
  `\\d{1,2} ${MONTH}`,
  `\\d{1,2} ${MON} \\d{4}`,
  `\\d{1,2}–\\d{1,2} ${MON}`,
  `\\d{1,2} ${MON} – \\d{1,2} ${MON}`,
  `\\d{1,2} ${MON}`,
  "\\d{2}[:.]\\d{2}–\\d{2}[:.]\\d{2}",
  "\\d{2}[:.]\\d{2}",
  "[Hh]ari ini",
  "[Bb]esok",
  "[Kk]emarin",
].join("|");
const ATOMS_ONLY = new RegExp(`^(?:(?:${ATOM})(?:,? | · |, | )?)+$`);
const ATOM_GLOBAL = new RegExp(ATOM, "g");

// How long until or since: it moves with the clock, so it's never a fact to look for.
const RELATIVE = new RegExp(
  [
    "^dalam \\d+ (?:detik|menit|mnt|jam|hari|minggu|bulan)",
    "^\\d+ (?:detik|menit|jam|hari|minggu|bulan) (?:yang )?lalu$",
    "^\\d+ (?:hari|minggu) lagi$",
    "^(?:\\d+ jam )?\\d+ mnt(?: lagi)?$",
    "^baru saja$",
    "^Diperbarui ",
    "^(?:kemarin|besok|lusa|hari ini)$",
    // The greeting follows the hour.
    "^Selamat (?:pagi|siang|sore|malam)",
  ].join("|"),
  "i",
);

/** A value that names something on its own (not "2", not "·"). */
export function strong(value) {
  return (
    /\d{1,2}[:.]\d{2}/.test(value) ||
    /\d%|\d×|×\d/.test(value) ||
    /\d+,\d+/.test(value) ||
    /\d{3,}/.test(value) ||
    /[A-Za-z]{2,}\d/.test(value) ||
    /\p{L}{3,}/u.test(value)
  );
}

const WEEKDAY_ALONE = new RegExp(`^(?:${WEEKDAY}|${WEEKDAY_SHORT})(?:–(?:${WEEKDAY}|${WEEKDAY_SHORT}))?$`);
/** Punctuation a token doesn't need at its ends (", belum dibuka dosen", "Huruf lain:"). */
const trim = (text) => norm(text).replace(/^[\s,;:·•–—-]+|[\s,;:·•]+$/g, "");
/** Without its closing stop or question mark ("Butuh berapa?" is the app's "Butuh berapa"). */
const bare = (text) => text.replace(/[.?!…]+$/, "");

export function makeTokenizer(strings) {
  const words = new Set();
  const fixed = { add: (t) => words.add(bare(t)), has: (t) => words.has(bare(t)) };
  const templates = [];
  const add = (text) => {
    const t = norm(text);
    if (!t) return;
    if (!/\{\w+\}/.test(t)) return void fixed.add(trim(t));
    const literal = t.replace(/\{\w+\}/g, "");
    // A label drawn apart from its value ("Diunggah dosen" over "Jum, 11 Sep") is the app's own words too.
    for (const part of t.split(/\{\w+\}/)) if (/\p{L}{3,}/u.test(part)) fixed.add(trim(part));
    // Templates that are mostly blanks ("{a} dan {b}") would read any course name as two values.
    if (literal.replace(/[^\p{L}]/gu, "").length < 4) return;
    const source = t
      .split(/(\{\w+\})/)
      .map((part) => (/^\{\w+\}$/.test(part) ? "(.+?)" : escapeRegex(part)))
      .join("");
    templates.push({ re: new RegExp(`^${source}$`, "u"), literal: literal.length });
  };
  for (const text of strings) {
    add(text);
    // The screens often draw a string's " · " parts as separate facts.
    if (text.includes(" · ")) for (const part of text.split(" · ")) add(part);
  }
  templates.sort((a, b) => b.literal - a.literal);

  /** The template the whole text fills, with its values; null when it's no template's. */
  const fill = (text) => {
    for (const { re } of templates) {
      const match = re.exec(text);
      if (match) return match.slice(1).map(norm);
    }
    return null;
  };

  /** A weak value with what's stuck to it ("85" in "Kehadiran 85%" is "85%"), when that makes it strong. */
  const widen = (value, text) => {
    const at = text.indexOf(value);
    if (at < 0) return null;
    let start = at;
    let end = at + value.length;
    while (start > 0 && !/\s/.test(text[start - 1])) start--;
    while (end < text.length && !/\s/.test(text[end])) end++;
    const word = text.slice(start, end).replace(/^[([]+|[)\].,;:]+$/g, "");
    return strong(word) ? word : null;
  };

  const atoms = (text) => (ATOMS_ONLY.test(text) ? text.match(ATOM_GLOBAL).map(norm) : null);

  /**
   * What one piece of screen text holds: `fixed` (the app's own words, no data in them), or the facts in it.
   * Long text with no template (an announcement, instructions) gives its opening words.
   */
  function read(raw, depth = 0) {
    const text = trim(raw);
    if (!text || !/[\p{L}\d]/u.test(text) || RELATIVE.test(text)) return { tokens: [] };
    if (fixed.has(text)) return { fixed: true, tokens: [text] };
    // A heading with its count ("Perlu perhatianmu 2", "Semester ini 7") is a heading.
    const counted = /^(.*\S)\s+\d{1,3}$/.exec(text);
    if (counted && fixed.has(counted[1])) return { fixed: true, tokens: [text] };
    if (WEEKDAY_ALONE.test(text)) return { tokens: [] };
    const split = atoms(text);
    if (split) return { tokens: split.filter((atom) => !RELATIVE.test(atom)) };
    const values = fill(text);
    if (values) {
      const kept = [];
      const weak = [];
      for (const value of values) {
        if (!value || RELATIVE.test(value) || fixed.has(trim(value))) continue;
        if (strong(value)) {
          // A value can be a sentence of its own ("Bentrok dengan KU5014 16:00–16:30").
          const inner = depth < 2 && value !== text ? read(value, depth + 1) : null;
          if (inner && !inner.fixed && inner.tokens.length) kept.push(...inner.tokens);
          else if (!inner?.fixed) kept.push(value);
        } else {
          const wide = widen(value, text);
          if (wide) kept.push(wide);
          else weak.push(value);
        }
      }
      if (weak.length) {
        // Counts read together ("2 dari 6"), or the whole short text when there's one.
        const from = text.indexOf(weak[0]);
        const last = weak.at(-1);
        const to = text.indexOf(last, from + weak[0].length) + last.length;
        if (weak.length > 1 && from >= 0 && to > from && to - from <= 12) kept.push(text.slice(from, to));
        else if (text.length <= 40) return { tokens: [text] };
      }
      return { tokens: kept.map(trim).filter(Boolean) };
    }
    // Facts the screen strings together: "Minggu ke-7 · 5–11 Okt", two sentences.
    if (depth < 2) {
      // A sentence ends after a word ("kuliah. Hanya …", "80%. Bentrok …"), not after a title ("Dr. Ir. …", "K2. …").
      const parts = text
        .split(/ · |(?<=\p{Ll}{4}|\d%|\d:\d\d)\. (?=\p{Lu})/u)
        .map(trim)
        .filter(Boolean);
      if (parts.length > 1) {
        const tokens = [];
        let data = false;
        for (const part of parts) {
          const inner = read(part, depth + 1);
          if (inner.fixed) continue;
          data = true;
          tokens.push(...inner.tokens);
        }
        return data ? { tokens } : { fixed: true, tokens: [text] };
      }
    }
    if (/^\d{1,2}$/.test(text)) return { tokens: [] };
    if (text.length <= 80) return { tokens: [text] };
    // Long free text: its opening words, cut at a word.
    let snippet = "";
    for (const word of text.split(" ")) {
      if ((snippet ? `${snippet} ${word}` : word).length > 48) break;
      snippet = snippet ? `${snippet} ${word}` : word;
    }
    return { tokens: [trim(snippet || text.slice(0, 48))], snippet: true };
  }

  return { read, fixed, relative: (text) => RELATIVE.test(norm(text)) };
}
