// What goes into the phone calendar file (#77): SIX's classes and exam
// sessions with their rooms, meetings announced only in Edunex, Edunex's
// dated exams, every Task deadline (marked once handed in, so importing
// again updates it), and ITB's calendar (exam weeks, holidays, the last
// lecture day) as whole days. The Student picks what goes in and how far
// ahead. Shared by the desktop's save handler, the export dialog (its
// counts) and the tests.
import { isExamActivity } from "./attendance";
import { examKind } from "./exams";
import { type IcsItem, writeIcs } from "./ics";
import type { CalendarEvent, DatasetName, DatasetValue } from "./models";
import { dayStart, meetingsOutsideSix, taskWindows } from "./schedule";
import { type Lang, translate } from "./strings";
import { edunexTaskUrl, isOpenStatus, taskStatus } from "./tasks";

const UID_HOST = "edunex-plus";
/** A deadline, or a start with no known end, is a short event: some phone calendars reject one that ends when it starts. */
const MOMENT = 30 * 60_000;
const DAY = 24 * 3_600_000;

/** What a calendar item is, for the Student's choice of what goes in. */
export type PhoneKind = "classes" | "exams" | "deadlines" | "itb";
export const PHONE_KINDS: readonly PhoneKind[] = ["classes", "exams", "deadlines", "itb"];

/** ITB's calendar events worth having on a phone: exam weeks, holidays, the term's edges and its deadlines. */
const ITB_KINDS: ReadonlySet<CalendarEvent["kind"]> = new Set([
  "uts",
  "uas",
  "holiday",
  "lecture-start",
  "lecture-end",
  "questionnaire",
  "drs",
  "urs",
  "ukt-deadline",
]);

export interface PhoneCalendarOptions {
  /** Which kinds go in; a kind left out goes in. */
  include?: Partial<Record<PhoneKind, boolean>>;
  /** The first and last day (WIB, "2026-10-08", inclusive) of what goes in; open-ended when left out. */
  from?: string;
  until?: string;
}

export interface PhoneItem extends IcsItem {
  kind: PhoneKind;
}

export interface PhoneCalendar {
  text: string;
  events: number;
}

type Get = <N extends DatasetName>(name: N) => DatasetValue<N> | undefined;

/** Everything the phone calendar can hold for the datasets at hand, in the Student's language, by start. */
export function phoneItems(get: Get, lang: Lang, now: number, options: PhoneCalendarOptions = {}): PhoneItem[] {
  const schedule = get("six.schedule") ?? [];
  const courses = get("six.courses") ?? [];
  const nameOf = (code: string, fallback?: string) =>
    courses.find((c) => c.code === code)?.name ?? get("edunex.courses")?.find((c) => c.code === code)?.name ?? fallback ?? code;
  /** An exam's kind in the Student's language ("Kuis", "Quiz"), whatever word SIX or Edunex uses. */
  const kindOf = (text: string | null) => translate(lang, `exam.kind.${examKind(text) ?? "UJIAN"}`);
  const items: PhoneItem[] = [];
  // A roomless SIX meeting whose Edunex Presence counts a handed-in Task is a window to hand in, not a class to sit in.
  const handIn = new Map(
    taskWindows(get("edunex.presence"), schedule, get("edunex.tasks") ?? []).flatMap((w) => (w.six && !w.six.room ? [[w.six.id, w] as const] : [])),
  );

  for (const session of schedule) {
    const code = session.courseCode;
    const name = nameOf(code, session.courseName);
    const exam = isExamActivity(session.activity);
    const window = handIn.get(session.id);
    if (window) {
      items.push({
        kind: "classes",
        uid: `six-${session.id}@${UID_HOST}`,
        summary: translate(lang, "ics.handIn", { code, task: window.task?.title ?? name }),
        start: window.presence.opensAt,
        end: window.presence.closesAt,
        description: translate(lang, "ics.handIn.note"),
        url: window.task ? edunexTaskUrl(window.task.id) : null,
        free: true,
      });
      continue;
    }
    items.push({
      kind: exam ? "exams" : "classes",
      uid: `six-${session.id}@${UID_HOST}`,
      summary: exam
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
      kind: "classes",
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
        kind: "exams",
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
      kind: "deadlines",
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

  for (const event of get("itb.calendar")?.events ?? []) {
    if (!ITB_KINDS.has(event.kind)) continue;
    items.push({
      kind: "itb",
      uid: `itb-${event.id}@${UID_HOST}`,
      summary: event.title,
      start: dayStart(event.firstDay),
      end: dayStart(event.lastDay) + DAY,
      description: translate(lang, "ics.fromItb"),
      allDay: true,
      free: true,
    });
  }

  const from = options.from ? dayStart(options.from) : Number.NEGATIVE_INFINITY;
  const until = options.until ? dayStart(options.until) + DAY : Number.POSITIVE_INFINITY;
  return items
    .filter((item) => options.include?.[item.kind] !== false && item.end > from && item.start < until)
    .sort((a, b) => a.start - b.start || a.uid.localeCompare(b.uid));
}

/** The calendar file for the datasets at hand, in the Student's language. */
export function phoneCalendar(get: Get, lang: Lang, now: number, options: PhoneCalendarOptions = {}): PhoneCalendar {
  const items = phoneItems(get, lang, now, options).map(({ kind: _kind, ...item }) => item);
  return { text: writeIcs(items, { name: "Edunex Plus", now }), events: items.length };
}
