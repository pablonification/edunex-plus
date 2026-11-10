// Beranda's strip, the tile for what's due: under the date, the Task's name and hour on one line that is never cut.
import { describe, expect, it } from "vitest";
import { tileName } from "../../mobile/src/screens/home/tile-name";

describe("tileName", () => {
  it("keeps a kind and its number, with the hour", () => {
    expect(tileName("Tugas 02 Bab II", "23:59")).toBe("Tugas 02, 23:59");
    expect(tileName("Tugas 01 Bab I: Latar Belakang, Rumusan Masalah (revisi kedua)", "08:00")).toBe("Tugas 01, 08:00");
  });
  it("keeps a short name whole, with the hour when both fit", () => {
    expect(tileName("Kuis 3", "10:00")).toBe("Kuis 3, 10:00");
    expect(tileName("Esai", "23:59")).toBe("Esai, 23:59");
    expect(tileName("Laporan akhir", "23:59")).toBe("Laporan akhir");
  });
  it("cuts a long name at a whole word, never mid-word", () => {
    expect(tileName("Laporan Praktikum Modul Tiga", "23:59")).toBe("Laporan, 23:59");
    expect(tileName("Presentasi kelompok - sesi dua", "23:59")).toBe("Presentasi");
  });
});
