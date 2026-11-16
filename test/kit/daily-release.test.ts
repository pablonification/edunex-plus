// Whether the daily release goes out (scripts/ci/daily-release.mjs): once a day, main is released when students get
// something since the newest release and CI passed on it, numbered as the next alpha unless package.json is ahead.
import { describe, expect, it } from "vitest";
import { commitMessage, DailyRefused, dailyRelease, forStudents } from "../../scripts/ci/daily-release.mjs";

const fix = { sha: "a".repeat(40), author: "Maintainer", subject: "fix(six): read course codes like MB210Y (#378)" };
const docs = { sha: "b".repeat(40), author: "Maintainer", subject: "docs: say how to install on Linux (#379)" };
const numbered = { sha: "c".repeat(40), author: "github-actions[bot]", subject: "chore(release): number 0.1.0-alpha.36, with what main got since alpha.35" };
const passed = { status: "completed", conclusion: "success", html_url: "https://github.com/o/r/actions/runs/1" };
const day = { event: "schedule", latest: "0.1.0-alpha.35", version: "0.1.0-alpha.35", commits: [fix], ci: passed };

describe("what students get", () => {
  it("is a feat, fix or perf, with or without a scope", () => {
    expect(forStudents("feat(presence): say the day a window closes")).toBe(true);
    expect(forStudents("fix: keep the session")).toBe(true);
    expect(forStudents("perf(engine)!: sync less")).toBe(true);
    expect(forStudents("chore(deps): bump vite")).toBe(false);
    expect(forStudents("docs(site): a picture guide")).toBe(false);
    expect(forStudents("chore(release): number the thirty-fifth alpha 0.1.0-alpha.35, so students get the fixes")).toBe(false);
    expect(forStudents("fixup the build")).toBe(false);
  });
});

describe("a day's release", () => {
  it("numbers the next alpha and goes out when a fix went in and CI passed", () => {
    expect(dailyRelease(day)).toMatchObject({ go: true, bump: true, version: "0.1.0-alpha.36", tag: "v0.1.0-alpha.36" });
  });

  it("doesn't go out when main hasn't changed, or got nothing students get", () => {
    expect(dailyRelease({ ...day, commits: [] })).toMatchObject({ go: false });
    expect(dailyRelease({ ...day, commits: [] }).reason).toContain("main hasn't changed");
    const quiet = dailyRelease({ ...day, commits: [docs, numbered] });
    expect(quiet.go).toBe(false);
    expect(quiet.reason).toContain("2 commits, none a feat, fix or perf");
  });

  it("waits for CI to pass on main's newest commit", () => {
    expect(dailyRelease({ ...day, ci: null }).go).toBe(false);
    expect(dailyRelease({ ...day, ci: { ...passed, status: "in_progress", conclusion: null } }).reason).toContain("still running");
    const failed = dailyRelease({ ...day, ci: { ...passed, conclusion: "failure" } });
    expect(failed.go).toBe(false);
    expect(failed.reason).toContain("CI didn't pass on main's newest commit (aaaaaaa) (failure)");
  });

  it("checks CI on the newest commit this workflow didn't number itself, which CI never runs on", () => {
    expect(dailyRelease({ ...day, commits: [numbered, docs, fix], ci: null }).reason).toContain("(bbbbbbb)");
    // A maintainer's numbering pull request runs CI like any other, so it's the one checked.
    const byHand = { ...numbered, author: "Maintainer" };
    expect(dailyRelease({ ...day, commits: [byHand, docs, fix], ci: null }).reason).toContain("(ccccccc)");
  });

  it("releases package.json's version as it is when it's ahead: numbered by hand, or yesterday's run didn't finish", () => {
    const ahead = dailyRelease({ ...day, version: "0.1.0-alpha.36", commits: [numbered, fix] });
    expect(ahead).toMatchObject({ go: true, bump: false, version: "0.1.0-alpha.36" });
    expect(dailyRelease({ ...day, version: "0.1.0" })).toMatchObject({ go: true, bump: false, version: "0.1.0" });
  });

  it("refuses a version behind the newest release, or one it can't number after", () => {
    expect(() => dailyRelease({ ...day, version: "0.1.0-alpha.34" })).toThrow(DailyRefused);
    expect(() => dailyRelease({ ...day, latest: "0.1.0", version: "0.1.0" })).toThrow("isn't an alpha");
    expect(() => dailyRelease({ ...day, version: "0.1.0-beta.1" })).toThrow("Number it by hand");
  });

  it("reads alpha.10 as after alpha.9", () => {
    expect(dailyRelease({ ...day, latest: "0.1.0-alpha.9", version: "0.1.0-alpha.10" })).toMatchObject({ go: true, bump: false });
  });

  it("is paused by DAILY_RELEASE=off on schedule, but not by hand", () => {
    expect(dailyRelease({ ...day, paused: true })).toMatchObject({ go: false });
    expect(dailyRelease({ ...day, paused: true }).reason).toContain("paused");
    expect(dailyRelease({ ...day, paused: true, event: "workflow_dispatch" }).go).toBe(true);
  });
});

it("writes a numbering commit that says the version, the release it follows, and what students get", () => {
  expect(commitMessage({ latest: "0.1.0-alpha.35", version: "0.1.0-alpha.36", commits: [fix, docs] })).toBe(
    "chore(release): number 0.1.0-alpha.36, with what main got since alpha.35\n\n- fix(six): read course codes like MB210Y (#378)\n",
  );
});
