// The words a Student sees on a tab's first screen, from a uiautomator dump (words.sh): every visible text of
// the app between the status bar and the bottom navigation, nothing scrolled to, then counted.
//
//   node mobile/qa/words.mjs <dump.xml> [--app <package>] [--json]
//
// Counted: each node's `text` (what's drawn; an icon's content-desc is not text on screen), split at spaces,
// a word being anything with a letter or a digit ("·", "–", "›" aren't). Left out: other packages (the status bar,
// the launcher), the bottom navigation (from the top of the first tab.* node down) and nodes whose middle is off
// the screen or under that bar. Prints the count, then each text with its own count, top to bottom.
import fs from "node:fs";

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith("--"));
const app = args.includes("--app") ? args[args.indexOf("--app") + 1] : "io.github.pablonification.edunexplus.demo";
if (!file) {
  console.error("usage: node words.mjs <dump.xml> [--app <package>] [--json]");
  process.exit(2);
}
const xml = fs.readFileSync(file, "utf8");
const attr = (node, name) => {
  const match = new RegExp(` ${name}="([^"]*)"`).exec(node);
  return match ? match[1] : "";
};
const decodeXml = (text) =>
  text
    .replace(/&#10;/g, "\n")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
const nodes = [...xml.matchAll(/<node [^>]*>/g)].map(([node]) => {
  const [x1, y1, x2, y2] = (attr(node, "bounds").match(/\d+/g) ?? [0, 0, 0, 0]).map(Number);
  return { id: attr(node, "resource-id"), text: decodeXml(attr(node, "text")), pkg: attr(node, "package"), x1, y1, x2, y2 };
});
const screen = nodes.find((node) => node.pkg === app && node.y1 === 0) ?? nodes[0];
const height = Math.max(...nodes.map((node) => node.y2));
const tabs = nodes.filter((node) => /^tab\./.test(node.id));
const barTop = tabs.length ? Math.min(...tabs.map((node) => node.y1)) : height;
const words = (text) => text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
const shown = nodes
  .filter((node) => node.pkg === app && node.text.trim() !== "")
  .filter((node) => {
    const middle = (node.y1 + node.y2) / 2;
    return middle > 0 && middle < barTop && node.x2 > 0 && node.x1 < (screen?.x2 ?? Number.POSITIVE_INFINITY);
  })
  .sort((a, b) => a.y1 - b.y1 || a.x1 - b.x1)
  .map((node) => ({ text: node.text.replace(/\s+/g, " ").trim(), words: words(node.text), y: node.y1 }));
const total = shown.reduce((sum, item) => sum + item.words, 0);
if (args.includes("--json")) console.log(JSON.stringify({ words: total, texts: shown }, null, 1));
else {
  console.log(`words ${total}`);
  for (const item of shown) console.log(`${String(item.words).padStart(3)}  ${item.text}`);
}
