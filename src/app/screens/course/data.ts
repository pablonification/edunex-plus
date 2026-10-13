// Everything the course page reads for one course, from the store: Edunex's
// outline, materials, Presence, announcements and Tasks, SIX's timetable, the
// meetings merged from them, and the course's exams from every source.
import { useMemo } from "react";
import { announcedMeetings, courseMeetings, type Meeting } from "../../../core/course-meetings";
import type { Exam } from "../../../core/exams";
import type { Announcement, CourseOutline, Material, PresenceSession, Task } from "../../../core/models";
import { type TermCourse, useTermCourses } from "../../courses";
import { useExams } from "../../schedule-data";
import { useDataset } from "../../store";

// SIX's timetable is registered by the SIX ticket (#76); until then nothing arrives under this name.

export interface CoursePage {
  course: TermCourse;
  /** undefined while Edunex hasn't been read yet. */
  outline: CourseOutline | undefined;
  materials: Material[] | undefined;
  presence: PresenceSession[] | undefined;
  announcements: Announcement[] | undefined;
  /** The same exams as in Tugas & Ujian: SIX's sessions, Edunex's exams and take-homes, the outline. */
  exams: Exam[];
  tasks: Task[];
  meetings: Meeting[];
  /** SIX's timetable has this course's sessions. */
  inSix: boolean;
}

export function useCoursePage(code: string): CoursePage | null | undefined {
  const courses = useTermCourses();
  const outline = useDataset("edunex.outline");
  const materials = useDataset("edunex.materials");
  const presence = useDataset("edunex.presence");
  const announcements = useDataset("edunex.announcements");
  const exams = useExams();
  const tasks = useDataset("edunex.tasks");
  const six = useDataset("six.schedule");
  const sixMonths = useDataset("six.scheduleMonths");
  return useMemo(() => {
    if (!courses) return undefined;
    const course = courses.find((c) => c.code === code);
    if (!course) return null;
    const courseMaterials = materials?.[code];
    const courseAnnouncements = announcements?.[code];
    const announced = announcedMeetings(courseMaterials ?? [], courseAnnouncements ?? []);
    return {
      course,
      outline: outline?.[code],
      materials: courseMaterials,
      presence: presence?.[code],
      announcements: courseAnnouncements,
      exams: (exams ?? []).filter((exam) => exam.courseCode === code),
      tasks: (tasks ?? []).filter((task) => task.courseCode === code),
      meetings: courseMeetings(code, presence?.[code] ?? [], six ?? null, announced, sixMonths),
      inSix: (six ?? []).some((session) => session.courseCode === code),
    };
  }, [code, courses, outline, materials, presence, announcements, exams, tasks, six, sixMonths]);
}

/** A Task still to do: not handed in, and not past its deadline. */
export const isOpenTask = (task: Task, now: number) => (task.status === "not_started" || task.status === "draft") && (task.dueAt === null || task.dueAt > now);
