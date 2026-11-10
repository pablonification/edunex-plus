// Round 4's first hill, read from Beranda's first screen (mobile/qa/r4-board.md): the tabs in order, whether an avatar
// is in the top bar, whether the search bar, the now card, the strip and the grid are all fully visible above the tab
// bar and in that order, how many things there are to tap, how many words, and the grid's tiles and their words.
// From Maestro's view of the screen (`maestro hierarchy`), which works while Beranda's wave keeps moving.
//
//   maestro --device "$ANDROID_SERIAL" hierarchy | node mobile/qa/r4-hill1.mjs
import fs from "node:fs";

const raw = fs.readFileSync(0, "utf8");
const root = JSON.parse(raw.slice(raw.indexOf("{")));
const box = (b) => (b ?? "[0,0][0,0]").match(/-?\d+/g).map(Number);
const nodes = [];
const walk = (node, inside) => {
  const a = node.attributes ?? {};
  const id = a["resource-id"] ?? "";
  nodes.push({ ...a, id, inside });
  for (const child of node.children ?? []) walk(child, id.startsWith("service.") ? id : inside);
};
walk(root, null);
const byId = (id) => nodes.find((n) => n.id === id);
const screenBottom = Math.max(...nodes.map((n) => box(n.bounds)[3]));
const tabs = nodes.filter((n) => /^tab\./.test(n.id)).sort((a, b) => box(a.bounds)[0] - box(b.bounds)[0]);
const bottom = tabs.length ? Math.min(...tabs.map((n) => box(n.bounds)[1])) : screenBottom;
const top = Math.round(screenBottom * 0.055);
const out = {};
out.tabs = tabs.map((n) => n.id).join(" ");
out.lastTabIsProfile = tabs.at(-1)?.id === "tab.profile";
out.avatarInTopBar = !!byId("action.account");

const parts = ["home.search", "home.now", "home.strip", "home.grid"];
let last = -1;
out.parts = {};
out.partsInOrderAndVisible = true;
for (const id of parts) {
  const node = byId(id);
  if (!node) {
    out.parts[id] = "missing";
    out.partsInOrderAndVisible = false;
    continue;
  }
  const [, y1, , y2] = box(node.bounds);
  const visible = y1 >= 0 && y2 <= bottom && y2 > y1;
  out.parts[id] = `${y1}-${y2}${visible ? "" : " (cut off)"}`;
  if (!visible || y1 < last) out.partsInOrderAndVisible = false;
  last = y1;
}
out.roomAboveTabBarPx = byId("home.grid") ? bottom - box(byId("home.grid").bounds)[3] : null;

// Things to tap: clickable nodes fully between the status bar and the tab bar, the tabs left out. A clickable inside
// another clickable counts (a button on a card is its own target); the page's scroller isn't one.
const taps = nodes.filter((n) => {
  if (n.clickable !== "true" || /^tab\./.test(n.id)) return false;
  const [x1, y1, x2, y2] = box(n.bounds);
  return y1 >= top && y2 <= bottom && x2 - x1 > 8 && y2 - y1 > 8;
});
out.thingsToTap = taps.length;
out.tapIds = taps.map((n) => n.id || n.text || n["content-desc"] || "?").join(", ");

let words = 0;
for (const n of nodes) {
  const text = (n.text ?? "").trim();
  if (!text) continue;
  const [, y1, , y2] = box(n.bounds);
  if (y1 >= bottom || y2 <= top || y2 <= y1) continue;
  words += (text.match(/[\p{L}\p{N}][\p{L}\p{N}.:,×%–-]*/gu) || []).length;
}
out.words = words;

const tiles = nodes.filter((n) => n.id.startsWith("service.") && box(n.bounds)[3] <= bottom);
const labels = tiles.map((tile) => nodes.find((n) => n.inside === tile.id && (n.text ?? "").trim())?.text?.trim() ?? "?");
out.gridTiles = tiles.length;
out.gridLabels = labels.join(" · ");
out.gridOneWordEach = labels.every((label) => !/\s/.test(label));
out.gridLast = tiles.at(-1)?.id ?? null;
console.log(JSON.stringify(out, null, 2));
