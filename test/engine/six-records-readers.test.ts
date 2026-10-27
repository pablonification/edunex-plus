// SIX record readers (#78, #79, #80) against the recorded pages: what they
// read, how the transcript counts retakes and courses off the transcript, and
// that a layout they don't know is "SIX changed something", never wrong or
// empty data. Pages are changed the way SIX would through the pretend SIX.
import { load } from "cheerio/slim";
import { describe, expect, it } from "vitest";
import type { Bill, Transcript } from "../../src/core/models";
import { isEngineError } from "../../src/engine/errors";
import { readBills } from "../../src/engine/sources/six/readers/bills";
import { readCurriculumList } from "../../src/engine/sources/six/readers/curriculum-list";
import { readCurriculumStructure } from "../../src/engine/sources/six/readers/curriculum-structure";
import { readKrs } from "../../src/engine/sources/six/readers/krs";
import { readProgress } from "../../src/engine/sources/six/readers/progress";
import { readSchemes } from "../../src/engine/sources/six/readers/schemes";
import { readSyllabus } from "../../src/engine/sources/six/readers/syllabus";
import { readTranscript } from "../../src/engine/sources/six/readers/transcript";
import { Skipped } from "../../src/engine/sources/skipped";
import { bodyText, exchanges, sixPage } from "../kit/fixtures";
import { PretendSix } from "../pretend/six";

const TRANSCRIPT = /\/transkrip\/historis\/\d+$/;
const PROGRESS = /\/transkrip\/kurikulum\/\d+$/;
const KRS = /\/registrasi\/rencanastudi\/\d+$/;
const BILLS = /\/keuangan$/;
const LIST = /\/kurikulum\/kurikulum\/list$/;
const STRUCTURE = /\/kurikulum\/kurikulum\/\d+\/struktur$/;
const SCHEMES = /\/program-integrasi\/riwayat\/\d+$/;
const SYLLABUS = /\/kurikulum\/silabus\/\d+\/view$/;
const IPK = { value: 3.26, sks: 125 };
const wib = (iso: string) => Date.parse(`${iso}+07:00`);

/** The reader's result, or "VendorChanged: <message>" when it refuses the page. */
/** What a reader makes of a page, and the rows it left out. */
function skipping<T>(read: (skipped: Skipped) => T): { value: T; skipped: Skipped["rows"] } {
  const skipped = new Skipped();
  return { value: read(skipped), skipped: skipped.rows };
}

function verdict<T>(read: () => T): T | string {
  try {
    return read();
  } catch (error) {
    if (isEngineError(error)) return `${error.kind}: ${error.message}`;
    throw error;
  }
}

/** The page as SIX's English variant: the language switch on English and these labels translated. */
function inEnglish(html: string, labels: [string, string][], switchLanguage = true): string {
  let out = html;
  if (switchLanguage) {
    out = out
      .replace('<li class="active"><a href="/pub/locale/id', '<li><a href="/pub/locale/id')
      .replace('<li><a href="/pub/locale/en', '<li class="active"><a href="/pub/locale/en');
  }
  for (const [from, to] of labels) out = out.split(from).join(to);
  return out;
}

/**
 * `html` with every row of the table whose header has the label `marker` rebuilt by `row`, which gets
 * the row's cells as HTML (and whether it's a header row) and gives back the cells it should have.
 */
function rebuildRows(html: string, marker: string, row: (cells: string[], header: boolean) => string[]): string {
  const $ = load(html);
  const clean = (text: string) => text.replace(/\s+/g, " ").trim();
  const table = $("table")
    .filter((_, t) =>
      $(t)
        .find("th")
        .toArray()
        .some((th) => clean($(th).text()) === marker),
    )
    .last();
  expect(table.length).toBe(1);
  table
    .find("tr")
    .filter((_, tr) => $(tr).closest("table").is(table))
    .each((_, tr) => {
      const cells = $(tr).children("th,td").toArray();
      $(tr).html(
        row(
          cells.map((cell) => $.html(cell)),
          cells.every((cell) => cell.tagName === "th"),
        ).join(""),
      );
    });
  return $.html();
}

const transcriptOf = (six: PretendSix, ipk = IPK) => readTranscript(six.page(TRANSCRIPT), ipk);
const course = (transcript: ReturnType<typeof transcriptOf>, term: string, code: string) =>
  transcript.terms.find((t) => t.term === term)!.courses.find((c) => c.code === code)!;

describe("transcript by semester", () => {
  it("reads every term with its courses, SIX's IP and the IPK, all agreeing with the rows", () => {
    const transcript = readTranscript(sixPage(TRANSCRIPT), IPK);
    expect(transcript.terms.map((t) => t.term)).toEqual(["2023-1", "2023-2", "2024-1", "2024-2", "2025-1", "2025-2", "2026-1"]);
    expect(transcript.terms.map((t) => t.ip.six)).toEqual([3.69, 3.17, 3.17, 3.24, 3.1, 3.27, null]);
    expect(transcript.terms.map((t) => t.ip.computed)).toEqual([3.69, 3.17, 3.17, 3.24, 3.1, 3.27, null]);
    expect(transcript.terms.every((t) => t.ip.agrees)).toBe(true);
    expect(transcript.terms.map((t) => t.sks)).toEqual([18, 18, 24, 23, 20, 22, 14]);
    expect(transcript.terms.map((t) => t.courses.reduce((sum, c) => sum + c.sks!, 0))).toEqual([18, 18, 24, 23, 20, 22, 14]);
    expect(transcript.sksTaken).toBe(139);
    expect(transcript.ipk).toEqual({ six: 3.26, sixSks: 125, computed: 3.26, points: 408, sks: 125, agrees: true });

    expect(transcript.terms[0]!.courses[0]).toEqual({
      code: "FI1101",
      curriculumYear: 2019,
      name: "Fisika Dasar IA",
      sks: 4,
      grade: "A",
      curriculumSemester: 1,
      onTranscript: true,
      standing: "counted",
      attempt: 1,
    });
    const now = transcript.terms.at(-1)!;
    expect(now.courses.map((c) => c.code)).toEqual(["DK4073", "II4091", "KU5014", "PL3002", "PL3032"]);
    expect(now.courses.every((c) => c.grade === null && c.standing === "pending" && !c.onTranscript && c.curriculumYear === 2024)).toBe(true);
    expect(now.ip).toMatchObject({ six: null, computed: null, agrees: true });
  });

  it("a retaken course: the old grade counts until the new one is on the transcript, then only the newest", () => {
    const six = new PretendSix(() => 0);
    six.retake("II3130", "2025-1", "2026-1");
    let transcript = transcriptOf(six);
    expect(course(transcript, "2025-1", "II3130")).toMatchObject({ grade: "C", standing: "counted", attempt: 1 });
    expect(course(transcript, "2026-1", "II3130")).toMatchObject({ grade: null, standing: "pending", attempt: 2 });
    expect(transcript.ipk).toMatchObject({ computed: 3.26, agrees: true });

    // Graded, but SIX hasn't put it on the transcript yet: the IPK still holds the old grade.
    six.gradeCourse("2026-1", "II3130", "A");
    transcript = transcriptOf(six);
    expect(course(transcript, "2026-1", "II3130").standing).toBe("off-transcript");
    expect(transcript.ipk).toMatchObject({ computed: 3.26, agrees: true });

    // Both attempts on the transcript: still only the newest counts.
    six.markOnTranscript("2026-1", "II3130", true);
    transcript = transcriptOf(six);
    expect([course(transcript, "2025-1", "II3130").standing, course(transcript, "2026-1", "II3130").standing]).toEqual(["replaced", "counted"]);
    expect(transcript.ipk).toMatchObject({ computed: 3.31, points: 414, sks: 125 });

    six.markOnTranscript("2025-1", "II3130", false);
    transcript = transcriptOf(six);
    expect(course(transcript, "2025-1", "II3130").standing).toBe("replaced");
    expect(course(transcript, "2026-1", "II3130").standing).toBe("counted");
    // The old C still counts in its own term's IP; the IPK takes the A: (408 − 6 + 12) / 125.
    expect(transcript.terms.find((t) => t.term === "2025-1")!.ip).toMatchObject({ six: 3.1, computed: 3.1, agrees: true });
    expect(transcript.ipk).toMatchObject({ six: 3.26, computed: 3.31, points: 414, sks: 125, agrees: false });
    expect(transcriptOf(six, { value: 3.31, sks: 125 }).ipk.agrees).toBe(true);
  });

  it("a graded course SIX keeps off the transcript counts in its term's IP but not in the IPK", () => {
    const six = new PretendSix(() => 0);
    six.markOnTranscript("2025-2", "FK3057", false);
    const transcript = transcriptOf(six);
    expect(course(transcript, "2025-2", "FK3057")).toMatchObject({ grade: "B", onTranscript: false, standing: "off-transcript" });
    expect(transcript.terms.find((t) => t.term === "2025-2")!.ip).toMatchObject({ six: 3.27, computed: 3.27, agrees: true });
    // SIX's IPK still covers 125 SKS; the rows now give 123: the mismatch shows, nothing is overwritten.
    expect(transcript.ipk).toEqual({ six: 3.26, sixSks: 125, computed: 3.27, points: 402, sks: 123, agrees: false });
    expect(transcriptOf(six, { value: 3.27, sks: 123 }).ipk.agrees).toBe(true);
  });

  it("an incomplete (T) or missing grade counts nowhere", () => {
    const six = new PretendSix(() => 0);
    six.gradeCourse("2026-1", "PL3002", "T");
    six.gradeCourse("2025-1", "II3170", "");
    const transcript = transcriptOf(six);
    expect(course(transcript, "2026-1", "PL3002")).toMatchObject({ grade: "T", standing: "no-points" });
    expect(course(transcript, "2025-1", "II3170")).toMatchObject({ grade: null, standing: "pending" });
    expect(transcript.terms.at(-1)!.ip).toMatchObject({ six: null, computed: null, agrees: true });
    // 2025-1 without II3170 (2 SKS, BC): SIX's 3.10 no longer matches the rows.
    expect(transcript.terms.find((t) => t.term === "2025-1")!.ip).toMatchObject({ six: 3.1, computed: 3.17, sks: 18, agrees: false });
  });

  it("a changed grade shows next to SIX's old IP until SIX recomputes it", () => {
    const six = new PretendSix(() => 0);
    six.gradeCourse("2025-1", "II3130", "B");
    expect(transcriptOf(six).terms.find((t) => t.term === "2025-1")!.ip).toMatchObject({ six: 3.1, computed: 3.25, agrees: false });
    six.editPage(TRANSCRIPT, (html) => html.replace("NR 3.10", "NR 3.25"));
    expect(transcriptOf(six).terms.find((t) => t.term === "2025-1")!.ip).toMatchObject({ six: 3.25, computed: 3.25, agrees: true });
  });

  it("a course whose code it can't read is left out and kept; the others read, and SIX's IP shows next to the app's", () => {
    const page = sixPage(TRANSCRIPT);
    const all = readTranscript(page, IPK);
    const { value, skipped } = skipping((into) => readTranscript(page.replace("<td>FI1101<span", "<td>Fisika<span"), IPK, into));
    const first = all.terms[0]!;
    expect(value.terms[0]!.courses.map((c) => c.code)).toEqual(first.courses.filter((c) => c.code !== "FI1101").map((c) => c.code));
    expect(skipped).toEqual([{ row: "1 · Fisika-19 · Fisika Dasar IA · 4 · A · 1", why: 'SIX transcript page: course code "Fisika-19" isn\'t a course code' }]);
    expect(value.terms[0]!.ip).toMatchObject({ six: 3.69, agrees: false });
  });

  it("a course whose SKS, grade, curriculum semester or mark it can't read stays, with that detail blank and its row noted", () => {
    const page = sixPage(TRANSCRIPT);
    const all = readTranscript(page, IPK);
    const fi1101 = /(<td>FI1101<span[^>]*>-19<\/span><\/td><td>[^<]*<\/td><td>)4(<\/td><td>)\s*A\s*(<\/td><td>)1(<\/td><td>)<i class="fa fa-check[^>]*><\/i>/;
    expect(page).toMatch(fi1101);
    const read = (edit: string) => skipping((into) => readTranscript(page.replace(fi1101, edit), IPK, into));
    const first = (transcript: Transcript) => transcript.terms[0]!.courses[0]!;

    const sks = read('$14 SKS$2A$31$4<i class="fa fa-check"></i>');
    expect(first(sks.value)).toEqual({ ...first(all), sks: null });
    expect(sks.skipped).toEqual([
      { row: "1 · FI1101-19 · Fisika Dasar IA · 4 SKS · A · 1", why: 'SIX transcript page: SKS "4 SKS" isn\'t a number', blank: true },
    ]);
    const grade = read('$14$2A (remedial)$31$4<i class="fa fa-check"></i>');
    expect(first(grade.value)).toEqual({ ...first(all), grade: null, standing: "unknown" });
    expect(grade.skipped.map((row) => row.why)).toEqual(['SIX transcript page: grade "A (remedial)" isn\'t a grade']);
    const semester = read('$14$2A$31 / 1$4<i class="fa fa-check"></i>');
    expect(first(semester.value)).toEqual({ ...first(all), curriculumSemester: null });
    expect(semester.value.terms[0]!.ip).toEqual(all.terms[0]!.ip);
    const mark = read("$14$2A$31$4Ya");
    expect(first(mark.value)).toEqual({ ...first(all), onTranscript: null, standing: "unknown" });
    expect(mark.skipped.map((row) => row.why)).toEqual(["SIX transcript page: a transcript mark is neither ✓ nor ✗"]);
    for (const { value } of [sks, grade, semester, mark])
      expect(value.terms.flatMap((t) => t.courses)).toHaveLength(all.terms.flatMap((t) => t.courses).length);
  });

  it("with a blank in it, SIX's IP and IPK show unchecked, never next to a figure the app worked out without it; known figures that disagree still say so", () => {
    const page = sixPage(TRANSCRIPT);
    const sks = readTranscript(page.replace(/(<td>FI1101<span[^>]*>-19<\/span><\/td><td>[^<]*<\/td><td>)4/, "$14 SKS"), IPK);
    expect(sks.terms[0]!.ip).toMatchObject({ six: 3.69, computed: null, agrees: true });
    expect(sks.ipk).toMatchObject({ six: 3.26, sixSks: 125, computed: null, agrees: true });
    // The other terms are whole: still checked.
    expect(sks.terms[1]!.ip).toMatchObject({ six: 3.17, computed: 3.17, agrees: true });
    const six = new PretendSix(() => 0);
    six.gradeCourse("2025-1", "II3130", "B");
    six.editPage(TRANSCRIPT, (html) => html.replace(/(<td>FI1101<span[^>]*>-19<\/span><\/td><td>[^<]*<\/td><td>)4/, "$14 SKS"));
    expect(transcriptOf(six).terms.find((t) => t.term === "2025-1")!.ip).toMatchObject({ six: 3.1, computed: 3.25, agrees: false });
    // SIX's IPK the app couldn't read on the curriculum-position page: shown as SIX's, none, unchecked.
    expect(readTranscript(page, null).ipk).toMatchObject({ six: null, sixSks: null, computed: null, agrees: true });
  });

  it("a mark it can't read leaves the term's IP checked (the mark isn't in it), and the IPK unchecked", () => {
    const page = sixPage(TRANSCRIPT).replace('<i class="fa fa-check fa-fw text-success" aria-hidden="true"></i></td></tr>', "Ya</td></tr>");
    expect(readTranscript(page, IPK).terms[0]!.ip).toMatchObject({ six: 3.69, computed: 3.69, agrees: true });
    expect(readTranscript(page, IPK).ipk).toMatchObject({ six: 3.26, computed: null, agrees: true });
    // Known figures that disagree still say so.
    expect(readTranscript(page.replace("NR 3.69", "NR 3.10"), IPK).terms[0]!.ip).toMatchObject({ six: 3.1, computed: 3.69, agrees: false });
  });

  it("a row of one cell across the table is left out and noted, never a crash", () => {
    const page = sixPage(TRANSCRIPT).replace(
      /<tr ><th scope="row" class='text-right'>1<\/th><td>FI1101[\s\S]*?<\/tr>/,
      '<tr><td colspan="7">Nilai sedang diproses</td></tr>',
    );
    const { value, skipped } = skipping((into) => readTranscript(page, IPK, into));
    expect(value.terms[0]!.courses.map((c) => c.code)).not.toContain("FI1101");
    expect(skipped).toEqual([{ row: "Nilai sedang diproses", why: 'SIX transcript page: a row has no "Kode" cell' }]);
  });

  it("every grade written another way: every course stays with its grade blank, each noted, the IP and IPK SIX's", () => {
    const page = sixPage(TRANSCRIPT);
    const { value, skipped } = skipping((into) => readTranscript(page.replace(/<td>\s*([A-E]{1,2}|T)\s*<\/td>/g, "<td>85.5</td>"), IPK, into));
    const all = readTranscript(page, IPK);
    expect(value.terms.flatMap((t) => t.courses.map((c) => c.code))).toEqual(all.terms.flatMap((t) => t.courses.map((c) => c.code)));
    expect(value.terms.slice(0, -1).every((t) => t.courses.every((c) => c.grade === null && c.standing === "unknown"))).toBe(true);
    expect(skipped).toHaveLength(all.terms.slice(0, -1).flatMap((t) => t.courses).length);
    expect(value.terms.map((t) => [t.ip.six, t.ip.computed, t.ip.agrees])).toEqual([
      [3.69, null, true],
      [3.17, null, true],
      [3.17, null, true],
      [3.24, null, true],
      [3.1, null, true],
      [3.27, null, true],
      [null, null, true],
    ]);
  });

  it("a term's SKS or IP, or the SKS taken, it can't read are blank and noted; the term's IP goes unchecked", () => {
    const page = sixPage(TRANSCRIPT);
    const all = readTranscript(page, IPK);
    const { value, skipped } = skipping((into) =>
      readTranscript(
        page.replace('<th>18</th><th colspan="3">NR 3.69</th>', '<th>18 SKS</th><th colspan="3">NR 3,6</th>').replace("<th>139</th>", "<th>139 SKS</th>"),
        IPK,
        into,
      ),
    );
    expect(value.terms[0]).toEqual({ ...all.terms[0], sks: null, ip: { ...all.terms[0]!.ip, six: null, computed: null, agrees: true } });
    expect(value.sksTaken).toBeNull();
    expect(skipped).toEqual([
      {
        row: "18 SKS · NR 3,6",
        why: 'SIX transcript page: semester SKS "18 SKS" isn\'t a number; SIX transcript page: semester IP "3,6" isn\'t an index',
        blank: true,
      },
      { row: "139 SKS", why: 'SIX transcript page: SKS taken "139 SKS" isn\'t a number', blank: true },
    ]);
  });

  it("finds the columns by their labels: in English, in another order, beside a column it doesn't know", () => {
    const page = sixPage(TRANSCRIPT);
    const all = readTranscript(page, IPK);
    // Name before code, in English, and a column the app doesn't know before SKS; each total's empty cell spans it too.
    const moved = rebuildRows(page, "Masuk Transkrip", (cells, header) => {
      if (cells.length === 1) return cells;
      if (header && cells.length === 7) return ["<th></th>", "<th>Course</th>", "<th>Code</th>", "<th>Type</th>", "<th>Credits</th>", ...cells.slice(4)];
      if (header) return [cells[0]!.replace('colspan="3"', 'colspan="4"'), ...cells.slice(1)];
      return [cells[0]!, cells[2]!, cells[1]!, "<td>W</td>", ...cells.slice(3)];
    });
    expect(skipping((into) => readTranscript(moved, IPK, into))).toEqual({ value: all, skipped: [] });
  });

  it("without a detail's column, that detail is blank in every course, noted once; without the code's, the page is refused", () => {
    const page = sixPage(TRANSCRIPT);
    const all = readTranscript(page, IPK);
    const { value, skipped } = skipping((into) => readTranscript(page.split("<th>Semester Kurikulum</th>").join("<th>Smt</th>"), IPK, into));
    expect(value).toEqual({ ...all, terms: all.terms.map((t) => ({ ...t, courses: t.courses.map((c) => ({ ...c, curriculumSemester: null })) })) });
    expect(skipped).toEqual([
      {
        row: "Kode · Mata Kuliah · SKS · Nilai · Smt · Masuk Transkrip",
        why: 'SIX transcript page: the course header has no "Semester Kurikulum" column',
        blank: true,
      },
    ]);
    // No grade column: every grade blank, so no IP or IPK of the app's to set beside SIX's.
    const grades = readTranscript(page.split("<th>Nilai</th>").join("<th>Indeks</th>"), IPK);
    expect(grades.terms.flatMap((t) => t.courses).every((c) => c.grade === null && c.standing === "unknown")).toBe(true);
    expect(grades.ipk).toMatchObject({ six: 3.26, computed: null, agrees: true });
    expect(verdict(() => readTranscript(page.split("<th>Kode</th>").join("<th>Kode MK</th>"), IPK))).toBe(
      'VendorChanged: SIX transcript page: the course header has no "Kode" column',
    );
  });

  it("refuses layouts it doesn't know", () => {
    const page = sixPage(TRANSCRIPT);
    const refused = (html: string) => verdict(() => readTranscript(html, IPK));
    // A header with a column the rows don't have: no row can be placed under it, nor the term's totals.
    expect(refused(page.split("<th>Nilai</th>").join("<th>Bobot</th><th>Nilai</th>"))).toBe("VendorChanged: SIX transcript page: a total row is out of place");
    expect(refused(page.replace("Semester 1 Tahun 2023/2024", "Semester Ganjil"))).toBe(
      'VendorChanged: SIX transcript page: semester heading "Semester Ganjil" names no term',
    );
    expect(refused(page.replace(/<tr class="info">[\s\S]*<\/table>/, "</table>"))).toBe("VendorChanged: SIX transcript page: no table of semesters");
    expect(refused("<html><body><h1>Maintenance</h1></body></html>")).toBe("VendorChanged: SIX transcript page: no table of semesters");
  });

  it("reads SIX's English page the same way", () => {
    const labels: [string, string][] = [
      [">Kode<", ">Code<"],
      [">Mata Kuliah<", ">Course<"],
      [">Nilai<", ">Grade<"],
      [">Semester Kurikulum<", ">Curriculum Semester<"],
      [">Masuk Transkrip<", ">In Transcript<"],
      [" Tahun ", " Year "],
      ["NR ", "GPA "],
    ];
    const page = sixPage(TRANSCRIPT);
    for (const label of [">Nilai<", "Masuk Transkrip", " Tahun ", "NR "]) expect(inEnglish(page, labels)).not.toContain(label);
    expect(readTranscript(inEnglish(page, labels), IPK)).toEqual(readTranscript(page, IPK));
    // A page can mix them: the same labels on a page that says it's Indonesian read the same too.
    expect(skipping((into) => readTranscript(inEnglish(page, labels, false), IPK, into))).toEqual({ value: readTranscript(page, IPK), skipped: [] });
  });
});

describe("graduation progress (curriculum position)", () => {
  it("reads stages, semesters and courses with SIX's figures, and the IPK with the SKS it covers", () => {
    const { progress, ipk } = readProgress(sixPage(PROGRESS));
    expect(ipk).toEqual(IPK);
    expect(progress).toMatchObject({ entryTerm: "2023-1", ipk: 3.26, sksPassed: 125, sksIncomplete: 0 });
    expect(progress.sksByKind).toEqual([
      { kind: "required", label: "Wajib", sks: 108 },
      { kind: "program-elective", label: "Pilihan Dalam Prodi", sks: 6 },
      { kind: "outside-elective", label: "Pilihan Luar Prodi", sks: 25 },
    ]);
    expect(progress.stages.map((s) => [s.name, s.ip.six, s.ip.computed, s.ip.agrees, s.sksPassed])).toEqual([
      ["Tahap Persiapan Bersama", 3.81, 3.81, true, 18],
      ["Tahap Sarjana", 3.18, 3.18, true, 107],
    ]);
    expect(progress.stages[0]!.semesters.map((s) => s.semester)).toEqual([1]);
    expect(progress.stages[1]!.semesters.map((s) => s.semester)).toEqual([2, 3, 4, 5, 6, 7, 8]);

    const courses = progress.stages.flatMap((s) => s.semesters.flatMap((x) => x.courses));
    const byCode = (code: string) => courses.find((c) => c.code === code);
    expect(byCode("MA1101")).toEqual({
      code: "MA1101",
      curriculumYear: 2019,
      name: "Matematika IA",
      kind: "required",
      kindCode: "W",
      sks: 4,
      status: "graded",
      grade: "AB",
      term: "2023-1",
      note: null,
    });
    expect(byCode("WI1103")).toMatchObject({ status: "exempt", grade: null, term: null, note: "Transfer" });
    expect(byCode("II4091")).toMatchObject({ status: "in-progress", grade: null, term: "2026-1" });
    expect(byCode("II4012")).toMatchObject({ kind: "program-elective", kindCode: "PD", grade: "C" });
    expect(byCode("FI1201")).toMatchObject({ kind: "outside-elective", kindCode: "PL" });
    expect(courses.filter((c) => c.status === "not-taken").map((c) => [c.code, c.kind, c.sks])).toEqual([
      ["II4090", "required", 2],
      ["II4092", "required", 4],
    ]);
    // SIX's "Jenis Mata Kuliah" totals are the rows taken (graded or in progress), exempt ones aside.
    const taken = (kind: string) =>
      courses.filter((c) => c.kind === kind && (c.status === "graded" || c.status === "in-progress")).reduce((sum, c) => sum + c.sks!, 0);
    expect([taken("required"), taken("program-elective"), taken("outside-elective")]).toEqual([108, 6, 25]);
  });

  it("a course passed under an older code already sits in the curriculum, so only truly missing courses are left", () => {
    const { progress } = readProgress(sixPage(PROGRESS));
    const firstSemester = progress.stages[0]!.semesters[0]!.courses;
    // The 2024 curriculum asks for KI1101 (Kimia Dasar I); SIX places the 2019 KI1002 there.
    expect(firstSemester.map((c) => `${c.code}-${c.curriculumYear}`)).toContain("KI1002-2019");
    expect(firstSemester.some((c) => c.code === "KI1101")).toBe(false);
  });

  it("a course row it doesn't understand is left out and kept; the rest of its semester and stage read", () => {
    const page = sixPage(PROGRESS);
    const courses = (progress: ReturnType<typeof readProgress>["progress"]) =>
      progress.stages.flatMap((s) => s.semesters.flatMap((m) => m.courses.map((c) => c.code)));
    const all = courses(readProgress(page).progress);
    const { value, skipped } = skipping((into) =>
      readProgress(page.replace('<span class="label label-danger" title="Belum diambil">', '<span class="label label-warning" title="Belum diambil">'), into),
    );
    expect(courses(value.progress)).toEqual(all.filter((code) => code !== "II4090"));
    expect(skipped).toEqual([
      { row: expect.stringMatching(/II4090/), why: 'SIX curriculum position page: course II4090 has an unknown status "Belum diambil"' },
    ]);
  });

  it("a course whose SKS, grade or term it can't read stays, with that blank and its row noted; its stage's IP shows SIX's, unchecked", () => {
    const page = sixPage(PROGRESS);
    const all = readProgress(page);
    const ma1101 = /(<td>MA1101<span[^>]*>-19<\/span><\/td><td>Matematika IA<\/td><td>W<\/td><td>)4(<\/td><td>)\s*AB\s*(<\/td><td>)2023-1/;
    expect(page).toMatch(ma1101);
    const first = (read: ReturnType<typeof readProgress>) => read.progress.stages[0]!.semesters[0]!.courses[0]!;
    const sks = skipping((into) => readProgress(page.replace(ma1101, "$14 SKS$2AB$32023-1"), into));
    expect(first(sks.value)).toEqual({ ...first(all), sks: null });
    expect(sks.value.progress.stages[0]!.ip).toMatchObject({ six: 3.81, computed: null, agrees: true });
    expect(sks.value.progress.stages[1]!.ip).toEqual(all.progress.stages[1]!.ip);
    expect(sks.skipped).toEqual([
      { row: "1 · MA1101-19 · Matematika IA · W · 4 SKS · AB · 2023-1", why: 'SIX curriculum position page: SKS "4 SKS" isn\'t a number', blank: true },
    ]);
    const grade = skipping((into) => readProgress(page.replace(ma1101, "$14$2AB (sakit)$32023-1"), into));
    expect(first(grade.value)).toEqual({ ...first(all), grade: null });
    expect(grade.value.progress.stages[0]!.ip).toMatchObject({ six: 3.81, computed: null, agrees: true });
    const term = skipping((into) => readProgress(page.replace(ma1101, "$14$2AB$3Ganjil 2023"), into));
    expect(first(term.value)).toEqual({ ...first(all), term: null });
    expect(term.skipped.map((row) => row.why)).toEqual(["SIX curriculum position page: course MA1101's term \"Ganjil 2023\" isn't a term"]);
    expect(term.value.progress.stages[0]!.ip).toEqual(all.progress.stages[0]!.ip);
  });

  it("an SKS by kind, the IPK, the SKS passed or the entry term it can't read are blank and noted; with the IPK blank, the transcript's goes unchecked", () => {
    const page = sixPage(PROGRESS);
    const all = readProgress(page);
    const kinds = skipping((into) => readProgress(page.replace("<td>Wajib</td><td>108</td>", "<td>Wajib</td><td>108 SKS</td>"), into));
    expect(kinds.value.progress.sksByKind[0]).toEqual({ kind: "required", label: "Wajib", sks: null });
    expect(kinds.skipped.map((row) => row.row)).toEqual(["Wajib · 108 SKS"]);
    const ipk = skipping((into) => readProgress(page.replace('<span title="dari 125 SKS">3.26</span>', '<span title="dari 125 SKS">3,265</span>'), into));
    expect(ipk.value).toEqual({ progress: { ...all.progress, ipk: null }, ipk: null });
    expect(ipk.skipped.map((row) => row.why)).toEqual(['SIX curriculum position page: IPK "3,265" isn\'t an index']);
    const sks = skipping((into) => readProgress(page.replace(/Lulus 125 SKS\s*\/\s*Nilai T 0 SKS/, "125 SKS"), into));
    expect(sks.value.progress).toEqual({ ...all.progress, sksPassed: null, sksIncomplete: null });
    expect(sks.skipped.map((row) => row.why)).toEqual(['SIX curriculum position page: SKS "125 SKS" isn\'t readable']);
    const entry = readProgress(page.replace("<td>2023 semester 1</td>", "<td>Angkatan 2023</td>"));
    expect(entry.progress).toEqual({ ...all.progress, entryTerm: null });
  });

  it("finds the courses' columns by their labels: in English, in another order, beside a column it doesn't know", () => {
    const page = sixPage(PROGRESS);
    const all = readProgress(page);
    // Name before code, in English, and a column the app doesn't know before SKS.
    const moved = rebuildRows(page, "Semester Pengambilan", (cells, header) => {
      if (cells.length === 1 || cells.length === 2) return cells;
      if (header)
        return [
          "<th></th>",
          "<th>Course</th>",
          "<th>Code</th>",
          "<th>Type</th>",
          "<th>Kelompok</th>",
          "<th>Credits</th>",
          "<th>Grade</th>",
          "<th>Term Taken</th>",
        ];
      return [cells[0]!, cells[2]!, cells[1]!, cells[3]!, "<td>A</td>", ...cells.slice(4)];
    });
    expect(skipping((into) => readProgress(moved, into))).toEqual({ value: all, skipped: [] });
  });

  it("without the SKS column, every course's SKS is blank, noted once; without the code's, the page is refused", () => {
    const page = sixPage(PROGRESS);
    const all = readProgress(page);
    const { value, skipped } = skipping((into) => readProgress(page.split("<th>Sifat</th><th>SKS</th>").join("<th>Sifat</th><th>Bobot</th>"), into));
    expect(value.progress.stages.flatMap((s) => s.semesters.flatMap((m) => m.courses)).every((c) => c.sks === null)).toBe(true);
    expect(value.progress.stages.map((s) => s.ip.agrees)).toEqual([true, true]);
    expect(value.progress.sksByKind).toEqual(all.progress.sksByKind);
    expect(skipped).toEqual([
      {
        row: "Kode · Mata Kuliah · Sifat · Bobot · Nilai · Semester Pengambilan",
        why: 'SIX curriculum position page: the course header has no "SKS" column',
        blank: true,
      },
    ]);
    expect(verdict(() => readProgress(page.split("<th>Kode</th>").join("<th>Kode MK</th>")))).toBe(
      'VendorChanged: SIX curriculum position page: the course header has no "Kode" column',
    );
  });

  it("without the grade or kind column, whose blank no course could carry, the page is refused", () => {
    const page = sixPage(PROGRESS);
    expect(verdict(() => readProgress(page.split("<th>Nilai</th>").join("<th>Indeks</th>")))).toBe(
      'VendorChanged: SIX curriculum position page: the course header has no "Nilai" column',
    );
    expect(verdict(() => readProgress(page.split("<th>Sifat</th>").join("<th>Jenis</th>")))).toBe(
      'VendorChanged: SIX curriculum position page: the course header has no "Sifat" column',
    );
  });

  it("a stage's IP or SKS passed it can't read is blank, its heading noted; the stage and its courses stay", () => {
    const page = sixPage(PROGRESS);
    const all = readProgress(page);
    const { value, skipped } = skipping((into) => readProgress(page.replace(/\(IP 3\.18 \/ SKS Lulus 107\)/, "(IP 3,175 / SKS Lulus 107)"), into));
    expect(value.progress.stages[1]).toEqual({ ...all.progress.stages[1], ip: { ...all.progress.stages[1]!.ip, six: null, computed: null, agrees: true } });
    expect(skipped).toEqual([
      { row: "Tahap Sarjana (IP 3,175 / SKS Lulus 107)", why: 'SIX curriculum position page: stage IP "3,175" isn\'t an index', blank: true },
    ]);
    // The overall total's figures aren't read at all.
    expect(readProgress(page.replace(/Semua \(IPK 3\.26 \/ SKS Lulus 125\)/, "Semua (IPK - / SKS Lulus -)"))).toEqual(all);
  });

  it("refuses layouts it doesn't know", () => {
    const page = sixPage(PROGRESS);
    const refused = (html: string) => verdict(() => readProgress(html));
    // A stage heading without its name: its courses would sit under no stage.
    expect(refused(page.replace(/Tahap Sarjana\s*\(IP 3\.18 \/ SKS Lulus 107\)/, "(IP 3.18 / SKS Lulus 107)"))).toBe(
      'VendorChanged: SIX curriculum position page: stage "(IP 3.18 / SKS Lulus 107)" isn\'t readable',
    );
    // A course's status label it doesn't know on every course: more rows left out than read, so the table changed.
    expect(
      refused(
        page
          .replace(/label-(danger|success)/g, "label-warning")
          .replace(/<td>\s*[A-E]{1,2}\s*<\/td><td>\d{4}-[123]<\/td>/g, '<td colspan="2"><span class="label label-warning">Lain</span></td>'),
      ),
    ).toMatch(/^VendorChanged: SIX curriculum position page: course \w+ has an unknown status/);
    expect(refused(page.replace(/<tr class="info"><th colspan="3">Semua[\s\S]*?<\/tr>/, ""))).toBe(
      "VendorChanged: SIX curriculum position page: the overall total is missing",
    );
  });

  it("reads SIX's English page by structure; kinds it can't name stay as SIX labels them", () => {
    const page = sixPage(PROGRESS);
    const english = inEnglish(page, [
      ["<th>Tahun Masuk</th>", "<th>Year of Entry</th>"],
      ["<th>Indeks Prestasi Kumulatif</th>", "<th>GPA</th>"],
      ["Lulus", "Passed"],
      ["Nilai T", "Grade T"],
      ["Jenis Mata Kuliah", "Course Type"],
      ["<td>Wajib</td>", "<td>Required</td>"],
      ["(IP ", "(GPA "],
      ["SKS Lulus", "Credits Passed"],
      ["Kurikulum Semester", "Curriculum Semester"],
    ]);
    const indonesian = readProgress(page);
    const read = readProgress(english);
    expect(read.ipk).toEqual(indonesian.ipk);
    expect(read.progress.stages).toEqual(indonesian.progress.stages);
    expect(read.progress.sksByKind[0]).toEqual({ kind: "other", label: "Required", sks: 108 });
  });
});

describe("curriculum", () => {
  it("lists the program's curricula and finds the one in force", () => {
    const list = readCurriculumList(sixPage(LIST));
    expect(list.map((c) => [c.year, c.active, c.graduationSks, c.semesters])).toEqual([
      [2024, true, 144, 8],
      [2019, false, 144, 8],
      [2013, false, null, null],
      [2008, false, null, null],
    ]);
    expect(list[0]).toMatchObject({
      id: "1047",
      name: "Kurikulum 2024 - Sarjana Sistem dan Teknologi Informasi",
      program: { code: "182", name: "S1 Sistem dan Teknologi Informasi", faculty: "STEI" },
      structurePath: "/app/mahasiswa:18223901/kurikulum/kurikulum/1047/struktur",
    });
    expect(list[1]!.structurePath).toBe("/app/mahasiswa:18223901/kurikulum/struktur?th_kur=2019&prodi=182&req_by=kurikulum-list-2024");
  });

  it("reads required courses by semester, specializations, minors and the catalog, each with its syllabus id", () => {
    const structure = readCurriculumStructure(sixPage(STRUCTURE));
    expect(structure.name).toBe("Kurikulum 2024 - Sarjana Sistem dan Teknologi Informasi");
    expect(structure.required).toHaveLength(45);
    expect(structure.required.reduce((sum, c) => sum + c.sks!, 0)).toBe(117);
    expect(structure.required.filter((c) => c.semester === 1).map((c) => c.code)).toEqual([
      "MA1101",
      "FI1101",
      "KI1101",
      "WI1101",
      "WI1102",
      "WI1103",
      "WI1111",
      "WI1116",
    ]);
    expect(structure.required.filter((c) => c.semester === 6).map((c) => c.code)).toEqual(["II3220", "II3230", "II3240", "IF3211", "WI2022"]);
    expect(structure.required.find((c) => c.code === "WI201X")).toEqual({ code: "WI201X", name: "Agama", sks: 2, courseId: "47573", semester: 2 });
    expect(structure.required.find((c) => c.code === "II1200")).toMatchObject({ courseId: "47837", semester: 2 });
    expect(structure.required.at(-1)).toMatchObject({ code: "II4092", semester: 8 });

    expect(structure.specializations.map((s) => [s.name, s.sks, s.courses.map((c) => c.code)])).toEqual([
      ["Keamanan dan Privasi Siber", 12, ["II4021", "II4022", "II4023", "II4024"]],
      ["Sistem Informasi Cerdas", 12, ["II4010", "II4011", "II4012", "II4013"]],
    ]);
    expect(structure.minors).toHaveLength(79);
    expect(structure.minors[0]).toMatchObject({ faculty: "FMIPA", program: "Matematika", name: "Program Minor Matematika", sks: 16 });
    expect(structure.minors[0]!.note).toMatch(/^Program minor matematika disediakan/);
    expect(structure.minors.at(-1)).toMatchObject({ faculty: "SBM", program: "Kewirausahaan", name: "Kewirausahaan Teknologi", sks: 15 });
    expect(structure.catalog).toHaveLength(45);
    expect(structure.catalog.at(-1)).toEqual({ code: "II4092", name: "Tugas Akhir", sks: 4, courseId: "47869", category: "Tugas Akhir / Tesis / Disertasi" });
    // Electives of the program: in the catalog, not required.
    const required = new Set(structure.required.map((c) => c.code));
    expect(structure.catalog.filter((c) => !required.has(c.code)).map((c) => c.code)).toContain("II4021");
  });

  it("reads what the Student registered for", () => {
    expect(readSchemes(sixPage(SCHEMES))).toEqual([
      {
        kind: "specialization",
        name: "Sistem Informasi Cerdas",
        program: "Sistem dan Teknologi Informasi",
        advisorApprovedOn: "2026-02-05",
        programApprovedOn: "2026-02-05",
        status: "On Progress",
      },
    ]);
  });

  it("a row of required courses it doesn't understand is left out and kept; the other semesters' courses read", () => {
    const structure = sixPage(STRUCTURE);
    const all = readCurriculumStructure(structure);
    const { value, skipped } = skipping((into) =>
      readCurriculumStructure(structure.replace(/(<a href="\/pub\/matakuliah\/47455">)\s*MA1101\s*</, "$1 Matematika <"), into),
    );
    expect(skipped).toEqual([{ row: "Matematika · Matematika I · 4", why: 'SIX curriculum structure page: "Matematika" isn\'t a course code' }]);
    // MA1101 is left out, and only it: the course beside it in the same row reads.
    expect(value.required).toEqual(all.required.filter((c) => c.code !== "MA1101"));
    expect(value.catalog).toEqual(all.catalog);
  });

  it("a curriculum's SKS to graduate, study length or active mark it can't read is blank and its row noted", () => {
    const page = sixPage(LIST);
    const all = readCurriculumList(page);
    const { value, skipped } = skipping((into) =>
      readCurriculumList(
        page.replace(
          '<td class="text-center">144</td><td class="text-center">8</td>',
          '<td class="text-center">144 SKS</td><td class="text-center">8 / 10</td>',
        ),
        into,
      ),
    );
    expect(value).toEqual([{ ...all[0]!, graduationSks: null, semesters: null }, ...all.slice(1)]);
    expect(skipped).toEqual([
      {
        // Cut to what finds it on SIX.
        row: "Lihat Struktur Kurikulum · 1 · 182 · S1 Sistem dan Teknologi Informasi · STEI · Kurikulum 2024 - Sarjana Sistem dan Tek…",
        why: 'SIX curriculum list page: SKS to graduate "144 SKS" isn\'t a number; SIX curriculum list page: study length "8 / 10" isn\'t a number',
        blank: true,
      },
    ]);
  });

  it("finds the curricula's columns by their labels: in English, in another order, beside a column it doesn't know", () => {
    const page = sixPage(LIST);
    const all = readCurriculumList(page);
    const moved = rebuildRows(page, "Nama Kurikulum", (cells, header) => {
      const [button, number, code, program, faculty, name, year, sks, length, active] = cells;
      if (header)
        return [
          "<th></th>",
          "<th></th>",
          "<th>Curriculum Name</th>",
          "<th>Year</th>",
          "<th>Program No</th>",
          "<th>Study Program</th>",
          "<th>Faculty</th>",
          "<th>Catatan</th>",
          "<th>Graduation SKS</th>",
          "<th>Study Length (Semester)</th>",
          "<th>Active</th>",
        ];
      return [button!, number!, name!, year!, code!, program!, faculty!, "<td>-</td>", sks!, length!, active!];
    });
    expect(skipping((into) => readCurriculumList(moved, into))).toEqual({ value: all, skipped: [] });
  });

  it("a curriculum course's SKS it can't read is blank and its row noted; its columns are found by their labels", () => {
    const page = sixPage(STRUCTURE);
    const all = readCurriculumStructure(page);
    const { value, skipped } = skipping((into) =>
      readCurriculumStructure(page.replace(/(Matematika I\s*<\/a><\/td><td class="text-center">)4/, "$14 SKS"), into),
    );
    expect(value.required.find((c) => c.code === "MA1101")).toEqual({ ...all.required.find((c) => c.code === "MA1101"), sks: null });
    expect(value.required).toHaveLength(all.required.length);
    expect(skipped).toEqual([
      { row: "MA1101 · Matematika I · 4 SKS", why: 'SIX curriculum structure page: SKS of MA1101 "4 SKS" isn\'t a number', blank: true },
    ]);
    // The catalog in English, its category moved to the end beside a column it doesn't know.
    const catalog = page.replace(/(id="katalog"[\s\S]*?<\/table>)/, (table) =>
      rebuildRows(`<html><body><div class="tab-pane" ${table}</div></body></html>`, "Kategori", (cells, header) => {
        if (header) return ["<th>Code</th>", "<th>Course</th>", "<th>Credits</th>", "<th>Catatan</th>", "<th>Category</th>"];
        return [cells[0]!, cells[1]!, cells[3]!, "<td>-</td>", cells[2]!];
      })
        .replace(/^[\s\S]*?<div class="tab-pane" /, "")
        .replace(/<\/div><\/body><\/html>$/, ""),
    );
    expect(catalog).toContain("<th>Category</th>");
    expect(skipping((into) => readCurriculumStructure(catalog, into))).toEqual({ value: all, skipped: [] });
  });

  it("without a course code column the structure is refused; a blank cell across both semesters is an empty row", () => {
    const page = sixPage(STRUCTURE);
    expect(verdict(() => readCurriculumStructure(page.replace('<th class="text-center">Kode</th>', '<th class="text-center">Kode MK</th>')))).toBe(
      'VendorChanged: SIX curriculum structure page: the required courses header has no "Kode" column',
    );
    const across = page.replace(/(<tr><th class="text-center">Kode<\/th>[\s\S]*?<\/tr>)/, '$1<tr><td colspan="6"></td></tr>');
    expect(skipping((into) => readCurriculumStructure(across, into))).toEqual({ value: readCurriculumStructure(page), skipped: [] });
  });

  it("finds the schemes' columns by their labels, across its two header rows: in English, in another order, beside one it doesn't know", () => {
    const page = sixPage(SCHEMES);
    const all = readSchemes(page);
    const moved = page
      .split(
        '<th rowspan="2"></th><th rowspan="2">Skema Program Pendidikan</th><th colspan="2" class="text-center">Persetujuan</th><th rowspan="2">Status</th></tr><tr><th>Dosen Wali</th><th>Prodi Penyelenggara</th>',
      )
      .join(
        '<th rowspan="2"></th><th rowspan="2">Status</th><th rowspan="2">Education Scheme</th><th rowspan="2">Catatan</th><th colspan="2" class="text-center">Approval</th></tr><tr><th>Academic Advisor</th><th>Organizing Program</th>',
      )
      .replace(
        /(<th class="text-right">1<\/th>)(<td><a[\s\S]*?<\/a><\/td>)(<td>[\s\S]*?<\/td>)(<td>[\s\S]*?<\/td>)(<td><span class="label label-primary">On Progress<\/span><\/td>)/,
        "$1$5$2<td>-</td>$3$4",
      );
    expect(moved).toContain("<th>Academic Advisor</th>");
    expect(skipping((into) => readSchemes(moved, into))).toEqual({ value: all, skipped: [] });
    expect(verdict(() => readSchemes(page.split(">Skema Program Pendidikan<").join(">Program<")))).toBe(
      'VendorChanged: SIX education scheme page: the header has no "Skema Program Pendidikan" column',
    );
  });

  it("an approval day it can't read is blank and its row noted; the registration stays", () => {
    const { value, skipped } = skipping((into) =>
      readSchemes(sixPage(SCHEMES).replace("<small>&nbsp;5 Feb 2026</small><br />", "<small>&nbsp;5/2/2026</small><br />"), into),
    );
    expect(value).toEqual([{ ...readSchemes(sixPage(SCHEMES))[0], advisorApprovedOn: null }]);
    expect(skipped.map((row) => row.why)).toEqual(['SIX education scheme page: approval day "5/2/2026" isn\'t a date']);
  });

  it("refuses layouts it doesn't know", () => {
    expect(verdict(() => readCurriculumList(sixPage(LIST).replace("<th>Nama Kurikulum</th>", "<th>Kurikulum</th>")))).toBe(
      'VendorChanged: SIX curriculum list page: the list header has no "Nama Kurikulum" column',
    );
    const structure = sixPage(STRUCTURE);
    expect(verdict(() => readCurriculumStructure(structure.replace('id="katalog"', 'id="catalog"')))).toBe(
      "VendorChanged: SIX curriculum structure page: the katalog tab is missing",
    );
    // Every course code written another way: not a row, the tables changed.
    expect(verdict(() => readCurriculumStructure(structure.replace(/(<a href="\/pub\/matakuliah\/\d+">)\s*[A-Z]{2}\d{3}[\dX]\s*</g, "$1 Matematika <")))).toBe(
      'VendorChanged: SIX curriculum structure page: "Matematika" isn\'t a course code',
    );
    expect(
      verdict(() =>
        readSchemes(
          sixPage(SCHEMES)
            .replace(/<div class="panel-title">[^<]*<\/div>/g, "")
            .replace(/tab=[a-z]+/g, ""),
        ),
      ),
    ).toBe("VendorChanged: SIX education scheme page: no scheme panels");
  });
});

describe("syllabus", () => {
  it("reads a course's syllabus, with empty parts as nothing", () => {
    expect(readSyllabus(sixPage(SYLLABUS), "47837")).toEqual({
      courseId: "47837",
      code: "II1200",
      curriculumYear: 2024,
      sks: 3,
      organizer: "182 - Sistem dan Teknologi Informasi / STEI",
      name: { id: "Pengantar Sistem dan Teknologi Informasi", en: "Introduction to Information Systems and Technology" },
      summary: { id: null, en: null },
      content: { id: null, en: null },
      outcomes: { id: null, en: null },
      related: null,
      activities: { id: null, en: null },
      references: null,
      assessment: { id: null, en: null },
      notes: { id: null, en: null },
      weeks: [],
    });
  });

  it("keeps a filled syllabus's lines and its weekly plan", () => {
    const page = sixPage(SYLLABUS)
      .replace("<tr><th>Silabus Ringkas</th><td></td>", "<tr><th>Silabus Ringkas</th><td>Konsep dasar STI.<br />Peran STI di organisasi.</td>")
      .replace('<tr><td colspan="5"><em>Belum ada</em></td></tr>', "<tr><td>1</td><td>Pengantar</td><td>Ruang lingkup</td><td></td><td>Buku 1</td></tr>");
    const syllabus = readSyllabus(page, "47837");
    expect(syllabus.summary).toEqual({ id: "Konsep dasar STI.\nPeran STI di organisasi.", en: null });
    expect(syllabus.weeks).toEqual([{ week: "1", topic: "Pengantar", subtopics: "Ruang lingkup", outcomes: null, sources: "Buku 1" }]);
  });
});

describe("study plan (KRS)", () => {
  it("reads when the plan and its change were sent, approved and made official, the UKT, and the courses", () => {
    expect(readKrs(sixPage(KRS))).toEqual({
      term: "2026-1",
      advisor: "Prof. Dr. Ir. Wahyu Wijaya, M.T.",
      maxSks: 24,
      state: "official",
      plan: { sentAt: wib("2026-08-16T10:45:42"), approvedAt: wib("2026-08-18T14:39:32"), legalizedAt: wib("2026-08-20T14:34:46") },
      change: { sentAt: wib("2026-09-15T14:15:10"), approvedAt: wib("2026-09-15T19:18:25"), legalizedAt: wib("2026-09-16T11:02:56") },
      ukt: { paid: true, amount: 5_400_000 },
      courses: [
        { code: "DK4073", name: "Komunikasi Pemasaran", classNo: "01", sks: 3, approved: true },
        { code: "II4091", name: "Proposal Tugas Akhir", classNo: "01", sks: 2, approved: true },
        { code: "KU5014", name: "Teknik Penyelesaian Masalah Terstruktur", classNo: "01", sks: 3, approved: true },
        { code: "PL3002", name: "Ekonomi dan Inovasi dalam Perencanaan", classNo: "01", sks: 3, approved: true },
        { code: "PL3032", name: "Ekonomi Infrastruktur dan Transportasi", classNo: "01", sks: 3, approved: true },
      ],
      sks: 14,
    });
  });

  it("follows the plan from sent to approved to official, and a change waiting for the advisor", () => {
    const six = new PretendSix(() => 0);
    six.dropKrsChange();
    six.krsStep("plan", "Pengesahan KSM", null);
    six.krsStep("plan", "Persetujuan Dosen Wali", null);
    expect(readKrs(six.page(KRS))).toMatchObject({
      state: "sent",
      change: null,
      plan: { sentAt: wib("2026-08-16T10:45:42"), approvedAt: null, legalizedAt: null },
    });
    six.krsStep("plan", "Persetujuan Dosen Wali", "18 Agu 2026 14.39.32");
    expect(readKrs(six.page(KRS)).state).toBe("approved");
    six.krsStep("plan", "Pengesahan KSM", "20 Agu 2026 14.34.46");
    expect(readKrs(six.page(KRS)).state).toBe("official");

    const changing = new PretendSix(() => 0);
    changing.krsStep("change", "Persetujuan Dosen Wali", null);
    changing.krsStep("change", "Pengesahan KSM Pengganti", null);
    expect(readKrs(changing.page(KRS))).toMatchObject({ state: "sent", change: { sentAt: wib("2026-09-15T14:15:10"), approvedAt: null, legalizedAt: null } });
  });

  it("an empty plan, and courses the advisor hasn't approved", () => {
    const six = new PretendSix(() => 0);
    six.krsCourse("PL3002", { approved: false });
    expect(readKrs(six.page(KRS)).courses.find((c) => c.code === "PL3002")!.approved).toBe(false);
    for (const code of ["DK4073", "II4091", "KU5014", "PL3002", "PL3032"]) six.krsCourse(code, "remove");
    expect(readKrs(six.page(KRS))).toMatchObject({ courses: [], sks: 0 });
  });

  it("a course whose SKS it can't read stays, its SKS blank and its row noted; the plan's total stays SIX's", () => {
    const page = sixPage(KRS);
    const all = readKrs(page);
    const { value, skipped } = skipping((into) =>
      readKrs(page.replace(/(PL3002[\s\S]*?<td class="text-center">\s*01\s*<\/td><td class="text-center">\s*)3/, "$13 SKS"), into),
    );
    expect(value).toEqual({ ...all, courses: all.courses.map((c) => (c.code === "PL3002" ? { ...c, sks: null } : c)) });
    expect(value.sks).toBe(14);
    expect(skipped).toEqual([
      { row: "PL3002 · Ekonomi dan Inovasi dalam Perencanaan · 01 · 3 SKS", why: 'SIX KRS page: SKS "3 SKS" isn\'t a number', blank: true },
    ]);
  });

  it("the plan's SKS total, the UKT amount or the most SKS allowed it can't read are blank, and noted", () => {
    const page = sixPage(KRS);
    const all = readKrs(page);
    const total = skipping((into) => readKrs(page.replace('<th class="text-center">14 </th>', '<th class="text-center">14 SKS</th>'), into));
    expect(total.value).toEqual({ ...all, sks: null });
    expect(total.skipped).toEqual([{ row: "14 SKS", why: 'SIX KRS page: SKS total "14 SKS" isn\'t a number', blank: true }]);
    const ukt = skipping((into) => readKrs(page.replace("Rp 5.400.000", "Rp 5.400.000,00"), into));
    expect(ukt.value).toEqual({ ...all, ukt: { paid: true, amount: null } });
    expect(ukt.skipped.map((row) => row.why)).toEqual(['SIX KRS page: UKT "Rp 5.400.000,00" isn\'t an amount']);
    const max = skipping((into) => readKrs(page.replace(/(<th>Maksimal Beban<\/th><td>)[^<]*/, "$1dua puluh empat"), into));
    expect(max.value).toEqual({ ...all, maxSks: null });
    expect(max.skipped).toEqual([{ row: "Maksimal Beban · dua puluh empat", why: 'SIX KRS page: maximum SKS "dua puluh empat" isn\'t a number', blank: true }]);
    // No total row at all: blank, noted under the header it belongs to.
    const none = skipping((into) => readKrs(page.replace(/<tr><td colspan="3"><\/td><th class="text-center">14 <\/th><th><\/th><\/tr>/, ""), into));
    expect(none.value).toEqual({ ...all, sks: null });
    expect(none.skipped).toEqual([{ row: "Kode · Mata Kuliah · Kelas · SKS · Disetujui", why: "SIX KRS page: the SKS total is missing", blank: true }]);
  });

  it("a step's time with words around it, or written twice, reads the same; one it can't read is still done, with its time blank and noted", () => {
    const page = sixPage(KRS);
    const all = readKrs(page);
    expect(readKrs(page.replace("18 Agu 2026 14.39.32", "18 Agu 2026 14.39.32 (oleh dosen wali)"))).toEqual(all);
    expect(readKrs(page.replace("18 Agu 2026 14.39.32", "18 Agu 2026 14.39.32 / 18 Agu 2026 14.39.32"))).toEqual(all);
    const { value, skipped } = skipping((into) => readKrs(page.replace("18 Agu 2026 14.39.32", "18/08/2026 14:39"), into));
    expect(value).toEqual({ ...all, plan: { ...all.plan, approvedAt: null, undated: ["approvedAt"] } });
    expect(skipped).toEqual([
      { row: "Persetujuan Dosen Wali · 18/08/2026 14:39", why: 'SIX KRS page: Persetujuan Dosen Wali "18/08/2026 14:39" isn\'t a date', blank: true },
    ]);
    // The step decides how far the plan is: done without a time it can read, it still counts.
    const six = new PretendSix(() => 0);
    six.dropKrsChange();
    six.krsStep("plan", "Pengesahan KSM", "20/08/2026 14:34");
    expect(readKrs(six.page(KRS))).toMatchObject({ state: "official", plan: { legalizedAt: null, undated: ["legalizedAt"] } });
  });

  it("finds the courses' columns by their labels: in English, in another order, beside a column it doesn't know", () => {
    const page = sixPage(KRS);
    const all = readKrs(page);
    // Name before code, in English, and a column the app doesn't know before SKS; the total's empty cell spans it too.
    const moved = rebuildRows(page, "Disetujui", (cells, header) => {
      if (header) return ["<th>Course</th>", "<th>Code</th>", "<th>Class</th>", "<th>Type</th>", "<th>Credits</th>", "<th>Approved</th>"];
      if (cells.length === 3) return ['<td colspan="4"></td>', ...cells.slice(1)];
      return [cells[1]!, cells[0]!, cells[2]!, "<td>W</td>", ...cells.slice(3)];
    });
    expect(moved).not.toContain(">Disetujui<");
    expect(skipping((into) => readKrs(moved, into))).toEqual({ value: all, skipped: [] });
  });

  it("without the class or SKS column, that detail is blank on every course, noted once; without the code's, the page is refused", () => {
    const page = sixPage(KRS);
    const all = readKrs(page);
    const { value, skipped } = skipping((into) => readKrs(page.replace('<th class="text-center">SKS </th>', '<th class="text-center">Bobot</th>'), into));
    expect(value).toEqual({ ...all, courses: all.courses.map((c) => ({ ...c, sks: null })), sks: null });
    expect(skipped).toEqual([
      { row: "Kode · Mata Kuliah · Kelas · Bobot · Disetujui", why: 'SIX KRS page: the course header has no "SKS" column', blank: true },
    ]);
    const noClass = readKrs(page.replace('<th class="text-center">Kelas</th>', '<th class="text-center">Rombel</th>'));
    expect(noClass.courses.map((c) => c.classNo)).toEqual([null, null, null, null, null]);
    expect(verdict(() => readKrs(page.replace("<th>Kode</th>", "<th>Kode MK</th>")))).toBe(
      'VendorChanged: SIX KRS page: the course header has no "Kode" column',
    );
  });

  it("refuses layouts it doesn't know", () => {
    const page = sixPage(KRS);
    const refused = (html: string) => verdict(() => readKrs(html));
    expect(refused(page.replace("<th>Persetujuan Dosen Wali</th>", "<th>Persetujuan Wali</th>"))).toBe(
      "VendorChanged: SIX KRS page: the plan round has no Persetujuan Dosen Wali row",
    );
    // A row the app doesn't use is fine.
    expect(
      refused(
        page.replace(
          '<tr class="success"><th>Pembayaran UKT</th>',
          '<tr><th>Pengisian Kuesioner</th><td>Sudah</td></tr><tr class="success"><th>Pembayaran UKT</th>',
        ),
      ),
    ).toMatchObject({ state: "official" });
    expect(refused(page.replace(/<h1>[\s\S]*?<\/h1>/, "<h1>Rencana Studi</h1>"))).toBe("VendorChanged: SIX KRS page: it names no term");
  });

  it("reads SIX's English page by the order of its steps", () => {
    const page = sixPage(KRS);
    const english = inEnglish(page, [
      ["Semester 1 (Ganjil)", "Semester 1 (Odd)"],
      ["<th>Dosen Wali</th>", "<th>Academic Advisor</th>"],
      ["<th>Maksimal Beban</th>", "<th>Maximum Load</th>"],
      ["<th>Pengiriman Rencana Studi</th>", "<th>Study Plan Sent</th>"],
      ["<th>Persetujuan Dosen Wali</th>", "<th>Advisor Approval</th>"],
      ["<th>Pembayaran UKT</th>", "<th>Tuition Payment</th>"],
      ["<th>Pengesahan KSM</th>", "<th>KSM Validation</th>"],
      ["<th>Pengesahan KSM Pengganti</th>", "<th>Replacement KSM Validation</th>"],
      ["Penggantian Rencana Studi (URS)", "Study Plan Change (URS)"],
      [" Agu 2026 ", " Aug 2026 "],
      [
        '<th>Kode</th><th>Mata Kuliah</th><th class="text-center">Kelas</th><th class="text-center">SKS </th><th class="text-center">Disetujui</th>',
        "<th>Code</th><th>Course</th><th>Class</th><th>Credits</th><th>Approved</th>",
      ],
    ]);
    for (const label of ["<th>Pengiriman", "<th>Persetujuan", "<th>Pengesahan", ">Disetujui<", " Agu "]) expect(english).not.toContain(label);
    expect(readKrs(english)).toEqual(readKrs(page));
  });
});

describe("bills", () => {
  it("reads every term's bill, with instalments and terms not billed", () => {
    const bills = readBills(sixPage(BILLS));
    expect(bills.map((b) => [b.term, b.status])).toEqual([
      ["2023-1", "paid"],
      ["2023-2", "paid"],
      ["2023-3", "not-billed"],
      ["2024-1", "paid"],
      ["2024-2", "paid"],
      ["2024-3", "not-billed"],
      ["2025-1", "paid"],
      ["2025-2", "paid"],
      ["2025-3", "not-billed"],
      ["2026-1", "paid"],
      ["2026-2", "not-billed"],
      ["2026-3", "not-billed"],
    ]);
    expect(bills.find((b) => b.term === "2026-1")).toEqual({
      term: "2026-1",
      amount: 5_400_000,
      paid: 5_400_000,
      status: "paid",
      dueDate: "2026-08-24",
      dueAt: wib("2026-08-24T23:59:59.999"),
      instalments: [],
      nextDueAt: null,
    });
    expect(bills.find((b) => b.term === "2023-2")).toMatchObject({
      amount: 10_500_000,
      dueDate: "2024-03-24",
      instalments: [
        { number: 1, amount: 5_250_000, dueDate: "2024-02-04", dueAt: wib("2024-02-04T23:59:59.999") },
        { number: 2, amount: 5_250_000, dueDate: "2024-03-24", dueAt: wib("2024-03-24T23:59:59.999") },
      ],
    });
    expect(bills.find((b) => b.term === "2026-2")).toMatchObject({ amount: null, paid: null, dueDate: null, dueAt: null, nextDueAt: null });
  });

  it("a new bill is due at the end of its last day in WIB; partly paid, the next instalment is", () => {
    const six = new PretendSix(() => 0);
    six.setBill("2026-2", { amount: "5.400.000", paid: "-", due: "31 Jan 2027" });
    expect(readBills(six.page(BILLS)).find((b) => b.term === "2026-2")).toMatchObject({
      status: "unpaid",
      dueDate: "2027-01-31",
      nextDueAt: wib("2027-01-31T23:59:59.999"),
    });
    six.setBill("2026-2", { amount: "5.400.000", paid: "5.400.000", due: "31 Jan 2027" });
    expect(readBills(six.page(BILLS)).find((b) => b.term === "2026-2")).toMatchObject({ status: "paid", nextDueAt: null });

    const partly = new PretendSix(() => 0);
    partly.editPage(BILLS, (html) =>
      html.replace(
        /(2&nbsp;-&nbsp;Genap\s*<\/strong><\/td><td class="text-right">\s*10\.500\.000\s*<\/td><td class="text-right">\s*)10\.500\.000/,
        "$15.250.000",
      ),
    );
    expect(readBills(partly.page(BILLS)).find((b) => b.term === "2023-2")).toMatchObject({ status: "partly-paid", nextDueAt: wib("2024-03-24T23:59:59.999") });
  });

  it("an SPI row (the one-off development fee, not a term's UKT) is left out, and the terms are read as before", () => {
    const page = sixPage(BILLS);
    const spi = page.replace(
      /(Tahun 2023 \/ 2024\s*<\/th><\/tr>)/,
      `$1<tr><td><strong>
                SPI            </strong></td><td class="text-right">
                            25.000.000
                                </td><td class="text-right">
                            25.000.000
                    </td><td class="text-left">
                                                                        20 Agu 2023
                                                        </td><td class="text-center"><a href="#" class="btn_kode" data-url="/app/mahasiswa:18223901/keuangan/kodebayar/2021000001/2023/SPI"><strong><i class="fa fa-info-circle fa-fw fa-lg" aria-hidden="true"></i></strong></a></td></tr>`,
    );
    expect(spi).not.toBe(page);
    expect(readBills(spi)).toEqual(readBills(page));
  });

  it("a bill whose term it can't read is left out and kept with what it shows; the other bills read", () => {
    const page = sixPage(BILLS);
    const all = readBills(page);
    const term = skipping((skipped) => readBills(page.replace("1&nbsp;-&nbsp;Ganjil", "Ganjil"), skipped));
    expect(term.value).toEqual(all.filter((bill) => bill.term !== "2023-1"));
    expect(term.skipped).toEqual([{ row: "Ganjil · 10.500.000 · 10.500.000 · 20 Agu 2023", why: 'SIX finance page: term "Ganjil" isn\'t readable' }]);
    // Read without a list to keep them in: still left out.
    expect(readBills(page.replace("1&nbsp;-&nbsp;Ganjil", "Ganjil"))).toEqual(term.value);
  });

  it("a bill with an amount it can't read stays, its amount blank and its row noted: whether it's paid isn't known", () => {
    const page = sixPage(BILLS);
    const all = readBills(page);
    const { value, skipped } = skipping((into) => readBills(page.replace(/(<td class="text-right">\s*)5\.400\.000/, "$15.400.000,00"), into));
    expect(value.map((bill) => bill.term)).toEqual(all.map((bill) => bill.term));
    expect(value.find((bill) => bill.term === "2025-1")).toEqual({
      ...all.find((bill) => bill.term === "2025-1"),
      amount: null,
      status: "unknown",
      nextDueAt: null,
    });
    expect(skipped).toEqual([
      { row: "1 - Ganjil · 5.400.000,00 · 5.400.000 · 1 Sep 2025", why: 'SIX finance page: bill of 2025-1 "5.400.000,00" isn\'t an amount', blank: true },
    ]);
    expect(value.filter((bill) => bill.term !== "2025-1")).toEqual(all.filter((bill) => bill.term !== "2025-1"));
  });

  it("a payment it can't read leaves the bill's status unknown; a deadline it can't read is blank, with the bill read", () => {
    const page = sixPage(BILLS);
    const all = readBills(page);
    const of = (bills: Bill[], term: string) => bills.find((bill) => bill.term === term);
    const paid = skipping((into) =>
      readBills(page.replace(/(<td class="text-right">\s*5\.400\.000\s*<\/td><td class="text-right">\s*)5\.400\.000/, "$1Lunas"), into),
    );
    expect(of(paid.value, "2025-1")).toMatchObject({ amount: 5_400_000, paid: null, status: "unknown", nextDueAt: null });
    expect(paid.skipped.map((row) => row.why)).toEqual(['SIX finance page: payment of 2025-1 "Lunas" isn\'t an amount']);

    const due = skipping((into) => readBills(page.replace("24 Agu 2026", "2026-08-24"), into));
    expect(of(due.value, "2026-1")).toEqual({ ...of(all, "2026-1"), dueDate: null, dueAt: null });
    expect(due.skipped).toEqual([
      { row: "1 - Ganjil · 5.400.000 · 5.400.000 · 2026-08-24", why: 'SIX finance page: deadline of 2026-1 "2026-08-24" isn\'t a date', blank: true },
    ]);
    // An instalment it can't read blanks the whole deadline, never a later instalment as the next one due.
    const instalment = skipping((into) => readBills(page.replace("4 Feb 2024", "4/2/2024"), into));
    expect(of(instalment.value, "2023-2")).toEqual({ ...of(all, "2023-2"), dueDate: null, dueAt: null, instalments: [] });
    expect(instalment.skipped.map((row) => row.why)).toEqual(['SIX finance page: instalment of 2023-2 "4/2/2024" isn\'t a date']);
  });

  it("finds the bills' columns by their labels: in English, in another order, beside a column it doesn't know", () => {
    const page = sixPage(BILLS);
    const all = readBills(page);
    const header = "<th class='text-left'>Semester</th><th class='text-right'>Tagihan (Rp)</th><th class='text-right'>Pembayaran (Rp)</th>";
    expect(page).toContain(header);
    // One Student's Indonesian page wrote these two in English.
    const mixed = page
      .replace("<th class='text-right'>Tagihan (Rp)</th>", "<th class='text-right'>Invoice (Rp)</th>")
      .replace("<th class='text-left'>Batas Pembayaran</th>", "<th class='text-left'>Payment Due Date</th>");
    expect(skipping((into) => readBills(mixed, into))).toEqual({ value: all, skipped: [] });
    // A column the app doesn't know, before the others: every row has one cell more.
    const extra = page
      .replace("<th class='text-left'>Semester</th>", "<th>No</th><th class='text-left'>Semester</th>")
      .replace(/<tr><td><strong>/g, "<tr><td>1</td><td><strong>");
    expect(skipping((into) => readBills(extra, into))).toEqual({ value: all, skipped: [] });
  });

  it("without a detail's column, that detail is blank in every bill, noted once; without the term's, the page is refused", () => {
    const page = sixPage(BILLS);
    const without = page.replace("<th class='text-left'>Batas Pembayaran</th>", "<th class='text-left'>Keterangan</th>");
    const { value, skipped } = skipping((into) => readBills(without, into));
    expect(value.map((bill) => bill.term)).toEqual(readBills(page).map((bill) => bill.term));
    expect(value.every((bill) => bill.dueDate === null && bill.instalments.length === 0)).toBe(true);
    expect(skipped).toEqual([
      {
        row: "Semester · Tagihan (Rp) · Pembayaran (Rp) · Keterangan · Petunjuk",
        why: 'SIX finance page: the bills header has no "Batas Pembayaran" column',
        blank: true,
      },
    ]);
    expect(verdict(() => readBills(page.replace("<th class='text-left'>Semester</th>", "<th class='text-left'>Periode</th>")))).toBe(
      'VendorChanged: SIX finance page: the bills header has no "Semester" column',
    );
  });

  it("refuses layouts it doesn't know: a year it can't read, or no bill it understands", () => {
    const page = sixPage(BILLS);
    const refused = (html: string) => verdict(() => readBills(html));
    expect(refused(page.replace("Tahun 2024 / 2025", "Tahun Ajaran Baru"))).toBe(
      'VendorChanged: SIX finance page: year row "Tahun Ajaran Baru" isn\'t readable',
    );
    expect(refused(page.replace(/\d&nbsp;-&nbsp;/g, ""))).toBe('VendorChanged: SIX finance page: term "Ganjil" isn\'t readable');
  });

  it("reads SIX's English page the same way", () => {
    const page = sixPage(BILLS);
    const english = inEnglish(page, [
      [
        "<th class='text-right'>Tagihan (Rp)</th><th class='text-right'>Pembayaran (Rp)</th><th class='text-left'>Batas Pembayaran</th><th class='text-center'>Petunjuk</th>",
        "<th class='text-right'>Bill (Rp)</th><th class='text-right'>Paid (Rp)</th><th class='text-left'>Due</th><th class='text-center'>Help</th>",
      ],
      ["Tahun ", "Year "],
      ["Ganjil", "Odd"],
      ["Genap", "Even"],
      ["Pendek", "Short"],
      [" Agu ", " Aug "],
      ["5.400.000", "5,400,000"],
    ]);
    for (const label of ["Tagihan", "Tahun", "Ganjil", " Agu ", "5.400.000"]) expect(english).not.toContain(label);
    expect(readBills(english)).toEqual(readBills(page));
  });
});

describe("every reader, given a row it doesn't recognise among the ones it does", () => {
  /** `html` with `row` put before the row holding `marker` (the first after `after`). */
  const withRowBefore = (html: string, marker: string, row: string, after = "") => {
    const at = html.indexOf(marker, after ? html.indexOf(after) : 0);
    expect(at).toBeGreaterThan(0);
    const start = html.lastIndexOf("<tr", at);
    return html.slice(0, start) + row + html.slice(start);
  };
  const cases: [string, RegExp, (html: string, skipped: Skipped) => unknown, string, string, string?][] = [
    ["a KRS course", KRS, readKrs, "DK4073", "<tr><td>XX-01</td><td>Mata kuliah baru</td><td>01</td><td>3</td><td></td></tr>"],
    ["a curriculum", LIST, readCurriculumList, "Lihat Struktur Kurikulum", "<tr><td>Kurikulum lama</td><td>2013</td></tr>"],
    ["a scheme registration", SCHEMES, readSchemes, "Sistem Informasi Cerdas &#183;", "<tr><td>2</td><td>Minor baru</td><td>-</td></tr>"],
    ["a specialization's course", STRUCTURE, readCurriculumStructure, "II4021", "<tr><td>II4X99</td><td>Topik Khusus</td><td>3</td></tr>"],
    ["a catalog course", STRUCTURE, readCurriculumStructure, "<td", "<tr><td>Kategori baru</td><td>3</td></tr>", 'id="katalog"'],
  ];

  it.each(cases)("%s: left out and kept with what it shows; the rest reads as before", (_name, path, read, marker, row, after) => {
    const page = sixPage(path);
    const before = read(page, new Skipped());
    const { value, skipped } = skipping((into) => read(withRowBefore(page, marker, row, after), into));
    expect(value).toEqual(before);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]!.row).toBe(
      row
        .replace(/<[^>]+>/g, " · ")
        .split(" · ")
        .map((part) => part.trim())
        .filter(Boolean)
        .join(" · "),
    );
    expect(skipped[0]!.why).toMatch(/^SIX /);
  });
});

describe("every reader, given a page it isn't for", () => {
  const readers: [RegExp, (html: string) => unknown][] = [
    [TRANSCRIPT, (html) => readTranscript(html, IPK)],
    [PROGRESS, readProgress],
    [LIST, readCurriculumList],
    [STRUCTURE, readCurriculumStructure],
    [SCHEMES, readSchemes],
    [SYLLABUS, (html) => readSyllabus(html, "1")],
    [KRS, readKrs],
    [BILLS, readBills],
  ];
  const login = '<!DOCTYPE html><html><head><title>SIX</title></head><body><a href="/login/MS365">Login dengan ITB Account</a></body></html>';

  it("says SIX changed something: no crash, no data", () => {
    for (const [own, read] of readers) {
      const others = exchanges("six")
        .filter((e) => !own.test(e.path))
        .map((e) => bodyText("six", e.file));
      for (const html of [...others, login, ""]) expect(verdict(() => read(html))).toMatch(/^VendorChanged: /);
    }
  });
});
