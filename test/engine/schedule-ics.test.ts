// The phone calendar file (#77, user story 79): what it holds, that it's a
// valid calendar (the app's own reader parses it back to the same times),
// and that importing it again updates events instead of adding copies.
import { describe, expect, it } from "vitest";
import { writeIcs } from "../../src/core/ics";
import type { DatasetName, DatasetValue } from "../../src/core/models";
import { phoneCalendar, phoneItems } from "../../src/core/phone-calendar";
import { parseIcs } from "../../src/engine/sources/itb/ics";
import { aTask } from "../kit/tasks";

const wib = (iso: string) => Date.parse(`${iso}+07:00`);
const now = wib("2026-10-08T08:12:00");

/** Datasets as the engine holds them: SIX's timetable, a meeting announced only in Edunex, Tasks. */
function datasets(overrides: Partial<{ [N in DatasetName]: DatasetValue<N> }> = {}) {
  const values: Partial<{ [N in DatasetName]: DatasetValue<N> }> = {
    "six.schedule": [
      {
        id: "2194342",
        courseCode: "PL3002",
        courseName: "Ekonomi dan Inovasi dalam Perencanaan",
        start: wib("2026-10-08T08:00:00"),
        end: wib("2026-10-08T10:00:00"),
        activity: "Kuliah",
        room: "R.SG PWK LT.6",
      },
      {
        id: "2179909",
        courseCode: "DK4073",
        courseName: "Komunikasi Pemasaran",
        start: wib("2026-10-15T11:00:00"),
        end: wib("2026-10-15T12:59:00"),
        activity: "UTS",
        room: "TVST C",
      },
      {
        id: "2311195",
        courseCode: "II4091",
        courseName: "Proposal Tugas Akhir",
        start: wib("2026-10-16T15:00:00"),
        end: wib("2026-10-16T23:00:00"),
        activity: "Kuliah",
        room: null,
      },
    ],
    "six.scheduleMonths": ["2026-10", "2026-11"],
    "edunex.announcements": {
      II4091: [
        {
          id: 1,
          courseId: 95326,
          text: "Pertemuan 03: Jumat, 09 Oktober 2026 Pkl. 15:00 - 17:00 WIB (Online - Link meeting teams)",
          author: null,
          postedAt: wib("2026-10-01T10:00:00"),
        },
      ],
    },
    "edunex.tasks": [
      aTask({
        id: 117764,
        courseCode: "DK4073",
        courseId: 93409,
        title: "UTS Markom; bagian 1, esai",
        status: "not_started",
        kind: "uts",
        dueAt: wib("2026-10-22T23:50:00"),
      }),
      aTask({ id: 117001, courseCode: "II4091", courseId: 95326, title: "Tugas 01 Bab I", status: "submitted", dueAt: wib("2026-09-25T23:59:00") }),
    ],
    ...overrides,
  };
  return <N extends DatasetName>(name: N) => values[name] as DatasetValue<N> | undefined;
}

describe("the phone calendar file", () => {
  it("holds classes with rooms, exams, meetings outside SIX and deadlines, at their WIB times", () => {
    const { text, events } = phoneCalendar(datasets(), "id", now);
    expect(events).toBe(6);
    const read = parseIcs(text);
    expect(read.map((e) => [e.summary, new Date(e.start).toISOString(), new Date(e.end).toISOString()])).toEqual([
      ["Terkumpul II4091: Tugas 01 Bab I", "2026-09-25T16:29:00.000Z", "2026-09-25T16:59:00.000Z"],
      ["Kuliah PL3002 · Ekonomi dan Inovasi dalam Perencanaan", "2026-10-08T01:00:00.000Z", "2026-10-08T03:00:00.000Z"],
      ["Pertemuan 3 II4091 · II4091", "2026-10-09T08:00:00.000Z", "2026-10-09T10:00:00.000Z"],
      ["UTS DK4073 · Komunikasi Pemasaran", "2026-10-15T04:00:00.000Z", "2026-10-15T05:59:00.000Z"],
      ["Kuliah II4091 · Proposal Tugas Akhir", "2026-10-16T08:00:00.000Z", "2026-10-16T16:00:00.000Z"],
      ["Tenggat DK4073: UTS Markom; bagian 1, esai", "2026-10-22T16:20:00.000Z", "2026-10-22T16:50:00.000Z"],
    ]);
    expect(text).toContain("DTSTART;TZID=Asia/Jakarta:20261015T110000");
    expect(text).toContain("LOCATION:TVST C");
    expect(text).toContain("BEGIN:VTIMEZONE\r\nTZID:Asia/Jakarta");
    // Text is escaped, every line ends in CRLF.
    expect(text).toContain("SUMMARY:Tenggat DK4073: UTS Markom\\; bagian 1\\, esai");
    expect(text.split("\r\n").every((line) => !line.includes("\n"))).toBe(true);
  });

  it("every event ends after it starts: a deadline is a short event ending at the deadline", () => {
    const exams = { "edunex.exams": { PL3002: [{ id: "e1", courseId: 95001, title: "UTS Ekonomi Inovasi", start: wib("2026-10-20T10:00:00"), end: null }] } };
    const text = phoneCalendar(datasets(exams), "id", now).text;
    // Some phone calendars reject an event whose end isn't after its start.
    const stamps = (name: string) => [...text.matchAll(new RegExp(`^${name};TZID=Asia/Jakarta:(\\d{8}T\\d{6})`, "gm"))].map((m) => m[1]);
    const [starts, ends] = [stamps("DTSTART"), stamps("DTEND")];
    expect(starts).toHaveLength(7);
    starts.forEach((start, i) => {
      expect(ends[i] > start).toBe(true);
    });
    const due = parseIcs(text).find((e) => e.uid === "edunex-task-117764@edunex-plus")!;
    expect([new Date(due.start).toISOString(), new Date(due.end).toISOString()]).toEqual(["2026-10-22T16:20:00.000Z", "2026-10-22T16:50:00.000Z"]);
    expect(text).toContain("DTSTART;TZID=Asia/Jakarta:20261022T232000\r\nDTEND;TZID=Asia/Jakarta:20261022T235000");
    // Edunex's exam has a start and no end: a short event from its start.
    const exam = parseIcs(text).find((e) => e.uid === "edunex-exam-e1@edunex-plus")!;
    expect(exam.end - exam.start).toBe(30 * 60_000);
  });

  it("speaks English when the Student does", () => {
    const summaries = parseIcs(phoneCalendar(datasets(), "en", now).text).map((e) => e.summary);
    expect(summaries).toContain("Due DK4073: UTS Markom; bagian 1, esai");
    expect(summaries).toContain("Submitted II4091: Tugas 01 Bab I");
    expect(summaries).toContain("Meeting 3 II4091 · II4091");
  });

  it("names each exam in the Student's language", () => {
    const quizzes = {
      "six.schedule": [
        ...datasets()("six.schedule")!,
        {
          id: "2194370",
          courseCode: "PL3002",
          courseName: "Ekonomi dan Inovasi dalam Perencanaan",
          start: wib("2026-11-05T08:00:00"),
          end: wib("2026-11-05T09:00:00"),
          activity: "Kuis",
          room: "R.SG PWK LT.6",
        },
      ],
      "edunex.exams": { PL3002: [{ id: "e2", courseId: 95001, title: "Kuis 3 (daring)", start: wib("2026-11-12T19:00:00"), end: wib("2026-11-12T20:00:00") }] },
    };
    const summaries = (lang: "id" | "en") => parseIcs(phoneCalendar(datasets(quizzes), lang, now).text).map((e) => e.summary);
    expect(summaries("en")).toEqual(
      expect.arrayContaining(["Quiz PL3002 · Ekonomi dan Inovasi dalam Perencanaan", "Quiz PL3002 · Kuis 3 (daring)", "UTS DK4073 · Komunikasi Pemasaran"]),
    );
    expect(summaries("id")).toEqual(
      expect.arrayContaining(["Kuis PL3002 · Ekonomi dan Inovasi dalam Perencanaan", "Kuis PL3002 · Kuis 3 (daring)", "UTS DK4073 · Komunikasi Pemasaran"]),
    );
  });

  it("re-imported later: the same UIDs, a higher SEQUENCE, newer LAST-MODIFIED, and the moved class at its new time", () => {
    const first = phoneCalendar(datasets(), "id", now).text;
    const moved = datasets({
      "six.schedule": datasets()("six.schedule")!.map((s) =>
        s.id === "2194342" ? { ...s, start: wib("2026-10-08T09:00:00"), end: wib("2026-10-08T11:00:00"), room: "9009" } : s,
      ),
    });
    const second = phoneCalendar(moved, "id", now + 3_600_000).text;
    const uids = (text: string) =>
      parseIcs(text)
        .map((e) => e.uid)
        .sort();
    expect(uids(second)).toEqual(uids(first));
    expect(new Set(uids(first)).size).toBe(6);
    const field = (text: string, name: string) => [...text.matchAll(new RegExp(`^${name}:(.*)$`, "gm"))].map((m) => m[1].trim());
    expect(Number(field(second, "SEQUENCE")[0])).toBeGreaterThan(Number(field(first, "SEQUENCE")[0]));
    expect(field(second, "LAST-MODIFIED")[0] > field(first, "LAST-MODIFIED")[0]).toBe(true);
    const event = parseIcs(second).find((e) => e.uid === "six-2194342@edunex-plus")!;
    expect(new Date(event.start).toISOString()).toBe("2026-10-08T02:00:00.000Z");
    expect(second).toContain("LOCATION:9009");
  });
});

describe("what the Student puts on the phone", () => {
  const calendar = {
    checkedAt: 0,
    events: [
      {
        id: "uts-1",
        title: "Masa Ujian Tengah Semester I-2026/2027",
        kind: "uts" as const,
        term: "2026-1",
        start: wib("2026-10-12T00:00:00"),
        end: wib("2026-10-17T00:00:00"),
        allDay: true,
        firstDay: "2026-10-12",
        lastDay: "2026-10-16",
      },
      {
        id: "yud-1",
        title: "Yudisium ITB Bulan Oktober 2026",
        kind: "other" as const,
        term: null,
        start: wib("2026-10-20T00:00:00"),
        end: wib("2026-10-21T00:00:00"),
        allDay: true,
        firstDay: "2026-10-20",
        lastDay: "2026-10-20",
      },
      {
        id: "end-1",
        title: "Hari Terakhir Masa Kuliah Semester I-2026/2027",
        kind: "lecture-end" as const,
        term: "2026-1",
        start: wib("2026-12-04T00:00:00"),
        end: wib("2026-12-05T00:00:00"),
        allDay: true,
        firstDay: "2026-12-04",
        lastDay: "2026-12-04",
      },
    ],
  };

  it("ITB's exam weeks and the term's edges as whole days, never ITB's other news", () => {
    const text = phoneCalendar(datasets({ "itb.calendar": calendar }), "id", now).text;
    expect(text).toContain("DTSTART;VALUE=DATE:20261012\r\nDTEND;VALUE=DATE:20261017");
    const itb = parseIcs(text).filter((e) => e.uid.startsWith("itb-"));
    expect(itb.map((e) => [e.summary, e.allDay, new Date(e.start).toISOString(), new Date(e.end).toISOString()])).toEqual([
      ["Masa Ujian Tengah Semester I-2026/2027", true, "2026-10-11T17:00:00.000Z", "2026-10-16T17:00:00.000Z"],
      ["Hari Terakhir Masa Kuliah Semester I-2026/2027", true, "2026-12-03T17:00:00.000Z", "2026-12-04T17:00:00.000Z"],
    ]);
  });

  it("only the kinds chosen, from one day to another", () => {
    const get = datasets({ "itb.calendar": calendar });
    const summaries = (options: Parameters<typeof phoneCalendar>[3]) => parseIcs(phoneCalendar(get, "id", now, options).text).map((e) => e.summary);
    expect(summaries({ include: { classes: false, exams: false, itb: false } })).toEqual([
      "Terkumpul II4091: Tugas 01 Bab I",
      "Tenggat DK4073: UTS Markom; bagian 1, esai",
    ]);
    expect(summaries({ include: { deadlines: false, itb: false }, from: "2026-10-09", until: "2026-10-15" })).toEqual([
      "Pertemuan 3 II4091 · II4091",
      "UTS DK4073 · Komunikasi Pemasaran",
    ]);
    // A whole-day event still running on the first day goes in.
    expect(summaries({ include: { classes: false, exams: false, deadlines: false }, from: "2026-10-14", until: "2026-10-31" })).toEqual([
      "Masa Ujian Tengah Semester I-2026/2027",
    ]);
  });

  it("a roomless SIX meeting that Edunex counts by a handed-in Task goes in as the window to hand it in, never an 8-hour class", () => {
    const presence = {
      II4091: [
        {
          id: 2243740,
          courseId: 95326,
          classId: 87103,
          start: wib("2026-10-16T15:00:00"),
          end: wib("2026-10-16T23:59:00"),
          opensAt: wib("2026-10-16T15:00:00"),
          closesAt: wib("2026-10-16T23:59:00"),
          topic: "Tugas",
          note: "Presensi dengan submit Tugas 02 Bab II",
          countsBy: [{ kind: "assignment", id: "117003" }],
          url: null,
          recorded: null,
        },
      ],
    };
    const tasks = [
      ...datasets()("edunex.tasks")!,
      aTask({ id: 117003, courseCode: "II4091", courseId: 95326, title: "Tugas 02 Bab II", status: "not_started", dueAt: wib("2026-10-16T23:59:00") }),
    ];
    const text = phoneCalendar(datasets({ "edunex.presence": presence, "edunex.tasks": tasks }), "id", now).text;
    const event = parseIcs(text).find((e) => e.uid === "six-2311195@edunex-plus")!;
    expect(event.summary).toBe("Presensi II4091: kumpulkan Tugas 02 Bab II");
    expect([new Date(event.start).toISOString(), new Date(event.end).toISOString()]).toEqual(["2026-10-16T08:00:00.000Z", "2026-10-16T16:59:00.000Z"]);
    const block = text.slice(text.indexOf("UID:six-2311195"), text.indexOf("END:VEVENT", text.indexOf("UID:six-2311195")));
    expect(block).toContain("TRANSP:TRANSPARENT");
  });

  it("counts by kind, the way the export dialog shows them", () => {
    const items = phoneItems(datasets({ "itb.calendar": calendar }), "id", now, { from: "2026-10-08" });
    const count = (kind: string) => items.filter((i) => i.kind === kind).length;
    expect([count("classes"), count("exams"), count("deadlines"), count("itb")]).toEqual([3, 1, 1, 2]);
  });
});

describe("a meeting announced in Edunex text, moved by the lecturer", () => {
  const announcement = (id: number, text: string, postedAt: string) => ({ id, courseId: 95326, text, author: null, postedAt: wib(postedAt) });
  const nine = announcement(1, "Pertemuan 03: Jumat, 09 Oktober 2026 Pkl. 15:00 - 17:00 WIB (Online - Link meeting teams)", "2026-10-01T10:00:00");
  const ten = "Pertemuan 03: Sabtu, 10 Oktober 2026 Pkl. 09:00 - 11:00 WIB (Online - Link meeting teams)";
  const meetings = (text: string) => parseIcs(text).filter((e) => e.summary.startsWith("Pertemuan 3 "));

  it("re-imported: the same event moves, whether the text was corrected in place or posted again", () => {
    const first = meetings(phoneCalendar(datasets({ "edunex.announcements": { II4091: [nine] } }), "id", now).text);
    expect(first).toHaveLength(1);

    const corrected = meetings(phoneCalendar(datasets({ "edunex.announcements": { II4091: [{ ...nine, text: ten }] } }), "id", now + 3_600_000).text);
    expect(corrected.map((e) => [e.uid, new Date(e.start).toISOString()])).toEqual([[first[0].uid, "2026-10-10T02:00:00.000Z"]]);

    // The new time in a later announcement, the old text still up: the latest text speaks for meeting 3.
    const reposted = { II4091: [nine, announcement(2, ten, "2026-10-05T10:00:00")] };
    const again = meetings(phoneCalendar(datasets({ "edunex.announcements": reposted }), "id", now + 7_200_000).text);
    expect(again.map((e) => [e.uid, new Date(e.start).toISOString()])).toEqual([[first[0].uid, "2026-10-10T02:00:00.000Z"]]);
  });
});

describe("writing iCalendar", () => {
  it("folds long lines at 75 octets without splitting a character, and reads back whole", () => {
    const summary = `Pertemuan ${"é".repeat(60)} — ${"x".repeat(40)}`;
    const text = writeIcs([{ uid: "u1", summary, start: now, end: now + 3_600_000, description: "baris satu\nbaris dua" }], { name: "Edunex Plus", now });
    for (const line of text.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    const [event] = parseIcs(text);
    expect(event.summary).toBe(summary);
    expect(event.start).toBe(now);
  });

  it("never writes an event that ends when it starts", () => {
    const [event] = parseIcs(writeIcs([{ uid: "u1", summary: "Tenggat", start: now, end: now }], { name: "Edunex Plus", now }));
    expect(event.end - event.start).toBe(30 * 60_000);
  });

  it("an empty calendar is still a calendar", () => {
    expect(parseIcs(writeIcs([], { name: "Edunex Plus", now }))).toEqual([]);
  });
});
