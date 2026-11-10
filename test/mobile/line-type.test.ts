// Tugas's recycling (mobile/src/screens/tasks/line-type.ts): a scrolled-away row's cell goes only to a row built from the
// same parts, so FlashList updates it in place. A late row's swipe, an exam's part and an exam period are other trees: a
// cell handed between them was taken down and built again mid-fling.
import { expect, it } from "vitest";
import { lineType } from "../../mobile/src/screens/tasks/line-type";
import type { TodoItem } from "../../src/core/todo";

const todo = (item: Partial<TodoItem> & { kind: TodoItem["kind"] }) => ({ type: "todo", item: item as TodoItem });

it("keeps rows drawn from different parts apart, and the same ones together", () => {
  const calm = lineType(todo({ kind: "task", late: false }));
  expect(calm).toBe(lineType(todo({ kind: "task", late: false })));
  expect(
    new Set([calm, lineType(todo({ kind: "task", late: true })), lineType(todo({ kind: "exam", late: false })), lineType(todo({ kind: "period" }))]).size,
  ).toBe(4);
  expect(lineType({ type: "heading" })).toBe("heading");
  expect(lineType({ type: "hero", item: { kind: "task" } as TodoItem })).toBe("hero");
});
