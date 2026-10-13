// Writes the pull request comment (and the run summary) for the screens job:
// the screens this pull request changes, before and after, cropped to the
// change; which screens couldn't be pictured and why; and where to get every
// picture. The comment's picture addresses start with {{IMAGES}}: the job that
// publishes the pictures (on the pr-assets branch) puts their folder's address
// there. The run summary, which can't show them, names the screens instead.
//
//   node scripts/ci/screens-comment.mjs <pictures-dir> <capture-log> <changed-dir> <artifact-url> <commit> <base> <out-file>
import fs from "node:fs";
import path from "node:path";

const [dir, logFile, changedDir, artifactUrl, commit, base, outFile] = process.argv.slice(2);
const pictures = fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith(".png")) : [];
const log = fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8") : "";
// capture.mjs notes each screen it couldn't picture as "! <screen>: <error>".
const missed = [...log.matchAll(/^! (.+?): (.*)$/gm)].map(([, screen, error]) => `- ${screen}: ${error.slice(0, 160)}`);
const changedFile = path.join(changedDir ?? "", "changed.json");
const changed = fs.existsSync(changedFile) ? JSON.parse(fs.readFileSync(changedFile, "utf8")) : null;
const short = (commit ?? "").slice(0, 7);
/** Pairs shown in the comment; the rest are named, and are in the zip. */
const SHOWN = 8;

/** "13-presensi.png" → "Presensi"; "28-gelap-beranda.png" → "Beranda, dark"; "31-english-home.png" → "Home, in English". */
function title(name) {
  let words = name.replace(/\.png$/, "").replace(/^\d+-/, "");
  let suffix = "";
  if (words.startsWith("gelap-")) [words, suffix] = [words.slice(6), ", dark"];
  if (words.startsWith("english-")) [words, suffix] = [words.slice(8), ", in English"];
  const text = words.replaceAll("-", " ");
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}${suffix}`;
}

const download = artifactUrl
  ? `[Every picture](${artifactUrl}) (${pictures.length}, a zip; open it while signed in to GitHub), kept for 14 days.`
  : `Every picture (${pictures.length}) is attached to this run under **Artifacts**, for 14 days.`;

function write(withPictures) {
  const lines = ["### Screens this pull request changes", ""];
  if (pictures.length === 0) {
    lines.push(
      "**No pictures this time:** the demo app didn't build or didn't start. The log of the **screens** job says why.",
      "",
      "This check is advisory, so it doesn't block merging. Try `npm run demo` on your computer: if the app doesn't open there either, this pull request broke it.",
    );
  } else if (changed === null) {
    lines.push(`Pictures of \`${base}\` to compare with couldn't be taken this time, so nothing is shown here.`, "", download);
  } else if (changed.length === 0) {
    lines.push(`No screen changed: all ${pictures.length} pictures match \`${base}\`, on the demo's made-up data.`, "", download);
  } else {
    lines.push(
      `Compared with \`${base}\`, on the demo's made-up data (no real student): ${changed.length} of ${pictures.length} pictures changed, cropped to the change.`,
      "",
    );
    for (const { name, kind } of changed.slice(0, SHOWN)) {
      lines.push(`**${title(name)}**${kind === "new" ? " (new)" : ""}`, "");
      if (!withPictures) continue;
      const after = `![${title(name)} after]({{IMAGES}}/after-${name}?raw=true)`;
      if (kind === "new") {
        lines.push(after, "");
      } else {
        lines.push("| Before | After |", "| --- | --- |", `| ![${title(name)} before]({{IMAGES}}/before-${name}?raw=true) | ${after} |`, "");
      }
    }
    const rest = changed.slice(SHOWN).map(({ name }) => title(name));
    if (rest.length > 0) lines.push(`Also changed: ${rest.join(", ")}.`, "");
    lines.push(download);
  }
  if (missed.length > 0)
    lines.push("", `Couldn't picture ${missed.length === 1 ? "one screen" : `${missed.length} screens`} (a moved button or a slow start):`, "", ...missed);
  if (short) lines.push("", `<sub>Taken at ${short}. Fonts on the build machine differ a little from macOS and Windows.</sub>`);
  return `${lines.join("\n")}\n`;
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, write(true));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, write(false));
