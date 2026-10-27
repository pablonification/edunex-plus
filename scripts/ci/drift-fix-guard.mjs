// The fix bot's last look before anything it made goes public (.github/workflows/drift-fix.yml,
// docs/fix-bot.md). Its change and its words come from a job that ran Claude and the repository's
// tests on strangers' data, so they're checked again, by main's own code, never the change's:
// - nothing in its words (comment.md, pr.md, pr-title.txt) is shaped like a personal detail
//   (test/kit/privacy-rules.ts);
// - with a checkout whose change is staged, the change touches only what a fix may (never the
//   workflows, the packages, or what judges a change: the checks' settings, the privacy tests, the
//   scripts), adds no link to another file and no page of SIX's that holds passwords or family
//   data, and adds nothing shaped like a personal detail either.
//
//   node scripts/ci/drift-fix-guard.mjs <folder with the bot's words> [<the change's checkout>]
//
// It says why it refuses in a sentence of its own words (the log and the issue are public: never a
// file name or a value from the change), and exits 1.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { personalHits } from "../../test/kit/privacy-rules.ts";

/** What a fix may not touch, each said as the refusal says it. */
const PROTECTED = [
  [/^\.github\//, ".github/"],
  [/^\.agents\/|^\.claude\/|^(?:AGENTS|CLAUDE)\.md$/, "the agents' instructions"],
  [/^package(?:-lock)?\.json$/, "the packages"],
  [/^(?:biome\.json|biome-plugins\/|vitest\.config\.ts|vite\.config\.ts|tsconfig[^/]*\.json|knip\.json|\.nvmrc|\.gitignore)/, "the checks' settings"],
  [/^test\/kit\//, "the privacy tests (test/kit/)"],
  [/^scripts\//, "scripts/"],
  [/^relay\//, "relay/"],
  [/^src\/desktop\//, "src/desktop/"],
  [/^(?:electron-builder\.config\.|native\/|\.signpath\/)/, "the packaging"],
];
// The pages test/kit/privacy.test.ts keeps out of the test data.
const PRIVATE_PAGE = /controlpanel|datainduk|ktm|pddikti/i;
/** More than any fix needs: a few scrubbed pages and the code around them. */
const MAX_ADDED = 8_000_000;

const [words, checkout] = process.argv.slice(2);
const refuse = (why) => {
  console.log(why);
  process.exit(1);
};
const said = (name) => (fs.existsSync(path.join(words, name)) ? fs.readFileSync(path.join(words, name), "utf8") : "");
if (["comment.md", "pr.md", "pr-title.txt"].some((name) => personalHits(said(name)).length)) refuse("its words hold something shaped like a personal detail.");
if (!checkout) {
  console.log("Its words hold nothing shaped like a personal detail.");
  process.exit(0);
}

const git = (...args) => execFileSync("git", ["-C", checkout, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const files = git("diff", "--cached", "--name-only", "-z").split("\0").filter(Boolean);
if (!files.length) refuse("it changes nothing.");
const kept = new Set(files.flatMap((file) => PROTECTED.filter(([pattern]) => pattern.test(file)).map(([, what]) => what)));
if (kept.size) refuse(`it changes what a fix may not touch: ${[...kept].join(", ")}.`);
if (files.some((file) => PRIVATE_PAGE.test(file))) refuse("it adds a page of SIX's that holds passwords or family data.");
// Each line: ":old-mode new-mode …"; 120000 is a link to another file, 160000 another repository.
if (/^:\d+ (?:120000|160000) /m.test(git("diff", "--cached", "--raw"))) refuse("it adds a link to another file or repository.");

const added = git("diff", "--cached", "--no-color", "--unified=0")
  .split("\n")
  .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
  .join("\n");
if (added.length > MAX_ADDED) refuse("it's bigger than a fix should be.");
const hits = personalHits(added).length;
if (hits) refuse(`it adds ${hits === 1 ? "something" : `${hits} things`} shaped like a personal detail.`);
console.log(`${files.length} files, all of them ones a fix may change, and nothing shaped like a personal detail.`);
