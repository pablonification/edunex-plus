// v2-15 (#84): the iCalendar reader behind ITB's academic calendar. ITB's
// feed uses all-day events only; these cover the rest of what calendar feeds
// send, so a change in how ITB exports doesn't silently misread dates.
import { describe, expect, it } from "vitest";
import { parseIcs } from "../../src/engine/sources/itb/ics";

const ics = (...lines: string[]) => ["BEGIN:VCALENDAR", "VERSION:2.0", ...lines, "END:VCALENDAR"].join("\r\n");
const event = (...lines: string[]) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"];
const at = (iso: string) => Date.parse(iso);

describe("iCalendar reader", () => {
  it("reads all-day events as WIB days, with the end exclusive", () => {
    const [e] = parseIcs(ics(...event("UID:a", "SUMMARY:UTS", "DTSTART;VALUE=DATE:20261012", "DTEND;VALUE=DATE:20261017")));
    expect(e).toEqual({ uid: "a", summary: "UTS", start: at("2026-10-12T00:00:00+07:00"), end: at("2026-10-17T00:00:00+07:00"), allDay: true });
  });

  it("reads UTC, zoned and floating times exactly", () => {
    const events = parseIcs(
      ics(
        ...event("UID:utc", "DTSTART:20261012T020000Z", "DTEND:20261012T040000Z"),
        ...event("UID:zoned", "DTSTART;TZID=Asia/Makassar:20261012T090000", "DURATION:PT1H30M"),
        ...event("UID:floating", "DTSTART:20261012T090000"),
      ),
    );
    expect(events.map((e) => [e.uid, new Date(e.start).toISOString(), new Date(e.end).toISOString(), e.allDay])).toEqual([
      ["utc", "2026-10-12T02:00:00.000Z", "2026-10-12T04:00:00.000Z", false],
      ["zoned", "2026-10-12T01:00:00.000Z", "2026-10-12T02:30:00.000Z", false],
      ["floating", "2026-10-12T02:00:00.000Z", "2026-10-12T02:00:00.000Z", false],
    ]);
  });

  it("joins folded lines and unescapes text, and skips alarms inside events", () => {
    const [e] = parseIcs(
      ics(
        ...event(
          "UID:folded",
          "SUMMARY:Penerbitan Ijazah Yudisium Mei 2026\\, Juni 2026\\; dan",
          "  Juli 2026\\nbaris dua",
          "DTSTART;VALUE=DATE:20260827",
          "BEGIN:VALARM",
          "SUMMARY:Pengingat",
          "END:VALARM",
        ),
      ),
    );
    expect(e).toMatchObject({ summary: "Penerbitan Ijazah Yudisium Mei 2026, Juni 2026; dan Juli 2026\nbaris dua", end: at("2026-08-28T00:00:00+07:00") });
  });

  it("expands simple repeats and leaves out excluded dates", () => {
    const events = parseIcs(
      ics(
        ...event(
          "UID:weekly",
          "SUMMARY:Kuliah",
          "DTSTART;TZID=Asia/Jakarta:20261005T070000",
          "DTEND;TZID=Asia/Jakarta:20261005T090000",
          "RRULE:FREQ=WEEKLY;COUNT=4",
          "EXDATE;TZID=Asia/Jakarta:20261012T070000",
        ),
        ...event("UID:daily", "DTSTART;VALUE=DATE:20261224", "RRULE:FREQ=DAILY;UNTIL=20261226"),
      ),
    );
    const days = (uid: string) => events.filter((e) => e.uid.startsWith(uid)).map((e) => new Date(e.start + 7 * 3_600_000).toISOString().slice(0, 16));
    expect(days("weekly")).toEqual(["2026-10-05T07:00", "2026-10-19T07:00", "2026-10-26T07:00"]);
    expect(days("daily")).toEqual(["2026-12-24T00:00", "2026-12-25T00:00", "2026-12-26T00:00"]);
    expect(new Set(events.map((e) => e.uid)).size).toBe(events.length);
  });

  it("refuses something that isn't a calendar", () => {
    expect(() => parseIcs("<!DOCTYPE html><html></html>")).toThrow("Not a calendar");
    expect(() => parseIcs(ics(...event("UID:x", "SUMMARY:no start")))).toThrow("An event has no start");
  });
});
