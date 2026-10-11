// Everything the course page reads for one course, from the store: EduNex's
// outline, materials, Presence, announcements, exams and Tasks, SIX's
// timetable, and the meetings merged from them.
import { useMemo } from "react";
import { announcedMeetings, courseMeetings, type Meeting } from "../../../core/course-meetings";
import type { Announcement, ClassSession, CourseOutline, DatasetName, EdunexExam, Material, PresenceSession, Task } from "../../../core/models";
import { type TermCourse, useTermCourses } from "../../courses";
import { useDataset } from "../../store";

// SIX's timetable is registered by the SIX ticket (#76); until then nothing arrives under this name.
const SIX_SCHEDULE = "six.schedule" as DatasetName;

export interface CoursePage {
  course: TermCourse;
  /** undefined while EduNex hasn't been read yet. */
  outline: CourseOutline | undefined;
  materials: Material[] | undefined;
  presence: PresenceSession[] | undefined;
  announcements: Announcement[] | undefined;
  exams: EdunexExam[] | undefined;
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
  const exams = useDataset("edunex.exams");
  const tasks = useDataset("edunex.tasks");
  const six = useDataset(SIX_SCHEDULE) as ClassSession[] | undefined;
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
      exams: exams?.[code],
      tasks: (tasks ?? []).filter((task) => task.courseCode === code),
      meetings: courseMeetings(code, presence?.[code] ?? [], six ?? null, announced),
      inSix: (six ?? []).some((session) => session.courseCode === code),
    };
  }, [code, courses, outline, materials, presence, announcements, exams, tasks, six]);
}

/** A Task still to do: not handed in, and not past its deadline. */
export const isOpenTask = (task: Task, now: number) => (task.status === "not_started" || task.status === "draft") && (task.dueAt === null || task.dueAt > now);
