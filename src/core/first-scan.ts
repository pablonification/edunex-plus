// The first-run scan (#81, spec story 68): once the first full sync of Edunex
// (and SIX when connected) is done, a short list of what the app found that
// neither system says on its own, each finding with its number and the
// screen that shows it. Only findings with something to say are listed. Pure:
// the dialog and its tests reason with this.
import { krsOverlaps, type Overlap } from "./academic";
import { type AttendanceHealth, attendanceHealth, countedIn, lecturePeriod, needsAttention } from "./attendance";
import { type AnnouncedMeeting, announcedMeetings, courseMeetings } from "./course-meetings";
import { examAhead, examRoute, examsFound } from "./exam-sources";
import type { Exam } from "./exams";
import { blockedBy, HONORS, type HonorLevel, honorFor, type Path } from "./honors";
import type { DatasetName, SourceId, SourceState, SourceStatus, Task } from "./models";
import { semesterOf } from "./planner";
import type { Route } from "./route";
import { inTerm, type Saved, termCourses } from "./saved";
import { editedAfterSubmit } from "./tasks";

/** What each source must have read before the scan speaks for it. */
export const SCAN_PARTS = {
  edunex: ["edunex.courses", "edunex.tasks", "edunex.outline", "edunex.materials", "edunex.presence", "edunex.announcements", "edunex.exams"],
  six: ["six.courses", "six.schedule", "six.transcript"],
  itb: ["itb.calendar"],
} as const satisfies Record<SourceId, readonly DatasetName[]>;
export type ScanPart = (typeof SCAN_PARTS)[SourceId][number];

const stateOf = (statuses: readonly SourceStatus[], source: SourceId): SourceState => statuses.find((s) => s.source === source)?.state ?? "signed-out";
const hasAll = (saved: Saved, source: SourceId) => SCAN_PARTS[source].every((name) => saved[name] !== undefined);

/**
 * The first full sync is done: every signed-in system (Edunex, SIX) has read
 * what the scan needs, or has stopped for a reason it shows (offline, a
 * vendor change, an ended session), and so has ITB's calendar.
 */
export function scanReady(saved: Saved, statuses: readonly SourceStatus[]): boolean {
  const signedIn = (["edunex", "six"] as const).filter((source) => stateOf(statuses, source) !== "signed-out");
  // "live" without every part: still reading.
  const settled = (source: SourceId) => stateOf(statuses, source) !== "connecting" && (hasAll(saved, source) || stateOf(statuses, source) !== "live");
  const calendar = hasAll(saved, "itb") || ["offline", "changed"].includes(stateOf(statuses, "itb"));
  return signedIn.length > 0 && signedIn.every(settled) && calendar;
}

/** What Beranda needs before it can speak without guessing: SIX's attendance and timetable, Edunex's courses, Tasks and Presence. */
const HOME_PARTS = {
  edunex: ["edunex.courses", "edunex.tasks", "edunex.presence"],
  six: ["six.courses", "six.schedule"],
} as const satisfies Record<"edunex" | "six", readonly DatasetName[]>;

/**
 * The first read has what Beranda shows, so it opens complete (the full scan
 * may still be reading): every signed-in system has its Beranda parts, or has
 * stopped for a reason it shows. Never before anyone is signed in.
 */
export function homeReady(saved: Saved, statuses: readonly SourceStatus[]): boolean {
  const signedIn = (["edunex", "six"] as const).filter((source) => stateOf(statuses, source) !== "signed-out");
  const settled = (source: "edunex" | "six") => {
    const state = stateOf(statuses, source);
    const has = HOME_PARTS[source].every((name) => saved[name] !== undefined);
    return has || (state !== "connecting" && state !== "live");
  };
  return signedIn.length > 0 && signedIn.every(settled);
}

// ---------------------------------------------------------------- findings

export type Tone = "danger" | "warning" | "info" | "success";

interface FindingBase {
  /** The number on the line: how many, or the IPK. */
  count: number;
  tone: Tone;
  /** The systems it comes from. */
  sources: ("edunex" | "six" | "itb")[];
  /** Where it shows, best first: the window opens the first screen that's built. */
  routes: Route[];
}

export type Finding = FindingBase &
  (
    | { kind: "attendance"; courses: AttendanceHealth[] }
    | { kind: "clash"; overlaps: Overlap[] }
    | { kind: "unusedPresence"; courses: { code: string; absent: number; attended: number; held: number }[] }
    | { kind: "exams"; exams: Exam[] }
    | { kind: "notInSix"; meetings: { code: string; meeting: AnnouncedMeeting }[] }
    | { kind: "edited"; tasks: Task[]; afterSubmit: number }
    | {
        kind: "ipk";
        ipk: number;
        band: HonorLevel | null;
        /** The next level up, still open. */
        next: { level: HonorLevel; min: number } | null;
        /** The next level up is ruled out whatever the grades: a retake (summa), or past 9 semesters. */
        blocked: { level: HonorLevel; reason: "retake" | "time" } | null;
      }
    | {
        kind: "unread";
        /** `catalog`: what changed on ITB's side is a page of SIX's public catalog, not ITB's calendar. */
        parts: { source: SourceId; state: SourceState; missing: ScanPart[]; catalog?: true }[];
      }
  );
export type FindingKind = Finding["kind"];

export interface ScanInput {
  saved: Saved;
  statuses: readonly SourceStatus[];
  /** The Student's attendance target (percent). */
  target: number;
  now: number;
}

/** What the first full sync found, most pressing first. */
export function firstScan(input: ScanInput): Finding[] {
  const courses = termCourses(input.saved);
  const codes = courses.map((course) => course.code);
  return [
    attendanceAtRisk(input),
    overlaps(input, codes),
    unusedPresence(input),
    exams(input),
    meetingsOutsideSix(input, codes),
    editedTasks(input, inTerm(courses)),
    ipkStanding(input),
    unread(input),
  ].filter((finding) => finding !== null);
}

/** The lines that say something neither system tells the Student (what couldn't be read doesn't count). */
export const notable = (findings: readonly Finding[]) => findings.filter((finding) => finding.kind !== "unread").length;

const STATE_ORDER = { out: 0, none: 1, risk: 2, safe: 3, unknown: 4 } as const;

/** Courses with one absence left or fewer, or the target out of reach, from SIX's exact counts. */
function attendanceAtRisk({ saved, target, now }: ScanInput): Finding | null {
  const six = saved["six.courses"];
  const schedule = saved["six.schedule"];
  // Without SIX's whole timetable and ITB's last lecture day the meetings left, and so the absences left, would be undercounted.
  const period = lecturePeriod(saved["itb.calendar"], saved["six.student"]?.term ?? null, now);
  if (!six || !schedule || !period) return null;
  const presence = saved["edunex.presence"] ?? {};
  const courses = six
    .map((course) => attendanceHealth({ code: course.code, six: course.attendance, presence: presence[course.code] ?? [], schedule, period, target, now }))
    .filter((health) => needsAttention(health.state))
    .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]);
  if (!courses.length) return null;
  return {
    kind: "attendance",
    count: courses.length,
    tone: courses.some((health) => health.state === "out") ? "danger" : "warning",
    sources: ["six", "itb"],
    routes: [{ screen: "presence" }],
    courses,
  };
}

/**
 * Courses whose classes still to come overlap on SIX's timetable: SIX accepts
 * such a KRS and never says so. Counted as the KRS tab counts them, so both
 * say the same thing.
 */
function overlaps({ saved, now }: ScanInput, codes: readonly string[]): Finding | null {
  const schedule = saved["six.schedule"];
  if (!schedule) return null;
  const found = krsOverlaps(codes, schedule, now)
    .filter((overlap) => overlap.upcoming)
    .sort((a, b) => a.start - b.start);
  if (!found.length) return null;
  const meetings: Route = { screen: "course", code: found[0].codes[0], tab: "meetings" };
  return {
    kind: "clash",
    count: found.length,
    // A choice to make (which class to attend), nothing lost yet: amber, as on Beranda and Jadwal.
    tone: "warning",
    sources: ["six"],
    routes: [{ screen: "schedule" }, ...(saved["six.krs"] ? [{ screen: "plan", tab: "krs" } as const] : []), meetings],
    overlaps: found,
  };
}

/** Courses counted in SIX whose Edunex Presence windows went unused: Edunex would show those meetings as absences. */
function unusedPresence({ saved, now }: ScanInput): Finding | null {
  const presence = saved["edunex.presence"];
  if (!presence) return null;
  const courses = (saved["six.courses"] ?? []).flatMap((course) => {
    const sessions = presence[course.code] ?? [];
    const absent = sessions.filter((p) => p.closesAt <= now && !p.recorded?.present).length;
    if (!course.attendance || absent === 0 || countedIn(course.attendance, sessions, now) !== "six") return [];
    return [{ code: course.code, absent, attended: course.attendance.attended, held: course.attendance.held }];
  });
  if (!courses.length) return null;
  return { kind: "unusedPresence", count: courses.length, tone: "info", sources: ["edunex", "six"], routes: [{ screen: "presence" }], courses };
}

/**
 * Exams still ahead, as Tugas & Ujian lists them (one per course and exam,
 * however many systems name it): SIX's sessions with time and room, Edunex
 * exams, take-home exams not handed in, and exams named only in a course
 * outline, dated by ITB's exam week. The line opens the soonest.
 */
function exams({ saved, now }: ScanInput): Finding | null {
  const ahead = examsFound(saved, now).filter((exam) => examAhead(exam, now));
  if (!ahead.length) return null;
  const sources = new Set<"edunex" | "six" | "itb">();
  for (const exam of ahead) {
    if (exam.six.length) sources.add("six");
    if (exam.edunex.length || exam.tasks.length || exam.inOutline) sources.add("edunex");
    if (exam.at === null && exam.week) sources.add("itb");
  }
  return {
    kind: "exams",
    count: ahead.length,
    tone: "warning",
    sources: (["six", "edunex", "itb"] as const).filter((source) => sources.has(source)),
    routes: [examRoute(ahead[0])],
    exams: ahead,
  };
}

/** Upcoming meetings a lecturer announced only in Edunex text, in a month SIX's timetable covers without them. */
function meetingsOutsideSix({ saved, now }: ScanInput, codes: readonly string[]): Finding | null {
  const schedule = saved["six.schedule"];
  if (!schedule) return null;
  const meetings: { code: string; meeting: AnnouncedMeeting }[] = [];
  for (const code of codes) {
    const announced = announcedMeetings(saved["edunex.materials"]?.[code] ?? [], saved["edunex.announcements"]?.[code] ?? []);
    if (!announced.length) continue;
    for (const meeting of courseMeetings(code, saved["edunex.presence"]?.[code] ?? [], schedule, announced, saved["six.scheduleMonths"] ?? []))
      if (meeting.announced && meeting.notInSix && meeting.end > now) meetings.push({ code, meeting: meeting.announced });
  }
  if (!meetings.length) return null;
  meetings.sort((a, b) => a.meeting.start - b.meeting.start);
  const courses = [...new Set(meetings.map((m) => m.code))];
  const coursePage: Route = { screen: "course", code: courses[0], tab: "meetings" };
  return {
    kind: "notInSix",
    count: meetings.length,
    tone: "warning",
    sources: ["edunex"],
    routes: courses.length === 1 ? [coursePage] : [{ screen: "schedule" }, coursePage],
    meetings,
  };
}

/** Tasks the lecturer changed after posting them: Edunex never says so. */
function editedTasks({ saved, now }: ScanInput, known: (code: string) => boolean): Finding | null {
  const tasks = (saved["edunex.tasks"] ?? [])
    .filter((task) => known(task.courseCode) && task.editedAt !== null && task.editedAt <= now)
    .sort((a, b) => (b.editedAt ?? 0) - (a.editedAt ?? 0));
  if (!tasks.length) return null;
  const afterSubmit = tasks.filter(editedAfterSubmit).length;
  return {
    kind: "edited",
    count: tasks.length,
    tone: afterSubmit > 0 ? "warning" : "info",
    sources: ["edunex"],
    routes: [tasks.length === 1 ? { screen: "task", taskId: tasks[0].id } : { screen: "tasks" }],
    tasks,
    afterSubmit,
  };
}

/**
 * The IPK as SIX shows it (as Nilai shows it), the honors level it reaches
 * (Peraturan Akademik ITB, shared with Nilai and the planner), and the next
 * level up: how far, or what rules it out.
 */
function ipkStanding({ saved }: ScanInput): Finding | null {
  const transcript = saved["six.transcript"];
  const ipk = transcript ? (transcript.ipk.six ?? transcript.ipk.computed) : null;
  if (!transcript || ipk === null) return null;
  const term = saved["six.student"]?.term ?? null;
  const entry = saved["six.progress"]?.entryTerm ?? transcript.terms[0]?.term ?? null;
  const path: Path = {
    retakes: transcript.terms.some((t) => t.courses.some((c) => c.attempt > 1 || c.standing === "replaced")),
    semesters: term ? semesterOf(term, entry) : null,
  };
  const band = honorFor(ipk, path);
  const bandMin = HONORS.find((h) => h.level === band)?.min ?? 0;
  const up = [...HONORS].reverse().find((h) => h.min > bandMin);
  const reason = up ? blockedBy(up.level, path) : null;
  return {
    kind: "ipk",
    count: ipk,
    tone: band ? "success" : "info",
    sources: ["six"],
    routes: [{ screen: "grades" }],
    ipk,
    band,
    next: up && !reason ? up : null,
    blocked: up && reason ? { level: up.level, reason } : null,
  };
}

/** What a system couldn't read: parts that never arrived because it went offline, changed something, or ended the session. */
function unread({ saved, statuses }: ScanInput): Finding | null {
  const parts = (["edunex", "six", "itb"] as const).flatMap((source) => {
    const state = stateOf(statuses, source);
    if (state !== "offline" && state !== "changed" && state !== "expired") return [];
    const missing = SCAN_PARTS[source].filter((name) => saved[name] === undefined);
    if (!missing.length && state !== "changed") return [];
    // ITB's side also reads SIX's public catalog: with the calendar there, a changed catalog page is what changed.
    const catalog = source === "itb" && !missing.length && saved["itb.catalog"]?.programs.some((p) => p.state === "changed");
    return [catalog ? { source, state, missing, catalog: true as const } : { source, state, missing }];
  });
  if (!parts.length) return null;
  return {
    kind: "unread",
    count: parts.reduce((sum, part) => sum + Math.max(1, part.missing.length), 0),
    tone: "danger",
    sources: parts.map((part) => part.source),
    routes: [{ screen: "home" }],
    parts,
  };
}

// ---------------------------------------------------------------- what was read

export interface ScanSummary {
  /** The systems connected now: signed in, the session not ended. */
  connected: ("edunex" | "six")[];
  /** The systems whose data the scan read. */
  read: ("edunex" | "six")[];
  courses: number;
  tasks: number;
  /** Meetings of this term's courses: SIX's timetable, Edunex Presence and announced meetings, merged. */
  meetings: number;
}

export function scanSummary(saved: Saved, statuses: readonly SourceStatus[]): ScanSummary {
  const term = termCourses(saved);
  const known = inTerm(term);
  const courses = term.map((course) => course.code);
  const schedule = saved["six.schedule"] ?? null;
  const meetings = courses.reduce((sum, code) => {
    const announced = announcedMeetings(saved["edunex.materials"]?.[code] ?? [], saved["edunex.announcements"]?.[code] ?? []);
    return sum + courseMeetings(code, saved["edunex.presence"]?.[code] ?? [], schedule, announced).length;
  }, 0);
  return {
    connected: (["edunex", "six"] as const).filter((source) => !["signed-out", "expired"].includes(stateOf(statuses, source))),
    read: (["edunex", "six"] as const).filter((source) => saved[`${source}.courses`] !== undefined),
    courses: courses.length,
    tasks: (saved["edunex.tasks"] ?? []).filter((task) => known(task.courseCode)).length,
    meetings,
  };
}
