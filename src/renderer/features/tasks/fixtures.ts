/**
 * Fixture data for the tasks slice — real API shapes only.
 *
 * Task/answer shapes follow the live captures: GET /course/tasks is a JSON-API
 * envelope (#9), the answer lifecycle is draft (is_sent=0) → submitted
 * (is_sent=1) per #16, and `sent_at` is stamped on drafts too (the decoy that
 * makes students think they submitted — the UI must derive status from
 * `is_sent` only). The final-submit contract and re-submission rules stay a
 * bounded known-unknown until #12 captures a real submission (due 2026-09-14).
 */

export const NOW = new Date("2026-09-05T14:00:00+07:00"); // pinned demo clock

export interface CourseTask {
  id: number;
  code: string;
  title: string;
  due: string; // ISO
  hue: string;
}

export const COURSE_TASKS: CourseTask[] = [
  { id: 113986, code: "II4091", title: "Tugas 01 — Usulan Dosen Pembimbing dan Topik", due: "2026-09-14T23:59:00+07:00", hue: "#DCE4F5" },
  { id: 114055, code: "ME4066", title: "Tugas 01 — Laporan Iklim dan Mitigasi", due: "2026-09-07T23:59:00+07:00", hue: "#FBE3CD" },
  { id: 114077, code: "DK4073", title: "Tugas 01 — Case Study: Brand Audit", due: "2026-09-03T23:59:00+07:00", hue: "#DCEBDD" },
  { id: 114101, code: "PL3032", title: "Tugas 01 — Kajian Transportasi Daerah", due: "2026-09-21T23:59:00+07:00", hue: "#D8EAF6" },
];

export const OPEN_TASK_ID = 113986;
export const OVERDUE_ID = 114077;

export const OPEN_TASK = {
  id: 113986,
  answerId: 4472101,
  code: "II4091",
  course: "Final Project Proposal",
  lecturer: "Dr. Fetty Fitriyanti Lubis",
  name: "Tugas 01 — Usulan Dosen Pembimbing dan Topik",
  due: "2026-09-14T23:59:00+07:00",
  draftSavedAt: "2026-09-01T21:14:00+07:00", // live capture, #16
  text: "Usulan pembimbing: Dr. Fetty Fitriyanti Lubis (mikrokontroler terapan). Topik: sistem monitoring energy laboratorium berbasis ESP32 dengan dashboard web. Rencana metodologi dan jadwal terlampir.",
  files: [
    { name: "Usulan TA — proposal v1.pdf", size: "412 KB" },
    { name: "Rencana jadwal.xlsx", size: "38 KB" },
  ],
};

export type AnswerState = "not_started" | "draft" | "submitted";
