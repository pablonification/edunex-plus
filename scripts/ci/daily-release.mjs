// Whether today's daily release (.github/workflows/daily-release.yml) goes out, and as which version. Main gets a
// release once a day when something students get (a feat, fix or perf commit) went in since the newest published
// release, and CI passed on it. The version is the next alpha after that release, unless package.json numbers one
// already (a numbering pull request merged by hand, or yesterday's run that didn't finish).
//
//   node scripts/ci/daily-release.mjs
//
// Reads GITHUB_EVENT_NAME, GITHUB_REPOSITORY, PAUSED ("off" pauses the schedule), GH_TOKEN and COMMIT_MESSAGE (a
// file to write the numbering commit's message to); asks git for the commits since the newest release's tag. Writes
// go, bump, version and tag to GITHUB_OUTPUT and the reason, in plain words, to the run's summary. A refusal is an
// error on the run and exits 1.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

/** A day this workflow can't release, said as the error on the run says it. */
export class DailyRefused extends Error {}

const short = (sha) => (sha ?? "").slice(0, 7);
const ALPHA = /^(\d+)\.(\d+)\.(\d+)(?:-alpha\.(\d+))?$/;

/** A commit students get something from: a Conventional Commit feat, fix or perf. */
export const forStudents = (subject) => /^(feat|fix|perf)(\([^)]*\))?!?:/.test(subject);
/** A commit this workflow made to number a version: pushed with its own token, so CI never runs on it. */
export const numberedHere = (commit) => commit.author === "github-actions[bot]" && /^chore\(release\):/.test(commit.subject);

/** -1, 0 or 1 as `a` comes before, is, or comes after `b`; a version without an alpha comes after its alphas. */
function compare(a, b) {
  const [x, y] = [ALPHA.exec(a), ALPHA.exec(b)];
  for (let i = 1; i <= 3; i++) if (Number(x[i]) !== Number(y[i])) return Number(x[i]) < Number(y[i]) ? -1 : 1;
  const [p, q] = [x[4] === undefined ? Infinity : Number(x[4]), y[4] === undefined ? Infinity : Number(y[4])];
  return p === q ? 0 : p < q ? -1 : 1;
}

/**
 * Whether today's release goes out.
 * - `latest`: the newest published release's version (its tag without the v).
 * - `version`: package.json's version on main.
 * - `commits`: the commits since that release's tag, newest first, as `{ sha, author, subject }`.
 * - `ci`: CI's run on push for the newest commit this workflow didn't make, as GitHub lists it, or null.
 */
export function dailyRelease({ event, paused = false, latest, version, commits, ci = null }) {
  const stop = (reason) => ({ go: false, bump: false, version, tag: `v${version}`, reason });
  if (paused && event === "schedule")
    return stop("The daily release is paused (the repository variable DAILY_RELEASE is off). Run it by hand to release anyway.");

  const changes = commits.filter((commit) => forStudents(commit.subject));
  if (changes.length === 0)
    return stop(
      `Nothing new for students since ${latest}: ${commits.length === 0 ? "main hasn't changed" : `${commits.length} commit${commits.length === 1 ? "" : "s"}, none a feat, fix or perf`}. No release today.`,
    );

  const newest = commits.find((commit) => !numberedHere(commit));
  const at = `main's newest commit (${short(newest.sha)})`;
  if (!ci) return stop(`CI hasn't run on ${at}, so no release today.`);
  if (ci.status !== "completed") return stop(`CI is still running on ${at}, so no release today. Tomorrow's run looks again: ${ci.html_url}`);
  if (ci.conclusion !== "success") return stop(`CI didn't pass on ${at} (${ci.conclusion}), so no release today: ${ci.html_url}`);

  const what = `${changes.length} change${changes.length === 1 ? "" : "s"} for students since ${latest}`;
  if (!ALPHA.test(version) || !ALPHA.test(latest))
    throw new DailyRefused(`Can't number the next alpha after ${latest} from package.json's ${version}. Number it by hand (CONTRIBUTING.md, Releases).`);
  const order = compare(version, latest);
  if (order < 0) throw new DailyRefused(`package.json's version (${version}) is older than the newest release, ${latest}. Number a new one by hand.`);
  if (order > 0)
    return { go: true, bump: false, version, tag: `v${version}`, reason: `${what}: package.json numbers ${version} already, so it's released as it is.` };

  const [, major, minor, patch, alpha] = ALPHA.exec(latest);
  if (alpha === undefined) throw new DailyRefused(`${latest} isn't an alpha, so there's no next alpha to number. Number the next version by hand.`);
  const next = `${major}.${minor}.${patch}-alpha.${Number(alpha) + 1}`;
  return { go: true, bump: true, version: next, tag: `v${next}`, reason: `${what}: numbered ${next} and released.` };
}

/** The numbering commit's message: the version, the release it follows, and what students get. */
export function commitMessage({ latest, version, commits }) {
  const alpha = (v) => v.replace(/^\d+\.\d+\.\d+-/, "");
  const lines = commits.filter((commit) => forStudents(commit.subject)).map((commit) => `- ${commit.subject}`);
  return `chore(release): number ${version}, with what main got since ${alpha(latest)}\n\n${lines.join("\n")}\n`;
}

async function main() {
  const env = process.env;
  const api = env.GITHUB_API_URL || "https://api.github.com";
  const get = async (path) => {
    const response = await fetch(`${api}/${path}`, {
      headers: { accept: "application/vnd.github+json", authorization: `Bearer ${env.GH_TOKEN}`, "x-github-api-version": "2022-11-28" },
    });
    if (response.status !== 200) throw new Error(`GitHub answered ${response.status} when asked for ${path}. Run the workflow again.`);
    return response.json();
  };
  const summary = (text) => (env.GITHUB_STEP_SUMMARY ? fs.appendFileSync(env.GITHUB_STEP_SUMMARY, text) : console.log(text));
  try {
    const repo = env.GITHUB_REPOSITORY;
    const { version } = JSON.parse(fs.readFileSync("package.json", "utf8"));
    // Only a published release that's marked latest answers here: drafts and pre-releases don't.
    const latestTag = (await get(`repos/${repo}/releases/latest`)).tag_name;
    const latest = latestTag.replace(/^v/, "");
    const log = execFileSync("git", ["log", "--format=%H%x09%an%x09%s", `${latestTag}..HEAD`], { encoding: "utf8" });
    const commits = log
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [sha, author, ...subject] = line.split("\t");
        return { sha, author, subject: subject.join("\t") };
      });
    const newest = commits.find((commit) => !numberedHere(commit));
    let ci = null;
    if (newest && commits.some((commit) => forStudents(commit.subject))) {
      const runs = await get(`repos/${repo}/actions/workflows/ci.yml/runs?head_sha=${newest.sha}&event=push&per_page=1`);
      ci = runs.workflow_runs[0] ?? null;
    }
    const day = dailyRelease({ event: env.GITHUB_EVENT_NAME, paused: env.PAUSED?.trim().toLowerCase() === "off", latest, version, commits, ci });
    if (day.go && day.bump && env.COMMIT_MESSAGE) fs.writeFileSync(env.COMMIT_MESSAGE, commitMessage({ latest, version: day.version, commits }));
    const outputs = `go=${day.go}\nbump=${day.bump}\nversion=${day.version}\ntag=${day.tag}\n`;
    if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, outputs);
    console.log(outputs + day.reason);
    summary(`### Today's release\n\n${day.reason}\n`);
  } catch (error) {
    console.log(`::error::${error.message}`);
    summary(`### Today's release\n\n**None: ${error.message}**\n`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
