// What Beranda's reasoning and the screens' dates cost on the phone's JS thread, counted rather than timed (a count is
// the same on any machine). On a mid-range Android phone each Intl formatter is made through Java (Hermes asks ICU),
// and every component that shows a date made five per minute (src/core/format.ts); Beranda's reasoning turned a moment
// into its WIB day (`wibDay`) about 1,700 times a pass, each a Date and an ISO string. Both are now made once and kept
// (src/core/intl-formats.ts, src/core/course-meetings.ts).
import { afterEach, expect, it, vi } from "vitest";
import { widgetModel } from "../../mobile/src/widget/model";
import { makeFormat } from "../../src/core/format";
import { snapshotHomeWorld } from "../../src/core/home-world";
import { attention, dueItems, homeContext, nowCard, todayPlan } from "../../src/core/needs";
import { startEngine } from "../engine/harness";
import { demoOptions, demoRun } from "../pretend/demo";

afterEach(() => vi.restoreAllMocks());

/** How many formatters and ISO strings `work` makes. */
function made(work: () => void): { formatters: number; isoStrings: number } {
  const count = { formatters: 0, isoStrings: 0 };
  const { DateTimeFormat, NumberFormat } = Intl;
  const counted = <T extends object>(real: T): T =>
    new Proxy(real, {
      construct(target, args) {
        count.formatters++;
        return Reflect.construct(target as never, args);
      },
    });
  Intl.DateTimeFormat = counted(DateTimeFormat);
  Intl.NumberFormat = counted(NumberFormat);
  const iso = Date.prototype.toISOString;
  vi.spyOn(Date.prototype, "toISOString").mockImplementation(function (this: Date) {
    count.isoStrings++;
    return iso.call(this);
  });
  try {
    work();
  } finally {
    Intl.DateTimeFormat = DateTimeFormat;
    Intl.NumberFormat = NumberFormat;
    vi.restoreAllMocks();
  }
  return count;
}

it("works out Beranda, the widget and the minute's dates again without a new formatter or ISO string", async () => {
  const run = demoRun(demoOptions({ EDUNEX_DEMO: "signed-in" }));
  const { engine } = await startEngine({ world: run.world, start: false });
  await run.prepare(engine);
  engine.stop();
  const snapshot = engine.snapshot();
  const now = run.world.clock.now();
  const beranda = () => {
    const context = homeContext(snapshotHomeWorld(snapshot, now)!);
    const card = nowCard(context);
    const plan = todayPlan(context);
    attention(context, card, plan);
    dueItems(context, plan);
  };
  // The first pass makes what's kept; a redraw (new data, the minute's tick) makes nothing more.
  beranda();
  widgetModel(snapshot, now);
  expect(made(beranda)).toEqual({ formatters: 0, isoStrings: 0 });
  expect(made(() => widgetModel(snapshot, now))).toEqual({ formatters: 0, isoStrings: 0 });
  // Components showing dates, at the minute's tick: each made five formatters before.
  makeFormat("id", now);
  const minutes = () => {
    for (let i = 0; i < 5; i++) makeFormat("id", now + i * 60_000).time(now);
  };
  expect(made(minutes).formatters).toBe(0);
}, 60_000);
