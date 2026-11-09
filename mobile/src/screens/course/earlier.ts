// The past meetings SIX counted that Pertemuan can't list one by one (round 3's third review: "Hadir 5 dari 9" over a
// list of one meeting): SIX gives totals only, and its timetable is read a month or two at a time, so the meetings
// before what the app read are one quiet row under the list (./meetings.tsx), and the list adds up to the count.
import { type ClassResult, isExamActivity, resultGate } from "../../../../src/core/attendance";
import type { Meeting } from "../../../../src/core/course-meetings";

/** The meetings SIX counted that aren't listed one by one, and how many of them were attended when that can be told. */
export interface Earlier {
  count: number;
  /** The first listed meeting SIX counts: they came before it. Null when none is listed. */
  before: number | null;
  /** Attended of them, when every listed meeting's mark comes from SIX's count; else null (SIX gives totals only). */
  attended: number | null;
}

/**
 * SIX counted `held` meetings; the list shows the past ones the app knows (its timetable months, Edunex's windows). The
 * rest came before what the app read: `held` less the listed meetings SIX counts (not exams, not one SIX hasn't counted
 * yet, nor one just over that SIX may not have counted yet: no result before its `resultGate`). When SIX's count after every listed one is known (attended or not), the rest's attended is the remainder.
 */
export function earlierMeetings(
  meetings: readonly Meeting[],
  now: number,
  health: { held: number | null; attended: number | null } | undefined,
  results: Readonly<Record<string, ClassResult>>,
): Earlier | null {
  if (!health?.held) return null;
  const counted = meetings.filter((m) => {
    if (m.end > now || m.six === null || isExamActivity(m.six.activity)) return false;
    const result = results[m.six.id];
    return result ? result.result !== "missing" : now >= resultGate(m.six).at;
  });
  const count = health.held - counted.length;
  if (count <= 0) return null;
  const known = counted.every((m) => results[m.six!.id] !== undefined);
  const attended = known ? (health.attended ?? 0) - counted.filter((m) => results[m.six!.id]?.result === "counted").length : null;
  return {
    count,
    before: counted[0]?.start ?? null,
    attended: attended !== null && attended >= 0 && attended <= count ? attended : null,
  };
}
