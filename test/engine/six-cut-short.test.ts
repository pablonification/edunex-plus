// #403 and #396: on a shaky connection, SIX's answer arrived empty (the timetable) or stopped partway through the page
// (a curriculum, cut off in the middle of its specializations, before its minor tab), as the reports kept them. That's a
// connection that dropped, not SIX changing its page: the Student sees "No connection", their data stays, nothing is
// reported, and SIX reads again once a whole page comes. A class's popup is a piece of a page, with no </html> of its
// own: ./check-in.test.ts reads it as before.
import { describe, expect, it } from "vitest";
import { bodyText } from "../kit/fixtures";
import { PRETEND_RELAY } from "../pretend/relay";
import { PRETEND_SIX_COOKIE } from "../pretend/six";
import { until } from "./first-sync";
import { type Harness, startEngine } from "./harness";

const TIMETABLE = /\/kelas\/jadwal\//;
const STRUCTURE = /\/kurikulum\/kurikulum\/\d+\/struktur$/;

/** Signed in to SIX, with every report sent by itself, so one that isn't sent was never made. */
async function signedIn() {
  const h = await startEngine({ relay: PRETEND_RELAY });
  await h.engine.updateSettings({ reportSending: "auto", reportAsked: true });
  await until(h, h.engine.signIn("six", { cookie: PRETEND_SIX_COOKIE }));
  return h;
}

/** SIX's pages whose path matches `which`, answered with `body` instead; returns them as they were, to put back. */
function answer(h: Harness, which: RegExp, body: (path: string) => string): Map<string, string> {
  const was = new Map([...h.world.six.pages].filter(([path]) => which.test(path)));
  expect(was.size).toBeGreaterThan(0);
  for (const path of was.keys()) h.world.six.pages.set(path, body(path));
  return was;
}

/** Nothing read since `since` was taken for SIX changing, and nothing kept or sent to report. */
async function nothingChanged(h: Harness, since: number) {
  const read = h.log.entries().slice(since);
  expect(read.filter((entry) => entry.message.startsWith("VendorChanged"))).toEqual([]);
  expect(h.status("six").changedPages).toBeUndefined();
  await until(h, h.engine.reports.idle());
  expect((await h.engine.report({})).problems).toEqual([]);
  expect(h.world.relay.reports).toEqual([]);
}

describe("SIX's answer cut short by a dropped connection", () => {
  it("the timetable arriving empty (#403): no connection, the timetable stays, nothing reported, and it reads again", async () => {
    const h = await signedIn();
    const schedule = h.dataset("six.schedule");
    expect(schedule?.length).toBeGreaterThan(0);
    const since = h.log.entries().length;
    const pages = answer(h, TIMETABLE, () => "");

    await until(h, h.engine.refresh("six"));
    // No answer, as a dropped connection is: once SIX's next page answers whole, it's live again (as Edunex's, #386).
    expect(h.status("six").state).not.toBe("changed");
    expect(h.dataset("six.schedule")).toEqual(schedule);
    expect(
      h.log
        .entries()
        .slice(since)
        .some((entry) => entry.area === "six.schedule" && /came empty/.test(entry.message)),
    ).toBe(true);
    await nothingChanged(h, since);

    for (const [path, html] of pages) h.world.six.pages.set(path, html);
    await h.wait(2 * 60_000);
    expect(h.status("six").state).toBe("live");
  });

  it("a curriculum that stops partway (#396), as the Student's arrived: no connection, not its minor tab gone", async () => {
    const h = await signedIn();
    const curriculum = h.dataset("six.curriculum");
    expect(curriculum?.required.length).toBeGreaterThan(0);
    const since = h.log.entries().length;
    const cut = bodyText("six", "report-six-cut-short-kurikulum-kurikulum-1012-struktur.html");
    expect(cut).not.toMatch(/<\/html>/i);
    const pages = answer(h, STRUCTURE, () => cut);

    await until(h, h.engine.refresh("six"));
    expect(h.status("six").state).not.toBe("changed");
    const read = h.log.entries().slice(since);
    expect(read.some((entry) => entry.area === "six.curriculum" && /came cut short/.test(entry.message))).toBe(true);
    expect(h.dataset("six.curriculum")).toEqual(curriculum);
    await nothingChanged(h, since);

    // The whole page again: the curriculum reads, and the day's read isn't stuck on the cut one.
    for (const [path, html] of pages) h.world.six.pages.set(path, html);
    const after = h.log.entries().length;
    await h.wait(2 * 60_000);
    await until(h, h.engine.refresh("six"));
    expect(
      h.log
        .entries()
        .slice(after)
        .some((entry) => entry.area === "six.curriculum" && entry.message === "ok"),
    ).toBe(true);
    expect(h.status("six").state).toBe("live");
  });
});
