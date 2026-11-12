// What a run of the Package and release workflow (.github/workflows/release.yml) makes: a check build that
// publishes nothing, every app for a draft release, or nothing at all. Every later job reads its answer.
//
// - A version tag (v1.2.3) that matches package.json: the draft release for it, unless that version is already
//   published. Publishing a draft makes GitHub create its tag, and that tag's run must end in seconds, not build
//   again over a published release's files.
// - A push to main that numbers a new version (a merged `chore(release)` pull request): the draft release for it,
//   unless it's already published or tagged (a tag's own run makes that one). Any other push to main: a check.
// - By hand: a check build of any branch, or with `release`, the draft for package.json's version from main.
//
//   node scripts/ci/release-plan.mjs
//
// Reads GITHUB_EVENT_NAME, GITHUB_REF, GITHUB_SHA, GITHUB_REPOSITORY, BEFORE (the commit main was at before the
// push), RELEASE (the by-hand input) and GH_TOKEN; writes build, release, tag and version to GITHUB_OUTPUT and the
// reason, in plain words, to the run's summary. A refusal is an error on the run and exits 1.
import fs from "node:fs";
import { pathToFileURL } from "node:url";

/** A run this workflow won't make, said as the error on the run says it. */
export class PlanRefused extends Error {}

const MAIN = "refs/heads/main";
const TAGS = "refs/tags/";
const short = (sha) => (sha ?? "").slice(0, 7);

/**
 * What the run makes, from what's known about it.
 * - `versionBefore`: package.json's version before a push to main, or null when it couldn't be read.
 * - `published`: a published (not draft) release exists for `v<version>`.
 * - `tagCommit`: the commit `v<version>` is tagged at on GitHub, or null when there's no such tag.
 */
export function releasePlan({ event, ref, sha, version, versionBefore = null, releaseInput = false, published = false, tagCommit = null }) {
  const tag = `v${version}`;
  const check = (reason) => ({ build: true, release: false, tag, version, reason });
  const draft = (reason) => ({ build: true, release: true, tag, version, reason });

  if (event === "push" && ref.startsWith(TAGS)) {
    const pushed = ref.slice(TAGS.length);
    if (pushed !== tag)
      throw new PlanRefused(
        `The tag ${pushed} doesn't match package.json's version (${version}). The app compares the two to offer updates: run \`npm version <new-version>\` and push that commit and its tag instead.`,
      );
    if (published)
      return {
        build: false,
        release: false,
        tag,
        version,
        reason: `${tag} is already published: nothing to build, and its files stay as they are. (Publishing a draft makes its tag, which starts this run.)`,
      };
    return draft(`The tag ${tag} matches package.json: every app is built for its draft release.`);
  }

  if (event === "push" && ref === MAIN) {
    if (versionBefore === null)
      return check(
        `A check build of ${version}: the version before this push couldn't be read, so this run doesn't make a release. To make the draft for ${tag}, run the workflow by hand from main with "release" ticked.`,
      );
    if (versionBefore === version) return check(`A check build: this push changes packaging, not the version (${version}). Nothing is published.`);
    if (published) return check(`A check build: this push numbers ${version}, but ${tag} is already published. Nothing is published.`);
    if (tagCommit)
      return check(
        `A check build: this push numbers ${version}, but ${tag} is already tagged (at ${short(tagCommit)}), and the tag's own run makes its draft.`,
      );
    return draft(`This push numbers a new version, ${versionBefore} → ${version}: every app is built for the draft release ${tag}.`);
  }

  if (event === "workflow_dispatch" && releaseInput) {
    if (ref !== MAIN)
      throw new PlanRefused(
        `A release is made only from main, not ${ref.replace(/^refs\/(heads|tags)\//, "")}. Run it from main, or untick "release" for a check build.`,
      );
    if (published)
      throw new PlanRefused(
        `${tag} is already published, so its draft can't be made again. Number a new version (a pull request that runs \`npm version\`) to release this commit.`,
      );
    if (tagCommit && tagCommit !== sha)
      throw new PlanRefused(
        `${tag} is already tagged at another commit (${short(tagCommit)}), so a draft from this one (${short(sha)}) would carry files the tag doesn't. Re-run that tag's run, or number a new version.`,
      );
    return draft(`Run by hand: the draft release ${tag} is made, or refreshed, from this commit (${short(sha)}).`);
  }

  if (event === "workflow_dispatch")
    return check(`Run by hand: a check build of ${ref.replace(/^refs\/(heads|tags)\//, "")} (${version}). Nothing is published.`);
  return check(`A check build (${event} on ${ref}). Nothing is published.`);
}

/**
 * What releasePlan needs to know, asked of GitHub only as far as this run needs it. `get(path)` answers a GET of
 * the REST API as `{ status, body }`, `body` parsed when the status is 200; a failed request throws.
 */
export async function releaseFacts({ event, ref, sha, before, releaseInput, version, repo }, get) {
  const tag = `v${version}`;
  const facts = { event, ref, sha, version, releaseInput, versionBefore: null, published: false, tagCommit: null };
  const tagPush = event === "push" && ref.startsWith(TAGS);
  const mainPush = event === "push" && ref === MAIN;
  const handRelease = event === "workflow_dispatch" && releaseInput && ref === MAIN;
  const fail = (what, status) => {
    throw new Error(`GitHub answered ${status} when asked for ${what}. Run the workflow again; if it keeps failing, GitHub may be having trouble.`);
  };

  // A new branch, a force push, or a first push have no usable commit before: no version to compare with.
  if (mainPush && before && !/^0+$/.test(before)) {
    const { status, body } = await get(`repos/${repo}/contents/package.json?ref=${encodeURIComponent(before)}`);
    if (status === 200) facts.versionBefore = JSON.parse(Buffer.from(body.content, "base64").toString("utf8")).version ?? null;
    else if (status !== 404 && status !== 422) fail(`package.json at ${short(before)}`, status);
  }
  const versionChanged = mainPush && facts.versionBefore !== null && facts.versionBefore !== version;
  if (tagPush ? ref === `${TAGS}${tag}` : versionChanged || handRelease) {
    // Only a published release answers here (a draft has no tag yet): what's wanted, even with a read-only token.
    const { status, body } = await get(`repos/${repo}/releases/tags/${encodeURIComponent(tag)}`);
    if (status === 200) facts.published = body.draft !== true;
    else if (status !== 404) fail(`the release ${tag}`, status);
  }
  if (versionChanged || handRelease) facts.tagCommit = await tagCommitOf(tag, repo, get, fail);
  return facts;
}

/** The commit `tag` is at on GitHub (through an annotated tag to what it tags), or null without the tag. */
async function tagCommitOf(tag, repo, get, fail) {
  // matching-refs answers [] for no tag, where git/ref answers 404 for that and for a failure alike.
  const { status, body } = await get(`repos/${repo}/git/matching-refs/tags/${encodeURIComponent(tag)}`);
  if (status !== 200) fail(`the tag ${tag}`, status);
  let object = body.find((entry) => entry.ref === `${TAGS}${tag}`)?.object;
  for (let depth = 0; object?.type === "tag" && depth < 5; depth++) {
    const annotated = await get(`repos/${repo}/git/tags/${object.sha}`);
    if (annotated.status !== 200) fail(`the tag ${tag}`, annotated.status);
    object = annotated.body.object;
  }
  return object ? object.sha : null;
}

async function main() {
  const env = process.env;
  const api = env.GITHUB_API_URL || "https://api.github.com";
  const get = async (path) => {
    const response = await fetch(`${api}/${path}`, {
      headers: { accept: "application/vnd.github+json", authorization: `Bearer ${env.GH_TOKEN}`, "x-github-api-version": "2022-11-28" },
    });
    return { status: response.status, body: response.status === 200 ? await response.json() : null };
  };
  const summary = (text) => (env.GITHUB_STEP_SUMMARY ? fs.appendFileSync(env.GITHUB_STEP_SUMMARY, text) : console.log(text));
  try {
    const { version } = JSON.parse(fs.readFileSync("package.json", "utf8"));
    const facts = await releaseFacts(
      {
        event: env.GITHUB_EVENT_NAME,
        ref: env.GITHUB_REF,
        sha: env.GITHUB_SHA,
        before: env.BEFORE,
        releaseInput: env.RELEASE === "true",
        version,
        repo: env.GITHUB_REPOSITORY,
      },
      get,
    );
    const plan = releasePlan(facts);
    const outputs = `build=${plan.build}\nrelease=${plan.release}\ntag=${plan.tag}\nversion=${plan.version}\n`;
    if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, outputs);
    console.log(outputs + plan.reason);
    summary(`### What this run makes\n\n${plan.reason}\n`);
  } catch (error) {
    console.log(`::error::${error.message}`);
    summary(`### What this run makes\n\n**Nothing: ${error.message}**\n`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
