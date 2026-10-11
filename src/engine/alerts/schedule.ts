// Schedule and exam alerts (#77), from SIX's timetable and EduNex:
// - A class moved: a SIX meeting's time or room changed between two reads
//   (naming old → new), or a meeting SIX newly lists that stands in for the
//   week's usual meeting (naming that one → this one). Raised when it's seen.
// - An extra meeting: one SIX newly lists on top of the week's usual
//   meeting(s), told as an extra meeting, never as the class having moved.
// - Overlapping classes: once per pair of courses per week, on the Monday
//   morning of a week where they clash. SIX never says so.
// - A meeting announced only in EduNex text, in a month whose own SIX page
//   was read, on a day SIX doesn't list it.
// - An exam scheduled (a SIX exam session or a dated EduNex exam appears), and
//   the evening before it. Take-home exams are Tasks: the Task alerts cover them.
// Every one is silent on the first sync (the center does that) and only
// about what is still to come. Days read as the app writes them ("Kam, 15
// Okt", "Thu, 15 Oct"): the text carries both languages' (src/core/dates.ts).
import { wibDay } from "../../core/course-meetings";
import { dateVars, sameLocalDay } from "../../core/dates";
import { type ExamKind, mergeExams } from "../../core/exams";
import type { AlertText, ClassSession } from "../../core/models";
import { translate } from "../../core/strings";
import { dayStart, meetingsOutsideSix, overlaps, pairKey, REMINDER_ALERTS, sessionChanges, slotMarks, weekStart } from "../../core/schedule";
import { type AlertDraft, clockTime, type Detector, type PlannedAlert } from "./detector";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

interface Words {
  id: string;
  en: string;
}

/** "Kam, 15 Okt 10:00–11:30 · 9009" in each language; just the time and room when it's on `sameDayAs`'s day. */
function when(start: number, end: number, room: string | null, sameDayAs?: number): Words {
  const time = `${clockTime(start)}–${clockTime(end)}${room ? ` · ${room}` : ""}`;
  if (sameDayAs !== undefined && sameLocalDay(start, sameDayAs)) return { id: time, en: time };
  const { dateId, dateEn } = dateVars(start);
  return { id: `${dateId} ${time}`, en: `${dateEn} ${time}` };
}
const whenOf = (s: Pick<ClassSession, "start" | "end" | "room">, sameDayAs?: number) => when(s.start, s.end, s.room, sameDayAs);

export const scheduleMoves: Detector = {
  name: "schedule.moved",
  watches: ["six.schedule"],
  changed(change, { now }) {
    if (change.name !== "six.schedule" || !change.previous) return [];
    const drafts: AlertDraft[] = [];
    /** `old` → this session, the day said once when both are on it. */
    const draft = (session: ClassSession, old: Words, oldStart: number): AlertDraft => {
      const next = whenOf(session, oldStart);
      return {
        id: `schedule.moved:${session.id}:${session.start}:${session.end}:${session.room ?? ""}`,
        kind: "scheduleChanged",
        source: "six",
        title: { key: "alert.moved", vars: { course: session.courseCode } },
        body: { key: "alert.moved.body", vars: { oldId: old.id, oldEn: old.en, newId: next.id, newEn: next.en } },
        target: { screen: "schedule" },
      };
    };
    for (const { before, after } of sessionChanges(change.previous, change.next)) {
      if (after.end > now) drafts.push(draft(after, whenOf(before), before.start));
    }
    // A meeting SIX lists for the first time, off the course's usual slot: one standing in for
    // the week's usual meeting moved it; one on top of it is an extra meeting, and says so.
    const known = new Set(change.previous.map((s) => s.id));
    const { moved, extra } = slotMarks(change.next);
    for (const session of change.next) {
      if (known.has(session.id) || session.start <= now) continue;
      const off = moved.get(session.id);
      if (off) {
        // The week's usual meeting it replaces, on its own day.
        const day = dayStart(weekStart(wibDay(session.start))) + off.usual.weekday * DAY;
        const usualStart = day + off.usual.start * MINUTE;
        drafts.push(draft(session, when(usualStart, day + off.usual.end * MINUTE, off.usual.room), usualStart));
      } else if (extra.has(session.id)) {
        const at = whenOf(session);
        drafts.push({
          id: `schedule.extra:${session.id}:${session.start}:${session.end}:${session.room ?? ""}`,
          kind: "scheduleChanged",
          source: "six",
          title: { key: "alert.extra", vars: { course: session.courseCode } },
          body: { key: "alert.extra.body", vars: { whenId: at.id, whenEn: at.en } },
          target: { screen: "schedule" },
        });
      }
    }
    return drafts;
  },
};

export const scheduleOverlaps: Detector = {
  name: "schedule.overlaps",
  watches: ["six.schedule"],
  plan({ get, now }) {
    const byWeek = new Map<string, { pair: string; codes: string[]; first: { from: number; to: number }; until: number }>();
    for (const overlap of overlaps(get("six.schedule") ?? [])) {
      const to = Math.min(overlap.a.end, overlap.b.end);
      if (to <= now) continue;
      const pair = pairKey(overlap);
      const key = `${pair}:${weekStart(wibDay(overlap.from))}`;
      const entry = byWeek.get(key);
      if (entry) entry.until = Math.max(entry.until, to);
      else byWeek.set(key, { pair, codes: pair.split("+"), first: { from: overlap.from, to: overlap.to }, until: to });
    }
    return [...byWeek.entries()].map(([key, { codes, first, until }]): PlannedAlert => ({
      id: `${REMINDER_ALERTS.overlap}${key}`,
      kind: "scheduleChanged",
      source: "six",
      // Monday 06:00 WIB of that week.
      at: dayStart(key.split(":")[1]) + 6 * HOUR,
      until,
      title: { key: "alert.overlap", vars: { a: codes[0], b: codes[1], course: `${codes[0]} · ${codes[1]}` } },
      body: { key: "alert.overlap.body", vars: { ...dateVars(first.from), from: clockTime(first.from), to: clockTime(first.to) } },
      target: { screen: "schedule" },
    }));
  },
};

export const meetingsOutside: Detector = {
  name: "schedule.meetingsOutside",
  watches: ["six.schedule", "six.scheduleMonths", "edunex.materials", "edunex.announcements", "edunex.presence"],
  changed(_change, { get, now }) {
    const materials = get("edunex.materials");
    const announcements = get("edunex.announcements");
    const codes = [...new Set([...Object.keys(materials ?? {}), ...Object.keys(announcements ?? {})])];
    return meetingsOutsideSix(codes, get("six.schedule"), get("six.scheduleMonths"), { materials, announcements, presence: get("edunex.presence") })
      .filter((meeting) => meeting.start > now)
      .map((meeting) => ({
        // The id Beranda's "what changed" gives the same meeting, so it shows once there.
        id: `meeting:${meeting.code}:${meeting.start}`,
        kind: "meeting",
        source: "edunex",
        title: { key: "alert.meetingOutside", vars: { course: meeting.code } },
        body: { key: "alert.meetingOutside.body", vars: { n: meeting.number, ...dateVars(meeting.start), time: `${clockTime(meeting.start)}–${clockTime(meeting.end)}` } },
        target: { screen: "schedule" },
      }));
  },
};

interface DatedExam {
  key: string;
  code: string;
  kind: ExamKind;
  start: number;
  room: string | null;
  /** The exam (and its page) it belongs to. */
  examId: string;
  source: "six" | "edunex";
}

/** Every dated exam sitting, SIX's sessions and EduNex's dated exams, each with the exam it belongs to. */
function datedExams(get: Parameters<NonNullable<Detector["plan"]>>[0]["get"]): DatedExam[] {
  const out: DatedExam[] = [];
  for (const exam of mergeExams({ schedule: get("six.schedule"), edunexExams: get("edunex.exams"), now: 0 })) {
    const base = { code: exam.courseCode, kind: exam.kind, examId: exam.id };
    for (const s of exam.six) out.push({ ...base, key: `six:${s.id}`, start: s.start, room: s.room, source: "six" });
    for (const e of exam.edunex) if (e.start !== null) out.push({ ...base, key: `edunex:${e.id}`, start: e.start, room: null, source: "edunex" });
  }
  return out;
}

/** The exam's kind as each language names it ("Kuis", "Quiz"). */
const kindVars = (kind: ExamKind) => ({ kindId: translate("id", `exam.kind.${kind}`), kindEn: translate("en", `exam.kind.${kind}`) });

function examBody(exam: DatedExam): AlertText {
  const vars = { ...dateVars(exam.start), time: clockTime(exam.start) };
  return exam.room ? { key: "alert.exam.whenRoom", vars: { ...vars, room: exam.room } } : { key: "alert.exam.when", vars };
}

export const examAlerts: Detector = {
  name: "exams",
  watches: ["six.schedule", "edunex.exams"],
  changed(change, { get, now }) {
    if (change.name !== "six.schedule" && change.name !== "edunex.exams") return [];
    return datedExams(get)
      .filter((exam) => exam.start > now)
      .map((exam) => ({
        id: `exam.scheduled:${exam.key}`,
        kind: "exam",
        source: exam.source,
        title: { key: "alert.examScheduled", vars: { ...kindVars(exam.kind), course: exam.code } },
        body: examBody(exam),
        target: { screen: "exam", examId: exam.examId },
      }));
  },
  plan({ get }) {
    return datedExams(get).map((exam) => ({
      id: `${REMINDER_ALERTS.examTomorrow}${exam.key}:${exam.start}`,
      kind: "exam",
      source: exam.source,
      // 18:00 WIB the evening before.
      at: dayStart(wibDay(exam.start)) - 6 * HOUR,
      until: exam.start,
      title: { key: "alert.examTomorrow", vars: { ...kindVars(exam.kind), course: exam.code } },
      body: examBody(exam),
      target: { screen: "exam", examId: exam.examId },
    }));
  },
};
