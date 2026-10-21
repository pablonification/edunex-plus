// Every alert detector the engine runs. To add an alert: write a detector
// (./detector.ts) that watches the datasets it needs, give its kind text in
// src/core/strings/alerts.ts, and add it here. The center handles never
// twice, the silent first sync, grouping, Settings and the history.
// The same `changed()` results can later feed the in-app "what changed" list.
import { academicCalendar, billReminders, krsChanged, newBill } from "./academic";
import { attendanceBudget, sixNotCounting } from "./attendance";
import { materialForToday, taskEdits } from "./changes";
import { sixCheckIn } from "./check-in";
import type { Detector } from "./detector";
import { edunexNotifications } from "./edunex-feed";
import { newGrades, questionnaireReminder } from "./grades";
import { presenceClosing, presenceOpening } from "./presence";
import { classSoon, examAlerts, meetingsOutside, scheduleMoves, scheduleOverlaps } from "./schedule";
import { deadlineReminders, newTasks } from "./tasks";

export const DETECTORS: readonly Detector[] = [
  newTasks,
  deadlineReminders,
  edunexNotifications,
  taskEdits,
  materialForToday,
  sixCheckIn,
  presenceOpening,
  presenceClosing,
  sixNotCounting(),
  attendanceBudget,
  scheduleMoves,
  scheduleOverlaps,
  meetingsOutside,
  examAlerts,
  classSoon,
  newGrades,
  questionnaireReminder,
  krsChanged,
  newBill,
  billReminders,
  academicCalendar,
];
