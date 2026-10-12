// Writes the pull request comment (and the run summary) for the screens job:
// how many pictures of the app were taken, where to get them, and which
// screens couldn't be pictured and why.
//
//   node scripts/ci/screens-comment.mjs <pictures-dir> <capture-log> <artifact-url> <commit> <out-file>
import fs from "node:fs";

const [dir, logFile, artifactUrl, commit, outFile] = process.argv.slice(2);
const pictures = fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith(".png")) : [];
const log = fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8") : "";
// capture.mjs notes each screen it couldn't picture as "! <screen>: <error>".
const missed = [...log.matchAll(/^! (.+?): (.*)$/gm)].map(([, screen, error]) => `- ${screen}: ${error.slice(0, 160)}`);
const short = (commit ?? "").slice(0, 7);

const lines = ["### Pictures of every screen", ""];
if (pictures.length === 0) {
  lines.push(
    "**No pictures this time:** the demo app didn't build or didn't start. The log of the **screens** job says why.",
    "",
    "This check is advisory, so it doesn't block merging. Try `npm run demo` on your computer: if the app doesn't open there either, this pull request broke it.",
  );
} else {
  lines.push(
    `${pictures.length} pictures of the app as this pull request leaves it, taken on made-up data (no real student): every screen in light and dark, in Indonesian and English, plus the first run and Edunex without SIX.`,
    "",
    artifactUrl
      ? `**[Download the pictures](${artifactUrl})** (a zip; open it while signed in to GitHub). They're kept for 14 days.`
      : "The pictures are attached to this run under **Artifacts** (kept for 14 days).",
  );
  if (missed.length > 0)
    lines.push("", `Couldn't picture ${missed.length === 1 ? "one screen" : `${missed.length} screens`} (a moved button or a slow start):`, "", ...missed);
}
if (short) lines.push("", `<sub>Taken at ${short}. Fonts on the build machine differ a little from macOS and Windows.</sub>`);

const text = `${lines.join("\n")}\n`;
fs.writeFileSync(outFile, text);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
