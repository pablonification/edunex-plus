// The item an Edunex answer failed on, as a report's issue shows it: field names and types, the failing one marked,
// never a value (src/engine/report/json-shape.ts).
import { describe, expect, it } from "vitest";
import { checkPath, itemShape } from "../../src/engine/report/json-shape";

const answer = JSON.stringify({
  meta: { total: 2 },
  data: [
    { id: "1", attributes: { name: "Tugas 1", files: [], answers: [] } },
    { id: "2", attributes: { name: "Tugas 2 Rahasia", files: null, answers: [{ id: 7, answer: "<p>jawaban</p>", files: [] }] } },
  ],
});

describe("an Edunex answer's failing item", () => {
  it("reads the path out of the app's check, and none out of a check without one", () => {
    expect(checkPath("/course/tasks: data.1.attributes.files Invalid input: expected array, received null")).toEqual(["data", "1", "attributes", "files"]);
    expect(checkPath("/course/tasks: (root) Invalid input")).toBeNull();
    expect(checkPath("Edunex sent something other than data for /course/tasks")).toBeNull();
  });

  it("is the list item the check names, each value its type, the failing field marked, and no value of its own", () => {
    const item = itemShape(answer, ["data", "1", "attributes", "files"])!;
    expect(item.at).toBe("data.1");
    expect(item.shape).toBe(
      [
        "{",
        "  id: string",
        "  attributes: {",
        "    name: string",
        "    files: null  ← the check",
        "    answers: [1 item, item 0:",
        "      {",
        "        id: number",
        "        answer: string",
        "        files: []",
        "      }",
        "    ]",
        "  }",
        "}",
      ].join("\n"),
    );
    expect(item.shape).not.toMatch(/Tugas|Rahasia|jawaban/);
  });

  it("a field that isn't there at all is said missing, in the innermost item the check names", () => {
    const item = itemShape(answer, ["data", "1", "attributes", "answers", "0", "sent_at"])!;
    expect(item.at).toBe("data.1.attributes.answers.0");
    expect(item.shape.split("\n")).toContain("  sent_at: (missing)  ← the check");
  });

  it("past four levels off the check's route, an object or a list is only counted", () => {
    const deep = JSON.stringify({ data: [{ a: { b: { c: { d: { e: 1 } } } }, bad: null }] });
    const item = itemShape(deep, ["data", "0", "bad"])!;
    expect(item.shape).toContain("d: {1 field …}");
    expect(item.shape).toContain("bad: null  ← the check");
  });

  it("isn't made from an answer that isn't JSON, or a path that doesn't reach into it", () => {
    expect(itemShape("<html>", ["data", "0"])).toBeNull();
    expect(itemShape(answer, ["data", "9", "attributes"])).toBeNull();
  });
});
