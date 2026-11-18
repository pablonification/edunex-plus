// #381–#383: on campus Wi-Fi that wants its own sign-in first, the network answers for SIX with a page that only sends
// the browser to that sign-in (gate-dev2.itb.ac.id/captive-portal), as the reports kept it. That's no connection yet,
// not SIX changing: the Student sees "No connection", their data stays, nothing is reported, and SIX reads again once
// the network lets it through.
import { describe, expect, it } from "vitest";
import { bodyText } from "../kit/fixtures";
import { PRETEND_TOKEN } from "../pretend/edunex";
import { PRETEND_RELAY } from "../pretend/relay";
import { PRETEND_SIX_COOKIE } from "../pretend/six";
import { until } from "./first-sync";
import { type Harness, startEngine } from "./harness";

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

    const since = h.log.entries().length;
    await h.wait(24 * 3_600_000);
    const read = h.log.entries().slice(since);
    expect(read.some((entry) => entry.message.startsWith("VendorChanged"))).toBe(false);
    for (const feed of ["six.krs", "six.transcript"])
      expect(
        read.some((entry) => entry.area === feed && entry.message.startsWith("Offline")),
        feed,
      ).toBe(true);
    expect(h.status("six").changedPages).toBeUndefined();
    await until(h, h.engine.reports.idle());
    expect(h.world.relay.reports).toEqual([]);
  });

  it("however the network writes its page: spaces around the attributes, the address quoted, no 'url=', a link to its own /login", async () => {
    for (const tag of [
      `<meta http-equiv = "refresh" content = "0; url=https://gate.example.net/portal">`,
      `<meta content="0;URL='https://gate.example.net/portal'" http-equiv="Refresh">`,
      `<meta http-equiv=refresh content="0;https://gate.example.net/portal">`,
      `<meta http-equiv="refresh" content="0; url=javascript:void(0)"><meta http-equiv="refresh" content="0; url=https://gate.example.net/portal">`,
      `<meta http-equiv="refresh" content="0; url=https://gate.example.net/portal"></head><body><a href="/login">Sign in</a>`,
    ]) {
      const h = await signedIn();
      for (const path of h.world.six.pages.keys()) h.world.six.pages.set(path, `<html><head>${tag}</head></html>`);
      await until(h, h.engine.refresh("six"));
      expect(h.status("six").state, tag).toBe("offline");
    }
  });

  it("isn't SIX's own page that refreshes itself, nor one that only looks like a refresh, nor Microsoft's sign-in", async () => {
    const away = (tag: string) => (html: string) => html.replace(/<head>/i, `<head>${tag}`);
    // A signed-in SIX page (it links to /logout) that refreshes off SIX is still SIX's page, and reads.
    const h = await signedIn();
    h.world.six.editPage(/\/statusmhs$/, away(`<meta http-equiv="refresh" content="600; url=https://gate.example.net/portal">`));
    await until(h, h.engine.refresh("six"));
    expect(h.status("six").state).toBe("live");

    for (const tag of [
      `<meta http-equiv="refresh" content="0; url=/home">`,
      `<meta http-equiv="refresh" content="0; url=http://six.itb.ac.id/home">`,
      `<meta data-http-equiv="refresh" content="0; url=https://gate.example.net/portal">`,
      `<meta http-equiv="refresh" content="0; url=https://login.microsoftonline.com/common/oauth2">`,
    ]) {
      const other = await signedIn();
      other.world.six.pages.set("/app/mahasiswa:18223901/statusmhs", `<html><head>${tag}</head><body></body></html>`);
      await until(other, other.engine.refresh("six"));
      expect(other.status("six").state, tag).not.toBe("offline");
    }
  });
});

// #387: the same network, answering in the other ways #385 didn't cover: SIX's pages with a redirect to its sign-in, and
// Edunex's and ITB's with its page (or, where the network stack follows redirects, its sign-in form).
describe("the network's own sign-in answering for SIX, Edunex and ITB", () => {
  /** Nothing read since `since` was taken for a site changing, and no problem was kept to report. */
  async function nothingChanged(h: Harness, since: number) {
    expect(
      h.log
        .entries()
        .slice(since)
        .filter((entry) => entry.message.startsWith("VendorChanged")),
    ).toEqual([]);
    await until(h, h.engine.reports.idle());
    expect((await h.engine.report({})).problems).toEqual([]);
    expect(h.world.relay.reports).toEqual([]);
  }

  it("SIX's pages redirected to it: no connection, still signed in, and SIX reads again once it's through", async () => {
    const h = await signedIn();
    const courses = h.dataset("six.courses");
    const since = h.log.entries().length;
    h.world.signInFirst = "redirect";

    await until(h, h.engine.refresh("six"));
    expect(h.status("six").state).toBe("offline");
    expect(h.dataset("six.courses")).toEqual(courses);
    await nothingChanged(h, since);

    h.world.signInFirst = null;
    await h.wait(2 * 60_000);
    expect(h.status("six").state).toBe("live");
  });

  for (const kind of ["page", "redirect"] as const)
    it(`Edunex answered with it (${kind === "page" ? "its page" : "a redirect to its sign-in form"}): no connection, not Edunex changing`, async () => {
      const h = await startEngine({ relay: PRETEND_RELAY });
      await h.engine.updateSettings({ reportSending: "auto", reportAsked: true });
      await until(h, h.engine.signIn("edunex", { token: PRETEND_TOKEN }));
      const courses = h.dataset("edunex.courses");
      const since = h.log.entries().length;
      h.world.signInFirst = kind;

      await until(h, h.engine.refresh("edunex"));
      expect(h.status("edunex").state).toBe("offline");
      expect(h.dataset("edunex.courses")).toEqual(courses);
      await nothingChanged(h, since);

      h.world.signInFirst = null;
      await h.wait(2 * 60_000);
      expect(h.status("edunex").state).toBe("live");
    });

  it("ITB's calendar answered with its page: no connection, and the calendar reads once it's through", async () => {
    const h = await startEngine({ relay: PRETEND_RELAY, start: false });
    await h.engine.updateSettings({ reportSending: "auto", reportAsked: true });
    h.world.signInFirst = "page";
    h.engine.start();

    await h.wait();
    expect(h.status("itb").state).toBe("offline");
    expect(h.dataset("itb.calendar")).toBeUndefined();
    await nothingChanged(h, 0);

    h.world.signInFirst = null;
    await h.wait(60 * 60_000);
    expect(h.status("itb").state).toBe("live");
    expect(h.dataset("itb.calendar")?.events.length).toBeGreaterThan(0);
  });
});
