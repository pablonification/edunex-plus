// Every tappable thing on a screen that is too small to hit or that TalkBack can't name, one line each.
//
//   node mobile/qa/touch-read.mjs <dump>... [--density 420]
//
// Reads Maestro's `hierarchy` JSON or Android's `uiautomator dump` XML (dump-lib.mjs), the same dumps layout-read.mjs reads.
// A finding is a clickable node under 48 dp on either side (1 dp = 2.625 px at 420 dpi), or one with no text, no content
// description and no child that has one. A clickable inside another clickable belongs to the one around it, which is the real
// target, so only the outer one is judged. A node cut by the tab bar or the screen's edge reports half its size: it is shown as
// a note and not counted. The size is what is drawn: a `hitSlop` is invisible to a dump, so look at a small one's code first.
// Exit 1 when any finding, 0 when none, 2 for a bad call. The measuring is targets-read.mjs's (and its tests').
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, readDump } from "./dump-lib.mjs";
import { readTargets, TARGET_DP } from "./targets-read.mjs";

/** "top left", "middle", "bottom right": which ninth of the screen the node's centre is in. */
export function whereOn(node, width, height) {
  const third = (value, size, names) => names[Math.min(2, Math.max(0, Math.floor((value / Math.max(size, 1)) * 3)))];
  const row = third((node.y1 + node.y2) / 2, height, ["top", "middle", "bottom"]);
  const column = third((node.x1 + node.x2) / 2, width, ["left", "centre", "right"]);
  return row === "middle" && column === "centre" ? "middle" : `${row} ${column}`;
}

/**
 * @param {ReturnType<typeof readDump>} dump
 * @returns {{ findings: { line: string, small: boolean, unnamed: boolean }[], notes: string[], taps: number }}
 */
export function readTouch(dump, { density = 420 } = {}) {
  const { small, unnamed, taps } = readTargets(dump, { density });
  const entries = new Map();
  const entry = (item) => {
    if (!entries.has(item.node)) entries.set(item.node, { item, small: false, unnamed: false });
    return entries.get(item.node);
  };
  for (const item of small) entry(item).small = true;
  for (const item of unnamed) entry(item).unnamed = true;
  const findings = [];
  const notes = [];
  for (const { item, small: isSmall, unnamed: isUnnamed } of entries.values()) {
    const why = [isSmall ? `under ${TARGET_DP} dp` : "", isUnnamed ? "no name TalkBack can read" : ""].filter(Boolean).join(", ");
    const line = `${describe(item.node)}  ${item.dp[0]}x${item.dp[1]} dp  ${whereOn(item.node, dump.width, dump.height)}  ${why}`;
    if (isSmall && !isUnnamed && item.cut) notes.push(`${line}  (cut by the tab bar or the screen's edge: not counted)`);
    else findings.push({ line, small: isSmall, unnamed: isUnnamed });
  }
  return { findings, notes, taps };
}

function main(argv) {
  const args = argv.slice(2);
  const at = args.indexOf("--density");
  const density = at >= 0 ? Number(args[at + 1]) : 420;
  const files = args.filter((arg, i) => !arg.startsWith("--") && i !== (at >= 0 ? at + 1 : -1));
  if (!files.length || files.some((file) => !fs.existsSync(file)) || !(density > 0)) {
    console.error("usage: node mobile/qa/touch-read.mjs <dump.xml|hierarchy.json>... [--density 420]");
    return 2;
  }
  let count = 0;
  for (const file of files) {
    const { findings, notes, taps } = readTouch(readDump(fs.readFileSync(file, "utf8")), { density });
    const screen = path.basename(file).replace(/\.(?:maestro\.json|json|xml)$/, "");
    count += findings.length;
    console.log(`${screen}  (${taps} tappable)`);
    for (const finding of findings) console.log(`  ${finding.line}`);
    for (const note of notes) console.log(`  note: ${note}`);
    if (!findings.length) console.log("  ok");
  }
  console.log(
    count ? `\n${count} to fix or check (a small one may be 48 dp to touch through hitSlop).` : "\nEvery tappable thing is 48 dp or more and has a name.",
  );
  return count ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv);
