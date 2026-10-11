// Grade alerts (#78), from SIX's transcript and ITB's academic calendar:
// - A grade appears or changes on the transcript: once per course and grade,
//   with the IPK it leaves. The first read after sign-in is the silent baseline.
// - The course questionnaire: SIX hides a course's grade until it's filled, so
//   at the start of ITB's questionnaire window and two days before it closes,
//   while a course of this term still has no grade.
import { gradeChanges, type Transcript } from "../../core/models";
import type { AlertDraft, Detector, DetectorContext, PlannedAlert } from "./detector";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Reminders go out at 08:00 WIB; calendar days start at 00:00 WIB. */
const MORNING = 8 * HOUR;

/** The term in progress: SIX's, else the KRS's, else the transcript's latest. */
function currentTerm({ get }: Pick<DetectorContext, "get">, transcript: Transcript): string | null {
  const student = get("six.student");
  return student?.term ?? get("six.krs")?.term ?? transcript.terms.at(-1)?.term ?? null;
}

export const newGrades: Detector = {
  name: "grades.new",
  watches: ["six.transcript"],
  changed(change) {
    if (change.name !== "six.transcript") return [];
    const ipk = change.next.ipk.six ?? change.next.ipk.computed;
    return gradeChanges(change.previous, change.next).map(
      (c): AlertDraft => ({
        id: `grade:${c.term}:${c.code}:${c.to}`,
        kind: "grade",
        source: "six",
        title: c.from === null ? { key: "alert.grade.new", vars: { course: c.code, grade: c.to } } : { key: "alert.grade.changed", vars: { course: c.code, from: c.from, grade: c.to } },
        body: { key: "alert.grade.body", vars: { name: c.name, ipk: ipk === null ? "—" : ipk.toFixed(2) } },
        target: { screen: "grades" },
      }),
    );
  },
};

export const questionnaireReminder: Detector = {
  name: "grades.questionnaire",
  watches: ["six.transcript", "six.krs", "itb.calendar", "six.student"],
  plan(context) {
    const transcript = context.get("six.transcript");
    const calendar = context.get("itb.calendar");
    if (!transcript || !calendar) return [];
    const term = currentTerm(context, transcript);
    const pending = transcript.terms.find((t) => t.term === term)?.courses.filter((c) => c.standing === "pending").length ?? 0;
    if (!term || pending === 0) return [];
    const planned: PlannedAlert[] = [];
    for (const event of calendar.events) {
      if (event.kind !== "questionnaire" || event.term !== term) continue;
      const remind = (at: number, which: "open" | "closing") =>
        planned.push({
          id: `grade.questionnaire:${event.id}:${which}`,
          kind: "grade",
          source: "itb",
          at,
          until: event.end,
          title: { key: which === "open" ? "alert.questionnaire.open" : "alert.questionnaire.closing" },
          body: { key: "alert.questionnaire.body", vars: { count: pending } },
          target: { screen: "grades" },
        });
      remind(event.start + MORNING, "open");
      // The window closes at the end of its last day: two days before, in the morning.
      const closing = event.end - 3 * DAY + MORNING;
      if (closing > event.start + MORNING) remind(closing, "closing");
    }
    return planned;
  },
};
