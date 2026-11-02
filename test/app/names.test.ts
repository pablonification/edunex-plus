// People's names as the screens show them: written the way people write them, initials from the name itself.
import { describe, expect, it } from "vitest";
import { displayName, initials } from "../../src/app/names";

describe("a person's name on screen", () => {
  it("is written the way people write it, even when Edunex stores capitals", () => {
    expect(displayName("DIMAS  PRATAMA")).toBe("Dimas Pratama");
  });

  it("gives initials from the name, never from a lecturer's titles", () => {
    expect(initials("Dimas Pratama")).toBe("DP");
    expect(initials("Dr. Fajar Yuliana, S.T., M.T.")).toBe("FY");
    expect(initials("Prof. Dr. Ir. Siti Rahma, M.Sc.")).toBe("SR");
  });
});
