// Every alert detector the engine runs. To add an alert: write a detector
// (./detector.ts) that watches the datasets it needs, give its kind text in
// src/core/strings/alerts.ts, and add it here. The center handles never
// twice, the silent first sync, grouping, Settings and the history.
//
// Waiting for their data (each names the dataset it will watch):
// - Overlapping classes (#76 six.schedule): `changed()`, kind "scheduleChanged".
// - Exams scheduled, and the day before (#74 exams, six.schedule UTS/UAS):
//   `changed()` for new ones, `plan()` for the day before; kind "exam".
// - Meetings announced outside SIX (#74 announcements + six.schedule):
//   `changed()`, kind "meeting".
// The same `changed()` results can later feed the in-app "what changed" list.
import { academicCalendar, billReminders, krsChanged, newBill } from "./academic";
import { attendanceBudget, sixNotCounting } from "./attendance";
import { materialForToday, taskEdits } from "./changes";
import type { Detector } from "./detector";
import { edunexNotifications } from "./edunex-feed";
import { newGrades, questionnaireReminder } from "./grades";
import { presenceOpening } from "./presence";
import { deadlineReminders, newTasks } from "./tasks";

export const DETECTORS: readonly Detector[] = [
  newTasks,
  deadlineReminders,
  edunexNotifications,
  taskEdits,
  materialForToday,
  presenceOpening,
  sixNotCounting(),
  attendanceBudget,
  newGrades,
  questionnaireReminder,
  krsChanged,
  newBill,
  billReminders,
  academicCalendar,
];
