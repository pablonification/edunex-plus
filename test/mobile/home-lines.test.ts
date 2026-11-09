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

  it("leads a moved class with its new time, and names the course", () => {
    const lines = changeLines(
      t,
      {
        title: { key: "alert.moved", vars: { course: "PL4099" } },
        body: { key: "alert.moved.body", vars: { oldId: "Jum, 9 Okt 15:00–23:59", oldEn: "", newId: "Jum, 9 Okt 15:00–16:40 · 9009", newEn: "" } },
      },
      name,
    );
    expect(lines.title).toBe("Jadwal berubah · Proposal Tugas Akhir");
    expect(lines.meta).toBe("Jum, 9 Okt 15:00–16:40 · 9009");
    // The old time stays in what TalkBack reads.
    expect(lines.spoken[1]).toContain("15:00–23:59 →");
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
