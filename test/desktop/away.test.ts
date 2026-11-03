// Back from SIX or Edunex: a page of either opened in the browser from the app,
// then the window coming back to the front, reads that source's attendance
// again; anything else opened, or a trip older than half an hour, reads nothing.
import { describe, expect, it } from "vitest";
import { awayFromApp, siteOf } from "../../src/desktop/away";

const MINUTE = 60_000;

function trips() {
  let now = 0;
  const rechecked: string[] = [];
  const away = awayFromApp({ now: () => now, recheck: (source) => rechecked.push(source) });
  return { away, rechecked, later: (ms: number) => void (now += ms) };
}

describe("back from SIX or Edunex", () => {
  it("knows SIX and Edunex by their address, nothing else", () => {
    expect(siteOf("https://six.itb.ac.id/app/mahasiswa:1+2026-1/kelas/jadwal/mahasiswa/2")).toBe("six");
    expect(siteOf("https://edunex.itb.ac.id/courses/95001")).toBe("edunex");
    expect(siteOf("https://edunex.itb.ac.id")).toBe("edunex");
    expect(siteOf("https://akademik.itb.ac.id/")).toBeNull();
    expect(siteOf("https://six.itb.ac.id.example.com/")).toBeNull();
    expect(siteOf("not a link")).toBeNull();
  });

  it("reads the source again when the window comes back, for half an hour after the Student left for it", () => {
    const { away, rechecked, later } = trips();
    away.back();
    expect(rechecked).toEqual([]);
    away.opened("https://edunex.itb.ac.id/courses/95001");
    later(2 * MINUTE);
    away.back();
    expect(rechecked).toEqual(["edunex"]);
    // Back and forth: each return reads again (the engine keeps it to once a minute).
    away.opened("https://six.itb.ac.id/app/mahasiswa:1+2026-1/kelas/jadwal/mahasiswa/2");
    away.back();
    expect(rechecked).toEqual(["edunex", "edunex", "six"]);
    later(31 * MINUTE);
    away.back();
    expect(rechecked).toHaveLength(3);
  });

  it("another page opened reads nothing", () => {
    const { away, rechecked } = trips();
    away.opened("https://akademik.itb.ac.id/");
    away.back();
    expect(rechecked).toEqual([]);
  });
});
