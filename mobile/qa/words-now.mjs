// Words on a phone's screen above its tab bar (round 2's text budget: a tab's first screen ≤ ~45 words; the lead's
// rules), from Maestro's view of the screen (`maestro hierarchy`, which works while something on screen keeps moving,
// where Android's own uiautomator dump waits for an idle that never comes): every text between the status bar and the
// top of the tabs' bar (or the screen's bottom with no tabs), counted as the v4 mockups count them (letters or digits,
// with what holds a word together: . : , × % – -). Content descriptions aren't counted (they repeat the text).
//
//   node mobile/qa/words.mjs <hierarchy.json> [--list]   (words.sh makes it)
import fs from "node:fs";

const raw = fs.readFileSync(process.argv[2], "utf8");
const root = JSON.parse(raw.slice(raw.indexOf("{")));
const box = (b) => (b ?? "[0,0][0,0]").match(/-?\d+/g).map(Number);
const nodes = [];
const walk = (node) => {
  nodes.push(node.attributes ?? {});
  for (const child of node.children ?? []) walk(child);
};
walk(root);
const tabs = nodes.find((a) => a["resource-id"] === "tab.home");
const bottom = tabs ? box(tabs.bounds)[1] : Math.max(...nodes.map((a) => box(a.bounds)[3]));
// Below the status bar (its clock isn't the app's): the top 5.5% of the screen.
const top = Math.round(Math.max(...nodes.map((a) => box(a.bounds)[3])) * 0.055);
let words = 0;
const seen = [];
for (const a of nodes) {
  const text = (a.text ?? "").trim();
  if (!text) continue;
  const [, y1, , y2] = box(a.bounds);
  if (y1 >= bottom || y2 <= top || y2 <= y1) continue;
  const count = (text.match(/[\p{L}\p{N}][\p{L}\p{N}.:,×%–-]*/gu) || []).length;
  words += count;
  seen.push(`${count}\t${text}`);
}
if (process.argv.includes("--list")) console.log(seen.join("\n"));
console.log(words);
