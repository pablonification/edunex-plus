// The class sheet's line under a moved class's time or room (mobile/src/screens/home/moved-line.ts): once SIX's verdict
// on a class that's over takes the sheet's one chip, the line still says the class moved (Check A, after-class-*:
// "Berubah", "08:00–09:30" on PL3002's sheet at 16:05).
import { describe, expect, it } from "vitest";
import { movedLine } from "../../mobile/src/screens/home/moved-line";
import { translate } from "../../src/core/strings";

describe("movedLine", () => {
  it("only says what's usual when the Berubah chip is beside it", () => {
    expect(movedLine("time", "08:00–09:30", true)).toEqual({ key: "mobile.home.usually", vars: { usual: "08:00–09:30" } });
    expect(movedLine("room", "R.SG PWK LT.6", true)).toEqual({ key: "mobile.home.usually", vars: { usual: "R.SG PWK LT.6" } });
  });

  it("says the class moved, in Jadwal's words, when another status took the chip", () => {
    const time = movedLine("time", "08:00–09:30", false);
    expect(time).toEqual({ key: "schedule.moved.time", vars: { usual: "08:00–09:30" } });
    expect(translate("id", time.key, time.vars)).toBe("Berubah · biasanya 08:00–09:30");
    expect(movedLine("room", "R.SG PWK LT.6", false)).toEqual({ key: "schedule.moved.room", vars: { room: "R.SG PWK LT.6" } });
  });
});
