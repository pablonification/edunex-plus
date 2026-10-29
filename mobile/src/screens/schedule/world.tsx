// What every part of Jadwal reads besides its own item (the course's color, name and lecturer, its
// attendance, Edunex's Presence windows, the exam a SIX session belongs to), and the desktop's
// DOM-free helpers for it. Copied from src/app/screens/schedule/details.tsx, which also holds DOM
// parts: ScheduleWorld, ScheduleWorldProvider, useWorld, timeRange, openWindow, handInLabel,
// periodName and holidayName, unchanged.
import { createContext, type ReactNode, useContext, useMemo } from "react";
import { useAttendance } from "../../../../src/app/attendance";
import { useCourseColor } from "../../../../src/app/courses";
import { type Format, type Translate, useNow } from "../../../../src/app/i18n";
import { useCourseNames, useExamIds } from "../../../../src/app/schedule-data";
import { useDataset } from "../../../../src/app/store";
import type { AttendanceHealth } from "../../../../src/core/attendance";
import { wibDay } from "../../../../src/core/course-meetings";
import type { PresenceSession, Task } from "../../../../src/core/models";
import type { TaskWindow } from "../../../../src/core/schedule";

/** What every row on the screen reads besides its own item. */
export interface ScheduleWorld {
  now: number;
  /** The course's color; none for a course the app doesn't know (its mark is an outline). */
  color(code: string): string | undefined;
  name(code: string, fallback?: string): string;
  lecturer(code: string): string | null;
  health(code: string): AttendanceHealth | undefined;
  presence(code: string): readonly PresenceSession[];
  tasks: readonly Task[];
  examId(sessionId: string): string | undefined;
}

const WorldContext = createContext<ScheduleWorld | null>(null);

export function ScheduleWorldProvider({ children }: { children: ReactNode }) {
  const colorOf = useCourseColor();
  const names = useCourseNames();
  const outline = useDataset("edunex.outline");
  const attendance = useAttendance();
  const presence = useDataset("edunex.presence");
  const tasks = useDataset("edunex.tasks");
  const examIds = useExamIds();
  const now = useNow();
  const world = useMemo<ScheduleWorld>(() => {
    const health = new Map((attendance?.courses ?? []).map((c) => [c.course.code, c.health]));
    return {
      now,
      color: colorOf,
      name: names,
      lecturer: (code) => outline?.[code]?.lecturer ?? null,
      health: (code) => health.get(code),
      presence: (code) => presence?.[code] ?? [],
      tasks: tasks ?? [],
      examId: (id) => examIds.get(id),
    };
  }, [colorOf, names, outline, attendance, presence, tasks, examIds, now]);
  return <WorldContext.Provider value={world}>{children}</WorldContext.Provider>;
}

export function useWorld(): ScheduleWorld {
  const world = useContext(WorldContext);
  if (!world) throw new Error("ScheduleWorldProvider is missing");
  return world;
}

/** SIX's end time as it is ("12:59"). */
export const timeRange = (f: Format, start: number, end: number) => f.timeRange(start, end);

/** The Edunex Presence window of the course open now, that hasn't recorded the Student yet, on the day of `start`. */
export function openWindow(world: ScheduleWorld, code: string, start: number): PresenceSession | null {
  return (
    world.presence(code).find((p) => wibDay(p.opensAt) === wibDay(start) && p.opensAt <= world.now && world.now < p.closesAt && !p.recorded?.present) ?? null
  );
}

/** "Kumpulkan Tugas 02 Bab II sebelum 23:59 untuk hadir". */
export function handInLabel(t: Translate, f: Format, window: TaskWindow): string {
  const time = f.time(window.presence.closesAt);
  return window.task ? t("schedule.handIn", { task: window.task.title, time }) : t("schedule.handIn.unknown", { time });
}

/** "Masa UTS", "Libur Natal": the period a day falls in, in a few words. */
export function periodName(t: Translate, event: { kind: string; title: string }): string {
  switch (event.kind) {
    case "uts":
    case "uas":
    case "lecture-start":
    case "lecture-end":
    case "drs":
    case "urs":
      return t(`calendar.kind.${event.kind}` as "calendar.kind.uts");
    case "holiday":
      return holidayName(event.title);
    default:
      return event.title;
  }
}

/** "Libur Kuliah dalam rangka Hari Raya Natal" → "Libur Hari Raya Natal": ITB's titles are long. */
function holidayName(title: string): string {
  const match = /^Libur(?:\s+Kuliah)?\s+(?:dalam\s+rangka\s+)?(.+?)\s*\**\)?$/i.exec(title.trim());
  return match ? `Libur ${match[1].replace(/\*+\)?$/, "").trim()}` : title;
}
