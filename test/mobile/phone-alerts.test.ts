// Two alerts as Android shows them on the phone, in the phone's own words (phoneWording, which
// Metro's wording.native.ts gives translate()): the reminder at the start of a class SIX counts,
// booked ahead, and a new Task with its deadline. The desktop's words: test/engine/class-start.test.ts.
import { describe, expect, it, vi } from "vitest";
import { CHANNELS, CHECK_IN_CATEGORY, noticeContent } from "../../mobile/src/host/booking";
import type { Task } from "../../src/core/models";
import type { PlannedAlert } from "../../src/engine/alerts/detector";
import { newTaskAlert } from "../../src/engine/alerts/tasks";

vi.mock("../../src/core/strings/wording", async () => ({ wording: (await import("../../src/core/strings/wording.native")).wording }));

const wib = (iso: string) => Date.parse(`${iso}+07:00`);
const TIMETABLE = "https://six.itb.ac.id/app/mahasiswa:18223901+2026-1/kelas/jadwal/mahasiswa/2021000001?bulan=202610";

describe("on the phone", () => {
  it("the class-start reminder: on the Presence channel, a tap opening SIX on the class, with the footnote of a booked one", () => {
    const reminder: PlannedAlert = {
      id: `six.classStart:2194342:${wib("2026-10-08T08:00:00")}`,
      kind: "presenceOpen",
      source: "six",
      urgent: true,
      at: wib("2026-10-08T08:00:00"),
      until: wib("2026-10-08T10:00:00"),
      title: { key: "mobile.alert.classStarted", vars: { course: "PL3002" } },
      body: { key: "mobile.alert.classStarted.body", vars: { time: "10:00" } },
      target: { screen: "home" },
      checkIn: { meetingId: "2194342", url: TIMETABLE },
    };
    expect(noticeContent(reminder, "id", true)).toEqual({
      title: "Kuliah sudah mulai · PL3002",
      body: "Tekan Tandai Hadir di SIX saat tombolnya muncul · kuliah sampai 10:00\nAbaikan kalau sudah tercatat hadir.",
      data: { target: { screen: "home" }, checkIn: { meetingId: "2194342", url: TIMETABLE } },
      channelId: CHANNELS.urgent,
      // Android's own "Tandai Hadir" button on it, opening SIX's page in the app.
      categoryId: CHECK_IN_CATEGORY,
    });
    expect(noticeContent(reminder, "en", true)).toMatchObject({
      title: "Class has started · PL3002",
      body: "Press Tandai Hadir in SIX when it shows · class until 10:00\nIgnore this if you're already marked present.",
    });
  });

  it("a new Task says its deadline", () => {
    const task = { id: 117003, courseCode: "PL3002", title: "Kuis Kilat Bab 5", opensAt: null, dueAt: wib("2026-10-16T23:59:00") } as Task;
    const alert = newTaskAlert(task, wib("2026-10-08T08:00:00"));
    expect(noticeContent(alert, "id")).toMatchObject({
      title: "Tugas baru · PL3002",
      body: "Kuis Kilat Bab 5 · tenggat Jum, 16 Okt 23:59",
      channelId: CHANNELS.normal,
    });
    expect(noticeContent(alert, "en")).toMatchObject({
      title: "New Task · PL3002",
      body: "Kuis Kilat Bab 5 · due Fri, 16 Oct 23:59",
    });
    // Without a deadline: the title alone.
    expect(noticeContent(newTaskAlert({ ...task, dueAt: null }, wib("2026-10-08T08:00:00")), "id").body).toBe("Kuis Kilat Bab 5");
  });
});
