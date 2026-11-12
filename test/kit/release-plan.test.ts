// What a run of the Package and release workflow makes (scripts/ci/release-plan.mjs): merging the pull request that
// numbers a version makes its draft release by itself, publishing that draft (which makes its tag) builds nothing
// again, and a run by hand makes a draft only from main and never over a published release.
import { describe, expect, it } from "vitest";
import { PlanRefused, releaseFacts, releasePlan } from "../../scripts/ci/release-plan.mjs";

const SHA = "a".repeat(40);
const OTHER = "b".repeat(40);
const pushToMain = { event: "push", ref: "refs/heads/main", sha: SHA, version: "0.1.0-alpha.34" };
const byHand = { event: "workflow_dispatch", ref: "refs/heads/main", sha: SHA, version: "0.1.0-alpha.34" };
const made = (plan: { build: boolean; release: boolean }) => (plan.release ? "draft" : plan.build ? "check" : "nothing");

describe("a version tag", () => {
  const tagPush = { event: "push", ref: "refs/tags/v0.1.0-alpha.34", sha: SHA, version: "0.1.0-alpha.34" };

  it("builds every app for its draft release, as tagging first always did", () => {
    expect(releasePlan(tagPush)).toMatchObject({ build: true, release: true, tag: "v0.1.0-alpha.34", version: "0.1.0-alpha.34" });
  });

  it("builds nothing once its release is published: publishing the draft made the tag", () => {
    const plan = releasePlan({ ...tagPush, published: true });
    expect(made(plan)).toBe("nothing");
    expect(plan.reason).toContain("already published");
  });

  it("must match package.json's version, which the app compares to offer updates", () => {
    expect(() => releasePlan({ ...tagPush, version: "0.1.0-alpha.33" })).toThrow(PlanRefused);
    expect(() => releasePlan({ ...tagPush, version: "0.1.0-alpha.33" })).toThrow(
      "The tag v0.1.0-alpha.34 doesn't match package.json's version (0.1.0-alpha.33). The app compares the two to offer updates",
    );
  });
});

describe("a push to main", () => {
  it("that numbers a new version makes its draft release", () => {
    const plan = releasePlan({ ...pushToMain, versionBefore: "0.1.0-alpha.33" });
    expect(made(plan)).toBe("draft");
    expect(plan.reason).toContain("0.1.0-alpha.33 → 0.1.0-alpha.34");
  });

  it("that changes packaging but not the version is a check", () => {
    expect(made(releasePlan({ ...pushToMain, versionBefore: "0.1.0-alpha.34" }))).toBe("check");
  });

  it("to a version already published or tagged is a check: no second draft, nothing over a published release", () => {
    expect(made(releasePlan({ ...pushToMain, versionBefore: "0.1.0-alpha.33", published: true }))).toBe("check");
    const tagged = releasePlan({ ...pushToMain, versionBefore: "0.1.0-alpha.33", tagCommit: OTHER });
    expect(made(tagged)).toBe("check");
    expect(tagged.reason).toContain("the tag's own run makes its draft");
  });

  it("whose version before can't be read is a check, and says how to make the draft by hand", () => {
    const plan = releasePlan({ ...pushToMain, versionBefore: null });
    expect(made(plan)).toBe("check");
    expect(plan.reason).toContain('"release" ticked');
  });
});

describe("a run by hand", () => {
  it("is a check build of any branch", () => {
    expect(made(releasePlan(byHand))).toBe("check");
    expect(made(releasePlan({ ...byHand, ref: "refs/heads/ci/try" }))).toBe("check");
  });

  it("with release, makes or refreshes the draft from main", () => {
    expect(made(releasePlan({ ...byHand, releaseInput: true }))).toBe("draft");
    // A tag pushed for this very commit: the draft and the tag carry the same build.
    expect(made(releasePlan({ ...byHand, releaseInput: true, tagCommit: SHA }))).toBe("draft");
  });

  it("with release, refuses anywhere but main", () => {
    expect(() => releasePlan({ ...byHand, ref: "refs/heads/ci/try", releaseInput: true })).toThrow("A release is made only from main, not ci/try.");
  });

  it("with release, refuses a version already published, or tagged at another commit", () => {
    expect(() => releasePlan({ ...byHand, releaseInput: true, published: true })).toThrow("v0.1.0-alpha.34 is already published");
    expect(() => releasePlan({ ...byHand, releaseInput: true, tagCommit: OTHER })).toThrow("already tagged at another commit (bbbbbbb)");
  });
});

/** GitHub's REST API, answering `routes` by path and 404 for anything else; every path asked is kept. */
function github(routes: Record<string, { status: number; body?: unknown }>) {
  const asked: string[] = [];
  const get = async (path: string) => {
    asked.push(path);
    const answer = routes[path] ?? { status: 404 };
    return { status: answer.status, body: answer.body ?? null };
  };
  return { asked, get };
}
const REPO = "owner/app";
const packageAt = (version: string) => ({ status: 200, body: { content: Buffer.from(JSON.stringify({ version }, null, 2)).toString("base64") } });
const run = { event: "push", ref: "refs/heads/main", sha: SHA, before: OTHER, releaseInput: false, version: "0.1.0-alpha.34", repo: REPO };

describe("what GitHub is asked", () => {
  it("reads package.json's version before the push, and the version's release and tag", async () => {
    const { asked, get } = github({
      [`repos/${REPO}/contents/package.json?ref=${OTHER}`]: packageAt("0.1.0-alpha.33"),
      [`repos/${REPO}/git/matching-refs/tags/v0.1.0-alpha.34`]: { status: 200, body: [] },
    });
    const facts = await releaseFacts(run, get);
    expect(facts).toMatchObject({ versionBefore: "0.1.0-alpha.33", published: false, tagCommit: null });
    expect(made(releasePlan(facts))).toBe("draft");
    expect(asked).toHaveLength(3);
  });

  it("takes a release that answers as published, and a draft (which never answers there) as not", async () => {
    const published = github({
      [`repos/${REPO}/contents/package.json?ref=${OTHER}`]: packageAt("0.1.0-alpha.33"),
      [`repos/${REPO}/releases/tags/v0.1.0-alpha.34`]: { status: 200, body: { draft: false } },
      [`repos/${REPO}/git/matching-refs/tags/v0.1.0-alpha.34`]: { status: 200, body: [] },
    });
    expect((await releaseFacts(run, published.get)).published).toBe(true);
  });

  it("fails loudly when GitHub can't say whether the release exists, rather than take that as no", async () => {
    const { get } = github({
      [`repos/${REPO}/contents/package.json?ref=${OTHER}`]: packageAt("0.1.0-alpha.33"),
      [`repos/${REPO}/releases/tags/v0.1.0-alpha.34`]: { status: 502 },
    });
    await expect(releaseFacts(run, get)).rejects.toThrow("GitHub answered 502 when asked for the release v0.1.0-alpha.34");
  });

  it("finds the commit behind an annotated tag, and doesn't take v0.1.0-alpha.3 for v0.1.0-alpha.33", async () => {
    const { get } = github({
      [`repos/${REPO}/contents/package.json?ref=${OTHER}`]: packageAt("0.1.0-alpha.2"),
      [`repos/${REPO}/git/matching-refs/tags/v0.1.0-alpha.3`]: {
        status: 200,
        body: [
          { ref: "refs/tags/v0.1.0-alpha.3", object: { type: "tag", sha: "c".repeat(40) } },
          { ref: "refs/tags/v0.1.0-alpha.33", object: { type: "commit", sha: "d".repeat(40) } },
        ],
      },
      [`repos/${REPO}/git/tags/${"c".repeat(40)}`]: { status: 200, body: { object: { type: "commit", sha: OTHER } } },
    });
    expect((await releaseFacts({ ...run, version: "0.1.0-alpha.3" }, get)).tagCommit).toBe(OTHER);
    const untagged = github({
      [`repos/${REPO}/contents/package.json?ref=${OTHER}`]: packageAt("0.1.0-alpha.2"),
      [`repos/${REPO}/git/matching-refs/tags/v0.1.0-alpha.3`]: {
        status: 200,
        body: [{ ref: "refs/tags/v0.1.0-alpha.33", object: { type: "commit", sha: "d".repeat(40) } }],
      },
    });
    expect((await releaseFacts({ ...run, version: "0.1.0-alpha.3" }, untagged.get)).tagCommit).toBeNull();
  });

  it("asks nothing more when the version didn't change, or there's no commit before the push", async () => {
    const same = github({ [`repos/${REPO}/contents/package.json?ref=${OTHER}`]: packageAt("0.1.0-alpha.34") });
    await releaseFacts(run, same.get);
    expect(same.asked).toHaveLength(1);
    const first = github({});
    const facts = await releaseFacts({ ...run, before: "0".repeat(40) }, first.get);
    expect(first.asked).toEqual([]);
    expect(facts.versionBefore).toBeNull();
  });

  it("asks nothing for a check by hand, and only the release for a tag", async () => {
    const check = github({});
    await releaseFacts({ ...run, event: "workflow_dispatch", before: undefined }, check.get);
    expect(check.asked).toEqual([]);
    const tag = github({});
    await releaseFacts({ ...run, ref: "refs/tags/v0.1.0-alpha.34", before: OTHER }, tag.get);
    expect(tag.asked).toEqual([`repos/${REPO}/releases/tags/v0.1.0-alpha.34`]);
  });
});
