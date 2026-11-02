// The tray (menu bar) menu (src/desktop/tray-menu.ts): what the Student needs
// to know now without opening the window, built from the real engine's
// snapshot against the pretend Edunex and SIX, at the fake clock's moment. On
// the recorded Thursday 8 October: PL3002 08:00–10:00 (SIX meeting 2194342,
// counted in SIX), DK4073 at 11:00, II4091's online meeting on Friday 15:00.
import { describe, expect, it } from "vitest";
import { putAway, taskDoneKey } from "../../src/core/done";
import { snapshotHomeWorld } from "../../src/core/home-world";
import type { SnoozeEntry, SourceStatus } from "../../src/core/models";
import { attentionWithToday, nowCard } from "../../src/core/needs";
import { snoozeKey } from "../../src/core/snooze";
import { cut, NEEDS_SHOWN, type TrayEntry, type TrayMenu, trayMenu } from "../../src/desktop/tray-menu";
import { startEngine } from "../engine/harness";
import { startHome } from "../engine/needs-harness";
import { PRETEND_TOKEN } from "../pretend/edunex";
import { PretendWorld } from "../pretend/world";

const MINUTE = 60_000;

type Home = Awaited<ReturnType<typeof startHome>>;
const menuOf = (h: Pick<Home, "engine" | "world">): TrayMenu => trayMenu(h.engine.snapshot(), h.world.clock.now());

/** The menu as the Student reads it: a line per entry, "~" before a line that can't be clicked, "[…]" around a section's label, "▸" after one that opens more, "//" before a line's detail. */
function read(menu: TrayMenu): string[] {
  return menu.entries.map((entry) =>
    entry.type === "separator"
      ? "---"
      : entry.type === "header"
        ? `[${entry.label}]`
        : entry.type === "submenu"
          ? `${entry.label} ▸ ${entry.entries.map((inner) => (inner.type === "item" ? inner.label : "")).join(" | ")}`
          : `${entry.action ? "" : "~ "}${entry.label}${entry.detail ? ` // ${entry.detail}` : ""}`,
  );
}

/** Every line, those in a submenu too. */
function lines(entries: readonly TrayEntry[]): TrayEntry[] {
  return entries.flatMap((entry) => (entry.type === "submenu" ? lines(entry.entries) : [entry]));
}

/** The line that says `label`, to click. */
function line(menu: TrayMenu, label: string | RegExp): Extract<TrayEntry, { type: "item" }> {
  const found = lines(menu.entries).find(
    (entry): entry is Extract<TrayEntry, { type: "item" }> =>
      entry.type === "item" && (typeof label === "string" ? entry.label === label : label.test(entry.label)),
  );
  if (!found) throw new Error(`No line ${label} in:\n${read(menu).join("\n")}`);
  return found;
}

/** The lines of a section, between its label and the next separator. */
function section(menu: TrayMenu, header: string): string[] {
  const lines = read(menu);
  const at = lines.indexOf(`[${header}]`);
  if (at < 0) return [];
  const end = lines.indexOf("---", at);
  return lines.slice(at + 1, end < 0 ? undefined : end);
}

/** The snapshot with the sources in other states, for the states the pretend world has no switch for. */
function withStatuses(menu: Home, statuses: Partial<Record<"edunex" | "six", Partial<SourceStatus>>>): TrayMenu {
  const snapshot = menu.engine.snapshot();
  return trayMenu(
    { ...snapshot, statuses: snapshot.statuses.map((status) => ({ ...status, ...statuses[status.source as "edunex" | "six"] })) },
    menu.world.clock.now(),
  );
}

describe("the status line", () => {
  it("all well: no line about it, only when the data was last read, under Perbarui sekarang, as a time that doesn't go stale while the menu is open", async () => {
    const h = await startHome();
    const menu = menuOf(h);
    expect(read(menu)[0]).toBe("[Sedang berlangsung]");
    expect(line(menu, "Perbarui sekarang").detail).toMatch(/^Diperbarui pukul \d\d:\d\d$/);
    // Read on another day: that day too.
    const yesterday = withStatuses(h, {
      edunex: { updatedAt: Date.parse("2026-10-07T14:05:00+07:00") },
      six: { updatedAt: Date.parse("2026-10-07T14:05:00+07:00") },
    });
    expect(line(yesterday, "Perbarui sekarang").detail).toBe("Diperbarui kemarin, 14:05");
    expect(line(withStatuses(h, { six: { state: "connecting" } }), "Perbarui sekarang").detail).toBe("Memperbarui…");
  });

  it("a session that ended says so, and opens the window, where the banner signs in again", async () => {
    const h = await startHome();
    h.world.six.expireSession();
    await h.refresh();
    expect(h.status("six").state).toBe("expired");
    expect(line(menuOf(h), "Sesi SIX berakhir · Masuk lagi").action).toEqual({ kind: "window" });
    // Signed out of one, its data still kept: sign in to it.
    expect(line(withStatuses(h, { six: { state: "signed-out" } }), "Masuk ke SIX").action).toEqual({ kind: "window" });
    expect(line(withStatuses(h, { edunex: { state: "changed" } }), "Edunex berubah").action).toEqual({ kind: "window" });
  });

  it("SIX waiting for the Student to do something on SIX first says so, and opens the window, where the banner says what", async () => {
    const h = await startHome();
    h.world.six.requireDataInduk();
    await h.refresh();
    expect(h.status("six").state).toBe("action-needed");
    expect(line(menuOf(h), "SIX menunggumu").action).toEqual({ kind: "window" });
  });

  it("no connection: since when the data is, and a click opens the window", async () => {
    const h = await startHome();
    const readAt = Math.max(...h.engine.snapshot().statuses.map((s) => s.updatedAt ?? 0));
    h.world.setOffline(true);
    await h.refresh();
    const time = new Date(readAt).toTimeString().slice(0, 5);
    expect(line(menuOf(h), `Tidak terhubung · data dari ${time}`).action).toEqual({ kind: "window" });
    // Only one of the two: which.
    expect(read(withStatuses(h, { edunex: { state: "live" } }))[0]).toBe("SIX tidak terhubung");
  });

  it("never signed in: where to start, nothing else to know, and nothing to refresh", async () => {
    const h = await startEngine();
    const menu = menuOf(h);
    expect(read(menu)).toEqual([
      "Hubungkan Edunex atau SIX dulu",
      "---",
      "Buka Edunex Plus",
      "~ Perbarui sekarang",
      "Buka di browser ▸ Edunex | SIX",
      "Pengaturan…",
      "---",
      "Keluar dari Edunex Plus",
    ]);
    expect(line(menu, "Hubungkan Edunex atau SIX dulu").action).toEqual({ kind: "window" });
    expect(menu.tooltip).toBe("Edunex Plus");
  });
});

describe("the class", () => {
  it("on now: its code and name, the time and room under it, opening the course's meetings", async () => {
    const h = await startHome();
    const menu = menuOf(h);
    expect(section(menu, "Sedang berlangsung")).toEqual(["PL3002 Ekonomi dan Inovasi dalam… // 08:00–10:00 · R.SG PWK LT.6"]);
    expect(line(menu, /^PL3002/).action).toEqual({ kind: "route", route: { screen: "course", code: "PL3002", tab: "meetings" } });
    // SIX counts PL3002: Edunex's window is optional, so the menu doesn't ask for it.
    expect(read(menu).some((label) => label.includes("Presensi PL3002"))).toBe(false);
  });

  it("between classes the next one today, and in the evening tomorrow's, the meeting only Edunex announced included", async () => {
    const h = await startHome();
    await h.until("2026-10-08T10:30:00+07:00");
    expect(section(menuOf(h), "Kuliah berikutnya · Hari ini")).toEqual(["DK4073 Komunikasi Pemasaran // 11:00–12:59 · TVST C"]);
    await h.until("2026-10-08T18:00:00+07:00");
    const evening = menuOf(h);
    expect(section(evening, "Kuliah berikutnya · Besok")).toEqual(["II4091 Proposal Tugas Akhir // 15:00–17:00 · Pertemuan 3 · daring"]);
    // The card has it: "Perlu perhatianmu" doesn't say it again.
    expect(section(evening, "Perlu perhatianmu").some((label) => label.startsWith("Pertemuan daring II4091"))).toBe(false);
  });

  it("a class SIX shows that the app couldn't read, up to the next one: said under it, opening Jadwal", async () => {
    const world = new PretendWorld();
    // DK4073's 11:00 class, its time written with dots.
    world.six.moveMeeting("2153983", "11.00", "12.59");
    const h = await startHome({ world });
    await h.until("2026-10-08T10:30:00+07:00");
    const menu = menuOf(h);
    expect(section(menu, "Kuliah berikutnya · Hari ini").at(-1)).toBe("Ada kuliah yang belum terbaca · Hari ini // Jam dan ruangnya ada di SIX.");
    expect(line(menu, /^Ada kuliah yang belum terbaca/).action).toEqual({
      kind: "url",
      url: "https://six.itb.ac.id/app/mahasiswa:18223901+2026-1/kelas/jadwal/mahasiswa/2021000001?bulan=202610",
    });
  });

  it("Tandai Hadir open in SIX: a line to press it, opening SIX on the class as the app's own button does", async () => {
    const h = await startHome();
    expect(read(menuOf(h)).some((label) => label.includes("Tandai Hadir"))).toBe(false);
    h.world.six.openCheckIn("2194342");
    await h.until("2026-10-08T08:40:00+07:00");
    const menu = menuOf(h);
    expect(section(menu, "Sedang berlangsung")).toEqual([
      "PL3002 Ekonomi dan Inovasi dalam… // 08:00–10:00 · R.SG PWK LT.6",
      "Tekan Tandai Hadir di SIX // PL3002",
    ]);
    expect(line(menu, "Tekan Tandai Hadir di SIX").action).toEqual({ kind: "checkIn", meetingId: "2194342" });
    // Pressed, or closed: the line goes once SIX stops showing it.
    h.world.six.closeCheckIn("2194342");
    await h.until("2026-10-08T08:50:00+07:00");
    expect(read(menuOf(h)).some((label) => label.includes("Tandai Hadir"))).toBe(false);
  });

  it("a Presence that counts for the class on now: its line, opening the Task it's handed in with", async () => {
    // II4091 from 15:00, recorded by handing in Tugas 02 Bab II (117003) in the window open until 23:59.
    const h = await startHome({ now: "2026-10-16T15:01:00" });
    const menu = menuOf(h);
    const presence = line(menu, /^Isi Presensi II4091/);
    expect([presence.label, presence.detail]).toEqual(["Isi Presensi II4091", "Tutup 23:59"]);
    expect(presence.action).toEqual({ kind: "route", route: { screen: "task", taskId: 117003 } });
    // Under its class, as SIX lists it (no room for an online class).
    expect(section(menu, "Sedang berlangsung")).toEqual(["II4091 Proposal Tugas Akhir // 15:00–23:00", "Isi Presensi II4091 // Tutup 23:59"]);
  });
});

describe("Perlu perhatianmu", () => {
  /** Tasks due tonight, in three days and in five, as Edunex posts them. */
  async function withTasks(h: Home) {
    const tonight = h.world.edunex.postTask(95059, { name: "Ringkasan K5", end_at: "2026-10-08T23:59:00+07:00" });
    const sunday = h.world.edunex.postTask(95001, { name: "Proposal", end_at: "2026-10-11T23:59:00+07:00" });
    const tuesday = h.world.edunex.postTask(95001, { name: "Laporan Akhir", end_at: "2026-10-13T23:59:00+07:00" });
    await h.refresh();
    return { tonight, sunday, tuesday };
  }

  it("Beranda's list with tonight's deadline in it (the menu has no Hari ini), each with its time and day, ranked as Beranda ranks", async () => {
    const h = await startHome();
    const { tonight, sunday, tuesday } = await withTasks(h);
    const menu = menuOf(h);
    // Due within a day first, then within three, then the rest of the week, as on Beranda.
    expect(section(menu, "Perlu perhatianmu")).toEqual([
      "Ringkasan K5 // PL3032 · Tenggat Hari ini, 23:59",
      "Pertemuan daring II4091 // Besok, 15:00–17:00",
      "Kehadiran KU5014 // Tak bisa lagi capai 80%",
      "Lihat semua 6 di Beranda",
    ]);
    expect(line(menu, /^Ringkasan K5/).action).toEqual({ kind: "route", route: { screen: "task", taskId: tonight } });
    // The lecturer's meeting link: any web page, as the window opens it (not only official ones).
    expect(line(menu, /^Pertemuan daring II4091/).action).toMatchObject({ kind: "link", url: expect.stringMatching(/^https:\/\/teams\.microsoft\.com\//) });
    // The rest are on Beranda.
    expect(line(menu, "Lihat semua 6 di Beranda").action).toEqual({ kind: "route", route: { screen: "home" } });
    expect(NEEDS_SHOWN).toBe(3);
    expect(menu.tooltip).toBe("Edunex Plus · 6 perlu perhatianmu");
    // What's past "Lihat semua" is still Beranda's: the UTS, then Sunday's and Tuesday's Tasks.
    const context = snapshotHomeWorld(h.engine.snapshot(), h.world.clock.now())!;
    expect(
      attentionWithToday(context, nowCard(context))
        .map((need) => need.id)
        .slice(NEEDS_SHOWN),
    ).toEqual([expect.stringMatching(/^exam:/), `task:${sunday}`, `task:${tuesday}`]);
  });

  it("leaves out what the Student put off or marked handled, as Beranda does", async () => {
    const h = await startHome();
    const { tonight, sunday } = await withTasks(h);
    const now = h.world.clock.now();
    const context = snapshotHomeWorld(h.engine.snapshot(), now)!;
    const needs = attentionWithToday(context, nowCard(context));
    const snoozed: SnoozeEntry = { ...snoozeKey(needs.find((need) => need.id === `task:${tonight}`)!), until: now + 6 * 60 * MINUTE };
    await h.engine.setLocal("local.snoozes", [snoozed]);
    const task = h.engine.snapshot().datasets.find((d) => d.name === "edunex.tasks")!.value as { id: number }[];
    const proposal = task.find((t) => t.id === sunday) as Parameters<typeof taskDoneKey>[0];
    await h.engine.setLocal("local.done", putAway([], taskDoneKey(proposal, "due"), "handedElsewhere", now));
    const menu = menuOf(h);
    expect(section(menu, "Perlu perhatianmu")).toEqual([
      "Pertemuan daring II4091 // Besok, 15:00–17:00",
      "Kehadiran KU5014 // Tak bisa lagi capai 80%",
      "UTS DK4073 // Kam, 15 Okt, 11:00",
      "Lihat semua 4 di Beranda",
    ]);
    // Snoozed until 14:12: back in the menu after that.
    await h.until("2026-10-08T15:00:00+07:00");
    expect(section(menuOf(h), "Perlu perhatianmu")).toContain("Ringkasan K5 // PL3032 · Tenggat Hari ini, 23:59");
  });

  it("looks as far ahead as Beranda: the range in Settings", async () => {
    const h = await startHome();
    await withTasks(h);
    expect(menuOf(h).tooltip).toBe("Edunex Plus · 6 perlu perhatianmu");
    // Three days: Sunday's Task is in, Tuesday's Task and Thursday's UTS aren't.
    await h.engine.updateSettings({ needsAhead: 3 });
    const three = menuOf(h);
    expect(section(three, "Perlu perhatianmu").at(-1)).toBe("Lihat semua 4 di Beranda");
    expect(three.tooltip).toBe("Edunex Plus · 4 perlu perhatianmu");
  });

  it("nothing due in the range: Beranda's words, and how far it looked", async () => {
    // Signed in to Edunex alone, the week before the term's Tasks: no class, no deadline, no count.
    const h = await startEngine({ now: "2026-08-03T09:00:00+07:00" });
    await h.engine.signIn("edunex", { token: PRETEND_TOKEN });
    await h.wait();
    const menu = menuOf(h);
    expect(section(menu, "Perlu perhatianmu")).toEqual(["Bebas tenggat 7 hari ke depan"]);
    expect(line(menu, "Bebas tenggat 7 hari ke depan").action).toEqual({ kind: "route", route: { screen: "home" } });
    await h.engine.updateSettings({ lang: "en" });
    expect(section(menuOf(h), "Needs you")).toEqual(["Nothing due in the next 7 days"]);
  });

  it("everything left only put off: never 'nothing due'", async () => {
    const h = await startHome();
    const now = h.world.clock.now();
    const context = snapshotHomeWorld(h.engine.snapshot(), now)!;
    const until = now + 3 * 60 * MINUTE;
    const all = attentionWithToday(context, nowCard(context)).map((need): SnoozeEntry => ({ ...snoozeKey(need), until }));
    await h.engine.setLocal("local.snoozes", all);
    expect(section(menuOf(h), "Perlu perhatianmu")).toEqual(["Tidak ada lagi yang perlu perhatianmu sekarang"]);
    expect(menuOf(h).tooltip).toBe("Edunex Plus");
  });

  it("a long title is cut short with an ellipsis, so the menu stays narrow; its time is kept whole", async () => {
    const h = await startHome();
    h.world.edunex.postTask(95059, {
      name: "Analisis Kebijakan Perencanaan Wilayah dan Kota Berkelanjutan di Kawasan Metropolitan Bandung Raya",
      end_at: "2026-10-08T23:59:00+07:00",
    });
    await h.refresh();
    const entry = line(menuOf(h), /^Analisis/);
    expect([entry.label, entry.detail]).toEqual(["Analisis Kebijakan Perencanaan…", "PL3032 · Tenggat Hari ini, 23:59"]);
    expect(entry.label.length).toBeLessThanOrEqual(36);
    expect(cut("Ekonomi dan Inovasi dalam Perencanaan", 20)).toBe("Ekonomi dan Inovasi…");
    expect(cut("Tugas-Besar-Tanpa-Spasi-Sama-Sekali", 12)).toBe("Tugas-Besar…");
  });
});

describe("new notifications", () => {
  it("how many arrived since the bell was opened, opening the bell; gone once it's opened", async () => {
    const h = await startHome();
    h.world.edunex.postTask(95059, { name: "Ringkasan K6", end_at: "2026-10-12T23:59:00+07:00" });
    await h.refresh();
    const menu = menuOf(h);
    const alerts = line(menu, /notifikasi baru$/);
    expect(alerts.label).toMatch(/^\d+ notifikasi baru$/);
    expect(alerts.action).toEqual({ kind: "command", command: "alerts" });
    await h.engine.markAlertsRead();
    expect(read(menuOf(h)).some((label) => label.endsWith("notifikasi baru"))).toBe(false);
  });
});

describe("the actions", () => {
  it("open, refresh, Edunex and SIX in the browser, Settings, and quit last, each doing what it says", async () => {
    const h = await startHome();
    const menu = menuOf(h);
    expect(read(menu).slice(-7)).toEqual([
      "---",
      "Buka Edunex Plus",
      expect.stringMatching(/^Perbarui sekarang \/\/ Diperbarui pukul \d\d:\d\d$/),
      "Buka di browser ▸ Edunex | SIX",
      "Pengaturan…",
      "---",
      "Keluar dari Edunex Plus",
    ]);
    expect(line(menu, "Buka Edunex Plus").action).toEqual({ kind: "window" });
    expect(line(menu, "Perbarui sekarang").action).toEqual({ kind: "refresh" });
    expect(line(menu, "Edunex").action).toEqual({ kind: "url", url: "https://edunex.itb.ac.id" });
    expect(line(menu, "SIX").action).toEqual({ kind: "url", url: "https://six.itb.ac.id" });
    expect(line(menu, "Pengaturan…").action).toEqual({ kind: "command", command: "settings" });
    expect(line(menu, "Keluar dari Edunex Plus").action).toEqual({ kind: "quit" });
  });

  it("in English, the whole menu", async () => {
    const h = await startHome();
    h.world.edunex.postTask(95059, { name: "Ringkasan K5", end_at: "2026-10-08T23:59:00+07:00" });
    await h.refresh();
    await h.engine.markAlertsRead();
    await h.engine.updateSettings({ lang: "en" });
    const menu = menuOf(h);
    expect(read(menu)).toEqual([
      "[On now]",
      "PL3002 Ekonomi dan Inovasi dalam… // 08:00–10:00 · R.SG PWK LT.6",
      "---",
      "[Needs you]",
      "Ringkasan K5 // PL3032 · Due Today, 23:59",
      "II4091 online meeting // Tomorrow, 15:00–17:00",
      "KU5014 attendance // Can't reach 80% anymore",
      "See all 4 on Home",
      "---",
      "Open Edunex Plus",
      expect.stringMatching(/^Refresh now \/\/ Updated at \d\d:\d\d$/),
      "Open in browser ▸ Edunex | SIX",
      "Settings…",
      "---",
      "Quit Edunex Plus",
    ]);
    expect(menu.tooltip).toBe("Edunex Plus · 4 need you");
  });
});

describe("Beranda and the menu agree", () => {
  it("the menu's list is Beranda's world, from the same snapshot", async () => {
    const h = await startHome({ world: new PretendWorld() });
    const context = snapshotHomeWorld(h.engine.snapshot(), h.world.clock.now())!;
    // The harness builds Beranda's world as the window does; the core builder agrees on what reasoning needs.
    const home = h.home();
    expect(context.courses.map((course) => course.code)).toEqual(home.courses.map((course) => course.code));
    expect(context.tasks).toEqual(home.tasks);
    expect(context.schedule).toEqual(home.schedule);
  });
});
