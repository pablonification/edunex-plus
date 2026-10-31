// Finds an element in a `uiautomator dump` by its React Native testID (the resource-id) and prints the
// centre of the first match that's on screen: "x y". Exits 1 when there's none.
//
//   adb shell uiautomator dump /dev/tty | node mobile/qa/ui-find.mjs '<testID regex>' [width height]
import fs from "node:fs";

const [pattern, width = "100000", height = "100000"] = process.argv.slice(2);
const wanted = new RegExp(`^(?:${pattern})$`);
const xml = fs.readFileSync(0, "utf8");
for (const node of xml.split("<node").slice(1)) {
  const id = /resource-id="([^"]*)"/.exec(node)?.[1];
  const bounds = /bounds="\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]"/.exec(node);
  if (!id || !bounds || !wanted.test(id)) continue;
  const [x1, y1, x2, y2] = bounds.slice(1).map(Number);
  // Partly hidden rows (under the tab bar, above the top) are skipped: a tap there could land on something else.
  if (x2 - x1 < 8 || y2 - y1 < 8 || y1 < 0 || x1 < 0 || x2 > Number(width) || y2 > Number(height)) continue;
  console.log(`${Math.round((x1 + x2) / 2)} ${Math.round((y1 + y2) / 2)} ${id}`);
  process.exit(0);
}
process.exit(1);
