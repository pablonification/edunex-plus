// One request at a time per website (src/engine/http/pace.ts). SIX's public catalog, read for the
// planner, shares SIX's line: its pages go only while none of the Student's own pages is waiting.
import { describe, expect, it } from "vitest";
import { Pace } from "../../src/engine/http/pace";
import { FakeClock } from "../pretend/clock";

describe("a site's line", () => {
  it("runs one request at a time, in the order asked", async () => {
    const pace = new Pace(new FakeClock(0));
    const order: string[] = [];
    let running = 0;
    const work = (name: string) => async () => {
      running++;
      expect(running).toBe(1);
      await Promise.resolve();
      order.push(name);
      running--;
      return name;
    };
    expect(await Promise.all([pace.turn(work("a")), pace.turn(work("b")), pace.turn(work("c"))])).toEqual(["a", "b", "c"]);
    expect(order).toEqual(["a", "b", "c"]);
  });

  it("lets the Student's pages go before the background ones queued earlier, and passes errors back", async () => {
    const pace = new Pace(new FakeClock(0));
    const order: string[] = [];
    const work =
      (name: string, fail = false) =>
      async () => {
        await Promise.resolve();
        order.push(name);
        if (fail) throw new Error(name);
        return name;
      };
    const runs = [
      pace.turn(work("catalog 1"), true),
      pace.turn(work("catalog 2"), true),
      pace.turn(work("catalog 3"), true),
      pace.turn(work("status")),
      pace.turn(work("timetable", true)),
    ];
    const settled = await Promise.allSettled(runs);
    // The first catalog page was already going; then the Student's two, then the rest of the catalog.
    expect(order).toEqual(["catalog 1", "status", "timetable", "catalog 2", "catalog 3"]);
    expect(settled[4]).toMatchObject({ status: "rejected" });
    expect(settled[3]).toMatchObject({ status: "fulfilled", value: "status" });
  });
});
