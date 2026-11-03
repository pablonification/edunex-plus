// The course sheet's count line before SIX has a count (mobile/src/screens/presence/logic.ts noCountLine): a course
// Edunex records says Edunex's own tally, as the desktop's Presensi row does, never just "Belum ada hitungan SIX".
import { describe, expect, it } from "vitest";
import { noCountLine } from "../../mobile/src/screens/presence/logic";
import type { AttendanceHealth } from "../../src/core/attendance";
import { translate } from "../../src/core/strings";

const t = (key: Parameters<typeof translate>[1], vars?: Parameters<typeof translate>[2]) => translate("id", key, vars);

const health = (over: Partial<AttendanceHealth>): AttendanceHealth => ({
  code: "PL3002",
  countedIn: "edunex",
  attended: null,
  held: null,
  left: { count: 0, estimated: false, next: null, upcoming: [] } as unknown as AttendanceHealth["left"],
  absencesLeft: null,
  best: null,
  needsUncertain: false,
  toRecover: null,
  state: "unknown",
  target: 80,
  edunexClosed: 0,
  edunexRecorded: 0,
  ...over,
});

describe("noCountLine", () => {
  it("says Edunex's tally for a course Edunex records", () => {
    expect(noCountLine(t, health({ edunexClosed: 6, edunexRecorded: 1 }), false)).toBe("Hadir 1 dari 6 di Edunex");
  });

  it("says SIX hasn't counted yet before any Edunex window closed", () => {
    expect(noCountLine(t, health({}), false)).toBe("Belum ada hitungan SIX");
  });

  it("says SIX hasn't counted yet for a course SIX counts", () => {
    expect(noCountLine(t, health({ countedIn: "six", edunexClosed: 3, edunexRecorded: 3 }), false)).toBe("Belum ada hitungan SIX");
  });
});
