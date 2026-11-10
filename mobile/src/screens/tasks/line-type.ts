// Tugas's lines for FlashList's recycling (./list.tsx): no React Native here, tested in Node.
import type { TodoItem } from "../../../../src/core/todo";

/**
 * A line's kind: a cell is handed over only to a line drawn from the same parts, so it's updated in place rather than
 * taken down and built again as the list scrolls. A late row carries its swipe (another tree), an exam's part and an
 * exam period theirs.
 */
export function lineType(line: { type: string; item?: TodoItem }): string {
  if (line.type !== "todo" || !line.item) return line.type;
  const { item } = line;
  return item.kind === "period" ? "todo:period" : `todo:${item.kind}${item.late ? ":late" : ""}`;
}
