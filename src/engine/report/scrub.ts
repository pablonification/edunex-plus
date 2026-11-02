// Takes everything personal out of what SIX and Edunex sent, on this computer, before anyone else
// sees it. One set of rules for the two places that need them: scripts/scrub-recording.mjs, which
// turns a recorded session into the committed test data (test/fixtures), and "Laporkan masalah"
// (./report.ts), which turns a page the app couldn't read into a report the Student sends.
//
// What a page is made of stays: its tags and classes, the labels SIX writes, course codes and names,
// terms, dates, counts. Who it is about doesn't: names, student numbers, SIX's and Edunex's ids,
// emails, phone numbers, meeting and file links, tokens, the chat with the academic advisor. The
// Student's records keep their shape with made-up values (grades, amounts, IP and IPK, scores), so
// the readers read the scrubbed page as they read the real one. Made-up values are stable: the same
// real value always becomes the same fake one, so links between pages still match.
//
// No imports, and only TypeScript Node can strip without a build (no enums, no constructor
// parameter properties): the script loads this file as it is.

/** The made-up Student every committed test and picture uses (CONTRIBUTING.md). */
export const FAKE_STUDENT = {
  name: "Dimas Pratama",
  email: "dimas.pratama@mahasiswa.itb.ac.id",
  phone: "080000000000",
  /** The made-up NIMs are 18223901 (the Student), 18223902, … (anyone else): the ones the privacy tests allow. */
  nim: 18223901,
  /** SIX's ids for students: 2021000001, 2021000002, … */
  sixId: 2021000001,
  /** Edunex's ids for the Student's records: 900001, 900002, … */
  edunexId: 900001,
};

const FIRST = [
  "Andi",
  "Budi",
  "Citra",
  "Dewi",
  "Eko",
  "Fajar",
  "Gita",
  "Hadi",
  "Indra",
  "Joko",
  "Kartika",
  "Laras",
  "Maya",
  "Nanda",
  "Oki",
  "Putri",
  "Rizki",
  "Sari",
  "Tegar",
  "Utami",
  "Wahyu",
  "Yudi",
  "Bayu",
  "Nisa",
  "Reza",
  "Tari",
];
const LAST = [
  "Wijaya",
  "Santoso",
  "Kusuma",
  "Hidayat",
  "Saputra",
  "Lestari",
  "Nugroho",
  "Rahman",
  "Setiadi",
  "Halim",
  "Gunawan",
  "Firmansyah",
  "Permana",
  "Siregar",
  "Wibowo",
  "Yuliana",
  "Hartono",
  "Purnama",
  "Susanto",
  "Utomo",
];

/** Made-up people for everyone a page names besides the Student, each a different one. */
export class FakePeople {
  private readonly used = new Set<string>();
  private count = 0;

  next(): string {
    const i = this.count++;
    let fake = `${FIRST[i % FIRST.length]} ${LAST[(i * 7 + Math.floor(i / FIRST.length)) % LAST.length]}`;
    while (this.used.has(fake)) fake = `${fake} Jr`;
    this.used.add(fake);
    return fake;
  }
}

/** Text of an HTML fragment: tags out, the common entities read, whitespace collapsed. */
export const stripTags = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

/** A small, stable hash (FNV-1a): the same text always picks the same made-up value. */
export function stableHash(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// ---------------------------------------------------------------- known values

const isDigit = (c: string | undefined) => c !== undefined && c >= "0" && c <= "9";
const isLetter = (c: string | undefined) => c !== undefined && ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z"));
const isAlphanumeric = (c: string | undefined) => isDigit(c) || isLetter(c);

/** Whether the characters on either side of a place (undefined at an end) leave a word there whole. */
type Apart = (before: string | undefined, after: string | undefined) => boolean;

/**
 * `text` with every place `word` stands whole (`apart`) replaced by `fake`, left to right and never
 * overlapping, by plain search: nothing from a page ever becomes a pattern.
 */
export function replaceWhole(text: string, word: string, fake: string, apart: Apart): string {
  let out = "";
  let kept = 0;
  let from = 0;
  for (let at = text.indexOf(word, from); at !== -1; at = text.indexOf(word, from)) {
    if (apart(text[at - 1], text[at + word.length])) {
      out += `${text.slice(kept, at)}${fake}`;
      kept = at + word.length;
      from = kept;
    } else from = at + 1;
  }
  return out + text.slice(kept);
}

/** Real value → fake value, replaced wherever it appears whole. The first fake given for a value stays. */
export class Replacements {
  private readonly map = new Map<string, string>();
  private ordered: { real: string; fake: string; apart: Apart }[] | null = null;

  /** Values under three characters are too common to replace. */
  add(real: string | number | null | undefined, fake: string | number | null | undefined): void {
    if (real === null || real === undefined || fake === null || fake === undefined) return;
    const key = String(real);
    if (key.length < 3 || key === String(fake) || this.map.has(key)) return;
    this.map.set(key, String(fake));
    this.ordered = null;
  }

  has(real: string): boolean {
    return this.map.has(real);
  }

  get(real: string): string | undefined {
    return this.map.get(real);
  }

  /** The real values, longest first. */
  reals(): string[] {
    return [...this.map.keys()].sort((a, b) => b.length - a.length);
  }

  /**
   * Every real value in `text` replaced, the longest first. Numbers only need non-digit neighbours
   * ("_18223901_" in file names, "%3D2021000001" in links); words need non-alphanumeric ones, so "_"
   * and "-" still separate them. A value's own characters are only ever text to find ("A+", "(B)").
   */
  apply(text: string): string {
    this.ordered ??= this.reals().map((real) => {
      const numeric = [...real].every(isDigit);
      const first = isAlphanumeric(real[0]);
      const last = isAlphanumeric(real[real.length - 1]);
      const apart: Apart = numeric
        ? (before, after) => !isDigit(before) && !isDigit(after)
        : (before, after) => !(first && isAlphanumeric(before)) && !(last && isAlphanumeric(after));
      return { real, fake: this.map.get(real)!, apart };
    });
    let out = text;
    for (const { real, fake, apart } of this.ordered) out = replaceWhole(out, real, fake, apart);
    return out;
  }
}

/** Student numbers: a program's three digits, the entry year's last two, then three ("18223901"). */
export const NIM_SHAPE = /(?<!\d)(1\d{2}(?:1[5-9]|2\d)\d{3})(?!\d)/g;

/** The student numbers in `text`: shaped like one, or in SIX's student addresses ("mahasiswa:23522017"). */
export function studentNumbers(text: string): string[] {
  const out = new Set<string>();
  for (const match of text.matchAll(NIM_SHAPE)) out.add(match[1]!);
  for (const match of text.matchAll(/mahasiswa:(\d{6,12})(?!\d)/g)) out.add(match[1]!);
  for (const match of text.matchAll(/<th>NIM<\/th>\s*<td>\s*(\d{6,12})\s*<\/td>/g)) out.add(match[1]!);
  return [...out];
}

/** SIX's ten-digit ids for a student, in its addresses ("/historis/2021000001", "mahasiswa_id=…"). */
export function sixStudentIds(text: string): string[] {
  const out = new Set<string>();
  for (const match of text.matchAll(/\/(\d{10})(?=[/?&"'#\s]|$)/g)) out.add(match[1]!);
  for (const match of text.matchAll(/[?&]mahasiswa_id=(\d+)/g)) out.add(match[1]!);
  return [...out];
}

// ---------------------------------------------------------------- people

const TITLES = /\b(Prof|Dr|Ir|Drs|Dra|Hj|H|Eng|Dr\.Eng)\.\s*/g;

/** "Prof. Dr. Ir. Nama Lengkap, M.T." → "Nama Lengkap" */
export const coreName = (full: string) => full.split(",")[0]!.replace(TITLES, "").replace(/\s+/g, " ").trim();

/** A name as people write one: capitalised words, four letters or more in all. */
export const looksLikeName = (core: string) => core.length >= 4 && /^[A-Z][A-Za-z'’.-]+( [A-Za-z'’.-]+)*$/.test(core);

/** `fake` in the same case as `real`: all capitals, all small letters, or as it is. */
const sameCase = (real: string, fake: string) => (real === real.toUpperCase() ? fake.toUpperCase() : real === real.toLowerCase() ? fake.toLowerCase() : fake);

/**
 * The ways the Student's name gets written, each with `fake` written the same way: whole, as it is
 * and in capitals; joined as file names and addresses join it ("Rahmat-Sakti-Hidayatullah",
 * "rahmat_sakti_hidayatullah", "RahmatSakti…"), in any case; and each part alone, as it is,
 * capitalised or in capitals, the first part as `fake`'s first name and the others as its last.
 * A part alone is never matched in small letters ("sakti", "putri" are words too), and past the first
 * only from four letters ("Nur", "Tri" are as often words of their own). Replacements only replaces a
 * value standing whole, so "Sakti" stays in "Saktiawan".
 */
export function nameForms(real: string, fake: string): [string, string][] {
  const parts = real.split(/\s+/).filter(Boolean);
  const fakes = fake.split(" ");
  const forms: [string, string][] = [];
  const add = (form: string, stand: string) => forms.push([form, sameCase(form, stand)]);
  add(real, fake);
  add(real.toUpperCase(), fake);
  if (parts.length > 1)
    for (const joint of [" ", "-", "_", ".", ""]) {
      const form = parts.join(joint);
      for (const written of [form, form.toUpperCase(), form.toLowerCase()]) add(written, fakes.join(joint));
    }
  for (const [i, part] of parts.entries()) {
    if (i > 0 && part.length < 4) continue;
    const stand = i === 0 ? fakes[0]! : fakes[fakes.length - 1]!;
    for (const written of [part, `${part[0]!.toUpperCase()}${part.slice(1).toLowerCase()}`, part.toUpperCase()]) add(written, stand);
  }
  return forms;
}

/** Someone written with an academic title before or a degree after: "Dr. Budi Santoso", "Budi Santoso, S.T., M.T.". */
const TITLED =
  /(?:\b(?:Prof|Dr|Ir|Drs|Dra|Hj|Eng)\.\s*)+[A-Z][A-Za-z'’-]+(?:[ \t]+[A-Z][A-Za-z'’.-]*)*|\b[A-Z][a-z'’-]+(?:[ \t]+[A-Z][a-z'’.-]+)*(?=,[ \t]*(?:S|M|B|D|Ph)\.)/g;

/** Edunex objects that are a person: they carry a person's own fields. */
export const isPersonObject = (o: Record<string, unknown>) =>
  ["user_id", "nidn", "front_degree", "back_degree", "last_online", "place_of_birth"].some((k) => k in o);

/** Calls `visit` on every object inside `value`, the outer ones first. */
export function walk(value: unknown, visit: (o: Record<string, unknown>) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
  } else if (value && typeof value === "object") {
    visit(value as Record<string, unknown>);
    for (const item of Object.values(value)) walk(item, visit);
  }
}

const PERSON_FIELDS = new Set(["lecturer", "created_by", "updated_by", "sent_by", "verified_by"]);

/** People an Edunex response names (lecturers, assistants, whoever posted or checked something), as core names. */
export function peopleInEdunex(value: unknown): string[] {
  const out: string[] = [];
  walk(value, (o) => {
    for (const [key, field] of Object.entries(o)) if (PERSON_FIELDS.has(key) && typeof field === "string") out.push(field);
    if ((isPersonObject(o) || "username" in o) && typeof o.name === "string") out.push(o.name);
    if (typeof o.message === "string") {
      const who = /^(.*?) has been added new/.exec(o.message)?.[1];
      if (who) out.push(who);
    }
    for (const field of Object.values(o)) if (typeof field === "string") for (const match of field.matchAll(TITLED)) out.push(match[0]);
  });
  return out.map(coreName).filter(looksLikeName);
}

/** People a SIX page names (the academic advisor, the questionnaire's lecturers, anyone with a title), as core names. */
export function peopleOnSixPage(html: string, path = ""): string[] {
  const out: string[] = [];
  for (const match of html.matchAll(/<th>Dosen Wali<\/th>\s*<td>([\s\S]*?)<\/td>/g)) out.push(stripTags(match[1]!));
  if (/kuesioner/.test(path)) for (const match of html.matchAll(/<div>([^<]{4,90})<\/div>/g)) if (/,\s*[A-Z]/.test(match[1]!)) out.push(match[1]!.trim());
  for (const text of html.split(/<[^>]*>/)) for (const match of text.matchAll(TITLED)) out.push(match[0]);
  return out.map(coreName).filter(looksLikeName);
}

/** Who a SIX page is about: the name in its student details or its top bar. */
export function studentNameOnSixPage(html: string): string | null {
  const row = /<th>Nama<\/th>\s*<td>([\s\S]*?)<\/td>/.exec(html)?.[1];
  // The signed-in person, next to their icon in the top bar's menu (as the status page's reader finds them).
  const bar = /<a\b[^>]*\bdropdown-toggle\b[^>]*>\s*<(?:i|span)\b[^>]*\bfa-user-circle-o\b[^>]*>\s*<\/(?:i|span)>\s*([^<]{3,80}?)\s*</.exec(html)?.[1];
  const name = stripTags(row ?? bar ?? "");
  return name.length >= 3 ? name : null;
}

// ---------------------------------------------------------------- links, tokens, contacts

/** Made-up stand-ins for values found by their shape, the same one each time a value comes back. */
export class Shapes {
  readonly fileLinks = new Map<string, number>();
  readonly longNumbers = new Map<string, string>();
}

/** Already made up (zeros, the fake phone, SIX's fake ids), or a moment in milliseconds (Edunex's ids carry some). */
const NOT_PERSONAL_NUMBER = /^(?:0+\d{0,3}|080000000000|20210000\d\d|1[5-9]\d{11}|20\d{11})$/;

/**
 * Meeting links and their ids and passcodes, signed file links, course join tokens, session
 * tokens, form tokens, phone numbers, emails, and any other number of nine digits or more (staff
 * numbers, bank accounts), by their shape wherever they are.
 */
export function scrubPatterns(text: string, shapes: Shapes): string {
  return text
    .replace(/https:\/\/teams\.(?:microsoft|live)\.com\/[^"'\s<>\\)]+/g, "https://teams.microsoft.com/meet/000000000000?p=fixture")
    .replace(/https:\/\/[\w.-]*zoom\.us\/[^"'\s<>\\)]+/g, "https://zoom.us/j/0000000000")
    .replace(/https:\/\/[a-z0-9]+\.blob\.core\.windows\.net\/[^"'\s<>\\)]+/g, (url) => {
      if (!shapes.fileLinks.has(url)) shapes.fileLinks.set(url, shapes.fileLinks.size + 1);
      return `https://edunexfixture.blob.core.windows.net/edunex/fixture-${shapes.fileLinks.get(url)}`;
    })
    .replace(/(Course Tokens?\s*:\s*)[A-Z0-9]{4,}/gi, "$1FIXTUR")
    .replace(/((?:Meeting|Rapat) ID\s*:?\s*)[\d ]{6,}\d/gi, "$1000 000 000")
    .replace(/((?:Passcode|Kode sandi|Password)\s*:?\s*)[^\s<"\\]+/gi, "$1fixture")
    .replace(/eyJ[\w-]{8,}\.eyJ[\w-]{8,}(?:\.[\w-]*)?/g, "fixture-token")
    .replace(/([?&](?:sig|signature|token|access_token)=)[^&"'\s<>\\]+/gi, "$1fixture")
    .replace(/(<meta\b[^>]*\bname=["']csrf-token["'][^>]*\bcontent=["'])[^"']*/gi, "$1fixture")
    .replace(/<input\b[^>]*>/gi, (tag) => (/\btype=["']?hidden\b/i.test(tag) ? tag.replace(/(\bvalue=["'])[^"']*/i, "$1fixture") : tag))
    .replace(/(?<!\d)(?:\+62|62|0)8\d{7,11}(?!\d)/g, "080000000000")
    .replace(/[\w.+-]+@(?!example\.com)[\w-]+(?:\.[\w-]+)+/g, (email) => (email === FAKE_STUDENT.email ? email : "someone@example.com"))
    .replace(/(?<![A-Za-z0-9.,])\d{9,}(?![A-Za-z0-9])/g, (digits) => {
      if (NOT_PERSONAL_NUMBER.test(digits)) return digits;
      let fake = shapes.longNumbers.get(digits);
      if (!fake) {
        fake = `${"0".repeat(digits.length - 3)}${String(shapes.longNumbers.size + 1).padStart(3, "0")}`;
        shapes.longNumbers.set(digits, fake);
      }
      return fake;
    });
}

// ---------------------------------------------------------------- Edunex

/** Made-up values for a Student's records, where only their shape is needed (a report). */
export interface MadeUp {
  /** A letter grade for a course. */
  grade(key: string): string;
  /** A score or grade point, of the same kind (whole or not) as `real`. */
  number(real: number, key: string): number;
}

const LETTER_GRADE = /^(?:A|AB|B|BC|C|D|E)$/;

/** A picture's address can carry its person's name ("…/avatar/Budi-Santoso.jpg"): one made up on the same site. */
const fakePicture = (url: string) => {
  const origin = /^https?:\/\/[^/]+/.exec(url)?.[0];
  return origin ? `${origin}/fixture.jpg` : "fixture.jpg";
};

/**
 * People's own fields in an Edunex response (contacts, birth details, pictures), the Student's
 * answers and lecturers' comments on them (the messages under an answer too), and lecturers' staff numbers. With `madeUp` (a report),
 * the Student's scores and grades too.
 */
export function scrubEdunexFields<T>(value: T, madeUp?: MadeUp): T {
  walk(value, (o) => {
    if (isPersonObject(o)) {
      for (const k of ["address", "place_of_birth", "phone_number", "religion", "ms_account", "zoom_email", "notification_email"])
        if (k in o && o[k]) o[k] = "-";
      if ("date_of_birth" in o && o.date_of_birth) o.date_of_birth = "2000-01-01T00:00:00.000Z";
      if ("nidn" in o && o.nidn) o.nidn = "0000000000";
      if ("thumbnail" in o && typeof o.thumbnail === "string" && o.thumbnail) o.thumbnail = null;
    }
    for (const k of ["thumbnail", "avatar", "photo"]) if (typeof o[k] === "string" && o[k]) o[k] = fakePicture(o[k] as string);
    // The Student's own work and lecturers' feedback on it.
    if ("is_sent" in o && "task_id" in o) {
      if (typeof o.answer === "string" && o.answer) o.answer = "<p>Jawaban.</p>";
      if (typeof o.comment === "string" && o.comment) o.comment = "Komentar.";
    }
    // What the Student and their lecturers wrote to each other under an answer (/course/comments).
    if ("commentable_type" in o && typeof o.comment === "string" && o.comment) o.comment = "<p>Komentar.</p>";
    // Lecturer staff numbers sit in "email" on lecturer objects.
    if ("email" in o && typeof o.email === "string" && /^\d{15,}$/.test(o.email)) o.email = "000000000000000000";
    if (!madeUp) return;
    for (const k of ["score", "point", "nilai", ...("index" in o ? ["total"] : [])]) {
      if (typeof o[k] === "number" && o[k] !== 0) o[k] = madeUp.number(o[k] as number, `${k}:${String(o.id ?? "")}`);
    }
    for (const k of ["index", "letter", "grade"])
      if (typeof o[k] === "string" && LETTER_GRADE.test(o[k] as string)) o[k] = madeUp.grade(`${k}:${String(o.id ?? "")}`);
  });
  return value;
}

// ---------------------------------------------------------------- SIX records

export interface RecordRules {
  /** The made-up grade for a course (`real`: its letter grade), the same on every page. */
  grade(code: string, real: string): string;
  /** What every amount is multiplied by, rounded to the thousand. */
  amountFactor: number;
  /**
   * A made-up IP or IPK in place of each real one (a report: it rarely has the whole transcript).
   * Without it they stay as they are (the fixtures script recomputes them from the made-up grades).
   */
  index?: (real: string) => string;
}

/** The text between tags (style sheets and comments left alone), each run through `change`. */
export function mapText(html: string, change: (text: string) => string): string {
  return html
    .split(/(<style\b[^>]*>[\s\S]*?<\/style>|<!--[\s\S]*?-->|<[^>]*>)/i)
    .map((part, i) => (i % 2 === 0 && part ? change(part) : part))
    .join("");
}

/**
 * Where `grade` first stands as a word in a cell's text: in a run that starts the cell or follows a
 * ">", up to the next "<", with no letter on either side. By plain search, so the cell's text never
 * becomes a pattern. -1 when it isn't there.
 */
function gradeAt(inner: string, grade: string): number {
  let start = 0;
  while (true) {
    const end = inner.indexOf("<", start);
    const stop = end === -1 ? inner.length : end;
    for (let at = inner.indexOf(grade, start); at !== -1 && at + grade.length <= stop; at = inner.indexOf(grade, at + 1))
      if (!isLetter(inner[at - 1]) && !isLetter(inner[at + grade.length])) return at;
    const next = inner.indexOf(">", start);
    if (next === -1) return -1;
    start = next + 1;
  }
}

/** In a row with a course code, any cell that holds just a letter grade gets that course's made-up one. */
function gradesInRows(html: string, grade: RecordRules["grade"]): string {
  return html.replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi, (row) => {
    const code = /<td\b[^>]*>\s*([A-Z]{2}\d{3}[\dX])(?![\dA-Za-z])/.exec(row)?.[1];
    if (!code) return row;
    return row.replace(/(<td\b[^>]*>)([\s\S]*?)(<\/td>)/gi, (cell, open: string, inner: string, close: string) => {
      const text = stripTags(inner);
      if (/<t[dr]\b/i.test(inner) || !LETTER_GRADE.test(text)) return cell;
      const at = gradeAt(inner, text);
      return at < 0 ? cell : `${open}${inner.slice(0, at)}${grade(code, text)}${inner.slice(at + text.length)}${close}`;
    });
  });
}

/** SIX's amounts ("8.750.000", "Rp 5.250.000", "10,500,000"): scaled together, so a bill and its payment still agree. */
function amounts(text: string, factor: number): string {
  return text.replace(/(Rp\.?\s?)?(?<![\d.,])(\d{1,3}(?:([.,])\d{3})+)(?!\d|[.,]\d)/g, (all, rp: string | undefined, n: string, separator: string) => {
    // A lone "750.000" may be anything; with "Rp", or from a million up, it's money.
    if (!rp && n.split(separator).length < 3) return all;
    const value = Math.round((Number(n.replace(/[.,]/g, "")) * factor) / 1000) * 1000;
    return `${rp ?? ""}${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, separator)}`;
  });
}

/** IP and IPK as SIX writes them ("3.26", "3,5"), with no other number around them (times, versions, amounts). */
function indexes(text: string, index: (real: string) => string): string {
  return text.replace(/(?<![\d.,])[0-4][.,]\d{1,3}(?!\d|[.,]\d)/g, (real) => index(real));
}

const CHAT_TIME = /^\s*(?:&mdash;|—)?(?:&nbsp;|\s)*\d{1,2}(?:&nbsp;|\s)+[A-Za-z]{3,}\.?(?:&nbsp;|\s)+\d{4}(?:&nbsp;|\s)+\d{1,2}[.:]\d{2}(?:[.:]\d{2})?\s*$/;
const CHAT_WHO = /^\s*(?:Mahasiswa|Dosen Wali|Student|Academic advisor)\s*$/i;

/** The messages between the Student and their academic advisor: each "Pesan.", who wrote it and when kept. */
function advisorChat(html: string): string {
  const start = html.search(/Percakapan dengan Dosen Wali|id=["']pesanwali["']/);
  if (start < 0) return html;
  // To the end of the list of messages, never past the form they sit in.
  const ends = ["</ul>", "</form>"].map((tag) => html.indexOf(tag, start)).filter((at) => at >= 0);
  if (!ends.length) return html;
  const end = Math.min(...ends);
  const chat = html
    .slice(start, end)
    .replace(/>([^<]+)</g, (all, text: string) => (!text.trim() || CHAT_WHO.test(text) || CHAT_TIME.test(text) ? all : "> Pesan. <"));
  return `${html.slice(0, start)}${chat}${html.slice(end)}`;
}

/** The Student's records on a SIX page: their sex and age, grades, amounts, the chat with the advisor, and with `rules.index` IP and IPK. */
export function scrubSixRecords(html: string, rules: RecordRules): string {
  // SIX's student details say the Student's sex and age, on an icon.
  let out = html
    .replace(/\b(?:Laki-laki|Perempuan|Male|Female),\s*\d{1,3}\s*(?:tahun|years? old)/gi, "Laki-laki, 20 tahun")
    .replace(/\bfa-female\b/g, "fa-male");
  out = gradesInRows(out, rules.grade);
  out = amounts(out, rules.amountFactor);
  out = advisorChat(out);
  if (rules.index) out = mapText(out, (text) => indexes(text, rules.index!));
  return out;
}

/**
 * A row or a check's words, as a reader writes them from a page ("II2230 · Algoritma · 3 · A"):
 * the same made-up grades, amounts and IPs as the page they came from.
 */
export function scrubRecordText(text: string, rules: RecordRules): string {
  const parts = text.split(" · ");
  const code = parts.find((part) => /^[A-Z]{2}\d{3}[\dX](?![\dA-Za-z])/.test(part))?.slice(0, 6);
  let out = code ? parts.map((part) => (LETTER_GRADE.test(part) ? rules.grade(code, part) : part)).join(" · ") : text;
  out = amounts(out, rules.amountFactor);
  return rules.index ? indexes(out, rules.index) : out;
}
