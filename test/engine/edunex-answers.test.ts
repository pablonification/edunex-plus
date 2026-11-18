// How an Edunex answer's body is taken (#384): data, a change in Edunex's data, or an answer a dropped connection cut short.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { read } from "../../src/engine/sources/edunex/client";

const Anything = z.unknown();
const kindOf = (body: string) => {
  try {
    read({ path: "/course/x", status: 200, body }, Anything);
    return "data";
  } catch (error) {
    return (error as { kind: string }).kind;
  }
};

describe("an Edunex answer's body", () => {
  it.each([
    ["nothing", ""],
    ["only spaces", "  \n"],
    ["an object that stops", '{"data":{"attributes":{"na'],
    ["a list that stops", '[{"id":1},{"id":'],
    ["a brace inside a string, then it stops", '{"name":"a } b", "x":'],
    ["an escaped quote, then it stops inside the string", '{"name":"say \\"hi'],
    ["a backslash at the very end", '{"name":"C:\\\\'],
  ])("%s: a dropped connection", (_what, body) => expect(kindOf(body)).toBe("Offline"));

  it.each([
    ["an HTML page", "<!DOCTYPE html><html><body>Maintenance</body></html>"],
    ["a string that stops", '"abc'],
    ["a whole object with more after it", '{"a":1}}'],
    ["a closing brace too many inside", '{"a":[1]]}'],
  ])("%s: Edunex changed", (_what, body) => expect(kindOf(body)).toBe("VendorChanged"));

  it("whole data reads", () => expect(kindOf('{"name":"a } { [ b","list":[1,2]}')).toBe("data"));
});
