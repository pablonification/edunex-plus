// PROTOTYPE (#83) — throwaway. Builds the design prototype's data from the
// git-ignored session recordings in .scratch/recordings. The output contains
// a real Student's data and goes to .scratch/prototype/ (git-ignored too).
// Never commit the output.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../../..");
const recordingsDir = path.join(root, ".scratch", "recordings");
const outFile = path.join(root, ".scratch", "prototype", "design-data.json");

if (!fs.existsSync(recordingsDir)) {
  console.error("No recordings found. Run `npm run record` first (see scripts/record-session.cjs).");
  process.exit(1);
}

const rows = [];
for (const dir of fs.readdirSync(recordingsDir).sort()) {
  const index = path.join(recordingsDir, dir, "index.jsonl");
  if (!fs.existsSync(index)) continue;
  for (const line of fs.readFileSync(index, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    if (row.bodyFile && row.status === 200) rows.push({ ...row, file: path.join(recordingsDir, dir, row.bodyFile) });
  }
}

const readJson = (row) => JSON.parse(fs.readFileSync(row.file, "utf8"));
const readHtml = (row) => fs.readFileSync(row.file, "utf8");
const edunex = (pattern) => rows.filter((row) => row.host === "api-edunex.cognisia.id" && pattern.test(row.path));
const six = (pattern) => rows.filter((row) => row.host === "six.itb.ac.id" && pattern.test(row.path));
const last = (list) => list[list.length - 1];
const strip = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
const tableRows = (html) =>
  [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) =>
    [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => strip(c[1])),
  );
const wib = (date, time) => `${date}T${time}:00+07:00`;
const vendorTime = (value) => {
  if (!value) return null;
  if (/[+-]\d{2}:\d{2}$|Z$/.test(value)) return value;
  return `${value.replace(" ", "T")}+07:00`; // EduNex omits the zone on some fields; it is WIB.
};

// ---- Student
const me = readJson(last(edunex(/^\/login\/me$/)));
const statusPage = readHtml(last(six(/\/statusmhs$/)));
const identity = Object.fromEntries(tableRows(statusPage.slice(0, statusPage.indexOf("</table>"))).filter((r) => r.length === 2));
const fullName = identity.Nama ?? me.name ?? "Student";
const termHeading = /Daftar Kuliah Semester ([^<]+)/.exec(statusPage)?.[1]?.trim() ?? "";

// ---- Courses: SIX is the source of truth, EduNex adds ids and lecturers
const COLORS = ["#2F7CF6", "#7C5CFC", "#1FA971", "#F2884B", "#E0559A", "#14A3B8", "#D7A20F", "#E5484D"];
const courseSection = statusPage.slice(statusPage.indexOf("Daftar Kuliah"));
const courseTable = courseSection.slice(0, courseSection.indexOf("</table>"));
// The Kehadiran cell carries the exact count in a tooltip: "Hadir 4 dari 6 pertemuan".
const attendanceCounts = new Map(
  [...courseTable.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
    .map((m) => [/([A-Z]{2}\d{4})/.exec(m[1])?.[1], /title="Hadir (\d+) dari (\d+) pertemuan"/.exec(m[1])])
    .filter(([code, count]) => code && count)
    .map(([code, count]) => [code, { attended: Number(count[1]), held: Number(count[2]) }]),
);
const sixCourses = tableRows(courseTable)
  .map((cells) => cells.filter((c) => c !== ""))
  .map((cells) => {
    const at = cells.findIndex((c) => /^[A-Z]{2}\d{4}$/.test(c));
    if (at < 0) return null;
    const [code, name, classNo, sks, attendance] = cells.slice(at);
    const count = attendanceCounts.get(code);
    return {
      code,
      name,
      classNo,
      sks: Number(sks) || null,
      attendancePct: attendance ? Number.parseFloat(attendance) : null,
      attended: count?.attended ?? null,
      held: count?.held ?? null,
    };
  })
  .filter(Boolean);
const pairs = readJson(last(edunex(/^\/course\/presences\/list$/)));
const courseDetail = new Map();
for (const row of edunex(/^\/course\/courses\/\d+$/)) {
  const body = readJson(row);
  const attrs = body?.data?.attributes;
  if (attrs) courseDetail.set(Number(body.data.id), attrs);
}
const lecturerName = (attrs) => {
  const value = attrs?.lecturer;
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.name ?? value.user?.name ?? null;
};
const courses = sixCourses.map((course, index) => {
  const pair = pairs.find((p) => p.course_code === course.code);
  const attrs = pair ? courseDetail.get(pair.course_id) : null;
  return {
    ...course,
    color: COLORS[index % COLORS.length],
    lecturer: lecturerName(attrs),
    edunexId: pair?.course_id ?? null,
    edunexClassId: pair?.class_id ?? null,
    // EduNex's gradebook page shows "0.00 · E" until the lecturer publishes it.
    gradebookPublished: Boolean(attrs?.gradebook_publish),
  };
});
const courseByCode = new Map(courses.map((c) => [c.code, c]));
const codeByEdunexId = new Map(pairs.map((p) => [p.course_id, p.course_code]));

// ---- Class sessions from the SIX month calendar
const calendarRow = last(six(/kelas\/jadwal\/mahasiswa$/));
const calendar = readHtml(calendarRow);
const termYear = Number(/\+(\d{4})-\d/.exec(calendarRow.path)?.[1] ?? "2026");
const MONTHS = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
let month = null;
const sessions = [];
for (const cell of [...calendar.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1])) {
  const head = /<div class="">\s*(\d{1,2})\s*(?:<span class="text-muted">\s*([A-Za-z]+)\s*<\/span>)?/.exec(cell);
  if (!head) continue;
  if (head[2]) month = MONTHS.indexOf(head[2].toLowerCase());
  if (month === null || month < 0) continue;
  const year = month >= 7 ? termYear : termYear + 1;
  const date = `${year}-${String(month + 1).padStart(2, "0")}-${head[1].padStart(2, "0")}`;
  for (const s of cell.matchAll(/<div title="([^"]*)">\s*<a class="linkpertemuan"[^>]*data-kuliah="([A-Z]{2}\d{4}) ([^"]*)"[^>]*data-url="[^"]*\/pertemuan\/(\d+)\/[^"]*"[^>]*>\s*<small>\s*(\d{2}:\d{2})-(\d{2}:\d{2})[\s\S]*?\(([^)]*)\)\s*<\/small>/g)) {
    const activity = /\(([^)]*)\)\s*$/.exec(s[1])?.[1] ?? "Kuliah";
    const where = s[7].startsWith(activity) ? s[7].slice(activity.length).trim() : s[7];
    sessions.push({
      id: s[4],
      courseCode: s[2],
      courseName: s[3],
      start: wib(date, s[5]),
      end: wib(date, s[6]),
      activity,
      room: where,
    });
  }
}
sessions.sort((a, b) => a.start.localeCompare(b.start));

// ---- Presence windows (EduNex)
const presenceById = new Map();
for (const row of edunex(/^\/course\/presences$/)) {
  for (const item of readJson(row).data ?? []) {
    const a = item.attributes;
    const code = codeByEdunexId.get(a.course_id) ?? "";
    presenceById.set(item.id, {
      id: String(item.id),
      courseCode: code,
      courseName: courseByCode.get(code)?.name ?? "",
      classStart: vendorTime(a.start_at),
      classEnd: vendorTime(a.end_at),
      opensAt: vendorTime(a.presence_start),
      closesAt: vendorTime(a.presence_end),
      topic: a.topic ?? "",
      myStatus: a.attandance?.status === 1 ? "attended" : null,
      // Some lecturers grant attendance for handing in a Task inside the window
      // ("Presensi dengan submit Tugas 02 Bab II"); EduNex links it via `presentable`.
      note: a.note ?? null,
      taskId: (a.presentable ?? []).find((x) => x.presentable === "assignment")?.presentable_id ?? null,
      // What EduNex counts as presence (its presence_categories): course (view the course material,
      // the default), module, thread, assignment, exam, vicon, crs_*.
      trigger: (a.presentable ?? [])[0]?.presentable ?? "course",
      url: a.url ?? null,
    });
  }
}
const presence = [...presenceById.values()].sort((a, b) => a.opensAt.localeCompare(b.opensAt));

// ---- Modules: EduNex's course outline (its "Table of Content")
const moduleById = new Map();
for (const row of edunex(/^\/course\/courses\/\d+$/)) {
  const body = readJson(row);
  const code = codeByEdunexId.get(Number(body?.data?.id)) ?? body?.data?.attributes?.code;
  for (const inc of body?.included ?? []) {
    if (inc.type !== "modules") continue;
    const a = inc.attributes;
    moduleById.set(String(inc.id), {
      id: String(inc.id),
      courseCode: code,
      index: Number(a.index) || 0,
      title: a.name,
      opensAt: vendorTime(a.start_at),
      closesAt: vendorTime(a.end_at),
      // Course templates ship 16 weekly modules; lecturers switch off the ones they don't use.
      active: a.is_active === undefined ? true : Boolean(a.is_active),
    });
  }
}
const modules = [...moduleById.values()].sort(
  (a, b) => a.courseCode.localeCompare(b.courseCode) || a.index - b.index,
);

// ---- Demo "now": just after the most recent Presence window opened, so the
// prototype shows a real open window. Falls back to the recording time.
const recordedAt = new Date(last(rows).at);
const lastOpened = presence.filter((p) => new Date(p.opensAt) <= recordedAt).pop();
const now = lastOpened
  ? new Date(new Date(lastOpened.opensAt).getTime() + 12 * 60_000).toISOString()
  : recordedAt.toISOString();

// ---- Tasks with the Student's answers (EduNex)
const taskById = new Map();
for (const row of edunex(/^\/course\/tasks$/)) {
  for (const item of readJson(row).data ?? []) {
    const a = item.attributes;
    const answer = (a.answers ?? [])[0] ?? null;
    const dueAt = vendorTime(a.end_at);
    const pastDue = dueAt ? new Date(dueAt) < new Date(now) : false;
    let status = "not_started";
    if (answer?.is_sent === 1) status = "submitted";
    else if (answer) status = "draft";
    else if (pastDue) status = a.is_lateable ? "overdue" : "closed";
    taskById.set(item.id, {
      id: String(item.id),
      courseCode: a.course_code,
      courseName: a.course_name,
      title: a.name,
      moduleId: a.taskable_type === "modules" ? String(a.taskable_id) : null,
      instructionsHtml: a.description ?? "",
      files: (a.files ?? []).map((f) => ({ name: f.name })),
      opensAt: vendorTime(a.start_at),
      dueAt,
      fileRequired: Boolean(a.file_required),
      lateAllowed: Boolean(a.is_lateable),
      status,
      score: answer && a.show_score ? answer.score : null,
      answerFiles: (answer?.files ?? []).map((f) => ({ name: f.name })),
      submittedAt: answer?.is_sent === 1 ? vendorTime(answer.sent_at) : null,
      domain: a.domain ?? null,
      draftStartedAt: answer ? vendorTime(answer.created_at) : null,
      createdAt: vendorTime(a.created_at),
      // EduNex shows "Updated by … at …" on the task page but never announces the edit.
      editedAt:
        a.updated_at && a.created_at && new Date(vendorTime(a.updated_at)) - new Date(vendorTime(a.created_at)) > 3_600_000
          ? vendorTime(a.updated_at)
          : null,
    });
  }
}
const tasks = [...taskById.values()].sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));

// ---- Materials (EduNex course contents)
const MEETING = new Set(["ms-teams", "zoom", "google-meet", "cloudx", "webex"]);
const materialById = new Map();
for (const row of edunex(/^\/course\/contents\/?$/)) {
  for (const item of readJson(row).data ?? []) {
    const a = item.attributes;
    const kind = a.type === "pdf" ? "pdf" : MEETING.has(a.type) ? "meeting" : a.type === "text" ? "note" : "other";
    materialById.set(item.id, {
      id: String(item.id),
      courseCode: a.course_code,
      title: a.name,
      moduleId: String(a.contentable_type ?? "").includes("Modules") ? String(a.contentable_id) : null,
      kind,
      provider: MEETING.has(a.type) ? a.type : null,
      url: kind === "pdf" || kind === "meeting" ? a.content : null,
      sizeBytes: a.size ? Number(a.size) : null,
      html: kind === "note" ? a.content : null,
      createdAt: vendorTime(a.created_at),
      updatedAt: vendorTime(a.updated_at),
    });
  }
}
// EduNex's Vicon feed also returns links from past terms (e.g. last semester's WI2022); keep this term's courses.
const materials = [...materialById.values()]
  .filter((m) => courseByCode.has(m.courseCode))
  .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));

// ---- Meetings announced only in EduNex text ("Pertemuan 03: Jumat, 09 Oktober 2026
// Pkl. 15:00 - 17:00 WIB (Online - Link meeting teams)"), often only in the
// parent class. SIX's timetable doesn't carry them.
const ID_MONTH_NUMBER = { januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6, juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12 };
const announcedByStart = new Map();
for (const m of materials.filter((x) => x.kind === "note")) {
  const text = strip(m.html ?? "");
  for (const hit of text.matchAll(/Pertemuan (\d+)[,:]?\s*\w+,\s*(\d{1,2}) (\w+) (\d{4})\s*Pkl\.?\s*(\d{1,2})[.:](\d{2})\s*-\s*(\d{1,2})[.:](\d{2})\s*WIB\s*(?:\(([^)]*)\))?/gi)) {
    const month = ID_MONTH_NUMBER[hit[3].toLowerCase()];
    if (!month) continue;
    const day = `${hit[4]}-${String(month).padStart(2, "0")}-${hit[2].padStart(2, "0")}`;
    const start = wib(day, `${hit[5].padStart(2, "0")}:${hit[6]}`);
    const link = materials.find((x) => x.kind === "meeting" && x.courseCode === m.courseCode && new RegExp(`Pertemuan 0?${Number(hit[1])}\\b`).test(x.title));
    const previous = announcedByStart.get(`${m.courseCode}|${start}`);
    if (previous && previous.updatedAt >= (m.updatedAt ?? "")) continue;
    announcedByStart.set(`${m.courseCode}|${start}`, {
      id: `${m.id}-${hit[1]}`,
      courseCode: m.courseCode,
      number: Number(hit[1]),
      start,
      end: wib(day, `${hit[7].padStart(2, "0")}:${hit[8]}`),
      note: hit[9] ?? null,
      online: /online|daring|teams|zoom/i.test(hit[9] ?? ""),
      link: link?.url ?? null,
      materialId: m.id,
      updatedAt: m.updatedAt,
    });
  }
}
const announcedMeetings = [...announcedByStart.values()].sort((a, b) => a.start.localeCompare(b.start));

// ---- EduNex notifications
const noticeBody = readJson(last(edunex(/^\/notifications\/\d+$/)));
const notices = (noticeBody?.data?.notifications ?? []).map((n, i) => {
  const courseId = /\/courses\/(\d+)/.exec(n.callbackUrl ?? "")?.[1];
  const taskId = /\/assignment\/take\/(\d+)/.exec(n.callbackUrl ?? "")?.[1] ?? null;
  const courseCode = courseId
    ? codeByEdunexId.get(Number(courseId))
    : taskById.get(Number(taskId))?.courseCode;
  return {
    id: `${n.objectId}-${i}`,
    courseCode: courseCode ?? null,
    taskId,
    type: n.type,
    title: n.title,
    message: n.message,
    date: n.date,
    read: Boolean(n.isRead),
  };
});

// ---- Grades from the SIX transcript
const POINTS = { A: 4, AB: 3.5, B: 3, BC: 2.5, C: 2, D: 1, E: 0 };
const transcript = readHtml(last(six(/transkrip\/historis\/\d+$/)));
const semesters = [];
for (const cells of tableRows(transcript)) {
  const heading = cells.find((c) => /^Semester \d+ Tahun/.test(c));
  if (heading && cells.filter(Boolean).length === 1) {
    semesters.push({ label: heading, sks: 0, points: 0, graded: 0 });
    continue;
  }
  // Transcript codes carry a curriculum suffix, e.g. "FI1101 -19".
  const at = cells.findIndex((c) => /^[A-Z]{2}\d{4}\b/.test(c));
  if (at < 0 || !semesters.length) continue;
  const sks = Number(cells[at + 2]);
  const grade = cells[at + 3];
  const current = semesters[semesters.length - 1];
  if (grade in POINTS && sks > 0) {
    current.sks += sks;
    current.graded += sks;
    current.points += POINTS[grade] * sks;
  }
}
// Per-semester course lists for the grades page.
const transcriptSemesters = [];
for (const cells of tableRows(transcript)) {
  const heading = cells.find((c) => /^Semester \d+ Tahun/.test(c));
  if (heading && cells.filter(Boolean).length === 1) {
    transcriptSemesters.push({ label: heading, courses: [] });
    continue;
  }
  const at = cells.findIndex((c) => /^[A-Z]{2}\d{4}\b/.test(c));
  if (at < 0 || !transcriptSemesters.length) continue;
  transcriptSemesters[transcriptSemesters.length - 1].courses.push({
    code: cells[at].split(" ")[0],
    name: cells[at + 1],
    sks: Number(cells[at + 2]) || 0,
    grade: cells[at + 3] || null,
  });
}

// ---- SIX: Indonesian dates like "16 Agu 2026 10.45.42"
const ID_MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, Mei: 5, Jun: 6, Jul: 7, Agu: 8, Sep: 9, Okt: 10, Nov: 11, Des: 12 };
const idDate = (text) => {
  const m = /(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})(?: (\d{2})\.(\d{2}))?/.exec(text ?? "");
  if (!m || !ID_MONTHS[m[2]]) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${m[3]}-${pad(ID_MONTHS[m[2]])}-${pad(m[1])}T${m[4] ?? "00"}:${m[5] ?? "00"}:00+07:00`;
};
const rupiah = (text) => (text && /\d/.test(text) ? Number(text.replace(/[^\d]/g, "")) : null);
const tablesOf = (html) => [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)].map((m) => tableRows(m[1]));

// ---- SIX: KRS (study plan) with its approval timeline
const krsPage = readHtml(last(six(/registrasi\/rencanastudi\/\d+$/)));
const [krsIdentityRows = [], krsStepRows = [], krsCourseRows = []] = tablesOf(krsPage);
const krsIdentity = Object.fromEntries(krsIdentityRows.filter((r) => r.length === 2));
let krsPhase = "plan";
const krsSteps = [];
for (const cells of krsStepRows) {
  if (cells.length === 1) {
    krsPhase = "change";
    continue;
  }
  const [label, value] = cells;
  krsSteps.push({ phase: krsPhase, label, at: idDate(value), amount: /Rp/.test(value) ? rupiah(value) : null });
}
const krs = {
  heading: /Rencana Studi Semester ([^<]+)/.exec(krsPage)?.[1]?.trim() ?? termHeading,
  steps: krsSteps,
  courses: krsCourseRows
    .filter((cells) => /^[A-Z]{2}\d{4}$/.test(cells[0] ?? ""))
    .map(([code, name, classNo, sks, approved]) => ({ code, name, classNo, sks: Number(sks) || 0, approved: Boolean(approved) })),
};

// ---- SIX: UKT bills per term
const financePage = readHtml(last(six(/\/keuangan$/)));
const bills = [];
let billYear = "";
for (const cells of tableRows(financePage.slice(financePage.indexOf("Tagihan")))) {
  const year = /^Tahun (\d{4}) \/ (\d{4})$/.exec(cells[0] ?? "");
  if (year) {
    billYear = `${year[1]}/${year[2]}`;
    continue;
  }
  const term = /^(\d) - (Ganjil|Genap|Pendek)$/.exec(cells[0] ?? "");
  if (!term) continue;
  const dates = cells.slice(3).map(idDate).filter(Boolean);
  bills.push({
    year: billYear,
    semester: Number(term[1]),
    kind: term[2],
    billed: rupiah(cells[1]),
    paid: rupiah(cells[2]),
    deadline: dates[0] ?? null,
    installments: cells.slice(3).some((c) => /^Rp/.test(c)),
  });
}

// ---- SIX: curriculum position (graduation map)
const positionPage = readHtml(last(six(/transkrip\/kurikulum\/\d+$/)));
const [, categoryRows = [], mapRows = []] = tablesOf(positionPage);
const curriculum = {
  categories: categoryRows.filter((r) => r.length === 2 && /\d/.test(r[1])).map(([label, sks]) => ({ label, sks: Number(sks) })),
  stages: [],
};
for (const cells of mapRows) {
  const stage = /^Tahap (.+?) \(IP ([\d.]+) \/ SKS Lulus (\d+)\)$/.exec(cells[0] ?? "");
  if (stage) {
    curriculum.stages.push({ name: stage[1], ip: Number(stage[2]), sksPassed: Number(stage[3]), semesters: [] });
    continue;
  }
  const sem = /^Kurikulum Semester (\d+)$/.exec(cells[0] ?? "");
  const currentStage = curriculum.stages[curriculum.stages.length - 1];
  if (sem && currentStage) {
    currentStage.semesters.push({ number: Number(sem[1]), courses: [] });
    continue;
  }
  const at = cells.findIndex((c) => /^[A-Z]{2}\d{4}\b/.test(c));
  const currentSem = currentStage?.semesters[currentStage.semesters.length - 1];
  if (at < 0 || !currentSem) continue;
  currentSem.courses.push({
    code: cells[at].split(" ")[0],
    name: cells[at + 1],
    kind: cells[at + 2] === "P" ? "elective" : "required",
    sks: Number(cells[at + 3]) || 0,
    grade: cells[at + 4] || null,
    takenIn: cells[at + 5] || null,
  });
}

// ---- SIX: the program's full curriculum (required courses by semester, specializations)
const structurePage = readHtml(last(six(/kurikulum\/kurikulum\/\d+\/struktur$/)));
const pane = (id) => {
  const start = structurePage.indexOf(`id="${id}"`);
  const next = structurePage.indexOf('class="tab-pane', start + 1);
  return start < 0 ? "" : structurePage.slice(start, next < 0 ? undefined : next);
};
const required = [];
let semesterPair = [];
for (const cells of tableRows(pane("wajib"))) {
  const heads = cells.map((c) => /^Semester (\d+)$/.exec(c)?.[1]).filter(Boolean);
  if (heads.length) {
    semesterPair = heads.map(Number);
    continue;
  }
  for (let side = 0; side < semesterPair.length; side++) {
    const [code, name, sks] = cells.slice(side * 3, side * 3 + 3);
    if (/^[A-Z]{2}\d{3}[0-9X]$/.test(code ?? "")) required.push({ semester: semesterPair[side], code, name, sks: Number(sks) || 0 });
  }
}
const specializations = [...pane("spesialisasi").matchAll(/<h4[^>]*>([\s\S]*?)<\/h4>([\s\S]*?)<\/table>/g)].map((m) => {
  const head = /^(.*?) \((\d+) SKS\)$/.exec(strip(m[1]));
  return {
    name: head?.[1] ?? strip(m[1]),
    sks: Number(head?.[2] ?? 0),
    courses: tableRows(m[2])
      .filter((cells) => /^[A-Z]{2}\d{4}$/.test(cells[0] ?? ""))
      .map(([code, name, sks]) => ({ code, name, sks: Number(sks) || 0 })),
  };
});
const curriculumList = readHtml(last(six(/kurikulum\/kurikulum\/list$/)));
const activeCurriculum = tableRows(curriculumList).find((cells) => cells.some((c) => c === /Kurikulum (\d{4})/.exec(strip(structurePage))?.[1]));
const programRules = {
  name: strip(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(structurePage)?.[1] ?? ""),
  graduationSks: Number(activeCurriculum?.[7]) || 144,
  semesters: Number(activeCurriculum?.[8]) || 8,
};

// ---- SIX: registered specialization (Status Mahasiswa › Skema Program Pendidikan)
const schemePage = six(/program-integrasi\/riwayat\/\d+$/).length ? readHtml(last(six(/program-integrasi\/riwayat\/\d+$/))) : "";
const schemeRow = tableRows(schemePage.slice(schemePage.indexOf("Spesialisasi"))).find((cells) => cells.some((c) => /On Progress|Selesai|Ditolak/.test(c)));
const specialization = schemeRow
  ? {
      name: schemeRow.find((c) => / · /.test(c))?.split(" · ")[0] ?? schemeRow[1],
      approvedAt: idDate(schemeRow.find((c) => /\d{4}$/.test(c)) ?? ""),
      status: schemeRow.find((c) => /On Progress|Selesai|Ditolak/.test(c)),
    }
  : null;

// ---- SIX: course-evaluation questionnaire (Evaluasi Perkuliahan)
const surveyPage = six(/evaluasi\/kuesioner$/).length ? readHtml(last(six(/evaluasi\/kuesioner$/))) : "";
const surveyWindow = /dibuka mulai (\d{1,2} \w+ \d{4}) [\d.]+ sampai (\d{1,2} \w+ \d{4})/.exec(strip(surveyPage));
const ID_LONG_MONTHS = { Januari: "Jan", Februari: "Feb", Maret: "Mar", April: "Apr", Mei: "Mei", Juni: "Jun", Juli: "Jul", Agustus: "Agu", September: "Sep", Oktober: "Okt", November: "Nov", Desember: "Des" };
const longDate = (text) => idDate(text.replace(/[A-Z][a-z]+/, (m) => ID_LONG_MONTHS[m] ?? m));
const survey = surveyWindow
  ? {
      term: /\+(\d{4}-\d)\//.exec(last(six(/evaluasi\/kuesioner$/)).path)?.[1] ?? "",
      opensAt: longDate(surveyWindow[1]),
      closesAt: longDate(surveyWindow[2]),
      total: (surveyPage.match(/label-(success|danger|warning|default)/g) ?? []).length,
      filled: (surveyPage.match(/Sudah diisi/g) ?? []).length,
    }
  : null;

const graded = semesters.reduce((sum, s) => sum + s.graded, 0);
const grades = {
  ipk: graded ? Math.round((semesters.reduce((sum, s) => sum + s.points, 0) / graded) * 100) / 100 : null,
  // Unrounded, for honors and target projections (IPK counts graded A–E SKS only).
  points: semesters.reduce((sum, s) => sum + s.points, 0),
  gradedSks: graded,
  sksPassed: semesters.reduce((sum, s) => sum + s.sks, 0),
  semesters: semesters.map((s) => ({ label: s.label, sks: s.sks, ip: s.graded ? Math.round((s.points / s.graded) * 100) / 100 : null })),
};

// ---- EduNex's own copy of the registration calendar (/login/me)
const period = {
  krsStart: vendorTime(me.rps_start ?? null),
  krsEnd: vendorTime(me.rps_end ?? null),
  changeEnd: vendorTime(me.prs_end ?? null),
};

// ---- ITB's academic calendar 2026/2027 (Kalender Pendidikan ITB, the official
// PDF; the app reads the same events from ITB's public calendar feed linked on
// SIX's home page). Only the events a Sarjana student acts on.
const academicCalendar = [
  { key: "drs", start: "2026-08-12", end: "2026-08-20", en: "Study plan (DRS) · Semester I", id: "Pengisian rencana studi (DRS) · Semester I" },
  { key: "ukt", start: "2026-08-23", end: "2026-08-23", en: "Tuition (UKT) due · Semester I", id: "Batas bayar UKT · Semester I" },
  { key: "lectures", start: "2026-08-24", end: "2026-12-04", en: "Lectures · Semester I", id: "Masa kuliah · Semester I" },
  { key: "urs", start: "2026-09-15", end: "2026-09-18", en: "Study plan change (URS) · Semester I", id: "Penggantian rencana studi (URS) · Semester I" },
  { key: "uts", start: "2026-10-12", end: "2026-10-16", en: "Midterm week (UTS)", id: "Masa UTS" },
  { key: "classes_next", start: "2026-10-12", end: "2026-11-13", en: "Programs publish Semester II classes", id: "Prodi membuka kelas Semester II" },
  { key: "survey", start: "2026-11-30", end: "2026-12-11", en: "Course evaluation questionnaire", id: "Pengisian kuesioner evaluasi perkuliahan" },
  { key: "uas", start: "2026-12-07", end: "2026-12-22", en: "Final exams (UAS)", id: "Masa UAS" },
  { key: "grades", start: "2027-01-08", end: "2027-01-08", en: "Final grades due from lecturers", id: "Batas dosen memasukkan nilai akhir" },
  { key: "monev", start: "2027-01-18", end: "2027-01-19", en: "Academic progress check", id: "Pemantauan dan evaluasi akademik" },
  { key: "drs2", start: "2027-01-20", end: "2027-01-28", en: "Study plan (DRS) · Semester II", id: "Pengisian rencana studi (DRS) · Semester II" },
  { key: "ukt2", start: "2027-01-31", end: "2027-01-31", en: "Tuition (UKT) due · Semester II", id: "Batas bayar UKT · Semester II" },
  { key: "lectures2", start: "2027-02-01", end: "2027-05-21", en: "Lectures · Semester II", id: "Masa kuliah · Semester II" },
  { key: "urs2", start: "2027-02-23", end: "2027-02-26", en: "Study plan change (URS) · Semester II", id: "Penggantian rencana studi (URS) · Semester II" },
  { key: "uas2", start: "2027-05-24", end: "2027-06-09", en: "Final exams (UAS) · Semester II", id: "Masa UAS · Semester II" },
].map((e) => ({ ...e, start: `${e.start}T00:00:00+07:00`, end: `${e.end}T23:59:00+07:00` }));

const data = {
  now,
  period,
  academicCalendar,
  student: {
    name: fullName,
    firstName: fullName.split(" ")[0],
    nim: identity.NIM ?? "",
    program: identity["Program Studi"] ?? identity.Prodi ?? null,
    termLabel: termHeading,
    advisor: krsIdentity["Dosen Wali"] ?? null,
    entry: krsIdentity["Tahun Masuk"] ?? null,
    ipk: krsIdentity["Indeks Prestasi Kumulatif"] ? Number(krsIdentity["Indeks Prestasi Kumulatif"]) : null,
    sksPassed: Number(/Lulus (\d+)/.exec(krsIdentity.SKS ?? "")?.[1] ?? 0),
    maxSks: Number(/(\d+)/.exec(krsIdentity["Maksimal Beban"] ?? "")?.[1] ?? 0) || null,
    specialization,
  },
  program: programRules,
  krs,
  bills,
  survey,
  /** SIX publishes the personal timetable as a calendar feed (link in the schedule page footer). */
  sixCalendarFeed: /\/pub\/calm\//.test(calendar),
  curriculum: { ...curriculum, required, specializations },
  transcript: transcriptSemesters,
  sources: { edunex: { updatedAt: now }, six: { updatedAt: now } },
  courses,
  modules,
  sessions,
  announcedMeetings,
  tasks,
  presence,
  materials,
  notices,
  grades,
};

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(data, null, 2));
console.log(
  `design data → ${path.relative(root, outFile)}: ${courses.length} courses, ${modules.length} modules, ${sessions.length} sessions, ` +
    `${tasks.length} tasks, ${presence.length} presence windows, ${materials.length} materials, ` +
    `${notices.length} notices, ${grades.semesters.length} semesters; demo now = ${now}`,
);
