// A dataset's hash says whether its content changed (DatasetStore.set): the same content in any key order is the
// same hash, any change in content is another.
import { describe, expect, it } from "vitest";
import { hashOf } from "../../src/engine/store/datasets";

describe("hashOf", () => {
  it("is the same for the same content, whatever order the keys came in, at any depth", () => {
    const a = { name: "Tugas 1", files: [{ url: "u", size: 1 }], due: { at: 5, tz: "WIB" } };
    const b = { due: { tz: "WIB", at: 5 }, files: [{ size: 1, url: "u" }], name: "Tugas 1" };
    expect(hashOf(a)).toBe(hashOf(b));
  });

  it("changes with any value, any key, the order of a list, or a value's type", () => {
    const base = {
      tasks: [
        { id: 1, title: "A" },
        { id: 2, title: "B" },
      ],
      n: 1,
    };
    const variants = [
      {
        tasks: [
          { id: 1, title: "A" },
          { id: 2, title: "b" },
        ],
        n: 1,
      },
      {
        tasks: [
          { id: 2, title: "B" },
          { id: 1, title: "A" },
        ],
        n: 1,
      },
      {
        tasks: [
          { id: 1, title: "A" },
          { id: 2, title: "B" },
        ],
        n: "1",
      },
      {
        tasks: [
          { id: 1, title: "A" },
          { id: 2, title: "B" },
        ],
        m: 1,
      },
      { tasks: [{ id: 1, title: "A" }], n: 1 },
      {
        tasks: [
          { id: 1, title: "A" },
          { id: 2, title: "B", extra: null },
        ],
        n: 1,
      },
    ];
    const hashes = new Set([hashOf(base), ...variants.map(hashOf)]);
    expect(hashes.size).toBe(variants.length + 1);
  });

  it("keeps a key that only appears deep down, and plain values", () => {
    expect(hashOf({ a: { b: { c: 1 } } })).not.toBe(hashOf({ a: { b: { c: 2 } } }));
    expect(hashOf(null)).not.toBe(hashOf(0));
    expect(hashOf("x")).not.toBe(hashOf(["x"]));
  });
});
