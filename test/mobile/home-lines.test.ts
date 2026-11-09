// Beranda's and Notifikasi's short lines (round 3, the real phone): the greeting's part of the day at night
// (mobile/src/screens/home/greeting.ts), a Perlu kamu urus card's deadline (when.ts), and a notification's meta line
// leading with the new value or the action and its deadline, with the course's name (mobile/src/parts/change-meta.ts).
import { describe, expect, it } from "vitest";
import { changeLines } from "../../mobile/src/parts/change-meta";
import { partOfDay } from "../../mobile/src/screens/home/greeting";
import { shortWhen } from "../../mobile/src/screens/home/when";
import { makeFormat } from "../../src/core/format";
import { translate } from "../../src/core/strings";

const t = ((key, vars) => translate("id", key, vars)) as Parameters<typeof changeLines>[0];

describe("partOfDay", () => {
  it("says night before dawn, never morning (01:34 was 'Pagi')", () => {
    expect(partOfDay(1, "id")).toBe("evening");
    expect(partOfDay(3, "en")).toBe("evening");
  });

  it("keeps the desktop's hours for the rest of the day", () => {
    expect([4, 10, 11, 14, 15, 17, 18, 23].map((hour) => partOfDay(hour, "id"))).toEqual([
      "morning",
      "morning",
      "midday",
      "midday",
      "afternoon",
      "afternoon",
      "evening",
      "evening",
    ]);
    expect([4, 11, 12, 17, 18].map((hour) => partOfDay(hour, "en"))).toEqual(["morning", "morning", "afternoon", "afternoon", "evening"]);
  });
});

describe("shortWhen", () => {
  // Thursday 8 October 2026, 10:00 on the machine's clock.
  const now = new Date(2026, 9, 8, 10, 0).getTime();
  const f = makeFormat("id", now);
  const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).getTime();

  it("names the day only when it isn't today, as short as a card's line holds", () => {
    expect(shortWhen(f, at(8, 23, 59))).toBe("23:59");
    expect(shortWhen(f, at(9, 23, 59))).toBe("besok 23:59");
    expect(shortWhen(f, at(10, 15))).toBe(`${f.weekdayShort(at(10, 15))} 15:00`);
    expect(shortWhen(f, at(20, 8))).toBe(`${f.dayMonth(at(20, 8))} 08:00`);
  });
});

describe("changeLines", () => {
  const name = (code: string) => (code === "PL4099" ? "Proposal Tugas Akhir" : code);

  it("says a moved class as old → new, only what changed, and names the course", () => {
    const moved = (oldId: string, newId: string) =>
      changeLines(
        t,
        { title: { key: "alert.moved", vars: { course: "PL4099" } }, body: { key: "alert.moved.body", vars: { oldId, oldEn: oldId, newId, newEn: newId } } },
        name,
      );
    const time = moved("Jum, 9 Okt, 15:00–23:59 · 9009", "15:00–16:40 · 9009");
    expect(time.title).toBe("Jadwal berubah · Proposal Tugas Akhir");
    expect(time.meta).toBe("15:00–23:59 → 15:00–16:40");
    // The whole of both stays in what TalkBack reads.
    expect(time.spoken[1]).toBe("Jum, 9 Okt, 15:00–23:59 · 9009 → 15:00–16:40 · 9009");
    expect(moved("Kam, 19 Nov, 08:00–09:30 · R.7602", "Jum, 20 Nov, 08:00–09:30 · R.7602").meta).toBe("Kam, 19 Nov → Jum, 20 Nov");
    expect(moved("Kam, 19 Nov, 08:00–09:30 · R.7602", "08:00–09:30 · R.9009").meta).toBe("R.7602 → R.9009");
    expect(moved("Kam, 19 Nov, 08:00–09:30", "Jum, 20 Nov, 10:00–11:30").meta).toBe("Kam, 19 Nov, 08:00–09:30 → Jum, 20 Nov, 10:00–11:30");
  });

  it("says a class off its usual slot as usual → this week's", () => {
    const lines = changeLines(t, {
      title: { key: "home.change.moved", vars: { course: "PL3002" } },
      body: {
        key: "home.change.moved.time",
        vars: { dateId: "Kam, 8 Okt", dateEn: "Thu, 8 Oct", time: "08:00–10:00", usualId: "08:00–09:30", usualEn: "08:00–09:30", room: "" },
      },
    });
    expect(lines.meta).toBe("08:00–09:30 → 08:00–10:00");
  });

  it("names both courses of a clash apart, never as one name", () => {
    const short = (code: string) => (code === "PL3032" ? "Teknik Penyelesaian" : code === "KU5014" ? "Ekonomi Infrastruktur" : code);
    const lines = changeLines(t, { title: { key: "alert.overlap", vars: { a: "PL3032", b: "KU5014" } }, body: null }, short);
    expect(lines.title).toBe("Bentrok · Teknik Penyelesaian × Ekonomi Infrastruktur");
    expect(lines.spoken[0]).toBe("Kelas bentrok · Teknik Penyelesaian dan Ekonomi Infrastruktur");
  });

  it("says Tandai Hadir's action and how long the class runs, never how to press it", () => {
    const lines = changeLines(t, {
      title: { key: "mobile.alert.classStarted", vars: { course: "PL4099" } },
      body: { key: "mobile.alert.classStarted.body", vars: { time: "16:30" } },
    });
    expect(lines.meta).toBe("Tandai Hadir · sampai 16:30");
    expect(lines.meta).not.toContain("Tekan");
  });

  it("leaves anything that isn't a course code as it is", () => {
    const lines = changeLines(t, { title: { key: "alert.moved", vars: { course: "XX0000" } }, body: null }, name);
    expect(lines.title).toBe("Jadwal berubah · XX0000");
  });
});
