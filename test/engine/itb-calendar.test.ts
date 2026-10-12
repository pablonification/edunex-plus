// v2-15 (#84): ITB's academic calendar, read from its public feed into dated
// events the rest of the app reasons with, refreshed daily, kept when offline.
import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "../../src/core/models";
import { kindOf } from "../../src/engine/sources/itb/calendar";
import { startEngine } from "./harness";

const HOUR = 3_600_000;
const wib = (iso: string) => Date.parse(`${iso}+07:00`);
const calendarRequests = (h: Awaited<ReturnType<typeof startEngine>>) => h.world.itb.requests.filter((r) => r.host === "goitb.id").length;
const find = (events: CalendarEvent[], kind: string, term: string) => events.filter((e) => e.kind === kind && e.term === term);

describe("ITB academic calendar", () => {
  it("reads the public feed into dated events with what each one means", async () => {
    const h = await startEngine();
    await h.wait();
    const { events } = h.dataset("itb.calendar")!;
    expect(events).toHaveLength(110);

    expect(find(events, "uts", "2026-1")).toEqual([
      {
        id: "2026-2027-1-masa-ujian-tengah",
        title: "Masa Ujian Tengah Semester I-2026/2027",
        kind: "uts",
        term: "2026-1",
        start: wib("2026-10-12T00:00:00"),
        end: wib("2026-10-17T00:00:00"),
        allDay: true,
        firstDay: "2026-10-12",
        lastDay: "2026-10-16",
      },
    ]);
    const day = (kind: string, term: string) => find(events, kind, term).map((e) => (e.firstDay === e.lastDay ? e.firstDay : `${e.firstDay}..${e.lastDay}`));
    expect(day("lecture-start", "2026-1")).toEqual(["2026-08-24"]);
    expect(day("lecture-end", "2026-1")).toEqual(["2026-12-04"]);
    expect(day("uas", "2026-1")).toEqual(["2026-12-07..2026-12-22"]);
    expect(day("drs", "2026-1")).toEqual(["2026-08-12..2026-08-20"]);
    expect(day("urs", "2026-1")).toEqual(["2026-09-15..2026-09-18"]);
    expect(day("ukt-deadline", "2026-1")).toEqual(["2026-08-23"]);
    expect(day("questionnaire", "2026-1")).toEqual(["2026-11-30..2026-12-11"]);
    expect(day("grade-deadline", "2026-1")).toEqual(["2027-01-08"]);
    expect(day("drs", "2026-3")).toEqual(["2027-06-15..2027-06-18"]);
    expect(events.filter((e) => e.kind === "progress-check").map((e) => e.firstDay)).toEqual(["2026-08-03", "2027-01-18", "2027-08-02"]);
    expect(events.filter((e) => e.kind === "holiday").map((e) => e.title)).toEqual([
      "Libur Kuliah dalam rangka Hari Raya Natal",
      "Libur Kuliah dalam rangka Hari Raya Idul Fitri*)",
    ]);
    // Escaped commas come out as commas.
    const ijazah = events.find((e) => e.id === "2026-penerbitan-ijazah-yudisium-mei")!;
    expect(ijazah).toMatchObject({ kind: "graduation", title: "Penerbitan Ijazah Yudisium Mei 2026, Juni 2026, dan Juli 2026 (Revisi-02)" });
    // Events the app doesn't know stay, as "other".
    expect(events.find((e) => e.title.startsWith("Sidang Terbuka Dalam Rangka Dies Natalis"))).toMatchObject({ kind: "other" });
    // In time order.
    expect(events.map((e) => e.start)).toEqual([...events.map((e) => e.start)].sort((a, b) => a - b));
    expect(h.status("itb").state).toBe("live");
  });

  it("is read once a day, not on every start", async () => {
    const h = await startEngine();
    await h.wait();
    expect(calendarRequests(h)).toBe(1);
    // A refresh soon after (the catalog is still being read) doesn't read the calendar again.
    const refresh = h.engine.refresh("itb");
    await h.wait(12 * HOUR);
    await refresh;
    expect(calendarRequests(h)).toBe(1);
    await h.wait(13 * HOUR);
    expect(calendarRequests(h)).toBe(2);
  });

  it("calendar changed: a moved exam week shows on the next daily read", async () => {
    const h = await startEngine();
    await h.wait();
    h.world.itb.calendar = h.world.itb.calendar.replace(
      "DTSTART;VALUE=DATE:20261012\nDTEND;VALUE=DATE:20261017\nDTSTAMP:20260710T000000Z\nUID:2026-2027-1-masa-ujian-tengah",
      "DTSTART;VALUE=DATE:20261019\nDTEND;VALUE=DATE:20261024\nDTSTAMP:20260710T000000Z\nUID:2026-2027-1-masa-ujian-tengah",
    );
    const before = h.events.filter((e) => e.type === "dataset" && e.dataset.name === "itb.calendar").length;
    await h.wait(25 * HOUR);
    const uts = find(h.dataset("itb.calendar")!.events, "uts", "2026-1")[0]!;
    expect([uts.firstDay, uts.lastDay]).toEqual(["2026-10-19", "2026-10-23"]);
    expect(h.events.filter((e) => e.type === "dataset" && e.dataset.name === "itb.calendar").length).toBeGreaterThan(before);
  });

  it("a feed that is no longer a calendar says ITB changed something and keeps the last copy", async () => {
    const h = await startEngine();
    await h.wait();
    h.world.itb.calendar = "<!DOCTYPE html><html><body>Halaman tidak ditemukan</body></html>";
    await h.wait(25 * HOUR);
    expect(h.status("itb")).toMatchObject({ state: "changed", detail: "ITB's calendar: Not a calendar" });
    expect(h.dataset("itb.calendar")!.events).toHaveLength(110);
  });

  it("offline with a cached copy: the calendar stays and the status says offline", async () => {
    const first = await startEngine();
    await first.wait();
    first.engine.stop();
    await first.world.clock.advance(2 * 24 * HOUR);
    first.world.setOffline(true);
    const again = await startEngine({ world: first.world, storage: first.storage, vault: first.vault });
    expect(again.dataset("itb.calendar")!.events).toHaveLength(110);
    await again.wait();
    expect(again.status("itb")).toMatchObject({ state: "offline", detail: "ITB's calendar is unreachable" });
    expect(again.dataset("itb.calendar")!.events).toHaveLength(110);
  });
});

describe("what an event is, from ITB's title", () => {
  it("titles ITB wrote in other years too (from the live feed), and the kinds the full calendar groups by", () => {
    // These two used to fall through to "other".
    expect(kindOf("Pemantauan dan Evaluasi Kemajuan Studi Mahasiswa")).toBe("progress-check");
    expect(kindOf("Batas Akhir Pemasukan Nilai Mata Kuliah Semester I-2024/2025")).toBe("grade-deadline");
    expect(kindOf("Batas Akhir Kategori Tepat Waktu Pemasukan Nilai Akhir Mata Kuliah Semester I-2026/2027")).toBe("grade-deadline");
    expect(kindOf("Batas Waktu Pemasukan Nilai Konversi Aktivitas Kemahasiswaan Semester II-2025/2026")).toBe("other");
    expect(kindOf("Batas Akhir Perubahan Nilai Mata Kuliah Semester I-2026/2027")).toBe("grade-change-deadline");
    expect(kindOf("Batas Akhir Pengajuan Cuti Semester I-2026/2027")).toBe("leave");
    expect(kindOf("Batas Akhir Pengajuan Perpanjangan Waktu Studi Semester I-2026/2027 dari mahasiswa")).toBe("study-extension");
    expect(kindOf("Yudisium ITB Bulan Juli 2026")).toBe("graduation");
    expect(kindOf("Hari Wisuda Ketiga Tahun Akademik 2025/2026 (Revisi)")).toBe("graduation");
    expect(kindOf("Batas Waktu Pemenuhan Persyaratan Administrasi Kelulusan untuk Yudisium September 2026")).toBe("graduation");
  });
});
