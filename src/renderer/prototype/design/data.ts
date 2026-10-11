// PROTOTYPE (#83) — throwaway. App-shaped data built locally by
// build-local-data.mjs from git-ignored recordings of a real account.
// @ts-ignore: generated locally into .scratch/ and never committed.
import raw from "../../../../.scratch/prototype/design-data.json";

export type TaskStatus = "not_started" | "draft" | "submitted" | "overdue" | "closed" | "in_review";
export const TASK_STATUSES: TaskStatus[] = ["not_started", "draft", "submitted", "overdue", "closed", "in_review"];

export interface Course {
  code: string;
  name: string;
  classNo: string;
  sks: number | null;
  attendancePct: number | null;
  /** SIX's exact count behind the percentage ("Hadir 4 dari 6 pertemuan"). */
  attended: number | null;
  held: number | null;
  color: string;
  lecturer: string | null;
  edunexId: number | null;
  /** False while EduNex's gradebook page still shows its "0.00 · E" placeholder. */
  gradebookPublished: boolean;
}
export interface CourseModule {
  id: string;
  courseCode: string;
  index: number;
  title: string;
  opensAt: string | null;
  closesAt: string | null;
  active: boolean;
}
export interface ClassSession {
  id: string;
  courseCode: string;
  courseName: string;
  start: string;
  end: string;
  activity: string;
  room: string;
}
/** A meeting announced only in an EduNex text item (often only in the parent class). */
export interface AnnouncedMeeting {
  id: string;
  courseCode: string;
  number: number;
  start: string;
  end: string;
  note: string | null;
  online: boolean;
  link: string | null;
  materialId: string;
  updatedAt: string | null;
}
export interface FileRef {
  name: string;
}
export interface Task {
  id: string;
  courseCode: string;
  courseName: string;
  title: string;
  moduleId: string | null;
  instructionsHtml: string;
  files: FileRef[];
  opensAt: string | null;
  dueAt: string | null;
  fileRequired: boolean;
  lateAllowed: boolean;
  status: TaskStatus;
  score: number | null;
  answerFiles: FileRef[];
  submittedAt: string | null;
  /** EduNex's own category: "task", or "uts" for a take-home midterm. */
  domain: string | null;
  /** When the Student's answer was first saved (a draft until submittedAt). */
  draftStartedAt: string | null;
  createdAt: string | null;
  /** When the lecturer last edited it after posting (EduNex never announces edits). */
  editedAt: string | null;
}
export interface PresenceWindow {
  id: string;
  courseCode: string;
  courseName: string;
  classStart: string;
  classEnd: string;
  opensAt: string;
  closesAt: string;
  topic: string;
  myStatus: "attended" | null;
  /** e.g. "Presensi dengan submit Tugas 02 Bab II": attendance granted by handing in a Task. */
  note: string | null;
  taskId: string | null;
  /**
   * The activity EduNex counts as presence during the window (the lecturer's choice):
   * "course" (open the course material, the default), "module", "assignment", "thread",
   * "exam", "vicon", "crs_join"…
   */
  trigger: string;
  /** EduNex's deep link to where that activity happens, when it gives one. */
  url: string | null;
}
export interface Material {
  id: string;
  courseCode: string;
  title: string;
  moduleId: string | null;
  kind: "pdf" | "meeting" | "note" | "other";
  provider: string | null;
  url: string | null;
  sizeBytes: number | null;
  html: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}
export interface Notice {
  id: string;
  courseCode: string | null;
  taskId: string | null;
  type: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
}
export interface KrsStep {
  phase: "plan" | "change";
  label: string;
  at: string | null;
  amount: number | null;
}
export interface Bill {
  year: string;
  semester: number;
  kind: string;
  billed: number | null;
  paid: number | null;
  deadline: string | null;
  installments: boolean;
}
export interface CurriculumCourse {
  code: string;
  name: string;
  kind: "required" | "elective";
  sks: number;
  grade: string | null;
  takenIn: string | null;
}
export interface CurriculumStage {
  name: string;
  ip: number;
  sksPassed: number;
  semesters: { number: number; courses: CurriculumCourse[] }[];
}
export interface DesignData {
  now: string;
  /** ITB's official academic calendar (Kalender Pendidikan ITB 2026/2027). */
  academicCalendar: { key: string; start: string; end: string; en: string; id: string }[];
  /** Registration windows as EduNex receives them from SIX (/login/me). */
  period: { krsStart: string | null; krsEnd: string | null; changeEnd: string | null };
  student: {
    name: string;
    firstName: string;
    nim: string;
    program: string | null;
    termLabel: string;
    advisor: string | null;
    entry: string | null;
    ipk: number | null;
    sksPassed: number;
    maxSks: number | null;
    specialization: { name: string; approvedAt: string | null; status: string } | null;
  };
  program: { name: string; graduationSks: number; semesters: number };
  survey: { term: string; opensAt: string | null; closesAt: string | null; total: number; filled: number } | null;
  sixCalendarFeed: boolean;
  krs: { heading: string; steps: KrsStep[]; courses: { code: string; name: string; classNo: string; sks: number; approved: boolean }[] };
  bills: Bill[];
  curriculum: {
    categories: { label: string; sks: number }[];
    stages: CurriculumStage[];
    /** The program's required courses by recommended semester (SIX Struktur Kurikulum). */
    required: { semester: number; code: string; name: string; sks: number }[];
    specializations: { name: string; sks: number; courses: { code: string; name: string; sks: number }[] }[];
  };
  transcript: { label: string; courses: { code: string; name: string; sks: number; grade: string | null }[] }[];
  sources: { edunex: { updatedAt: string }; six: { updatedAt: string } };
  courses: Course[];
  modules: CourseModule[];
  sessions: ClassSession[];
  announcedMeetings: AnnouncedMeeting[];
  tasks: Task[];
  presence: PresenceWindow[];
  materials: Material[];
  notices: Notice[];
  grades: {
    ipk: number | null;
    points: number;
    gradedSks: number;
    sksPassed: number;
    semesters: { label: string; sks: number; ip: number | null }[];
  };
}

export const data = raw as DesignData;

/** "Real record, changed on purpose": preview a real Task in any status. */
export function withStatus(task: Task, status: TaskStatus | null, now: Date): Task {
  if (!status || status === task.status) return task;
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
  const answer = task.answerFiles.length ? task.answerFiles : [{ name: `${task.courseCode}-jawaban.pdf` }];
  switch (status) {
    case "not_started":
      return { ...task, status, answerFiles: [], submittedAt: null, score: null };
    case "draft":
      return { ...task, status, answerFiles: answer, submittedAt: null, score: null };
    case "submitted":
      return { ...task, status, answerFiles: answer, submittedAt: task.submittedAt ?? hoursAgo(5), score: null };
    case "in_review":
      return { ...task, status, answerFiles: answer, submittedAt: task.submittedAt ?? hoursAgo(30), score: null };
    case "overdue":
      return { ...task, status, answerFiles: [], submittedAt: null, dueAt: hoursAgo(9), lateAllowed: true };
    case "closed":
      return { ...task, status, answerFiles: [], submittedAt: null, dueAt: hoursAgo(26), lateAllowed: false };
  }
}
