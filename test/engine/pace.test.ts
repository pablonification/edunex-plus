// One request at a time per website (src/engine/http/pace.ts). SIX's public catalog, read for the
// planner, shares SIX's line: its pages go only while none of the Student's own pages is waiting.
import { describe, expect, it } from "vitest";
import { sleep } from "../../src/engine/clock";
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
      pace.turn(work("catalog 1"), "background"),
      pace.turn(work("catalog 2"), "background"),
      pace.turn(work("catalog 3"), "background"),
      pace.turn(work("status")),
      pace.turn(work("timetable", true)),
    ];
    const settled = await Promise.allSettled(runs);
    // The first catalog page was already going; then the Student's two, then the rest of the catalog.
    expect(order).toEqual(["catalog 1", "status", "timetable", "catalog 2", "catalog 3"]);
    expect(settled[4]).toMatchObject({ status: "rejected" });
    expect(settled[3]).toMatchObject({ status: "fulfilled", value: "status" });
  });

  it("lets two through at once on Edunex, never three, the Student's own first", async () => {
    const clock = new FakeClock(0);
    const pace = new Pace(clock, 2);
    let running = 0;
    let most = 0;
    const order: string[] = [];
    const work = (name: string) => async () => {
      running++;
      most = Math.max(most, running);
      order.push(name);
      await sleep(clock, 100);
      running--;
    };
    const runs = [pace.turn(work("a")), pace.turn(work("b")), pace.turn(work("c")), pace.turn(work("d")), pace.turn(work("hand-in"), "first")];
    await clock.advance(1_000);
    await Promise.all(runs);
    expect(most).toBe(2);
    expect(order).toEqual(["a", "b", "hand-in", "c", "d"]);
  });

  it("chooses who goes next on SIX once its gap is over, so a page asked for meanwhile can go first", async () => {
    const clock = new FakeClock(0);
    const pace = new Pace(clock, 1, 2_000);
    const order: string[] = [];
    const page = (name: string) => async () => {
      await pace.gap(2_000);
      order.push(`${name}@${clock.now()}`);
    };
    const runs = [pace.turn(page("status")), pace.turn(page("catalog"), "behind")];
    await clock.advance(500);
    // The status page said whose it is: today's timetable is asked for while the catalog waits.
    runs.push(pace.turn(page("timetable")));
    await clock.advance(10_000);
    await Promise.all(runs);
    expect(order).toEqual(["status@0", "timetable@2000", "catalog@4000"]);
  });
});

describe("giving up on a site that didn't answer", () => {
  it("fails the feeds' waiting requests but still sends the Student's own", async () => {
    const pace = new Pace(new FakeClock(0));
    const sent: string[] = [];
    const work = (name: string) => async () => {
      await Promise.resolve();
      sent.push(name);
      return name;
    };
    let release!: () => void;
    const going = pace.turn(() => new Promise<string>((resolve) => (release = () => resolve("going"))));
    const feed = pace.turn(work("feed"), "behind");
    const handIn = pace.turn(work("hand-in"), "first");
    const settling = Promise.allSettled([going, feed, handIn]);
    await Promise.resolve();
    pace.giveUp(new Error("Edunex didn't answer in time"));
    release();
    const settled = await settling;
    expect(settled[1]).toMatchObject({ status: "rejected" });
    expect(settled[2]).toMatchObject({ status: "fulfilled", value: "hand-in" });
    expect(sent).toEqual(["hand-in"]);
  });
});
