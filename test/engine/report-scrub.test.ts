// What a report about a page the app couldn't read carries (src/engine/report): the page as SIX or
// Edunex sent it, scrubbed on the Student's computer. Two things make it worth sending: none of the
// Student's details are in it (the privacy rules that guard the committed test data hold it too),
// and the scrubbed page still fails the very check the real one did, so the maintainer can drop it
// into test/fixtures and see the same problem.
//
// The "real" pages here are the recorded ones with a made-up Student put back in, with details the
// recordings never had (a phone number, an email, a session token). The values that look real are
// joined at run time, so the repository's own privacy test doesn't take this file for a leak.
import { describe, expect, it } from "vitest";
import type { DatasetName, DatasetValue, ProblemReport, SixStudent } from "../../src/core/models";
import { isEngineError } from "../../src/engine/errors";
import type { Kept } from "../../src/engine/report/kept-pages";
import { buildReport } from "../../src/engine/report/report";
import { Replacements, scrubRecordText, scrubSixRecords } from "../../src/engine/report/scrub";
import { LoginMe } from "../../src/engine/sources/edunex/schemas";
import { readBills } from "../../src/engine/sources/six/readers/bills";
import { readKrs } from "../../src/engine/sources/six/readers/krs";
import { readProgress } from "../../src/engine/sources/six/readers/progress";
import { readTranscript } from "../../src/engine/sources/six/readers/transcript";
import { readStatusPage } from "../../src/engine/sources/six/status";
import { readTimetable } from "../../src/engine/sources/six/timetable";
import { Skipped } from "../../src/engine/sources/skipped";
import { edunexJson, sixPage } from "../kit/fixtures";
import { personalHits } from "../kit/privacy-rules";

const REAL = {
  name: "Rahmat Hidayatullah",
  nim: ["135", "22045"].join(""),
  sixId: "2023456789",
  advisor: "Siti Rahmawati",
  email: ["rahmat.hidayat", "gmail.com"].join("@"),
  phone: ["0812", "34567890"].join(""),
  token: ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiJyYWhtYXQifQ", "c2lnbmF0dXJl"].join("."),
  form: "f3c9a1d07be24e55a9c1",
};
const FAKE = { nim: "18223901", sixId: "2021000001" };

/** A recorded SIX page as this Student's SIX would send it. */
function real(html: string): string {
  return html
    .split("Dimas Pratama")
    .join(REAL.name)
    .split("18223901")
    .join(REAL.nim)
    .split("2021000001")
    .join(REAL.sixId)
    .split("Wahyu Wijaya")
    .join(REAL.advisor)
    .replace("<strong>Rencana studi Anda telah disetujui</strong>", `<strong>Hubungi ${REAL.email} atau ${REAL.phone}</strong>`)
    .replace("</head>", `<meta name="csrf-token" content="${REAL.form}"></head>`)
    .replace("</body>", `<script>var session = "${REAL.token}";</script></body>`);
}

/** What the app knows of this Student when the report is made (nothing, on a first sign-in that failed). */
const KNOWN: Partial<{ [N in DatasetName]: DatasetValue<N> }> = {
  "six.student": { nim: REAL.nim, name: REAL.name, studentId: REAL.sixId, term: "2026-1", program: null, programCode: null } satisfies SixStudent,
};

function report(kept: Omit<Kept, "at" | "datasets">, known = KNOWN): ProblemReport {
  return buildReport({
    kept: [{ ...kept, datasets: [], at: 0 }],
    about: {},
    get: (name) => known[name] as never,
    statuses: [],
    version: "2.0.0-test",
    now: 0,
    seed: 7,
  });
}

/** Everything the report carries that looks real, or that is this Student's. */
function leaks(sent: ProblemReport): string[] {
  const text = JSON.stringify(sent);
  const values = [REAL.name, REAL.name.toUpperCase(), REAL.nim, REAL.sixId, REAL.advisor, REAL.email, REAL.phone, REAL.token, REAL.form];
  return [...personalHits(text), ...values.filter((value) => text.includes(value)).map((value) => `this Student's: ${value.slice(0, 4)}…`)];
}

type Outcome = { check: string } | { rows: { row: string; why: string }[] };

/** What a reader makes of a page: the check it fails, or the rows it leaves out. */
function outcome(read: (html: string, skipped: Skipped, nim: string) => unknown, html: string, nim: string): Outcome {
  const skipped = new Skipped();
  try {
    read(html, skipped, nim);
  } catch (error) {
    if (isEngineError(error, "VendorChanged")) return { check: error.message };
    throw error;
  }
  // A report carries each row as SIX shows it and what didn't fit.
  return { rows: skipped.rows.map(({ row, why }) => ({ row, why })) };
}

const STATUS = "/app/mahasiswa:18223901/statusmhs";
/** The recorded page at exactly this path. */
const pageOf = (path: string) => sixPage(path);
const historis = /\/transkrip\/historis\/\d+$/;

const SIX_CASES: {
  what: string;
  path: string;
  drift: (html: string) => string;
  read: (html: string, skipped: Skipped, nim: string) => unknown;
}[] = [
  {
    what: "the fees page's header changes",
    path: "/app/mahasiswa:18223901/keuangan",
    drift: (html) => html.replace("<th class='text-left'>Semester</th>", "<th>Periode</th>"),
    read: (html, skipped) => readBills(html, skipped),
  },
  {
    what: "the fees page lists a row that isn't a term's bill, with its amounts",
    path: "/app/mahasiswa:18223901/keuangan",
    drift: (html) => html.replace("1&nbsp;-&nbsp;Ganjil", "Uang Pangkal"),
    read: (html, skipped) => readBills(html, skipped),
  },
  {
    what: "the transcript's header changes",
    path: "/app/mahasiswa:18223901/statusmhs/transkrip/historis/2021000001",
    drift: (html) => html.split("<th>Kode</th>").join("<th>Kode MK</th>"),
    read: (html, skipped) => readTranscript(html, { value: null, sks: null }, skipped),
  },
  {
    what: "the transcript writes a grade another way",
    path: "/app/mahasiswa:18223901/statusmhs/transkrip/historis/2021000001",
    drift: (html) => html.replace(/(<td>II1101<span[\s\S]*?<\/td><td>[^<]*<\/td><td>2<\/td><td>\s*)A(\s*<\/td>)/, "$1A+$2"),
    read: (html, skipped) => readTranscript(html, { value: null, sks: null }, skipped),
  },
  {
    what: "the progress page writes the IPK another way",
    path: "/app/mahasiswa:18223901/statusmhs/transkrip/kurikulum/2021000001",
    drift: (html) => html.replace('<span title="dari 125 SKS">3.26</span>', '<span title="dari 125 SKS">3,265</span>'),
    read: (html, skipped) => readProgress(html, skipped),
  },
  {
    what: "the KRS's course header changes",
    path: "/app/mahasiswa:18223901+2026-1/registrasi/rencanastudi/2021000001",
    drift: (html) => html.replace("<th>Kode</th>", "<th>Kode MK</th>"),
    read: (html, skipped) => readKrs(html, skipped),
  },
  {
    what: "the status page writes a course code another way",
    path: STATUS,
    drift: (html) => html.replace("<td>PL3002</td>", "<td>PL-3002</td>"),
    // The status page's reader returns the rows it left out.
    read: (html, skipped, nim) => skipped.rows.push(...readStatusPage(html, nim).skipped),
  },
  {
    what: "the status page loses its term",
    path: STATUS,
    drift: (html) => html.replace("Daftar Kuliah Semester 1-2026/2027", "Daftar Kuliah"),
    read: (html, skipped, nim) => skipped.rows.push(...readStatusPage(html, nim).skipped),
  },
  {
    what: "the timetable's meetings lose their address",
    path: "/app/mahasiswa:18223901+2026-1/kelas/jadwal/mahasiswa/2021000001",
    drift: (html) => html.split('data-url="').join('data-href="'),
    read: (html) => readTimetable(html, "202610"),
  },
];

describe("a report about a SIX page", () => {
  it.each(SIX_CASES)("$what: none of the Student's details, and the scrubbed page fails the same check", ({ path, drift, read }) => {
    const html = drift(real(pageOf(path)));
    const before = outcome(read, html, REAL.nim);
    const kept =
      "check" in before
        ? { feed: "six.page", kind: "changed" as const, check: before.check, rows: [] }
        : { feed: "six.page", kind: "skipped" as const, check: before.rows[0]!.why, rows: before.rows };
    expect("check" in before || before.rows.length > 0).toBe(true);

    for (const known of [KNOWN, {}]) {
      const sent = report(
        {
          ...kept,
          pages: [{ url: `https://six.itb.ac.id${path.split("18223901").join(REAL.nim).split("2021000001").join(REAL.sixId)}`, status: 200, body: html }],
        },
        known,
      );
      expect(leaks(sent)).toEqual([]);
      const [problem] = sent.problems;
      expect(problem!.pages[0]!.path).toBe(path);
      const after = outcome(read, problem!.pages[0]!.body, FAKE.nim);
      expect(after).toEqual("check" in before ? { check: problem!.check } : { rows: problem!.rows });
    }
  });

  it("keeps what the page is made of and makes up the Student's records: grades, amounts, IPK, the advisor's chat, their age", () => {
    const pages = [historis, /\/keuangan$/, /\/transkrip\/kurikulum\/\d+$/, /\/registrasi\/rencanastudi\/\d+$/].map((path) => real(sixPage(path)));
    const sent = report({
      feed: "six.page",
      kind: "changed",
      check: "",
      rows: [],
      pages: pages.map((body, i) => ({ url: `https://six.itb.ac.id/p${i}`, status: 200, body })),
    });
    expect(leaks(sent)).toEqual([]);
    const [transcript, bills, progress, krs] = sent.problems[0]!.pages.map((page) => page.body);

    // The same courses, with made-up grades, and the transcript still reads.
    const grades = (html: string) => readTranscript(html, { value: null, sks: null }).terms.flatMap((term) => term.courses.map((c) => `${c.code} ${c.grade}`));
    expect(grades(transcript!).map((g) => g.split(" ")[0])).toEqual(grades(pages[0]!).map((g) => g.split(" ")[0]));
    expect(grades(transcript!)).not.toEqual(grades(pages[0]!));
    // Every bill, with made-up amounts that still agree with what was paid.
    const before = readBills(pages[1]!);
    const after = readBills(bills!);
    expect(after.map((bill) => [bill.term, bill.status])).toEqual(before.map((bill) => [bill.term, bill.status]));
    expect(after.map((bill) => bill.amount)).not.toEqual(before.map((bill) => bill.amount));
    expect(readProgress(progress!).progress.ipk).not.toBe(readProgress(pages[2]!).progress.ipk);
    // The chat keeps who wrote when, not what.
    expect(krs).toContain("Pesan.");
    expect(krs).toContain("&mdash;&nbsp;25&nbsp;Agu&nbsp;2023&nbsp;10.03.23");
    expect(transcript).not.toContain("21 tahun");
    // The page itself: SIX's labels, terms and courses are all there.
    for (const kept of ["Tagihan (Rp)", "Tahun 2023 / 2024", "Batas Pembayaran"]) expect(bills).toContain(kept);
    for (const kept of ["Komputasi dan Masyarakat", "Semester Kurikulum", 'class="small text-muted"']) expect(transcript).toContain(kept);
  });
});

describe("a report about an Edunex answer", () => {
  it("its people's details are gone, and it fails the same check", () => {
    const me = {
      ...edunexJson<Record<string, unknown>>("/login/me"),
      name: REAL.name,
      username: REAL.nim,
      // What the app doesn't expect: the NIM as a number.
      code: Number(REAL.nim),
      email: REAL.email,
      phone_number: REAL.phone,
      address: "Jl. Tamansari No. 73, Bandung",
      place_of_birth: "Pematangsiantar",
      thumbnail: "https://cdn-edunex.itb.ac.id/avatar/rahmat-hidayatullah.jpg",
    };
    const check = (body: unknown) => {
      const parsed = LoginMe.safeParse(body);
      const issue = parsed.success ? null : parsed.error.issues[0]!;
      return issue && `/login/me: ${issue.path.join(".")} ${issue.message}`;
    };
    const before = check(me)!;
    const sent = report({
      feed: "edunex.account",
      kind: "changed",
      check: before,
      rows: [],
      pages: [{ url: "https://api-edunex.cognisia.id/login/me", status: 200, body: JSON.stringify(me) }],
    });
    expect(leaks(sent)).toEqual([]);
    const body = sent.problems[0]!.pages[0]!.body;
    for (const gone of ["Tamansari", "Pematangsiantar", "rahmat-hidayatullah"]) expect(body).not.toContain(gone);
    expect(check(JSON.parse(body))).toBe(sent.problems[0]!.check);
    expect(sent.problems[0]!.check).toBe(before);
  });

  it("a gradebook's scores and grades are made up", () => {
    const gradebook = {
      grades: [],
      students: [{ ...edunexJson<{ students: object[] }>("/gradebook", { course_id: "92948", class_id: "84725" }).students[0], total: 87.5, index: "AB" }],
    };
    const sent = report({
      feed: "edunex.outline",
      kind: "changed",
      check: "",
      rows: [],
      pages: [{ url: "https://api-edunex.cognisia.id/gradebook", status: 200, body: JSON.stringify(gradebook) }],
    });
    const student = JSON.parse(sent.problems[0]!.pages[0]!.body).students[0];
    expect(typeof student.total).toBe("number");
    expect(student.total).not.toBe(87.5);
    expect(student.index).toMatch(/^(A|AB|B|BC|C)$/);
  });
});

describe("text from a page is only ever text to find, never a pattern", () => {
  it("a known value with a pattern's characters in it is replaced where it's written, and nowhere else", () => {
    const known = new Replacements();
    known.add("(B)", "[b]");
    known.add("C.*", "[c]");
    known.add("A+B", "[ab]");
    known.add("1.5", "[n]");
    // Read as patterns, "C.*" would take "CXY", "A+B" would take "AAB" and "1.5" would take "105".
    expect(known.apply("(B) B (B)x C.* CXY C.*Z zA+B A+B AAB 1.5 105 21.5")).toBe("[b] B [b]x [c] CXY [c]Z zA+B [ab] AAB [n] 105 21.5");
  });

  it("a grade cell that isn't a letter grade stays as SIX wrote it; one that is gets the made-up grade, in its text only", () => {
    const rules = { grade: () => "BC", amountFactor: 1 };
    const row = (cell: string) => `<tr><td>II2230</td><td>${cell}</td></tr>`;
    for (const odd of ["A+", "(B)", "C.*", "A.", "[A]"]) expect(scrubSixRecords(row(odd), rules)).toBe(row(odd));
    expect(scrubSixRecords(row(" A "), rules)).toBe(row(" BC "));
    expect(scrubSixRecords(row("&nbsp;AB"), rules)).toBe(row("&nbsp;BC"));
    expect(scrubSixRecords(row('<span title="A">A</span>'), rules)).toBe(row('<span title="A">BC</span>'));
    expect(scrubRecordText("II2230 · Algoritma · 3 · A+ · 5", rules)).toBe("II2230 · Algoritma · 3 · A+ · 5");
    expect(scrubRecordText("II2230 · Algoritma · 3 · A · 5", rules)).toBe("II2230 · Algoritma · 3 · BC · 5");
  });
});
