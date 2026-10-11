// PROTOTYPE (#83) — throwaway. Variant D "Kuliah": what the merge is for.
// Pure functions that turn EduNex + SIX data into what the Student must do,
// what changed, and where they stand. The real engine (#71 onward) computes
// the same things in the main process from the same sources.
import type { AnnouncedMeeting, ClassSession, DesignData, PresenceWindow, Task } from "./data";
import type { Screen } from "./params";
import type { VariantProps } from "./variant-props";

type F = VariantProps["f"];
type Text = { en: string; id: string };
export type Source = "EduNex" | "SIX";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// ---------------------------------------------------------------- weekly slots (SIX)

export interface Slot {
  weekday: string;
  start: string;
  end: string;
  room: string;
}

export const isExamActivity = (activity: string) => /\b(UTS|UAS|Ujian|Kuis|Quiz)\b/i.test(activity);

function slotOf(s: ClassSession, f: F): Slot {
  return { weekday: f.weekdayShort(s.start), start: f.time(s.start), end: f.time(s.end), room: s.room };
}

const slotKey = (s: Slot) => `${s.weekday}|${s.start}|${s.end}|${s.room}`;

/** A course's usual meeting: the most common weekday, time and room among its regular sessions. */
export function usualSlot(data: DesignData, code: string, f: F): Slot | null {
  const counts = new Map<string, { slot: Slot; n: number }>();
  for (const s of data.sessions) {
    if (s.courseCode !== code || isExamActivity(s.activity)) continue;
    const slot = slotOf(s, f);
    const entry = counts.get(slotKey(slot)) ?? { slot, n: 0 };
    entry.n += 1;
    counts.set(slotKey(slot), entry);
  }
  const best = [...counts.values()].sort((a, b) => b.n - a.n)[0];
  // One session is no pattern; a "usual" slot needs at least two.
  return best && best.n >= 2 ? best.slot : null;
}

export interface ScheduleChange {
  session: ClassSession;
  /** What differs from the usual slot. */
  kinds: ("time" | "room")[];
  usual: Slot;
}

/** Sessions SIX lists at a different time or room than the course usually meets. SIX never marks these. */
export function scheduleChanges(data: DesignData, f: F): ScheduleChange[] {
  const usual = new Map(data.courses.map((c) => [c.code, usualSlot(data, c.code, f)]));
  const changes: ScheduleChange[] = [];
  for (const s of data.sessions) {
    const slot = usual.get(s.courseCode);
    if (!slot || isExamActivity(s.activity)) continue;
    const here = slotOf(s, f);
    if (here.weekday !== slot.weekday) continue; // A different day is an extra meeting, not a change.
    const kinds: ScheduleChange["kinds"] = [];
    if (here.start !== slot.start || here.end !== slot.end) kinds.push("time");
    if (here.room !== slot.room && here.room) kinds.push("room");
    if (kinds.length) changes.push({ session: s, kinds, usual: slot });
  }
  return changes;
}

// ---------------------------------------------------------------- clashes (SIX)

export interface Clash {
  codes: [string, string];
  weekday: string;
  /** The overlapping part, "16:00"–"16:30". */
  from: string;
  to: string;
  minutes: number;
  /** How many meetings collide in the known schedule. */
  count: number;
  next: [ClassSession, ClassSession] | null;
}

/** Courses whose meetings overlap — SIX accepts a KRS with clashing classes and never says so. */
export function clashes(data: DesignData, now: Date, f: F): Clash[] {
  const byPair = new Map<string, Clash>();
  const sessions = data.sessions.filter((s) => !isExamActivity(s.activity));
  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const [a, b] = [sessions[i], sessions[j]].sort((x, y) => x.start.localeCompare(y.start));
      if (a.courseCode === b.courseCode) continue;
      const start = Math.max(Date.parse(a.start), Date.parse(b.start));
      const end = Math.min(Date.parse(a.end), Date.parse(b.end));
      if (end <= start) continue;
      const codes = [a.courseCode, b.courseCode] as [string, string];
      const key = codes.join("|");
      const existing = byPair.get(key);
      const upcoming = Date.parse(a.end) > now.getTime();
      if (existing) {
        existing.count += 1;
        if (!existing.next && upcoming) existing.next = [a, b];
      } else {
        byPair.set(key, {
          codes,
          weekday: f.weekday(a.start),
          from: f.time(new Date(start).toISOString()),
          to: f.time(new Date(end).toISOString()),
          minutes: Math.round((end - start) / 60_000),
          count: 1,
          next: upcoming ? [a, b] : null,
        });
      }
    }
  }
  return [...byPair.values()].sort((a, b) => b.count - a.count);
}

export function clashFor(list: Clash[], code: string): Clash | undefined {
  return list.find((c) => c.codes.includes(code));
}

// ---------------------------------------------------------------- meetings SIX doesn't list (EduNex text)

/** Meetings announced only in EduNex text, on a day SIX has nothing for that course. */
export function offTimetable(data: DesignData, f: F): AnnouncedMeeting[] {
  return data.announcedMeetings.filter(
    (m) => !data.sessions.some((s) => s.courseCode === m.courseCode && f.dayKey(s.start) === f.dayKey(m.start)),
  );
}

// ---------------------------------------------------------------- exams (SIX calendar + EduNex)

export interface Exam {
  id: string;
  courseCode: string;
  courseName: string;
  /** "UTS", "UAS", "KUIS" … as SIX or EduNex names it. */
  kind: string;
  start: string | null;
  end: string | null;
  room: string | null;
  /** Where the date comes from. */
  source: Source;
  /** A take-home exam handed in as an EduNex Task. */
  taskId: string | null;
  /** Only known from the EduNex course outline; the date isn't in SIX yet. */
  dateUnknown: boolean;
}

/**
 * Exams from SIX's calendar (activity UTS/UAS), take-home exams posted as
 * EduNex Tasks (domain "uts"), and exam weeks in EduNex course outlines that
 * SIX hasn't scheduled yet.
 */
export function examsOf(data: DesignData): Exam[] {
  const exams: Exam[] = data.sessions
    .filter((s) => isExamActivity(s.activity))
    .map((s) => ({
      id: `six-${s.id}`,
      courseCode: s.courseCode,
      courseName: s.courseName,
      kind: s.activity.toUpperCase().match(/UTS|UAS|KUIS|QUIZ|UJIAN/)?.[0] ?? s.activity,
      start: s.start,
      end: s.end,
      room: s.room || null,
      source: "SIX" as const,
      taskId: null,
      dateUnknown: false,
    }));
  for (const task of data.tasks) {
    const kind = task.domain === "uts" ? "UTS" : /\b(UTS|UAS)\b/i.exec(task.title)?.[1]?.toUpperCase();
    if (!kind || !task.dueAt) continue;
    exams.push({
      id: `task-${task.id}`,
      courseCode: task.courseCode,
      courseName: task.courseName,
      kind,
      // A take-home exam is pinned to its deadline.
      start: task.dueAt,
      end: task.dueAt,
      room: null,
      source: "EduNex",
      taskId: task.id,
      dateUnknown: false,
    });
  }
  // Course outlines built on the 16-week template name their exam weeks ("Midex/UTS", "Finex/UAS").
  for (const mod of data.modules.filter((m) => m.active)) {
    const kind = /\b(UTS|UAS)\b/i.exec(mod.title)?.[1]?.toUpperCase();
    if (!kind || exams.some((e) => e.courseCode === mod.courseCode && e.kind === kind)) continue;
    const course = data.courses.find((c) => c.code === mod.courseCode);
    exams.push({
      id: `module-${mod.id}`,
      courseCode: mod.courseCode,
      courseName: course?.name ?? "",
      kind,
      start: null,
      end: null,
      room: null,
      source: "EduNex",
      taskId: null,
      dateUnknown: true,
    });
  }
  return exams.sort((a, b) => (a.start ?? "9").localeCompare(b.start ?? "9") || a.kind.localeCompare(b.kind));
}

// ---------------------------------------------------------------- attendance (SIX counts + EduNex Presence)

/** The current semester's lecture period from ITB's academic calendar. */
export function lecturePeriod(data: DesignData, now: Date): { start: string; end: string } | null {
  const period = data.academicCalendar.find((e) => e.key.startsWith("lectures") && new Date(e.start) <= now && now <= new Date(e.end));
  return period ? { start: period.start, end: period.end } : null;
}

/**
 * Meetings still to come after today. A weekly course meets on its weekday
 * until the last lecture day (minus weeks where SIX put an exam in that slot);
 * other courses follow their published SIX sessions and EduNex Presence windows.
 */
function meetingsLeft(data: DesignData, code: string, now: Date, f: F): number {
  const slot = usualSlot(data, code, f);
  const today = f.dayKey(now.toISOString());
  if (slot) {
    const period = lecturePeriod(data, now);
    if (!period) return 0;
    const exams = new Set(data.sessions.filter((s) => s.courseCode === code && isExamActivity(s.activity)).map((s) => f.dayKey(s.start)));
    let count = 0;
    for (let t = now.getTime() + DAY; t <= Date.parse(period.end); t += DAY) {
      const iso = new Date(t).toISOString();
      if (f.weekdayShort(iso) === slot.weekday && !exams.has(f.dayKey(iso))) count += 1;
    }
    return count;
  }
  const days = new Set(
    [
      ...data.sessions.filter((s) => s.courseCode === code && !isExamActivity(s.activity)).map((s) => s.start),
      ...data.presence.filter((p) => p.courseCode === code).map((p) => p.opensAt),
    ]
      .map(f.dayKey)
      .filter((d) => d > today),
  );
  return days.size;
}

export interface AttendanceHealth {
  code: string;
  /** Where the Student's attendance actually gets counted. */
  source: Source;
  attended: number | null;
  held: number | null;
  planned: number;
  remaining: number;
  /** Further absences allowed while still finishing at the target; negative when out of reach. */
  canMiss: number | null;
  /** Best final share if every remaining meeting is attended. */
  best: number | null;
  /** Meetings in a row needed to climb back to the target, when below it now. */
  toRecover: number | null;
  state: "safe" | "last" | "out" | "unknown";
  /** EduNex Presence for the same course: marked / windows already closed. */
  edunexMarked: number;
  edunexPast: number;
  /** EduNex shows fewer attendances than SIX counts — its "Absent" labels are misleading. */
  edunexMisleading: boolean;
}

export function attendanceHealth(data: DesignData, code: string, now: Date, f: F, targetPct: number): AttendanceHealth {
  const course = data.courses.find((c) => c.code === code);
  const target = targetPct / 100;
  const windows = data.presence.filter((p) => p.courseCode === code);
  const past = windows.filter((p) => new Date(p.closesAt) <= now);
  const marked = past.filter((p) => p.myStatus === "attended").length;
  const attended = course?.attended ?? null;
  const held = course?.held ?? null;
  // EduNex counts only when its marks keep up with SIX; otherwise the lecturer records in SIX.
  const source: Source = past.length > 0 && attended !== null && marked >= attended - 1 ? "EduNex" : "SIX";

  // SIX's count already includes today's meetings, so what's left starts tomorrow.
  const remaining = meetingsLeft(data, code, now, f);
  const planned = (held ?? 0) + remaining;

  if (attended === null || held === null) {
    return { code, source, attended, held, planned, remaining, canMiss: null, best: null, toRecover: null, state: "unknown", edunexMarked: marked, edunexPast: past.length, edunexMisleading: false };
  }
  const canMiss = Math.floor(attended + remaining - target * planned + 1e-9);
  const best = (attended + remaining) / planned;
  const toRecover = attended / held >= target ? 0 : Math.ceil((target * held - attended) / (1 - target) - 1e-9);
  return {
    code,
    source,
    attended,
    held,
    planned,
    remaining,
    canMiss,
    best,
    toRecover,
    state: canMiss >= 1 ? "safe" : canMiss === 0 ? "last" : "out",
    edunexMarked: marked,
    edunexPast: past.length,
    edunexMisleading: past.length > 0 && marked < attended - 1,
  };
}

// ---------------------------------------------------------------- what EduNex counts as presence

/** The one action that gets the Student counted in an EduNex Presence window. */
export function presenceAction(data: DesignData, w: PresenceWindow, tr: VariantProps["tr"]): { short: string; long: string } {
  const task = w.taskId ? data.tasks.find((t) => t.id === w.taskId) : undefined;
  switch (w.trigger) {
    case "assignment":
      return {
        short: tr({ en: `Hand in "${task?.title ?? "the task"}"`, id: `Kumpulkan "${task?.title ?? "tugasnya"}"` }),
        long: tr({
          en: `EduNex counts you present when you hand in "${task?.title ?? "the task"}" inside the window.`,
          id: `EduNex menghitungmu hadir saat kamu mengumpulkan "${task?.title ?? "tugasnya"}" di dalam jendela waktunya.`,
        }),
      };
    case "module":
      return {
        short: tr({ en: "Open the module", id: "Buka modulnya" }),
        long: tr({ en: "EduNex counts you present when you open the module inside the window.", id: "EduNex menghitungmu hadir saat kamu membuka modulnya di dalam jendela waktu." }),
      };
    case "thread":
      return {
        short: tr({ en: "Post in the discussion", id: "Ikut diskusi" }),
        long: tr({ en: "EduNex counts you present when you join the discussion inside the window.", id: "EduNex menghitungmu hadir saat kamu ikut diskusi di dalam jendela waktu." }),
      };
    case "exam":
      return {
        short: tr({ en: "Do the exam", id: "Kerjakan ujiannya" }),
        long: tr({ en: "EduNex counts you present when you do the exam.", id: "EduNex menghitungmu hadir saat kamu mengerjakan ujiannya." }),
      };
    case "vicon":
      return {
        short: tr({ en: "Join the online class", id: "Gabung kelas daring" }),
        long: tr({ en: "EduNex counts you present when you join the online class from EduNex.", id: "EduNex menghitungmu hadir saat kamu bergabung ke kelas daring dari EduNex." }),
      };
    default:
      return {
        short: tr({ en: "Open the material in EduNex", id: "Buka materinya di EduNex" }),
        long: tr({
          en: "EduNex counts you present when you open this course's material in EduNex inside the window. Reading the saved copy in this app doesn't count, so the button opens EduNex.",
          id: "EduNex menghitungmu hadir saat kamu membuka materi mata kuliah ini di EduNex di dalam jendela waktu. Membaca salinan di aplikasi ini tidak dihitung, jadi tombolnya membuka EduNex.",
        }),
      };
  }
}

// ---------------------------------------------------------------- task signals (EduNex)

export interface TaskSignals {
  /** The lecturer edited it after posting. */
  editedAt: string | null;
  /** …and after the Student had already handed it in. */
  editedAfterSubmit: boolean;
  /** Its answer window is under 6 hours. */
  shortNotice: boolean;
  /** Handing it in inside this Presence window is what records attendance. */
  attendanceWindow: PresenceWindow | null;
  /** Days an answer sat as a draft before it was submitted (or until now). */
  draftDays: number | null;
}

export function taskSignals(data: DesignData, task: Task, now: Date): TaskSignals {
  const editedAt = task.editedAt && new Date(task.editedAt) <= now ? task.editedAt : null;
  const window = task.opensAt && task.dueAt ? Date.parse(task.dueAt) - Date.parse(task.opensAt) : null;
  const draftEnd = task.submittedAt ?? (task.status === "draft" ? now.toISOString() : null);
  return {
    editedAt,
    editedAfterSubmit: Boolean(editedAt && task.submittedAt && editedAt > task.submittedAt),
    shortNotice: window !== null && window < 6 * HOUR,
    attendanceWindow: data.presence.find((p) => p.taskId === task.id) ?? null,
    draftDays: task.draftStartedAt && draftEnd ? Math.floor((Date.parse(draftEnd) - Date.parse(task.draftStartedAt)) / DAY) : null,
  };
}

// ---------------------------------------------------------------- graduation path (SIX)

export interface PlannedCourse {
  code: string;
  name: string;
  sks: number;
  why: Text;
}

export interface GraduationPath {
  target: number;
  passed: number;
  inProgress: number;
  /** SKS still missing once this term's courses pass. */
  leftAfterTerm: number;
  requiredLeft: { code: string; name: string; sks: number; semester: number }[];
  specialization: {
    name: string;
    sks: number;
    done: { code: string; name: string; sks: number }[];
    left: { code: string; name: string; sks: number }[];
  } | null;
  /** The program's recommended length, and the semester the Student is in now. */
  semesters: number;
  semesterNow: number;
  nextTerm: PlannedCourse[];
  maxSks: number | null;
}

export function graduationPath(data: DesignData): GraduationPath {
  const positioned = data.curriculum.stages.flatMap((st) => st.semesters.flatMap((sem) => sem.courses.map((c) => ({ ...c, semester: sem.number }))));
  const current = new Set(data.krs.courses.map((c) => c.code));
  const passedCodes = new Set(data.transcript.flatMap((s) => s.courses.filter((c) => c.grade).map((c) => c.code)));
  const requiredLeft = positioned
    .filter((c) => c.grade === "Belum diambil")
    .map(({ code, name, sks, semester }) => ({ code, name, sks, semester }));
  const inProgress = data.krs.courses.reduce((sum, c) => sum + c.sks, 0);
  const passed = data.student.sksPassed;
  const target = data.program.graduationSks;

  const spec = data.student.specialization
    ? data.curriculum.specializations.find((s) => s.name === data.student.specialization?.name)
    : undefined;
  const specialization = spec
    ? {
        name: spec.name,
        sks: spec.sks,
        done: spec.courses.filter((c) => passedCodes.has(c.code) || current.has(c.code)),
        left: spec.courses.filter((c) => !passedCodes.has(c.code) && !current.has(c.code)),
      }
    : null;

  const nextTerm: PlannedCourse[] = [
    ...requiredLeft.map((c) => ({ code: c.code, name: c.name, sks: c.sks, why: { en: "Required", id: "Wajib" } })),
    ...(specialization?.left ?? []).map((c) => ({
      code: c.code,
      name: c.name,
      sks: c.sks,
      why: { en: `Completes ${specialization?.name}`, id: `Menuntaskan ${specialization?.name}` },
    })),
  ];
  const entry = /(\d{4}) semester (\d)/.exec(data.student.entry ?? "");
  const term = /^(\d)-(\d{4})/.exec(data.student.termLabel.trim());
  const semesterNow = entry && term ? (Number(term[2]) - Number(entry[1])) * 2 + Number(term[1]) - Number(entry[2]) + 1 : 0;

  return {
    target,
    passed,
    inProgress,
    leftAfterTerm: Math.max(0, target - passed - inProgress),
    requiredLeft,
    specialization,
    semesters: data.program.semesters,
    semesterNow,
    nextTerm,
    maxSks: data.student.maxSks,
  };
}

// ---------------------------------------------------------------- honors (Peraturan Akademik ITB, Pasal 49)

export const HONORS = [
  { key: "summa", min: 3.85, label: { en: "Summa cum laude", id: "Summa cum laude" } },
  { key: "magna", min: 3.75, label: { en: "Magna cum laude", id: "Magna cum laude" } },
  { key: "cum", min: 3.5, label: { en: "Cum laude", id: "Cum laude" } },
] as const;

export interface HonorsOption {
  key: (typeof HONORS)[number]["key"];
  min: number;
  label: Text;
  /** Average IP needed over the SKS still to be graded; null when even straight A's fall short. */
  needAvg: number | null;
}

/** What average the remaining graded SKS need for each honors level, from the exact transcript points. */
export function honorsPath(data: DesignData, remainingSks: number): HonorsOption[] {
  const { points, gradedSks } = data.grades;
  return HONORS.map((h) => {
    const need = (h.min * (gradedSks + remainingSks) - points) / remainingSks;
    return { ...h, needAvg: need > 4 + 1e-9 ? null : Math.max(0, need) };
  });
}

// ---------------------------------------------------------------- what changed (both systems)

export interface ChangeEvent {
  id: string;
  at: string;
  source: Source;
  courseCode: string | null;
  kind: "schedule" | "exam" | "task_new" | "task_edited" | "material_new" | "krs";
  title: string;
  detail: string;
  /** Edits after you submitted, and SIX schedule changes, deserve a second look. */
  important: boolean;
  go?: { screen: Screen; task?: string; course?: string };
}

export function changeFeed(p: VariantProps): ChangeEvent[] {
  const { data, now, f, tr } = p;
  const events: ChangeEvent[] = [];
  for (const c of scheduleChanges(data, f)) {
    const s = c.session;
    const what =
      c.kinds.includes("time") && c.kinds.includes("room")
        ? tr({ en: `${f.timeRange(s.start, s.end)} in ${s.room}`, id: `${f.timeRange(s.start, s.end)} di ${s.room}` })
        : c.kinds.includes("time")
          ? f.timeRange(s.start, s.end)
          : tr({ en: `in ${s.room}`, id: `di ${s.room}` });
    events.push({
      id: `sched-${s.id}`,
      // The real engine stamps the moment it noticed; the prototype has one snapshot, so use the start of that day.
      at: new Date(Math.min(Date.parse(s.start), now.getTime()) - 12 * HOUR).toISOString(),
      source: "SIX",
      courseCode: s.courseCode,
      kind: "schedule",
      title: tr({ en: `${s.courseCode} on ${f.weekdayShort(s.start)} ${f.dayMonth(s.start)}: ${what}`, id: `${s.courseCode} ${f.weekdayShort(s.start)} ${f.dayMonth(s.start)}: ${what}` }),
      detail: tr({
        en: `Usually ${c.usual.start}–${c.usual.end}${c.kinds.includes("room") ? ` in ${c.usual.room}` : ""}. SIX doesn't flag changes.`,
        id: `Biasanya ${c.usual.start}–${c.usual.end}${c.kinds.includes("room") ? ` di ${c.usual.room}` : ""}. SIX tidak menandai perubahan.`,
      }),
      important: true,
      go: { screen: "schedule" },
    });
  }
  for (const e of examsOf(data).filter((x) => x.source === "SIX" && x.start)) {
    events.push({
      id: `exam-${e.id}`,
      at: new Date(Date.parse(e.start!) - 8 * DAY).toISOString(),
      source: "SIX",
      courseCode: e.courseCode,
      kind: "exam",
      title: tr({ en: `${e.kind} ${e.courseCode} scheduled`, id: `${e.kind} ${e.courseCode} dijadwalkan` }),
      detail: `${f.weekday(e.start!)}, ${f.dayMonth(e.start!)} · ${f.timeRange(e.start!, e.end!)}${e.room ? ` · ${e.room}` : ""}`,
      important: true,
      go: { screen: "exam", course: e.courseCode },
    });
  }
  for (const task of data.tasks) {
    const sig = taskSignals(data, task, now);
    if (task.createdAt && new Date(task.createdAt) <= now) {
      events.push({
        id: `task-new-${task.id}`,
        at: task.createdAt,
        source: "EduNex",
        courseCode: task.courseCode,
        kind: "task_new",
        title: tr({ en: `New task: ${task.title}`, id: `Tugas baru: ${task.title}` }),
        detail: task.dueAt ? tr({ en: `Due ${f.dueLabel(task.dueAt)}`, id: `Tenggat ${f.dueLabel(task.dueAt)}` }) : "",
        important: sig.shortNotice,
        go: { screen: "task", task: task.id },
      });
    }
    if (sig.editedAt) {
      events.push({
        id: `task-edit-${task.id}`,
        at: sig.editedAt,
        source: "EduNex",
        courseCode: task.courseCode,
        kind: "task_edited",
        title: sig.editedAfterSubmit
          ? tr({ en: `Changed after you submitted: ${task.title}`, id: `Diubah setelah kamu kumpulkan: ${task.title}` })
          : tr({ en: `Task edited: ${task.title}`, id: `Tugas diubah: ${task.title}` }),
        detail: tr({
          en: "The lecturer edited it. EduNex sent no notification.",
          id: "Dosen mengubahnya. EduNex tidak mengirim notifikasi.",
        }),
        important: sig.editedAfterSubmit,
        go: { screen: "task", task: task.id },
      });
    }
  }
  for (const m of data.materials) {
    if (!m.createdAt || new Date(m.createdAt) > now) continue;
    events.push({
      id: `mat-${m.id}`,
      at: m.createdAt,
      source: "EduNex",
      courseCode: m.courseCode,
      kind: "material_new",
      title: tr({ en: `New material: ${m.title}`, id: `Materi baru: ${m.title}` }),
      detail: "",
      important: false,
      go: { screen: "course", course: m.courseCode },
    });
  }
  // EduNex's own feed announces module content by title; keep those it has that aren't files above.
  const seen = new Set(events.map((e) => e.title));
  for (const n of data.notices) {
    if (n.type !== "CONTENT" || new Date(n.date) > now || !n.courseCode) continue;
    const title = tr({ en: `New material: ${n.title}`, id: `Materi baru: ${n.title}` });
    if (seen.has(title)) continue;
    seen.add(title);
    // Lecturers often post the night before or the morning of class; tie it to that class.
    const forClass = data.sessions.find(
      (s) => s.courseCode === n.courseCode && Date.parse(s.start) > Date.parse(n.date) && Date.parse(s.start) - Date.parse(n.date) < DAY,
    );
    events.push({
      id: `notice-${n.id}`,
      at: n.date,
      source: "EduNex",
      courseCode: n.courseCode,
      kind: "material_new",
      title,
      detail: forClass
        ? tr({ en: `For ${f.relativeDay(forClass.start).toLowerCase()}'s ${f.time(forClass.start)} class`, id: `Untuk kuliah ${f.relativeDay(forClass.start).toLowerCase()} ${f.time(forClass.start)}` })
        : n.courseCode,
      important: Boolean(forClass),
      go: { screen: "course", course: n.courseCode },
    });
  }
  for (const step of data.krs.steps) {
    if (!step.at || step.label !== "Persetujuan Dosen Wali") continue;
    events.push({
      id: `krs-${step.phase}-${step.at}`,
      at: step.at,
      source: "SIX",
      courseCode: null,
      kind: "krs",
      title: step.phase === "change"
        ? tr({ en: "Your advisor approved the changed study plan", id: "Dosen wali menyetujui perubahan rencana studi" })
        : tr({ en: "Your advisor approved your study plan", id: "Dosen wali menyetujui rencana studimu" }),
      detail: "",
      important: false,
      go: { screen: "academic" },
    });
  }
  return events.filter((e) => new Date(e.at) <= now).sort((a, b) => b.at.localeCompare(a.at));
}

// ---------------------------------------------------------------- what needs you (both systems)

export interface Action {
  id: string;
  urgency: "now" | "soon" | "later";
  icon: "hand" | "alert" | "exam" | "clash" | "task" | "clock" | "change";
  courseCode: string | null;
  title: string;
  detail: string;
  sources: Source[];
  /** A time to show on the right, e.g. "closes 09:30" or "in 7 days". */
  when?: string;
  primary?: { label: string; external?: Source; go?: { screen: Screen; task?: string; course?: string } };
  secondary?: { label: string; external?: Source; go?: { screen: Screen; task?: string; course?: string } };
}

export function actions(p: VariantProps, targetPct: number): Action[] {
  const { data, now, f, tr } = p;
  const list: Action[] = [];
  const health = new Map(data.courses.map((c) => [c.code, attendanceHealth(data, c.code, now, f, targetPct)]));
  const changes = scheduleChanges(data, f);
  const allClashes = clashes(data, now, f);

  // 1. Attendance that can be recorded right now, in whichever system counts.
  for (const s of data.sessions) {
    const live = new Date(s.start) <= now && now < new Date(s.end);
    if (!live) continue;
    const h = health.get(s.courseCode);
    const window = data.presence.find((x) => x.courseCode === s.courseCode && new Date(x.opensAt) <= now && now < new Date(x.closesAt));
    const change = changes.find((c) => c.session.id === s.id);
    const counted = h?.attended !== null && h?.held !== null ? `${h?.attended} ${tr({ en: "of", id: "dari" })} ${h?.held}` : "";
    const longer = change?.kinds.includes("time")
      ? tr({ en: ` (usually until ${change.usual.end})`, id: ` (biasanya sampai ${change.usual.end})` })
      : "";
    list.push({
      id: `presence-${s.id}`,
      urgency: "now",
      icon: "hand",
      courseCode: s.courseCode,
      title: tr({ en: `Record your ${s.courseCode} attendance`, id: `Catat kehadiran ${s.courseCode}` }),
      detail:
        h?.source === "SIX"
          ? tr({
              en: `Class until ${f.time(s.end)}${longer} · ${s.room}. SIX is where your lecturer counts you (${counted} so far): mark it there.${window ? ` EduNex Presence is open too until ${f.time(window.closesAt)}; it counts once you open the course material in EduNex (you have ${h.edunexMarked} of ${h.edunexPast} there).` : ""}`,
              id: `Kuliah sampai ${f.time(s.end)}${longer} · ${s.room}. Dosen menghitungmu di SIX (${counted} sejauh ini): tandai di sana.${window ? ` Presensi EduNex juga dibuka sampai ${f.time(window.closesAt)}; terhitung setelah kamu membuka materi mata kuliah di EduNex (tercatat ${h.edunexMarked} dari ${h.edunexPast} di sana).` : ""}`,
            })
          : tr({
              en: `Class until ${f.time(s.end)} · ${s.room}. ${window ? presenceAction(data, window, tr).long : "Your lecturer counts attendance in EduNex."}`,
              id: `Kuliah sampai ${f.time(s.end)} · ${s.room}. ${window ? presenceAction(data, window, tr).long : "Dosen mencatat kehadiran di EduNex."}`,
            }),
      sources: window ? ["SIX", "EduNex"] : ["SIX"],
      when: window ? tr({ en: `EduNex closes ${f.time(window.closesAt)}`, id: `EduNex tutup ${f.time(window.closesAt)}` }) : f.countdown(s.end),
      primary: { label: tr({ en: `Open in ${h?.source ?? "SIX"}`, id: `Buka di ${h?.source ?? "SIX"}` }), external: h?.source ?? "SIX" },
      secondary: window && h?.source === "SIX" ? { label: presenceAction(data, window, tr).short, external: "EduNex" } : undefined,
    });
  }

  // 2. Classes today you can't afford to miss (no absences left).
  const mustAttend = data.sessions.filter(
    (s) => f.dayOffset(s.start) === 0 && new Date(s.start) > now && !isExamActivity(s.activity) && health.get(s.courseCode)?.state === "last",
  );
  if (mustAttend.length) {
    const parts = mustAttend.map((s) => {
      const h = health.get(s.courseCode)!;
      return tr({
        en: `${s.courseCode} ${f.time(s.start)} in ${s.room} (${h.attended} of ${h.held} so far)`,
        id: `${s.courseCode} ${f.time(s.start)} di ${s.room} (${h.attended} dari ${h.held} sejauh ini)`,
      });
    });
    list.push({
      id: "last-today",
      urgency: "now",
      icon: "alert",
      courseCode: mustAttend[0].courseCode,
      title:
        mustAttend.length === 1
          ? tr({ en: `Don't miss ${mustAttend[0].courseCode} today`, id: `Jangan lewatkan ${mustAttend[0].courseCode} hari ini` })
          : tr({
              en: `Don't miss ${mustAttend.map((s) => s.courseCode).join(" or ")} today`,
              id: `Jangan lewatkan ${mustAttend.map((s) => s.courseCode).join(" dan ")} hari ini`,
            }),
      detail: tr({
        en: `${parts.join(" · ")}. One more absence in either and ${targetPct}% is out of reach.`,
        id: `${parts.join(" · ")}. Satu kali absen lagi di salah satunya dan ${targetPct}% tidak tercapai.`,
      }),
      sources: ["SIX"],
      when: f.fromNow(mustAttend[0].start),
      primary: { label: tr({ en: "See attendance", id: "Lihat kehadiran" }), go: { screen: "presence" } },
    });
  }

  // 3. Meetings SIX doesn't list, announced only in EduNex text (often only in the parent class).
  for (const m of offTimetable(data, f)) {
    if (new Date(m.end) <= now || Date.parse(m.start) - now.getTime() > 3 * DAY) continue;
    list.push({
      id: `extra-${m.id}`,
      urgency: f.dayOffset(m.start) === 0 ? "now" : "soon",
      icon: "change",
      courseCode: m.courseCode,
      title: tr({
        en: `${m.courseCode} meets ${m.online ? "online " : ""}${f.relativeDay(m.start).toLowerCase()}, ${f.timeRange(m.start, m.end)}`,
        id: `${m.courseCode} ada pertemuan ${m.online ? "daring " : ""}${f.relativeDay(m.start).toLowerCase()}, ${f.timeRange(m.start, m.end)}`,
      }),
      detail: tr({
        en: `Meeting ${m.number} is announced only in an EduNex text in the parent class. It isn't in SIX's timetable.${m.link ? " The Teams link is ready." : ""}`,
        id: `Pertemuan ${m.number} hanya diumumkan lewat teks EduNex di kelas induk. Tidak ada di jadwal SIX.${m.link ? " Link Teams sudah tersedia." : ""}`,
      }),
      sources: ["EduNex"],
      when: f.fromNow(m.start),
      primary: m.link ? { label: "Teams", external: "EduNex" } : undefined,
    });
  }

  // 4. Exams within two weeks, with what EduNex holds for them.
  for (const e of examsOf(data)) {
    if (e.source !== "SIX" || !e.start || new Date(e.start) < now || Date.parse(e.start) - now.getTime() > 14 * DAY) continue;
    const takeHome = examsOf(data).find((x) => x.courseCode === e.courseCode && x.taskId);
    const task = takeHome ? data.tasks.find((t) => t.id === takeHome.taskId) : undefined;
    list.push({
      id: `exam-${e.id}`,
      urgency: Date.parse(e.start) - now.getTime() < 2 * DAY ? "now" : "soon",
      icon: "exam",
      courseCode: e.courseCode,
      title: tr({ en: `${e.kind} ${e.courseCode}: ${f.relativeDay(e.start)}, ${f.time(e.start)}`, id: `${e.kind} ${e.courseCode}: ${f.relativeDay(e.start)}, ${f.time(e.start)}` }),
      detail: tr({
        en: `${e.room ? `Room ${e.room}. ` : ""}It's only on SIX's calendar.${task?.dueAt ? ` EduNex also has a take-home "${task.title}" due ${f.dueLabel(task.dueAt)}.` : ""}`,
        id: `${e.room ? `Ruang ${e.room}. ` : ""}Hanya ada di kalender SIX.${task?.dueAt ? ` EduNex juga punya "${task.title}" (dikerjakan di rumah), tenggat ${f.dueLabel(task.dueAt)}.` : ""}`,
      }),
      sources: task ? ["SIX", "EduNex"] : ["SIX"],
      when: f.fromNow(e.start),
      primary: { label: tr({ en: "Prepare", id: "Persiapan" }), go: { screen: "exam", course: e.courseCode } },
    });
  }

  // 5. Attendance already out of reach — the earlier it's raised, the more can be done.
  const out = data.courses.filter((c) => health.get(c.code)?.state === "out");
  if (out.length) {
    const parts = out.map((c) => {
      const h = health.get(c.code)!;
      return tr({
        en: `${c.code} ${h.attended}/${h.held}, best ${Math.round((h.best ?? 0) * 100)}%`,
        id: `${c.code} ${h.attended}/${h.held}, maksimal ${Math.round((h.best ?? 0) * 100)}%`,
      });
    });
    list.push({
      id: "attendance-out",
      urgency: "soon",
      icon: "alert",
      courseCode: out[0].code,
      title:
        out.length === 1
          ? tr({ en: `${out[0].code} can't reach ${targetPct}% attendance anymore`, id: `Kehadiran ${out[0].code} tidak bisa lagi mencapai ${targetPct}%` })
          : tr({ en: `${out.length} courses can't reach ${targetPct}% attendance anymore`, id: `${out.length} mata kuliah tidak bisa lagi mencapai ${targetPct}% kehadiran` }),
      detail: tr({
        en: `${parts.join(" · ")}, even attending every remaining meeting. If SIX missed a meeting you attended, ask your lecturer to fix it now, while they remember.`,
        id: `${parts.join(" · ")}, walau hadir di semua pertemuan tersisa. Kalau SIX tidak mencatat pertemuan yang kamu hadiri, minta dosen memperbaikinya sekarang, selagi masih ingat.`,
      }),
      sources: ["SIX"],
      primary: { label: tr({ en: "See attendance", id: "Lihat kehadiran" }), go: { screen: "presence" } },
    });
  }

  // 6. Clashing classes (SIX lets a KRS through with them).
  for (const c of allClashes) {
    list.push({
      id: `clash-${c.codes.join("-")}`,
      urgency: "soon",
      icon: "clash",
      courseCode: c.codes[0],
      title: tr({ en: `${c.codes[0]} and ${c.codes[1]} overlap every ${c.weekday}`, id: `${c.codes[0]} dan ${c.codes[1]} bentrok setiap ${c.weekday}` }),
      detail: c.next
        ? tr({
            en: `${c.from}–${c.to}, ${c.minutes} minutes: ${c.next[0].courseCode} in ${c.next[0].room}, ${c.next[1].courseCode} in ${c.next[1].room}. Agree with both lecturers how you'll attend.`,
            id: `${c.from}–${c.to}, ${c.minutes} menit: ${c.next[0].courseCode} di ${c.next[0].room}, ${c.next[1].courseCode} di ${c.next[1].room}. Sepakati dengan kedua dosen cara kamu hadir.`,
          })
        : "",
      sources: ["SIX"],
      primary: { label: tr({ en: "Schedule", id: "Jadwal" }), go: { screen: "schedule" } },
    });
  }

  // 7. Tasks: drafts nobody has received, deadlines inside 3 days, and Tasks that double as attendance.
  for (const task of data.tasks) {
    if (!task.dueAt) continue;
    const left = Date.parse(task.dueAt) - now.getTime();
    const sig = taskSignals(data, task, now);
    if (task.status === "draft" && left > 0 && left < 3 * DAY) {
      list.push({
        id: `draft-${task.id}`,
        urgency: left < DAY ? "now" : "soon",
        icon: "task",
        courseCode: task.courseCode,
        title: tr({ en: `Draft not handed in: ${task.title}`, id: `Draf belum dikumpulkan: ${task.title}` }),
        detail: tr({ en: "Your lecturer can't see a draft. Submit it before the deadline.", id: "Dosen tidak bisa melihat draf. Kumpulkan sebelum tenggat." }),
        sources: ["EduNex"],
        when: f.fromNow(task.dueAt),
        primary: { label: tr({ en: "Open", id: "Buka" }), go: { screen: "task", task: task.id } },
      });
    } else if (task.status === "not_started" && left > 0 && left < 3 * DAY) {
      list.push({
        id: `due-${task.id}`,
        urgency: left < DAY ? "now" : "soon",
        icon: "clock",
        courseCode: task.courseCode,
        title: tr({ en: `Due ${f.relativeDay(task.dueAt).toLowerCase()}: ${task.title}`, id: `Tenggat ${f.relativeDay(task.dueAt).toLowerCase()}: ${task.title}` }),
        detail: f.dueLabel(task.dueAt),
        sources: ["EduNex"],
        when: f.fromNow(task.dueAt),
        primary: { label: tr({ en: "Open", id: "Buka" }), go: { screen: "task", task: task.id } },
      });
    }
    const w = sig.attendanceWindow;
    if (w && task.status !== "submitted" && new Date(w.closesAt) > now && Date.parse(w.opensAt) - now.getTime() < 10 * DAY) {
      list.push({
        id: `task-presence-${task.id}`,
        urgency: "later",
        icon: "hand",
        courseCode: task.courseCode,
        title: tr({
          en: `Hand in "${task.title}" on ${f.weekdayShort(w.opensAt)} ${f.dayMonth(w.opensAt)}, ${f.timeRange(w.opensAt, w.closesAt)}`,
          id: `Kumpulkan "${task.title}" ${f.weekdayShort(w.opensAt)} ${f.dayMonth(w.opensAt)}, ${f.timeRange(w.opensAt, w.closesAt)}`,
        }),
        detail: tr({
          en: `Your lecturer set this ${task.courseCode} Presence to "Answer Assignment": it counts only if you hand the task in inside that window. EduNex shows this only on its Presence page.`,
          id: `Dosen mengatur Presensi ${task.courseCode} ini ke "Answer Assignment": hanya terhitung jika tugas dikumpulkan di dalam jendela itu. EduNex hanya menampilkannya di halaman Presensi.`,
        }),
        sources: ["EduNex"],
        when: f.fromNow(w.opensAt),
        primary: { label: tr({ en: "Open task", id: "Buka tugas" }), go: { screen: "task", task: task.id } },
      });
    }
  }

  const rank = { now: 0, soon: 1, later: 2 };
  return list.sort((a, b) => rank[a.urgency] - rank[b.urgency]);
}
