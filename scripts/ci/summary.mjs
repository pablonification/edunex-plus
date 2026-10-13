// Writes a CI job's result in plain words to the run's summary page, so the
// maintainer reads one line instead of a log. Locally it prints to the terminal.
//
//   node scripts/ci/summary.mjs <lint|typecheck|test|knip> <success|failure> <output-file>
//
// The output file is what the check printed (lint, typecheck), Vitest's JSON
// report (test) or knip's markdown report (knip).
import fs from "node:fs";
import path from "node:path";

const [kind, outcome, file] = process.argv.slice(2);
const passed = outcome === "success";
const output = file && fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

const writers = {
  lint() {
    const checked = output.match(/Checked (\d+) files?/)?.[1];
    const errors = Number(output.match(/Found (\d+) errors?/)?.[1] ?? 0);
    const warnings = Number(output.match(/Found (\d+) warnings?/)?.[1] ?? 0);
    if (passed) return `All clear: Biome checked ${checked ? `${checked} files` : "every file"} for code problems and formatting.`;
    const found = [errors && plural(errors, "problem"), warnings && plural(warnings, "warning")].filter(Boolean).join(" and ");
    return [
      `**Biome found ${found || "problems"}.**`,
      "Formatting and import order fix themselves: run `npm run format` and commit. Anything left is marked on its line in the pull request's Files tab.",
    ].join("\n\n");
  },

  typecheck() {
    if (passed) return "All clear: the types check out in all three parts (the window, the desktop side and engine, the tests).";
    const errors = [...output.matchAll(/^(.+?)\(\d+,\d+\): error TS\d+/gm)].map((match) => match[1]);
    if (errors.length === 0) return "**The type check failed before it could list errors.** The log of this job says why.";
    const files = [...new Set(errors)];
    return [
      `**${plural(errors.length, "type error")} in ${plural(files.length, "file")}.** Each is marked on its line in the pull request's Files tab.`,
      files.map((name) => `- \`${name}\``).join("\n"),
    ].join("\n\n");
  },

  test() {
    if (!output) return "**The tests didn't finish.** The log of this job says why.";
    const report = JSON.parse(output);
    const ended = Math.max(report.startTime, ...report.testResults.map((result) => result.endTime ?? 0));
    const seconds = Math.round((ended - report.startTime) / 1000);
    const failed = [];
    const skipped = [];
    for (const result of report.testResults) {
      const where = path.relative(process.cwd(), result.name);
      for (const test of result.assertionResults) {
        const name = `- \`${where}\`: ${[...test.ancestorTitles, test.title].join(" › ")}`;
        if (test.status === "failed") failed.push(name);
        else if (test.status === "pending" || test.status === "skipped") skipped.push(name);
      }
    }
    const files = plural(report.testResults.length, "file");
    const skips = skipped.length > 0 ? ` (${skipped.length} skipped)` : "";
    const lines = [];
    if (failed.length === 0 && report.success) lines.push(`All clear: **${plural(report.numPassedTests, "test")} passed**${skips} in ${files} (${seconds} s).`);
    else if (failed.length > 0)
      lines.push(
        `**${failed.length} of ${plural(report.numTotalTests, "test")} failed.** Each failure is marked on its line in the pull request's Files tab; run \`npm test\` to see them on your computer.`,
        failed.join("\n"),
      );
    else lines.push("**A test file couldn't run** (it crashed before its tests started). The log of this job says why.");
    // Folded away: in CI the check against the maintainer's private list of real values always skips.
    if (skipped.length > 0) lines.push(`<details><summary>Skipped</summary>\n\n${skipped.join("\n")}\n\n</details>`);
    return lines.join("\n\n");
  },

  knip() {
    if (passed) return "All clear: no unused files, exports or dependencies.";
    if (!output.includes("# Knip report")) return "**knip couldn't run** (often a mistake in `knip.json`). The log of this job says why.";
    const body = output.replace(/^# Knip report\s*/m, "").replace(/^## /gm, "#### ");
    return [
      "**knip found code nothing uses** (listed below). This check is advisory for now: it doesn't block merging.",
      "Remove what's truly unused, or keep it and tell knip why in `knip.json`.",
      body.trim(),
    ].join("\n\n");
  },
};

const titles = { lint: "Lint and format", typecheck: "Type check", test: "Tests", knip: "Unused code (knip)" };
if (!writers[kind]) throw new Error(`Unknown summary kind: ${kind}`);
const text = `### ${titles[kind]}\n\n${writers[kind]()}\n`;
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
else console.log(text);
