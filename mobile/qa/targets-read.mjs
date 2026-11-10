// Touch targets in dumps of the phone's screens (Android's `uiautomator dump` XML, or Maestro's `hierarchy` JSON):
//
//   node mobile/qa/targets-read.mjs <dump>... [--density 420] [--all] [--json]
//
// Two lists, per dump (the dump's file name, without its extension, is the screen):
//   small     every clickable node under 48 dp in either direction (dp = px ÷ density ÷ 160, so 2.625 px a dp at 420 dpi)
//   unnamed   every clickable node TalkBack has nothing to read from: no text, no content description, and no child with one
// A clickable inside another clickable (a Pressable's own children) belongs to the one around it and is left out; `--all`
// lists those too. Exits 1 when either list has something, 0 when both are empty, 2 for a bad call.
//
// What a dump can't see: `hitSlop`. The app makes small controls 48 dp to touch with a hitSlop around a smaller drawn box
// (mobile/src/ui/sizes.ts; test/mobile/touch-targets.test.ts checks those sizes), and a dump reports the drawn box. So a
// node listed as small is "small to look at": check its code before counting it a miss. Bounds in both formats are cut to
// what shows, so a node half under the tab bar looks small (marked "cut by the tab bar or the screen's edge").
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, heightOf, insideTap, isLabelled, readDump, widthOf } from "./dump-lib.mjs";

export const TARGET_DP = 48;
const round1 = (n) => Math.round(n * 10) / 10;

/** @param {ReturnType<typeof readDump>} dump @param {{ density?: number, all?: boolean }} [options] */
export function readTargets(dump, { density = 420, all = false } = {}) {
  const pxPerDp = density / 160;
  const nodes = dump.nodes.filter((node) => !node.system);
  const tabTop = Math.min(Number.POSITIVE_INFINITY, ...nodes.filter((node) => /^tab\./.test(node.id) && widthOf(node) > 0).map((node) => node.y1));
  const bottom = Math.max(0, ...nodes.map((node) => node.y2));
  const taps = nodes.filter((node) => node.clickable && widthOf(node) > 0 && heightOf(node) > 0 && (all || !insideTap(node)));
  const mark = (node) => ({
    node,
    px: [widthOf(node), heightOf(node)],
    dp: [round1(widthOf(node) / pxPerDp), round1(heightOf(node) / pxPerDp)],
    cut: Math.abs(node.y2 - tabTop) <= 1 || node.y2 >= bottom,
  });
  return {
    small: taps.filter((node) => widthOf(node) < TARGET_DP * pxPerDp - 0.5 || heightOf(node) < TARGET_DP * pxPerDp - 0.5).map(mark),
    unnamed: taps.filter((node) => !isLabelled(node)).map(mark),
    taps: taps.length,
  };
}

function main(argv) {
  const args = argv.slice(2);
  const density = args.includes("--density") ? Number(args[args.indexOf("--density") + 1]) : 420;
  const skip = args.includes("--density") ? args.indexOf("--density") + 1 : -1;
  const files = args.filter((arg, i) => !arg.startsWith("--") && i !== skip);
  if (!files.length || files.some((file) => !fs.existsSync(file)) || !(density > 0)) {
    console.error("usage: node mobile/qa/targets-read.mjs <dump.xml|hierarchy.json>... [--density 420] [--all] [--json]");
    return 2;
  }
  const out = [];
  let found = 0;
  for (const file of files) {
    const result = readTargets(readDump(fs.readFileSync(file, "utf8")), { density, all: args.includes("--all") });
    const screen = path.basename(file).replace(/\.(?:maestro\.json|json|xml)$/, "");
    found += result.small.length + result.unnamed.length;
    out.push({ screen, file, taps: result.taps, small: result.small, unnamed: result.unnamed });
  }
  if (args.includes("--json")) {
    const plain = (list) =>
      list.map((item) => ({
        id: item.node.id,
        name: item.node.text || item.node.desc,
        bounds: [item.node.x1, item.node.y1, item.node.x2, item.node.y2],
        px: item.px,
        dp: item.dp,
        cut: item.cut,
      }));
    console.log(
      JSON.stringify(
        out.map((o) => ({ ...o, small: plain(o.small), unnamed: plain(o.unnamed) })),
        null,
        2,
      ),
    );
  } else {
    for (const o of out) {
      console.log(`\n${o.screen}  (${o.taps} clickable)`);
      for (const item of o.small)
        console.log(
          `  under ${TARGET_DP} dp  ${describe(item.node)}  ${item.px[0]}x${item.px[1]} px = ${item.dp[0]}x${item.dp[1]} dp${item.cut ? "  (cut by the tab bar or the screen's edge)" : ""}`,
        );
      for (const item of o.unnamed) console.log(`  nothing to read  ${describe(item.node)}  ${item.px[0]}x${item.px[1]} px = ${item.dp[0]}x${item.dp[1]} dp`);
      if (!o.small.length && !o.unnamed.length) console.log("  ok");
    }
    console.log(
      `\n${found ? `${found} to look at (small ones may still be 48 dp to touch through hitSlop).` : "Every target is 48 dp or more and has a name."}`,
    );
  }
  return found ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv);
