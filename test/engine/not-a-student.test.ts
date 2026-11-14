// #345–#352: a lecturer signed in. Edunex's /login/me has no NIM (`code`) and says level "LECTURER", and SIX's home
// links only /app/dosen:… pages. The app reads only a Student's Edunex and SIX: each system asks them to sign in with a
// student account, and none of it is a change to report.
import { describe, expect, it } from "vitest";
import { bodyText } from "../kit/fixtures";
import { PRETEND_TOKEN } from "../pretend/edunex";
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

/** An engine that would send every report by itself, so one that isn't sent was never made. */
async function sendingReports() {
  const h = await startEngine({ relay: PRETEND_RELAY });
  await h.engine.updateSettings({ reportSending: "auto", reportAsked: true });
  return h;
}

/** Edunex's /login/me for a lecturer, as #345 kept it: no `code`, level "LECTURER", a lecturer's own fields. */
function asLecturer(h: Harness): void {
  const { code: _nim, ...me } = h.world.edunex.me as Record<string, unknown>;
  h.world.edunex.me = { ...me, level: "LECTURER", nidn: "0000000000", lecturer_id: 1 };
}

const nothingReported = async (h: Harness) => {
  await until(h, h.engine.reports.idle());
  expect(h.log.entries().some((entry) => entry.message.startsWith("VendorChanged"))).toBe(false);
  expect((await h.engine.report({})).problems).toEqual([]);
  expect(h.world.relay.reports).toEqual([]);
};

describe("an account that isn't a student's", () => {
  it("Edunex: a lecturer is asked to sign in with a student account, and nothing is reported", async () => {
    const h = await sendingReports();
    asLecturer(h);
    await until(h, h.engine.signIn("edunex", { token: PRETEND_TOKEN }));
    await until(h, h.engine.refresh("edunex"));

    expect(h.status("edunex")).toMatchObject({ state: "action-needed", asks: "student" });
    expect(h.dataset("edunex.account")).toBeUndefined();
    expect(h.dataset("edunex.notifications")).toBeUndefined();
    await nothingReported(h);
  });

  it("Edunex: a Student's /login/me without its NIM is still a change, reported as before", async () => {
    const h = await startEngine();
    const { code: _nim, ...me } = h.world.edunex.me as Record<string, unknown>;
    h.world.edunex.me = me;
    await until(h, h.engine.signIn("edunex", { token: PRETEND_TOKEN }));
    expect(h.status("edunex")).toMatchObject({ state: "changed", detail: "/login/me: code Invalid input: expected string, received undefined" });
  });

  it("SIX: a lecturer's home page (#346) asks for a student account, and nothing is reported", async () => {
    const h = await sendingReports();
    h.world.six.editPage(/^\/home$/, () => bodyText("six", "report-lecturer-home-home.html"));
    await until(h, h.engine.signIn("six", { cookie: PRETEND_SIX_COOKIE }));

    expect(h.status("six")).toMatchObject({ state: "action-needed", asks: "student" });
    expect(h.dataset("six.student")).toBeUndefined();
    await nothingReported(h);
  });

  it("SIX: a home page with neither a student's nor a lecturer's pages is still a change", async () => {
    const h = await startEngine();
    h.world.six.editPage(/^\/home$/, (html) => html.replace(/mahasiswa:/g, "tamu:"));
    await until(h, h.engine.signIn("six", { cookie: PRETEND_SIX_COOKIE }));
    expect(h.status("six")).toMatchObject({ state: "changed", detail: "SIX home: no student pages are linked" });
  });
});
