// What goes into the phone calendar file (#77): SIX's classes and exam
// sessions with their rooms, meetings announced only in EduNex, EduNex's
// dated exams, and every Task deadline (marked once handed in, so importing
// again updates it). Shared by the desktop's save handler and the tests.
import { isExamActivity } from "./attendance";
import { examKind } from "./exams";
import { type IcsItem, writeIcs } from "./ics";
import type { DatasetName, DatasetValue } from "./models";
import { meetingsOutsideSix } from "./schedule";
import { type Lang, translate } from "./strings";
import { edunexTaskUrl, isOpenStatus, taskStatus } from "./tasks";

const UID_HOST = "edunex-plus";
/** A deadline, or a start with no known end, is a short event: some phone calendars reject one that ends when it starts. */
const MOMENT = 30 * 60_000;

export interface PhoneCalendar {
  text: string;
  events: number;
}

/** The calendar file for the datasets at hand, in the Student's language. */
export function phoneCalendar(get: <N extends DatasetName>(name: N) => DatasetValue<N> | undefined, lang: Lang, now: number): PhoneCalendar {
  const schedule = get("six.schedule") ?? [];
  const courses = get("six.courses") ?? [];
  const nameOf = (code: string, fallback?: string) => courses.find((c) => c.code === code)?.name ?? get("edunex.courses")?.find((c) => c.code === code)?.name ?? fallback ?? code;
  /** An exam's kind in the Student's language ("Kuis", "Quiz"), whatever word SIX or EduNex uses. */
  const kindOf = (text: string | null) => translate(lang, `exam.kind.${examKind(text) ?? "UJIAN"}`);
  const items: IcsItem[] = [];

  for (const session of schedule) {
    const code = session.courseCode;
    const name = nameOf(code, session.courseName);
    items.push({
      uid: `six-${session.id}@${UID_HOST}`,
      summary: isExamActivity(session.activity)
        ? translate(lang, "ics.exam", { kind: kindOf(session.activity), code, title: name })
        : translate(lang, "ics.class", { activity: session.activity, code, name }),
      start: session.start,
      end: session.end,
      location: session.room,
      description: translate(lang, "ics.fromSix"),
    });
  }

  const codes = [...new Set([...courses.map((c) => c.code), ...schedule.map((s) => s.courseCode)])];
  const edunex = { materials: get("edunex.materials"), announcements: get("edunex.announcements"), presence: get("edunex.presence") };
  const termOf = (code: string) => get("edunex.courses")?.find((c) => c.code === code)?.term ?? get("six.student")?.term ?? null;
  for (const meeting of meetingsOutsideSix(codes, schedule, get("six.scheduleMonths"), edunex)) {
    items.push({
      // The course's term and code and the meeting's number: not its time, so a meeting the lecturer moves keeps its event.
      uid: `${["edunex-meeting", termOf(meeting.code), meeting.code, meeting.number].filter((part) => part !== null).join("-")}@${UID_HOST}`,
      summary: translate(lang, "ics.meeting", { code: meeting.code, n: meeting.number, name: nameOf(meeting.code) }),
      start: meeting.start,
      end: meeting.end,
      location: meeting.online ? translate(lang, "schedule.online") : null,
      description: translate(lang, "ics.notInSix"),
      url: meeting.link,
    });
  }

  for (const [code, exams] of Object.entries(get("edunex.exams") ?? {})) {
    for (const exam of exams) {
      if (exam.start === null) continue;
      items.push({
        uid: `edunex-exam-${exam.id}@${UID_HOST}`,
        summary: translate(lang, "ics.exam", { kind: kindOf(exam.title), code, title: exam.title ?? nameOf(code) }),
        start: exam.start,
        end: exam.end !== null && exam.end > exam.start ? exam.end : exam.start + MOMENT,
        description: translate(lang, "ics.fromEdunex"),
      });
    }
  }

  for (const task of get("edunex.tasks") ?? []) {
    if (task.dueAt === null) continue;
    const open = isOpenStatus(taskStatus(task, now));
    items.push({
      uid: `edunex-task-${task.id}@${UID_HOST}`,
      summary: translate(lang, open ? "ics.task" : "ics.taskDone", { code: task.courseCode, title: task.title }),
      // Ends at the deadline.
      start: task.dueAt - MOMENT,
      end: task.dueAt,
      description: translate(lang, "ics.fromEdunex"),
      url: edunexTaskUrl(task.id),
      free: true,
    });
  }

  items.sort((a, b) => a.start - b.start || a.uid.localeCompare(b.uid));
  return { text: writeIcs(items, { name: "Edunex Plus", now }), events: items.length };
}
