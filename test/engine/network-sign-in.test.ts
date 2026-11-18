// #381–#383: on campus Wi-Fi that wants its own sign-in first, the network answers for SIX with a page that only sends
// the browser to that sign-in (gate-dev2.itb.ac.id/captive-portal), as the reports kept it. That's no connection yet,
// not SIX changing: the Student sees "No connection", their data stays, nothing is reported, and SIX reads again once
// the network lets it through.
import { describe, expect, it } from "vitest";
import { bodyText } from "../kit/fixtures";
import { PRETEND_RELAY } from "../pretend/relay";
import { PRETEND_SIX_COOKIE } from "../pretend/six";
import { type Harness, startEngine } from "./harness";

/** Lets the fake clock run until `work` is done. */
async function until<T>(h: Harness, work: Promise<T>): Promise<T> {
  let outcome: { value: T } | { error: unknown } | null = null;
  void work.then(
    (value) => (outcome = { value }),
    (error: unknown) => (outcome = { error }),
  );
  for (let second = 0; second < 600 && !outcome; second++) await h.world.clock.advance(1_000);
  if (!outcome) throw new Error("still waiting after ten minutes");
  const done = outcome as { value: T } | { error: unknown };
  if ("error" in done) throw done.error;
  return done.value;
}

/** Signed in to SIX, with every report sent by itself, so one that isn't sent was never made. */
async function signedIn() {
  const h = await startEngine({ relay: PRETEND_RELAY });
  await h.engine.updateSettings({ reportSending: "auto", reportAsked: true });
  await until(h, h.engine.signIn("six", { cookie: PRETEND_SIX_COOKIE }));
  return h;
}

/** The network's sign-in, as #381 kept it, answering for SIX's `path`. */
const signInPage = (path: string) => bodyText("six", "report-campus-wifi-sign-in-statusmhs.html").replaceAll("/app/mahasiswa:18223901/statusmhs", path);

/** Every SIX page answered by the network's sign-in; returns SIX's own pages, to put back. */
function behindNetworkSignIn(h: Harness): Map<string, string> {
  const pages = new Map(h.world.six.pages);
  for (const path of pages.keys()) h.world.six.pages.set(path, signInPage(path));
  return pages;
}

describe("the network's own sign-in answering for SIX", () => {
  it("says there's no connection, keeps the data, reports nothing, and reads SIX again once it's through", async () => {
    const h = await signedIn();
    const courses = h.dataset("six.courses");
    const pages = behindNetworkSignIn(h);

    await until(h, h.engine.refresh("six"));
    expect(h.status("six").state).toBe("offline");
    expect(h.dataset("six.courses")).toEqual(courses);
    await until(h, h.engine.reports.idle());
    expect(h.log.entries().some((entry) => entry.message.startsWith("VendorChanged"))).toBe(false);
    expect((await h.engine.report({})).problems).toEqual([]);
    expect(h.world.relay.reports).toEqual([]);

    for (const [path, html] of pages) h.world.six.pages.set(path, html);
    await h.wait(2 * 60_000);
    expect(h.status("six").state).toBe("live");
  });

  it("on the KRS and the transcript too, which the records read later in the day", async () => {
    const h = await signedIn();
    const pages = behindNetworkSignIn(h);
    // Only the records' pages: the status page still answers, so it's their read that meets the sign-in.
    for (const [path, html] of pages) if (/statusmhs$|\/home$|kelas\/jadwal/.test(path)) h.world.six.pages.set(path, html);

    await h.wait(24 * 3_600_000);
    expect(h.log.entries().some((entry) => entry.message.startsWith("VendorChanged"))).toBe(false);
    expect(h.log.entries().some((entry) => /^six\.(krs|transcript)$/.test(entry.area) && entry.message.startsWith("Offline"))).toBe(true);
    expect(h.status("six").changedPages).toBeUndefined();
    await until(h, h.engine.reports.idle());
    expect(h.world.relay.reports).toEqual([]);
  });
});
