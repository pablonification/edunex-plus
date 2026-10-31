// Words on a phone's screen above its tab bar (round 2's text budget: a tab's first screen ≤ ~45 words; the lead's
// rules), from Android's own view dump: every text node whose box sits between the status bar and the top of the
// tabs' bar (or the screen's bottom with no tabs), counted as the v4 mockups count them (letters or digits, with
// what holds a word together: . : , × % – -). Content descriptions aren't counted (they repeat the text).
//
//   node mobile/qa/words.mjs <dump.xml>   (words.sh makes the dump)
import fs from "node:fs";

const xml = fs.readFileSync(process.argv[2], "utf8");
const box = (b) => b.match(/\d+/g).map(Number);
const nodes = [...xml.matchAll(/<node [^>]*?>/g)].map((m) => m[0]);
const attr = (n, k) => n.match(new RegExp(`${k}="([^"]*)"`))?.[1] ?? "";
const tabs = nodes.find((n) => attr(n, "resource-id") === "tab.home");
const screen = box(attr(nodes[0], "bounds"));
const bottom = tabs ? box(attr(tabs, "bounds"))[1] : screen[3];
const top = 80;
let words = 0;
const seen = [];
for (const n of nodes) {
  const text = attr(n, "text").replace(/&#10;/g, " ").replace(/&amp;/g, "&").trim();
  if (!text) continue;
  const [, y1, , y2] = box(attr(n, "bounds"));
  if (y1 >= bottom || y2 <= top) continue;
  const count = (text.match(/[\p{L}\p{N}][\p{L}\p{N}.:,×%–-]*/gu) || []).length;
  words += count;
  seen.push(`${count}\t${text}`);
}
if (process.argv.includes("--list")) console.log(seen.join("\n"));
console.log(words);
