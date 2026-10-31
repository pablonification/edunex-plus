// Jadwal's agenda on the phone (mobile/src/screens/schedule/agenda.ts): which weeks and days its one list holds,
// where today is, and the line a tap on the week strip brings up.
import { describe, expect, it } from "vitest";
import { agendaDays, agendaLines, lineOf } from "../../mobile/src/screens/schedule/agenda";
import type { ScheduleDay } from "../../src/core/schedule";

const empty = (day: string): ScheduleDay => ({ day, classes: [], outside: [], edunex: [], windows: [], due: [], events: [], holiday: null, unread: [] });
const busy = (day: string): ScheduleDay => ({ ...empty(day), classes: [{} as ScheduleDay["classes"][number]] });

describe("Jadwal's agenda", () => {
  it("covers three weeks back to six ahead at least, Monday to Sunday, and to the end of what SIX published, never past 26 weeks", () => {
    const days = agendaDays("2026-10-08", null);
    expect(days[0]).toBe("2026-09-14");
    expect(days.at(-1)).toBe("2026-11-22");
    expect(days.length % 7).toBe(0);
    expect(agendaDays("2026-10-08", "2026-12-31").at(-1)).toBe("2027-01-03");
    expect(agendaDays("2026-10-08", "2028-01-01").length).toBe((3 + 27) * 7);
  });

  it("each week has its line; a day shows when it holds something, is today, or is a weekday SIX says is free", () => {
    const week = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"];
    const plan = week.map((day) => (day === "2026-10-06" || day === "2026-10-09" ? busy(day) : empty(day)));
    const agenda = agendaLines(plan, { six: true, months: ["2026-10"], today: "2026-10-08" });
    expect(agenda.lines.map((line) => (line.type === "week" ? `week ${line.monday}` : `${line.day.day}${line.free ? " free" : ""}`))).toEqual([
      "week 2026-10-05",
      "2026-10-05 free",
      "2026-10-06",
      "2026-10-07 free",
      "2026-10-08 free",
      "2026-10-09",
    ]);
    // The weekend, empty, is left out; a tap on Saturday brings up its week's line.
    expect(lineOf(agenda, "2026-10-10")).toBe(agenda.weekAt.get("2026-10-05"));
    expect(lineOf(agenda, "2026-10-08")).toBe(4);
  });

  it("a week SIX hasn't published says so once, and its empty weekdays aren't called free", () => {
    const plan = ["2026-12-07", "2026-12-08", "2026-12-09", "2026-12-10", "2026-12-11", "2026-12-12", "2026-12-13"].map(empty);
    const agenda = agendaLines(plan, { six: true, months: ["2026-10", "2026-11"], today: "2026-10-08" });
    expect(agenda.lines).toEqual([expect.objectContaining({ type: "week", monday: "2026-12-07", uncovered: true })]);
    // Before a day of it shown, a tap on it brings up the week's line.
    expect(lineOf(agenda, "2026-12-09")).toBe(0);
  });
});
