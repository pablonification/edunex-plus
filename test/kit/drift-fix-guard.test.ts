// The fix bot's last look before its change and its words go public (scripts/ci/drift-fix-guard.mjs,
// docs/fix-bot.md): a fix to a reader passes; a change to the workflows or to what judges a change, a
// link to another file, or anything shaped like a personal detail doesn't, and the refusal never
// repeats what the change named. On a throwaway repository, as the workflow runs it. Values that
// look personal are joined at run time, so the repository's own privacy test doesn't take this file
// for a leak.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const GUARD = path.resolve(import.meta.dirname, "..", "..", "scripts", "ci", "drift-fix-guard.mjs");
const made: string[] = [];

afterEach(() => {
  for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

/** A repository with one commit, the change staged as `files` says, and the bot's words. */
function guard(files: Record<string, string | { link: string }>, words: Record<string, string> = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "drift-fix-guard-"));
  made.push(root);
  const repo = path.join(root, "repo");
  const git = (...args: string[]) => execFileSync("git", ["-C", repo, ...args], { stdio: "ignore" });
  fs.mkdirSync(path.join(repo, "src"), { recursive: true });
  fs.writeFileSync(path.join(repo, "src", "reader.ts"), "export {};\n");
  git("init", "--quiet");
  git("add", "-A");
  git("-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "start");
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    if (typeof content === "string") fs.writeFileSync(path.join(repo, file), content);
    else fs.symlinkSync(content.link, path.join(repo, file));
  }
  git("add", "-A");
  const dir = path.join(root, "words");
  fs.mkdirSync(dir);
  for (const [name, text] of Object.entries(words)) fs.writeFileSync(path.join(dir, name), text);
  const run = spawnSync("node", ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", GUARD, dir, repo], { encoding: "utf8" });
  return { passes: run.status === 0, says: run.stdout.trim() };
}

/** The guard on the bot's words alone, as it runs before every comment. */
function wordsOnly(words: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "drift-fix-words-"));
  made.push(dir);
  for (const [name, text] of Object.entries(words)) fs.writeFileSync(path.join(dir, name), text);
  const run = spawnSync("node", ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", GUARD, dir], { encoding: "utf8" });
  return { passes: run.status === 0, says: run.stdout.trim() };
}

const FIX = { "src/reader.ts": "export const read = 1;\n", "test/fixtures/six/report-drift-237-statusmhs.html": "<td>IF2123</td>\n" };

describe("the fix bot's guard", () => {
  it("lets a fix to a reader, with its test data, through", () => {
    expect(guard(FIX, { "comment.md": "SIX now writes two percentages.", "pr.md": "Closes #237." })).toEqual({
      passes: true,
      says: "2 files, all of them ones a fix may change, and nothing shaped like a personal detail.",
    });
  });

  it("refuses a change to the workflows or to what judges a change, without repeating its names", () => {
    expect(guard({ ...FIX, ".github/workflows/look-at-me.yml": "on: push\n" })).toEqual({
      passes: false,
      says: "it changes what a fix may not touch: .github/.",
    });
    expect(guard({ "test/kit/privacy-rules.ts": "export {};\n" }).passes).toBe(false);
    expect(guard({ "package.json": "{}\n" }).passes).toBe(false);
  });

  it("refuses a link to another file, and a page that holds family data", () => {
    expect(guard({ "test/fixtures/six/report-drift-237-x.html": { link: "/etc/passwd" } }).says).toBe("it adds a link to another file or repository.");
    expect(guard({ "test/fixtures/six/report-drift-237-datainduk.html": "<p></p>\n" }).passes).toBe(false);
  });

  it("refuses anything shaped like a personal detail, in what it adds or in its words, without saying what", () => {
    const email = ["rahmat.hidayat", "gmail.com"].join("@");
    const added = guard({ ...FIX, "test/fixtures/six/report-drift-237-y.html": `<p>${email}</p>\n` });
    expect(added).toEqual({ passes: false, says: "it adds something shaped like a personal detail." });
    expect(guard(FIX, { "comment.md": `Ask ${email}` })).toEqual({ passes: false, says: "its words hold something shaped like a personal detail." });
    // Before any comment, whatever the outcome.
    expect(wordsOnly({ "comment.md": "SIX now writes two percentages." }).passes).toBe(true);
    expect(wordsOnly({ "comment.md": `Ask ${email}` }).passes).toBe(false);
  });
});
