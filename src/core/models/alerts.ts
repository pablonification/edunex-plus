// Alerts: what the Student is told about, as OS notifications and in the
// in-app history (#75), and Edunex's own notification feed they partly come
// from. An alert carries its text as catalog keys, so it shows in the
// Student's current language wherever it appears.
import { z } from "zod";
import { Route } from "../route";
import { STRINGS, type StringKey } from "../strings";
import { SourceId } from "./base";

/**
 * The groups the Student can turn on or off in Settings (the approved
 * design's list). Every alert kind belongs to one. "classSoon" is off until
 * the Student turns it on, with its own setting (`classSoonAlerts`).
 */
export const AlertGroup = z.enum([
  "presence",
  "attendanceRisk",
  "changes",
  "exams",
  "deadline",
  "newTask",
  "newMaterial",
  "grade",
  "krs",
  "bill",
  "academic",
  "classSoon",
]);
export type AlertGroup = z.infer<typeof AlertGroup>;

/**
 * What an alert is about. Kinds without a detector yet are listed so later
 * tickets only add a detector (see src/engine/alerts/detectors.ts).
 */
export const AlertKind = z.enum([
  "newTask",
  "newMaterial",
  "deadline",
  "presenceOpen",
  /** A Presence window closes in 15 minutes and the Student isn't recorded present. */
  "presenceClosing",
  "taskEdited",
  "scheduleChanged",
  "meeting",
  "attendanceRisk",
  "exam",
  "grade",
  "krs",
  "bill",
  /** An ITB academic calendar date coming up (DRS, URS, UKT deadline, questionnaire). */
  "academic",
  /** A class starts in 15 minutes. */
  "classSoon",
]);
export type AlertKind = z.infer<typeof AlertKind>;

export const ALERT_GROUP: Record<AlertKind, AlertGroup> = {
  newTask: "newTask",
  newMaterial: "newMaterial",
  deadline: "deadline",
  presenceOpen: "presence",
  presenceClosing: "presence",
  taskEdited: "changes",
  scheduleChanged: "changes",
  meeting: "changes",
  attendanceRisk: "attendanceRisk",
  exam: "exams",
  grade: "grade",
  krs: "krs",
  bill: "bill",
  academic: "academic",
  classSoon: "classSoon",
};

/** A piece of alert text: a catalog key and what fills its placeholders. */
export const AlertText = z.object({
  key: z.custom<StringKey>((key) => typeof key === "string" && Object.hasOwn(STRINGS, key)),
  vars: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});
export type AlertText = z.infer<typeof AlertText>;

export const Alert = z.object({
  /** Stable: the same event always gets the same id, so it never alerts twice. */
  id: z.string(),
  kind: AlertKind,
  source: SourceId,
  /** When it was raised (ms). */
  at: z.number(),
  title: AlertText,
  body: AlertText.nullable(),
  /** The screen that opens when it's clicked. */
  target: Route,
});
export type Alert = z.infer<typeof Alert>;

/** The in-app history: newest first, the last ~200. */
export const AlertHistory = z.object({
  items: z.array(Alert),
  /** Everything raised up to this moment counts as read (opening the history). Nothing is marked in Edunex. */
  readAt: z.number(),
});
export type AlertHistory = z.infer<typeof AlertHistory>;

/** One item of Edunex's notification feed the app understands (types ASSIGNMENT and CONTENT). */
export const EdunexNotification = z.object({
  /** Stable key: type, object and date. */
  key: z.string(),
  type: z.enum(["task", "material"]),
  /** ASSIGNMENT: the Task id. CONTENT: the course id. */
  objectId: z.number(),
  title: z.string(),
  /** The course name at the end of Edunex's message ("… new Content in <course>"), when there. */
  courseName: z.string().nullable(),
  at: z.number(),
});
export type EdunexNotification = z.infer<typeof EdunexNotification>;

export const alertsDatasets = {
  "app.alerts": AlertHistory,
  "edunex.notifications": z.array(EdunexNotification),
} as const;
