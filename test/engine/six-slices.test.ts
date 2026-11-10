// On the phone the engine shares the JS thread with the screens: each SIX page is parsed as it comes, a slice at a time
// with the screens drawing between (src/engine/html-slices.ts parseAhead), and its reader finds it parsed. It must read
// exactly what a page parsed at once reads.
import { afterEach, describe, expect, it, vi } from "vitest";
import { openParsed, parseAhead } from "../../src/engine/html-slices";
import { Pace } from "../../src/engine/http/pace";
import { SixClient } from "../../src/engine/sources/six/client";
import { readSchedule } from "../../src/engine/sources/six/feeds";
import { fetchCurriculum } from "../../src/engine/sources/six/records";
import { sixPage } from "../kit/fixtures";
import { PRETEND_SIX_COOKIE } from "../pretend/six";
import { startEngine } from "./harness";

afterEach(() => vi.restoreAllMocks());

/** A phone-slow clock for the slicing: every look at the time is 10 ms later, so each slice ends in a pause. */
function slowThread(): void {
  let now = Date.now();
  vi.spyOn(Date, "now").mockImplementation(() => (now += 10));
}

async function read<T>(work: (pages: SixClient) => Promise<T>, breathe?: () => Promise<void>): Promise<T> {
  const h = await startEngine({ start: false });
  const pages = new SixClient(h.world, h.world.clock, PRETEND_SIX_COOKIE, "EdunexPlus/test", new Pace(h.world.clock), undefined, breathe);
  const done = work(pages);
  let result: { value: T } | null = null;
  void done.then((value) => (result = { value }));
  while (!result) await h.world.clock.advance(1_000);
  return (result as { value: T }).value;
}

describe("SIX's pages on the phone", () => {
  it("are parsed a slice at a time as they come, and read the same", async () => {
    const at = Date.parse("2026-10-08T08:00:00+07:00");
    const whole = await read((pages) => readSchedule(pages, at));
    const curriculum = await read((pages) => fetchCurriculum(pages));
    slowThread();
    let turns = 0;
    const breathe = async () => {
      turns++;
    };
    expect(await read((pages) => readSchedule(pages, at), breathe)).toEqual(whole);
    // The timetable and the status page it starts from: 34 KB and 18 KB, three slices and two.
    expect(turns).toBeGreaterThanOrEqual(4);
    turns = 0;
    expect(await read((pages) => fetchCurriculum(pages), breathe)).toEqual(curriculum);
    // The 296 KB structure page alone is nineteen slices.
    expect(turns).toBeGreaterThanOrEqual(19);
  });

  it("hand each parsed page out once: a reader may change it", async () => {
    const html = sixPage(/\/keuangan$/);
    await parseAhead(html, async () => undefined);
    const first = openParsed(html);
    first("table").remove();
    expect(openParsed(html)("table").length).toBeGreaterThan(0);
  });
});
