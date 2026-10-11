// SIX record readers (#78, #79, #80) against the recorded pages: what they
// read, how the transcript counts retakes and courses off the transcript, and
// that a layout they don't know is "SIX changed something", never wrong or
// empty data. Pages are changed the way SIX would through the pretend SIX.
import { describe, expect, it } from "vitest";
import { isEngineError } from "../../src/engine/errors";
import { readBills } from "../../src/engine/sources/six/readers/bills";
import { readCurriculumList } from "../../src/engine/sources/six/readers/curriculum-list";
import { readCurriculumStructure } from "../../src/engine/sources/six/readers/curriculum-structure";
import { readKrs } from "../../src/engine/sources/six/readers/krs";
import { readProgress } from "../../src/engine/sources/six/readers/progress";
import { readSchemes } from "../../src/engine/sources/six/readers/schemes";
import { readSyllabus } from "../../src/engine/sources/six/readers/syllabus";
import { readTranscript } from "../../src/engine/sources/six/readers/transcript";
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
    out = out.replace('<li class="active"><a href="/pub/locale/id', '<li><a href="/pub/locale/id').replace('<li><a href="/pub/locale/en', '<li class="active"><a href="/pub/locale/en');
  }
  for (const [from, to] of labels) out = out.split(from).join(to);
  return out;
}

const transcriptOf = (six: PretendSix, ipk = IPK) => readTranscript(six.page(TRANSCRIPT), ipk);
const course = (transcript: ReturnType<typeof transcriptOf>, term: string, code: string) => transcript.terms.find((t) => t.term === term)!.courses.find((c) => c.code === code)!;

describe("transcript by semester", () => {
  it("reads every term with its courses, SIX's IP and the IPK, all agreeing with the rows", () => {
    const transcript = readTranscript(sixPage(TRANSCRIPT), IPK);
    expect(transcript.terms.map((t) => t.term)).toEqual(["2023-1", "2023-2", "2024-1", "2024-2", "2025-1", "2025-2", "2026-1"]);
    expect(transcript.terms.map((t) => t.ip.six)).toEqual([3.69, 3.17, 3.17, 3.24, 3.1, 3.27, null]);
    expect(transcript.terms.map((t) => t.ip.computed)).toEqual([3.69, 3.17, 3.17, 3.24, 3.1, 3.27, null]);
    expect(transcript.terms.every((t) => t.ip.agrees)).toBe(true);
    expect(transcript.terms.map((t) => t.sks)).toEqual([18, 18, 24, 23, 20, 22, 14]);
    expect(transcript.terms.map((t) => t.courses.reduce((sum, c) => sum + c.sks, 0))).toEqual([18, 18, 24, 23, 20, 22, 14]);
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

  it("refuses layouts it doesn't know", () => {
    const page = sixPage(TRANSCRIPT);
    const refused = (html: string) => verdict(() => readTranscript(html, IPK));
    expect(refused(page.split("<th>Nilai</th>").join("<th>Indeks</th>"))).toBe('VendorChanged: SIX transcript page: the course header reads " | Kode | Mata Kuliah | SKS | Indeks | Semester Kurikulum | Masuk Transkrip"');
    // A new column shifts every cell: refused rather than read as grades.
    expect(refused(page.split("<th>Nilai</th>").join("<th>Bobot</th><th>Nilai</th>"))).toMatch(/^VendorChanged: SIX transcript page: the course header has 8 columns/);
    expect(refused(page.replace(/(<td>FI1101<span[^>]*>-19<\/span><\/td><td>[^<]*<\/td><td>4<\/td><td>)\s*A\s*/, "$185.5"))).toBe('VendorChanged: SIX transcript page: grade "85.5" isn\'t a grade');
    expect(refused(page.replace("Semester 1 Tahun 2023/2024", "Semester Ganjil"))).toBe('VendorChanged: SIX transcript page: semester heading "Semester Ganjil" names no term');
    expect(refused(page.replace("NR 3.69", "NR 3,6"))).toMatch(/^VendorChanged: SIX transcript page: semester IP "3,6"/);
    expect(refused(page.replace('<i class="fa fa-check fa-fw text-success" aria-hidden="true"></i></td></tr>', "Ya</td></tr>"))).toMatch(/neither ✓ nor ✗/);
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
    // The same labels on a page that says it's Indonesian aren't the recorded layout.
    expect(verdict(() => readTranscript(inEnglish(page, labels, false), IPK))).toMatch(/^VendorChanged/);
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
    expect(byCode("MA1101")).toEqual({ code: "MA1101", curriculumYear: 2019, name: "Matematika IA", kind: "required", kindCode: "W", sks: 4, status: "graded", grade: "AB", term: "2023-1", note: null });
    expect(byCode("WI1103")).toMatchObject({ status: "exempt", grade: null, term: null, note: "Transfer" });
    expect(byCode("II4091")).toMatchObject({ status: "in-progress", grade: null, term: "2026-1" });
    expect(byCode("II4012")).toMatchObject({ kind: "program-elective", kindCode: "PD", grade: "C" });
    expect(byCode("FI1201")).toMatchObject({ kind: "outside-elective", kindCode: "PL" });
    expect(courses.filter((c) => c.status === "not-taken").map((c) => [c.code, c.kind, c.sks])).toEqual([
      ["II4090", "required", 2],
      ["II4092", "required", 4],
    ]);
    // SIX's "Jenis Mata Kuliah" totals are the rows taken (graded or in progress), exempt ones aside.
    const taken = (kind: string) => courses.filter((c) => c.kind === kind && (c.status === "graded" || c.status === "in-progress")).reduce((sum, c) => sum + c.sks, 0);
    expect([taken("required"), taken("program-elective"), taken("outside-elective")]).toEqual([108, 6, 25]);
  });

  it("a course passed under an older code already sits in the curriculum, so only truly missing courses are left", () => {
    const { progress } = readProgress(sixPage(PROGRESS));
    const firstSemester = progress.stages[0]!.semesters[0]!.courses;
    // The 2024 curriculum asks for KI1101 (Kimia Dasar I); SIX places the 2019 KI1002 there.
    expect(firstSemester.map((c) => `${c.code}-${c.curriculumYear}`)).toContain("KI1002-2019");
    expect(firstSemester.some((c) => c.code === "KI1101")).toBe(false);
  });

  it("refuses layouts it doesn't know", () => {
    const page = sixPage(PROGRESS);
    const refused = (html: string) => verdict(() => readProgress(html));
    expect(refused(page.replace("<th>Sifat</th>", "<th>Jenis</th>"))).toMatch(/^VendorChanged: SIX curriculum position page: the course header reads/);
    expect(refused(page.replace(/Tahap Sarjana\s*\(IP 3\.18 \/ SKS Lulus 107\)/, "Tahap Sarjana (3.18)"))).toBe('VendorChanged: SIX curriculum position page: stage "Tahap Sarjana (3.18)" isn\'t readable');
    expect(refused(page.replace('<span class="label label-danger" title="Belum diambil">', '<span class="label label-warning" title="Belum diambil">'))).toBe(
      'VendorChanged: SIX curriculum position page: course II4090 has an unknown status "Belum diambil"',
    );
    expect(refused(page.replace(/Lulus 125 SKS\s*\/\s*Nilai T 0 SKS/, "125 SKS"))).toBe('VendorChanged: SIX curriculum position page: SKS "125 SKS" isn\'t readable');
    expect(refused(page.replace(/<tr class="info"><th colspan="3">Semua[\s\S]*?<\/tr>/, ""))).toBe("VendorChanged: SIX curriculum position page: the overall total is missing");
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
    expect(structure.required.reduce((sum, c) => sum + c.sks, 0)).toBe(117);
    expect(structure.required.filter((c) => c.semester === 1).map((c) => c.code)).toEqual(["MA1101", "FI1101", "KI1101", "WI1101", "WI1102", "WI1103", "WI1111", "WI1116"]);
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
      { kind: "specialization", name: "Sistem Informasi Cerdas", program: "Sistem dan Teknologi Informasi", advisorApprovedOn: "2026-02-05", programApprovedOn: "2026-02-05", status: "On Progress" },
    ]);
  });

  it("refuses layouts it doesn't know", () => {
    expect(verdict(() => readCurriculumList(sixPage(LIST).replace("<th class=\"text-center\">SKS Lulus</th>", "<th class=\"text-center\">Beban</th>")))).toMatch(
      /^VendorChanged: SIX curriculum list page: the list header reads/,
    );
    const structure = sixPage(STRUCTURE);
    expect(verdict(() => readCurriculumStructure(structure.replace('id="katalog"', 'id="catalog"')))).toBe("VendorChanged: SIX curriculum structure page: the katalog tab is missing");
    expect(verdict(() => readCurriculumStructure(structure.replace(/(<a href="\/pub\/matakuliah\/47455">)\s*MA1101\s*</, "$1 Matematika <")))).toBe('VendorChanged: SIX curriculum structure page: "Matematika" isn\'t a course code');
    expect(verdict(() => readSchemes(sixPage(SCHEMES).replace(/<div class="panel-title">[^<]*<\/div>/g, "").replace(/tab=[a-z]+/g, "")))).toBe(
      "VendorChanged: SIX education scheme page: no scheme panels",
    );
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
      .replace("<tr><td colspan=\"5\"><em>Belum ada</em></td></tr>", "<tr><td>1</td><td>Pengantar</td><td>Ruang lingkup</td><td></td><td>Buku 1</td></tr>");
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
    expect(readKrs(six.page(KRS))).toMatchObject({ state: "sent", change: null, plan: { sentAt: wib("2026-08-16T10:45:42"), approvedAt: null, legalizedAt: null } });
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

  it("refuses layouts it doesn't know", () => {
    const page = sixPage(KRS);
    const refused = (html: string) => verdict(() => readKrs(html));
    expect(refused(page.replace("<th>Persetujuan Dosen Wali</th>", "<th>Persetujuan Wali</th>"))).toBe("VendorChanged: SIX KRS page: the plan round has no Persetujuan Dosen Wali row");
    // A row the app doesn't use is fine.
    expect(refused(page.replace("<tr class=\"success\"><th>Pembayaran UKT</th>", "<tr><th>Pengisian Kuesioner</th><td>Sudah</td></tr><tr class=\"success\"><th>Pembayaran UKT</th>"))).toMatchObject({ state: "official" });
    expect(refused(page.replace("18 Agu 2026 14.39.32", "18/08/2026 14:39"))).toBe('VendorChanged: SIX KRS page: Persetujuan Dosen Wali "18/08/2026 14:39" isn\'t a date');
    expect(refused(page.replace('<th class="text-center">Disetujui</th>', '<th class="text-center">Status</th>'))).toMatch(/^VendorChanged: SIX KRS page: the course header reads/);
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
      ['<th>Kode</th><th>Mata Kuliah</th><th class="text-center">Kelas</th><th class="text-center">SKS </th><th class="text-center">Disetujui</th>', "<th>Code</th><th>Course</th><th>Class</th><th>Credits</th><th>Approved</th>"],
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
    partly.editPage(BILLS, (html) => html.replace(/(2&nbsp;-&nbsp;Genap\s*<\/strong><\/td><td class="text-right">\s*10\.500\.000\s*<\/td><td class="text-right">\s*)10\.500\.000/, "$15.250.000"));
    expect(readBills(partly.page(BILLS)).find((b) => b.term === "2023-2")).toMatchObject({ status: "partly-paid", nextDueAt: wib("2024-03-24T23:59:59.999") });
  });

  it("refuses layouts it doesn't know", () => {
    const page = sixPage(BILLS);
    const refused = (html: string) => verdict(() => readBills(html));
    expect(refused(page.replace("<th class='text-right'>Pembayaran (Rp)</th>", "<th class='text-right'>Dibayar (Rp)</th>"))).toMatch(/^VendorChanged: SIX finance page: the bills header reads/);
    expect(refused(page.replace("24 Agu 2026", "2026-08-24"))).toBe('VendorChanged: SIX finance page: deadline of 2026-1 "2026-08-24" isn\'t a date');
    expect(refused(page.replace(/(<td class="text-right">\s*)5\.400\.000/, "$15.400.000,00"))).toBe('VendorChanged: SIX finance page: bill of 2025-1 "5.400.000,00" isn\'t an amount');
    expect(refused(page.replace("1&nbsp;-&nbsp;Ganjil", "Ganjil"))).toBe('VendorChanged: SIX finance page: term "Ganjil" isn\'t readable');
  });

  it("reads SIX's English page the same way", () => {
    const page = sixPage(BILLS);
    const english = inEnglish(page, [
      ["<th class='text-right'>Tagihan (Rp)</th><th class='text-right'>Pembayaran (Rp)</th><th class='text-left'>Batas Pembayaran</th><th class='text-center'>Petunjuk</th>", "<th class='text-right'>Bill (Rp)</th><th class='text-right'>Paid (Rp)</th><th class='text-left'>Due</th><th class='text-center'>Help</th>"],
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
      const others = exchanges("six").filter((e) => !own.test(e.path)).map((e) => bodyText("six", e.file));
      for (const html of [...others, login, ""]) expect(verdict(() => read(html))).toMatch(/^VendorChanged: /);
    }
  });
});
