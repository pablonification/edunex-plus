import { describe, expect, it } from "vitest";
import {
  extractPresenceWindows,
  isWindowOpen,
  nextPresenceDelay,
  openWindows,
} from "./presence-detector";

const T0 = Date.parse("2026-09-16T07:00:00.000Z");

function agendaMeeting(overrides: Record<string, unknown> = {}) {
  return {
    id: 501,
    type: "offline",
    course_code: "II4091",
    course_name: "Final Project Proposal",
    name: "Week 05 — Studio review",
    start_at: "2026-09-16T07:00:00.000Z",
    end_at: "2026-09-16T09:00:00.000Z",
    ...overrides,
  };
}

describe("presence detector", () => {
  it("computes window-open from explicit presence_start/presence_end fields", () => {
    const windows = extractPresenceWindows([
      {
        id: "SIM-WIN-1",
        course_code: "SIM",
        presence_start: new Date(T0 - 60_000).toISOString(),
        presence_end: new Date(T0 + 60_000).toISOString(),
      },
    ]);

    expect(windows).toHaveLength(1);
    expect(windows[0].id).toBe("SIM-WIN-1");
    expect(isWindowOpen(windows[0], T0)).toBe(true);
    expect(openWindows(windows, T0)).toHaveLength(1);
  });

  it("extracts agenda meetings as windows with course context", () => {
    const windows = extractPresenceWindows([agendaMeeting()]);

    expect(windows).toHaveLength(1);
    expect(windows[0]).toMatchObject({
      id: "501",
      courseCode: "II4091",
      courseName: "Final Project Proposal",
      meeting: "Week 05 — Studio review",
      startAt: "2026-09-16T07:00:00.000Z",
      endAt: "2026-09-16T09:00:00.000Z",
    });
    // Open at the start boundary, closed a millisecond after the end.
    expect(isWindowOpen(windows[0], T0)).toBe(true);
    expect(isWindowOpen(windows[0], T0 - 1)).toBe(false);
    expect(isWindowOpen(windows[0], Date.parse("2026-09-16T09:00:00.000Z") + 1)).toBe(false);
  });

  it("handles timezone offsets (WIB +07:00 equals the same Z instant)", () => {
    const windows = extractPresenceWindows([
      agendaMeeting({
        start_at: "2026-09-16T14:00:00+07:00",
        end_at: "2026-09-16T16:00:00+07:00",
      }),
    ]);

    expect(windows).toHaveLength(1);
    expect(windows[0].startMs).toBe(T0);
    expect(windows[0].endMs).toBe(Date.parse("2026-09-16T09:00:00.000Z"));
    expect(isWindowOpen(windows[0], T0)).toBe(true);
  });

  it("accepts wrapped payloads and the open_at/close_at alias pair", () => {
    const windows = extractPresenceWindows({
      data: [
        {
          window_id: "w-9",
          meeting: "Week 09",
          open_at: new Date(T0 - 1_000).toISOString(),
          close_at: new Date(T0 + 3_600_000).toISOString(),
        },
      ],
    });

    expect(windows.map((w) => w.id)).toEqual(["w-9"]);
    expect(openWindows(windows, T0)).toHaveLength(1);
  });

  it("ignores history-shaped records (lone date + status, no end)", () => {
    // /course/presences/list history rows describe the past — promoting
    // them would false-positive on every sync.
    const history = [
      {
        course_id: 401,
        course_code: "II4091",
        courses_name: "Final Project Proposal",
        presences: [
          { id: 7001, name: "Week 01 — Opening", date: "2026-08-19T07:00:00.000Z", status: "Hadir" },
        ],
      },
    ];

    expect(extractPresenceWindows(history)).toEqual([]);
  });

  it("drops unparseable dates and end-before-start windows", () => {
    const windows = extractPresenceWindows([
      agendaMeeting({ id: 1, start_at: "not-a-date" }),
      agendaMeeting({
        id: 2,
        start_at: "2026-09-16T09:00:00.000Z",
        end_at: "2026-09-16T07:00:00.000Z",
      }),
      agendaMeeting({ id: 3, start_at: "2026-09-16T07:00:00.000Z", end_at: null }),
    ]);

    expect(windows).toEqual([]);
  });

  it("event-aligns the next tick to the nearest future opening", () => {
    const windows = extractPresenceWindows([
      agendaMeeting({
        id: "near",
        start_at: new Date(T0 + 8_000).toISOString(),
        end_at: new Date(T0 + 68_000).toISOString(),
      }),
      agendaMeeting({
        id: "far",
        start_at: new Date(T0 + 80_000).toISOString(),
        end_at: new Date(T0 + 140_000).toISOString(),
      }),
    ]);

    // Nearest future opening + 1.5s grace beats the regular 90s tick.
    expect(nextPresenceDelay(windows, T0, 90_000)).toEqual({
      delayMs: 9_500,
      alignedWindowId: "near",
    });
    // A regular tick sooner than any opening wins — no alignment.
    expect(nextPresenceDelay(windows, T0, 5_000)).toEqual({
      delayMs: 5_000,
      alignedWindowId: null,
    });
    // No future window — keep the regular cadence.
    expect(nextPresenceDelay(openWindows(windows, T0), T0 + 100_000, 90_000)).toEqual({
      delayMs: 90_000,
      alignedWindowId: null,
    });
  });
});
