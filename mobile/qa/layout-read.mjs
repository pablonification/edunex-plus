// Reads one dump of Beranda's first screen and says whether it reaches the top of tonight's hill (Hill 1). Takes
// Android's `uiautomator dump` (XML) or Maestro's `maestro hierarchy` (JSON); the format is told from the first character.
//
//   node mobile/qa/layout-read.mjs <dump> [--screen 1080x2400] [--tabbar-top <px>] [--app <package>] [--count-nested] [--detail] [--json]
//
// Rows (each "ok" or "FAIL"; the exit code is 1 when any is FAIL, 0 when none, 2 for a bad call):
//   bottom bar    the tabs left to right by testID: tab.home tab.schedule tab.tasks tab.courses tab.profile (Profil last)
//   no avatar     no `action.account` (or avatar) in a top bar: it leaves with the Profil tab
//   blocks        home.search, home.now, home.strip, home.grid: each there, top to bottom in that order, and fully visible,
//                 inside the screen and above the tab bar (a bottom edge touching the bar's top counts as cut: a dump
//                 reports only what shows, so a block cut by the bar looks like one that ends there)
//   taps          things to tap on the first screen, the tab bar left out, at least 14. A tap is a clickable node at least
//                 half on screen above the bar. A clickable inside another clickable (a Pressable's own children) is part
//                 of it and not counted; `--count-nested` counts them too. Boxes with the same bounds count once.
//   words         at most 50, counted as words-now.mjs counts (letters or digits, joined by . : , × % – -), from `text`
//                 only (a content description repeats what is drawn), status bar and tab bar left out
//   grid          home.grid's tiles (its outermost clickable nodes, or the `action.service.*` nodes lying inside its bounds: React
//                 Native may draw the tiles beside the grid's node, not under it): 8 at most, 4 across (the first row full when there are
//                 four or more), the last "Lainnya", one word each, none cut off, all the same size
//   strip         no tile of home.strip says exactly "0"
//
// "Cut off" for a grid label, three signs: the text ends with "…" or "..."; its box wraps onto more lines (taller than 1.8
// times the shortest label's); or its box is far narrower than its letters could be. A label is a 13 sp semibold word: at the
// A52's 2.625 px per dp a letter averages about 0.5 em, or 17 px, and the text node's box is about 1.5 em (52 px) tall, so a
// letter is never under a third of the box's height wide. The floor is letters × 0.25 × the shortest label's height, with
// the box 85% of it at least (the first guess, 0.4, asked 21 px a letter and flagged "Ujian" and "Nilai", which are whole on the
// phone). It is a guess to point at a label to look at in the picture, not a measure; a wide word (mmm) can still pass.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { describe, heightOf, insideTap, labelOf, readDump, shareInside, widthOf, within, wordsIn } from "./dump-lib.mjs";

export const TABS = ["tab.home", "tab.schedule", "tab.tasks", "tab.courses", "tab.profile"];
export const BLOCKS = ["home.search", "home.now", "home.strip", "home.grid"];
export const MIN_TAPS = 14;
export const MAX_WORDS = 50;
export const MAX_TILES = 8;
const ACCOUNT_WORDS = /^(?:akun dan pengaturan|account and settings)$/i;

const first = (nodes, id) => nodes.find((node) => node.id === id && !node.system);
const visibleText = (node) =>
  within(node)
    .map((n) => n.text.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ");

/**
 * @param {ReturnType<typeof readDump>} dump
 * @param {{ screen?: [number, number], tabbarTop?: number, countNested?: boolean }} [options]
 */
export function readLayout(dump, options = {}) {
  const [W, H] = options.screen ?? [1080, 2400];
  const nodes = dump.nodes.filter((node) => !node.system);
  const tabNodes = nodes.filter((node) => /^tab\./.test(node.id) && widthOf(node) > 0);
  const tabTop = options.tabbarTop ?? (tabNodes.length ? Math.min(...tabNodes.map((node) => node.y1)) : H);
  const rows = [];
  const add = (key, ok, value, detail = []) => rows.push({ key, ok, value, detail });
  const inBar = (node) => {
    for (let up = node; up; up = up.parent) if (/^tab\./.test(up.id)) return true;
    return false;
  };

  // The bottom bar.
  const seen = new Set();
  const tabs = tabNodes
    .filter((node) => !seen.has(node.id) && seen.add(node.id))
    .sort((a, b) => a.x1 - b.x1)
    .map((node) => ({ id: node.id, label: labelOf(node).split(",")[0] }));
  const order = tabs.map((tab) => tab.id);
  add("bottom bar", order.join(" ") === TABS.join(" "), tabs.map((tab) => `${tab.id}${tab.label ? ` (${tab.label})` : ""}`).join(", ") || "no tab.* nodes", [
    `wanted: ${TABS.join(" ")}`,
    `last is tab.profile: ${order.at(-1) === "tab.profile"}`,
    `tab bar top: ${tabTop}${options.tabbarTop === undefined ? "" : " (given)"}`,
  ]);

  // The avatar.
  const avatars = nodes.filter(
    (node) => node.y1 < H * 0.15 && (node.id === "action.account" || /avatar/i.test(node.id) || ACCOUNT_WORDS.test(node.desc.trim())),
  );
  add("no avatar in a top bar", avatars.length === 0, avatars.length ? avatars.map(describe).join("; ") : "none", [
    'today\'s is `action.account` in TabActions (mobile/src/shell/source-status.tsx), described "Akun dan pengaturan"',
  ]);

  // The four blocks.
  const found = BLOCKS.map((id) => ({ id, node: first(nodes, id) }));
  const blockDetail = [];
  let blocksOk = true;
  for (const [i, { id, node }] of found.entries()) {
    if (!node) {
      blocksOk = false;
      blockDetail.push(`${id}: missing`);
      continue;
    }
    const problems = [];
    if (widthOf(node) <= 0 || heightOf(node) <= 0) problems.push("no size");
    if (node.x1 < 0 || node.y1 < 0 || node.x2 > W) problems.push("outside the screen");
    if (node.y2 > tabTop) problems.push(`under the tab bar (bottom ${node.y2} > ${tabTop})`);
    else if (node.y2 >= tabTop - 2) problems.push(`touches the tab bar's top (bottom ${node.y2}, bar ${tabTop}): probably cut`);
    const before = found.slice(0, i).findLast((b) => b.node);
    if (before && node.y1 < before.node.y1) problems.push(`above ${before.id} (top ${node.y1} < ${before.node.y1})`);
    else if (before && node.y1 < before.node.y2 - 2) problems.push(`overlaps ${before.id} (top ${node.y1} < its bottom ${before.node.y2})`);
    if (problems.length) blocksOk = false;
    blockDetail.push(`${id} [${node.x1},${node.y1}][${node.x2},${node.y2}]: ${problems.length ? `FAIL ${problems.join(", ")}` : "ok"}`);
  }
  add(
    "blocks in order, fully visible",
    blocksOk,
    found.map(({ id, node }) => `${id.slice(5)} ${node ? `${node.y1}-${node.y2}` : "missing"}`).join(" · "),
    blockDetail,
  );

  // Things to tap.
  const screenRect = { x1: 0, y1: 0, x2: W, y2: tabTop };
  const onScreen = nodes.filter((node) => node.clickable && widthOf(node) > 0 && heightOf(node) > 0 && !inBar(node) && shareInside(node, screenRect) >= 0.5);
  const keep = new Set();
  const nested = [];
  const taps = [];
  for (const node of onScreen) {
    if (insideTap(node) && !options.countNested) {
      nested.push(node);
      continue;
    }
    const key = `${node.x1},${node.y1},${node.x2},${node.y2}`;
    if (keep.has(key)) continue;
    keep.add(key);
    taps.push(node);
  }
  add("things to tap", taps.length >= MIN_TAPS, `${taps.length} (wanted ${MIN_TAPS}+)`, [
    ...taps.map((node) => `${node.id || "(no id)"}  ${labelOf(node) || "(no name)"}`),
    ...(nested.length ? [`not counted, inside another tap: ${nested.map((node) => node.id || labelOf(node)).join(", ")}`] : []),
  ]);

  // Words.
  const statusBottom = Math.round(H * 0.055);
  const spoken = nodes
    .filter((node) => node.text.trim() && !inBar(node) && node.y1 < tabTop && node.y2 > statusBottom && node.y2 > node.y1 && node.x2 > 0 && node.x1 < W)
    .sort((a, b) => a.y1 - b.y1 || a.x1 - b.x1)
    .map((node) => ({ text: node.text.replace(/\s+/g, " ").trim(), words: wordsIn(node.text) }));
  const words = spoken.reduce((sum, item) => sum + item.words, 0);
  add(
    "words",
    words <= MAX_WORDS,
    `${words} (at most ${MAX_WORDS})`,
    spoken.map((item) => `${String(item.words).padStart(3)}  ${item.text}`),
  );

  // The service grid.
  const gridNode = first(nodes, "home.grid");
  let tiles = [];
  const gridDetail = [];
  let gridOk = false;
  let gridValue = "no home.grid";
  if (gridNode) {
    // React Native may flatten the grid's own view away, so its tiles come out as siblings of the `home.grid` node (same parent,
    // bounds inside its bounds), not children of it (the base's dump: ~/hill-climb/run/dumps/r0-home.maestro.json). A tile is a
    // clickable node under the grid, or an `action.service.*` node lying inside the grid's bounds; the outermost one of each.
    const gridRect = { x1: gridNode.x1, y1: gridNode.y1, x2: gridNode.x2, y2: gridNode.y2 };
    const under = new Set(within(gridNode));
    const candidates = nodes.filter(
      (node) =>
        node !== gridNode &&
        node.clickable &&
        widthOf(node) > 0 &&
        (under.has(node) || (/^action\.service\./.test(node.id) && shareInside(node, gridRect) >= 0.5)),
    );
    const isTile = new Set(candidates);
    tiles = candidates
      .filter((node) => {
        for (let up = node.parent; up; up = up.parent) if (isTile.has(up)) return false;
        return true;
      })
      .map((node) => {
        // A tile's tag ("3,26" on Nilai, under `tag.service.<id>`) is its answer, not its name: the one word is the label under it.
        const tagged = new Set(
          within(node)
            .filter((n) => /^tag\./.test(n.id))
            .flatMap((n) => [n, ...within(n)]),
        );
        const named = within(node).filter((n) => !tagged.has(n) && n.text.trim());
        const label = named.map((n) => n.text.replace(/\s+/g, " ").trim()).join(" ") || visibleText(node) || labelOf(node);
        return { node, label, box: within(node).filter((n) => n.text.trim()) };
      });
    const reading = [...tiles].sort((a, b) => a.node.y1 - b.node.y1 || a.node.x1 - b.node.x1);
    const rowsOfTiles = [];
    for (const tile of reading) {
      const row = rowsOfTiles.find((r) => Math.abs(r[0].node.y1 - tile.node.y1) <= 8);
      if (row) row.push(tile);
      else rowsOfTiles.push([tile]);
    }
    const across = rowsOfTiles.map((r) => r.length);
    const lastTile = reading.at(-1);
    const labelBoxes = tiles.flatMap((tile) => tile.box);
    const line = labelBoxes.length ? Math.min(...labelBoxes.map(heightOf)) : 0;
    const problems = [];
    if (tiles.length === 0) problems.push("no clickable tiles");
    if (tiles.length > MAX_TILES) problems.push(`${tiles.length} tiles, ${MAX_TILES} at most`);
    if (across.some((n) => n > 4) || (tiles.length >= 4 && across[0] !== 4)) problems.push(`${across.join("+")} across, not 4 a row`);
    if (lastTile && lastTile.node.id !== "action.service.more" && !/^(?:lainnya|more)$/i.test(lastTile.label.trim()))
      problems.push(`the last tile is "${lastTile.label}", not "Lainnya" (action.service.more)`);
    const heights = tiles.map((tile) => heightOf(tile.node));
    if (heights.length && Math.max(...heights) - Math.min(...heights) > 4)
      problems.push(`tiles differ in height (${Math.min(...heights)}-${Math.max(...heights)} px): one may be cut by the tab bar`);
    for (const tile of reading) {
      const marks = [];
      const count = wordsIn(tile.label);
      if (count !== 1) marks.push(`${count} words`);
      for (const box of tile.box) {
        const chars = [...box.text.trim()].length;
        const needed = 0.25 * line * chars;
        if (/(?:…|\.\.\.)$/.test(box.text.trim())) marks.push("ends with an ellipsis");
        else if (line > 0 && heightOf(box) > 1.8 * line) marks.push(`wraps (${heightOf(box)} px tall, a line is ${line})`);
        else if (line > 0 && widthOf(box) < 0.85 * needed)
          marks.push(`box ${widthOf(box)} px wide, at least ${Math.round(needed)} for ${chars} letters: may be cut`);
      }
      if (marks.length) problems.push(`"${tile.label}": ${marks.join("; ")}`);
      gridDetail.push(
        `${tile.node.id || "(no id)"}  "${tile.label}"  [${tile.node.x1},${tile.node.y1}][${tile.node.x2},${tile.node.y2}]${marks.length ? `  <- ${marks.join("; ")}` : ""}`,
      );
    }
    gridOk = problems.length === 0;
    gridValue = `${tiles.length} tiles (${across.join("+") || "-"} across), last "${lastTile?.label ?? "-"}"${problems.length ? ` · FAIL: ${problems.join(" | ")}` : ""}`;
  }
  add("service grid", gridOk, gridValue, gridDetail);

  // The strip.
  const stripNode = first(nodes, "home.strip");
  const zeros = stripNode ? within(stripNode).filter((node) => node.text.trim() === "0") : [];
  add(
    'no "0" on the strip',
    stripNode ? zeros.length === 0 : false,
    stripNode ? (zeros.length ? `${zeros.length} tile text is exactly "0": ${zeros.map((node) => describe(node)).join("; ")}` : "none") : "no home.strip",
    stripNode ? [`the strip says: ${visibleText(stripNode) || "(nothing)"}`] : [],
  );

  return {
    ok: rows.every((row) => row.ok),
    screen: [W, H],
    tabbarTop: tabTop,
    format: dump.format,
    tabs: order,
    avatar: avatars.map((node) => describe(node)),
    blocks: Object.fromEntries(found.map(({ id, node }) => [id, node ? { bounds: [node.x1, node.y1, node.x2, node.y2] } : null])),
    taps: taps.map((node) => ({ id: node.id, name: labelOf(node) })),
    tapsNested: nested.map((node) => node.id || labelOf(node)),
    words,
    wordList: spoken,
    grid: tiles.map((tile) => ({ id: tile.node.id, label: tile.label })),
    stripZeros: zeros.length,
    rows,
  };
}

function main(argv) {
  const args = argv.slice(2);
  const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const valued = new Set(["--screen", "--tabbar-top", "--app"].flatMap((name) => (args.includes(name) ? [args.indexOf(name), args.indexOf(name) + 1] : [])));
  const file = args.find((arg, i) => !arg.startsWith("--") && !valued.has(i));
  if (!file || !fs.existsSync(file)) {
    console.error(
      "usage: node mobile/qa/layout-read.mjs <dump.xml|hierarchy.json> [--screen 1080x2400] [--tabbar-top <px>] [--app <package>] [--count-nested] [--detail] [--json]",
    );
    return 2;
  }
  const screen = (flag("--screen") ?? "1080x2400").split("x").map(Number);
  if (screen.length !== 2 || screen.some((n) => !(n > 0))) {
    console.error(`--screen wants WIDTHxHEIGHT, like 1080x2400 (got ${flag("--screen")})`);
    return 2;
  }
  const tabbar = flag("--tabbar-top");
  const dump = readDump(fs.readFileSync(file, "utf8"), { app: flag("--app") });
  const result = readLayout(dump, { screen, tabbarTop: tabbar === undefined ? undefined : Number(tabbar), countNested: args.includes("--count-nested") });
  if (args.includes("--json")) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`${file}  (${result.format}, ${result.screen.join("x")}, tab bar top ${result.tabbarTop})`);
    for (const row of result.rows) {
      console.log(`${row.ok ? "ok  " : "FAIL"}  ${row.key}: ${row.value}`);
      if (!row.ok || args.includes("--detail") || row.key === "things to tap" || row.key === "service grid")
        for (const line of row.detail) console.log(`        ${line}`);
    }
    const failing = result.rows.filter((row) => !row.ok).map((row) => row.key);
    console.log(failing.length ? `\nBelow the top of the hill: ${failing.join("; ")}` : "\nAt the top of the hill.");
  }
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv);
