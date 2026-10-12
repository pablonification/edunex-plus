// @vitest-environment jsdom
// "Ingatkan nanti" (Remind me later), seam 2: putting off Beranda's items and a
// course's attendance banner as the Student does, with the real engine and the
// pretend Edunex and SIX behind the bridge, on the Monday of the UTS week.
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryStorage } from "../pretend/memory";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

const MONDAY = "2026-10-12T08:07:00+07:00";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const open = async (options: Parameters<typeof openApp>[0] = {}) => {
  screen = await openApp({ world: new PretendWorld({ now: MONDAY }), signedIn: true, six: true, ...options });
  return screen;
};
const needs = () => document.querySelector('main section[aria-labelledby="home-needs"]');
/** Beranda's list of what needs the Student: each row's title. */
const titles = () => [...(needs()?.querySelectorAll('ul[aria-label="Perlu perhatianmu"] li') ?? [])].map((li) => li.querySelector("button")?.textContent ?? "");
const heading = () => document.querySelector('main h2[id="home-needs"]')?.textContent;
const toastText = () => document.querySelector("[aria-live=polite]")?.textContent ?? "";
const menuItems = () => [...document.querySelectorAll("[role=menuitem]")].map((item) => item.textContent ?? "");

/** The next frame: focus handed on once the screen has redrawn is there by then. */
const frame = () => act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
/** Pressing a button as the keyboard (or the window, on a click) does: focused first. */
async function press(button: HTMLElement) {
  button.focus();
  await screen!.click(button);
}

/** "Ingatkan nanti" on the row (or banner) named so, then the choice starting with `choice`. */
async function snooze(name: string, choice: string | RegExp) {
  await press(screen!.button(`Ingatkan nanti: ${name}`));
  const item = [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].find((el) =>
    typeof choice === "string" ? el.textContent?.startsWith(choice) : choice.test(el.textContent ?? ""),
  );
  if (!item) throw new Error(`No choice ${String(choice)} in ${menuItems().join(" | ")}`);
  await press(item);
}

describe("putting off what needs you on Beranda", () => {
  it("offers moments that fit, hides the row, says when it's back, and Undo brings it back", async () => {
    const s = await open();
    expect(heading()).toBe("Perlu perhatianmu 6");
    expect(titles()).toContain("UTS Komunikasi PemasaranDK4073 · Kam, 15 Okt, 11:00–12:59 · TVST CTake-home tenggat Kam 22 Oktdalam 3 hari");

    await s.click("Ingatkan nanti: UTS Komunikasi Pemasaran");
    expect(menuItems()).toEqual([
      expect.stringMatching(/^3 jam lagiHari ini, 11:0\d$/),
      "Besok pagiBesok, 07:00",
      "Sehari sebelumnyaRab, 14 Okt, 07:00",
      "Sampai ada perubahanPaling lambat Rab, 14 Okt, 11:00",
    ]);
    await s.click([...document.querySelectorAll<HTMLElement>("[role=menuitem]")][1]!);

    expect(titles().some((t) => t.startsWith("UTS Komunikasi Pemasaran"))).toBe(false);
    expect(heading()).toBe("Perlu perhatianmu 5");
    expect(needs()?.textContent).toContain("1 ditunda");
    expect(toastText()).toContain("Diingatkan lagi Besok, 07:00");
    expect(s.calls.some((call) => call.name === "local.set" && (call.input as { name: string }).name === "local.snoozes")).toBe(true);
    expect(s.store.dataset("local.snoozes")?.value).toEqual([expect.objectContaining({ id: "exam:DK4073-UTS", reason: "morning" })]);

    await s.click("Urungkan");
    expect(heading()).toBe("Perlu perhatianmu 6");
    expect(titles().some((t) => t.startsWith("UTS Komunikasi Pemasaran"))).toBe(true);
    expect(needs()?.textContent).not.toContain("ditunda");
  });

  it("the row's control sits beside its button, not inside it, and hands focus to the next row", async () => {
    const s = await open();
    const control = s.button("Ingatkan nanti: DK4073: tidak boleh absen lagi");
    expect(control.closest("li")?.querySelector(":scope > button")?.contains(control)).toBe(false);
    expect(control.getAttribute("aria-haspopup")).toBe("menu");
    const next = control.closest("li")?.nextElementSibling?.querySelector("button");
    expect(next).toBeTruthy();
    await snooze("DK4073: tidak boleh absen lagi", "Besok pagi");
    await frame();
    expect(document.activeElement).toBe(next);
  });

  it("Undo pressed from the keyboard gives focus back where it was, not to the page", async () => {
    const s = await open();
    await snooze("UTS Komunikasi Pemasaran", "Besok pagi");
    await frame();
    // The snoozed row handed focus on to the next row; from there the Student goes to the toast's Undo.
    const before = document.activeElement;
    expect(needs()?.contains(before)).toBe(true);
    await press(s.button("Urungkan"));
    await frame();
    expect(titles().some((t) => t.startsWith("UTS Komunikasi Pemasaran"))).toBe(true);
    expect(document.activeElement).toBe(before);
  });

  it("comes back by itself at its time", async () => {
    const s = await open();
    await snooze("UTS Komunikasi Pemasaran", "3 jam lagi");
    expect(heading()).toBe("Perlu perhatianmu 5");
    await s.wait(3 * 3_600_000 + 60_000);
    await s.tick();
    expect(titles().some((t) => t.startsWith("UTS Komunikasi Pemasaran"))).toBe(true);
  });

  it("comes back when its deadline moves", async () => {
    const s = await open();
    const id = s.world.edunex.postTask(95059, { name: "Ringkasan K6", end_at: "2026-10-14T23:59:00+07:00" });
    await s.engineDoes(() => s.engine.refresh("edunex"));
    await snooze("Ringkasan K6 · PL3032", "Sampai ada perubahan");
    expect(toastText()).toContain("Disembunyikan sampai ada perubahan");
    expect(titles().some((t) => t.startsWith("Ringkasan K6"))).toBe(false);

    s.world.edunex.moveDeadline(id, "2026-10-16T23:59:00+07:00");
    await s.engineDoes(() => s.engine.refresh("edunex"));
    expect(titles().some((t) => t.startsWith("Ringkasan K6"))).toBe(true);
  });

  it("comes back when SIX records another meeting", async () => {
    const s = await open();
    await snooze("KU5014 tak bisa lagi capai 80%", "Sampai ada perubahan");
    expect(titles().some((t) => t.startsWith("KU5014"))).toBe(false);
    s.world.six.setAttendance("KU5014", 2, 7);
    await s.engineDoes(() => s.engine.refresh("six"));
    expect(titles().some((t) => t.startsWith("KU5014"))).toBe(true);
  });

  it("the list of what's put off says when each is back, and brings one back now", async () => {
    const s = await open();
    await snooze("UTS Komunikasi Pemasaran", "Besok pagi");
    await snooze("KU5014 tak bisa lagi capai 80%", "Sampai ada perubahan");
    expect(needs()?.textContent).toContain("2 ditunda");
    await s.click("Tampilkan");
    const list = [...document.querySelectorAll('ul[aria-label="Yang ditunda"] li')].map((li) => li.textContent);
    // In Beranda's order: the attendance that's out of reach before an exam three days away.
    expect(list).toEqual([
      "KU5014 tak bisa lagi capai 80%Sampai ada perubahan, paling lambat Sen, 26 Okt, 07:00Ingatkan sekarang",
      "UTS Komunikasi PemasaranKembali Besok, 07:00Ingatkan sekarang",
    ]);
    await press(s.button("Ingatkan sekarang: KU5014 tak bisa lagi capai 80%"));
    expect(titles().some((t) => t.startsWith("KU5014 tak bisa lagi capai 80%"))).toBe(true);
    expect(needs()?.textContent).toContain("1 ditunda");
    // Its row left with the button: focus goes on to the next thing put off…
    await frame();
    expect(document.activeElement).toBe(s.button("Ingatkan sekarang: UTS Komunikasi Pemasaran"));

    // …and with the last one, to the item itself, back in the list.
    await press(s.button("Ingatkan sekarang: UTS Komunikasi Pemasaran"));
    await frame();
    expect(document.activeElement?.closest("li")?.textContent).toMatch(/^UTS Komunikasi Pemasaran/);
    expect(needs()?.contains(document.activeElement)).toBe(true);
  });

  it("a Task is named with its course, so two courses' 'Tugas 02' can be told apart", async () => {
    const s = await open();
    s.world.edunex.postTask(95059, { name: "Tugas 02", end_at: "2026-10-16T23:59:00+07:00" });
    s.world.edunex.postTask(95001, { name: "Tugas 02", end_at: "2026-10-17T23:59:00+07:00" });
    await s.engineDoes(() => s.engine.refresh("edunex"));
    const names = [...document.querySelectorAll('[aria-label^="Ingatkan nanti: Tugas 02"]')].map((el) => el.getAttribute("aria-label")!);
    expect(names).toHaveLength(2);
    expect(names.every((name) => /^Ingatkan nanti: Tugas 02 · [A-Z]{2}\d{4}$/.test(name))).toBe(true);
    expect(new Set(names).size).toBe(2);

    for (const name of names) await snooze(name.replace("Ingatkan nanti: ", ""), "Besok pagi");
    await s.click("Tampilkan");
    const codes = names.map((name) => name.slice(-6));
    const rows = [...document.querySelectorAll('ul[aria-label="Yang ditunda"] li')].map((li) => li.textContent ?? "");
    expect(rows).toEqual(codes.map((code) => `Tugas 02${code} · Kembali Besok, 07:00Ingatkan sekarang`));
    expect(s.has(`Ingatkan sekarang: Tugas 02 · ${codes[0]}`)).toBe(true);
  });

  it("two Presence windows of one course are named with their own class, so they can be told apart, put off too", async () => {
    // Thursday 15 October after class: last Thursday's PL3002 window is still open, and so is today's.
    const world = new PretendWorld({ now: "2026-10-15T10:30:00+07:00" });
    world.edunex.keepPresenceOpen(2194342, "2026-10-16T23:00:00+07:00");
    world.edunex.keepPresenceOpen(2194343, "2026-10-15T23:59:00+07:00");
    const s = await open({ world });
    const title = "Presensi PL3002 dibuka, tidak wajib";
    const names = [...document.querySelectorAll(`[aria-label^="Ingatkan nanti: ${title}"]`)].map((el) => el.getAttribute("aria-label")!);
    expect(names).toEqual([`Ingatkan nanti: ${title} · Hari ini, 08:00–09:30`, `Ingatkan nanti: ${title} · Kam, 8 Okt, 08:00–10:00`]);

    for (const name of names) await snooze(name.replace("Ingatkan nanti: ", ""), /^3 jam lagi/);
    await s.click("Tampilkan");
    const rows = [...document.querySelectorAll('ul[aria-label="Yang ditunda"] li')].map((li) => li.textContent ?? "");
    expect(rows).toEqual([
      `${title}Hari ini, 08:00–09:30 · Kembali Hari ini, 13:30Ingatkan sekarang`,
      `${title}Kam, 8 Okt, 08:00–10:00 · Kembali Hari ini, 13:30Ingatkan sekarang`,
    ]);
    expect(s.has(`Ingatkan sekarang: ${title} · Kam, 8 Okt, 08:00–10:00`)).toBe(true);
  });

  it("the list of what's put off closes once it's empty, so the next snooze doesn't find it open", async () => {
    const s = await open();
    await snooze("UTS Komunikasi Pemasaran", "Besok pagi");
    await s.click("Tampilkan");
    await s.click("Ingatkan sekarang: UTS Komunikasi Pemasaran");
    await snooze("KU5014 tak bisa lagi capai 80%", "Besok pagi");
    expect(document.querySelector('ul[aria-label="Yang ditunda"]')).toBeNull();
    expect(needs()?.querySelector("[data-snoozed]")?.textContent).toBe("Tampilkan");
  });

  it("Undo takes back only its own snooze, not what the Student brought back since", async () => {
    const s = await open();
    await snooze("UTS Komunikasi Pemasaran", "Besok pagi");
    await snooze("KU5014 tak bisa lagi capai 80%", "Besok pagi");
    await s.click("Tampilkan");
    await s.click("Ingatkan sekarang: UTS Komunikasi Pemasaran");
    // The toast still offers to undo putting off KU5014.
    await s.click("Urungkan");
    expect(s.store.dataset("local.snoozes")?.value).toEqual([]);
    expect(titles().some((t) => t.startsWith("UTS Komunikasi Pemasaran"))).toBe(true);
    expect(titles().some((t) => t.startsWith("KU5014"))).toBe(true);
    expect(heading()).toBe("Perlu perhatianmu 6");
  });

  it("with everything put off, says so honestly: not 'nothing due'", async () => {
    await open();
    for (let left = 6; left > 0; left--) {
      const control = needs()?.querySelector<HTMLButtonElement>('[aria-label^="Ingatkan nanti: "]');
      await snooze(control!.getAttribute("aria-label")!.replace("Ingatkan nanti: ", ""), "Besok pagi");
    }
    expect(titles()).toEqual([]);
    // The last row left with nothing beside it: focus goes to the line opening what's put off.
    await frame();
    expect(document.activeElement).toBe(needs()?.querySelector("[data-snoozed]"));
    const text = needs()?.textContent ?? "";
    // Nothing reads as "all clear": no green check while things are only put off.
    expect(needs()?.querySelector(".text-success-fg")).toBeNull();
    expect(text).toContain("Tidak ada lagi yang perlu perhatianmu sekarang");
    expect(text).toContain("6 ditunda");
    expect(text).not.toContain("Bebas tenggat");
    expect(heading()).toBe("Perlu perhatianmu");
  });

  it("is kept on this computer: still put off after a restart, gone after signing out of everything", async () => {
    const storage = new MemoryStorage();
    let s = await open({ storage });
    await snooze("UTS Komunikasi Pemasaran", "Besok pagi");
    s.close();
    screen = null;

    s = await open({ storage });
    expect(heading()).toBe("Perlu perhatianmu 5");
    expect(needs()?.textContent).toContain("1 ditunda");

    await s.engineDoes(() => s.engine.signOut());
    expect(s.store.dataset("local.snoozes")).toBeUndefined();
    await expect(storage.read("datasets/local.snoozes.json")).resolves.toBeNull();
  });

  it("only a valid list is saved", async () => {
    const s = await open();
    await expect(s.engine.setLocal("local.snoozes", [{ id: "", facts: "x", until: 1 }])).rejects.toThrow(/valid local.snoozes/);
    await expect(s.engine.setLocal("local.snoozes", [{ id: "task:1", facts: "x" }])).rejects.toThrow();
  });

  it("speaks English", async () => {
    const s = await open();
    await s.engineDoes(() => s.engine.updateSettings({ lang: "en" }));
    await s.click("Remind me later: Komunikasi Pemasaran UTS");
    expect(menuItems()).toContain("Tomorrow morningTomorrow, 07:00");
    expect(menuItems()).toContain("The day beforeWed, 14 Oct, 07:00");
  });
});

describe("the course page's attendance banner", () => {
  it("puts off the banner and Beranda's item together, keeps the header's count, and comes back with a new count", async () => {
    const s = await open();
    await s.click([...document.querySelectorAll<HTMLButtonElement>("aside button")].find((b) => b.textContent?.startsWith("KU5014"))!);
    const banner = () => document.querySelector("main .bg-danger-bg")?.textContent ?? "";
    const header = () => document.querySelector("main header")?.textContent ?? "";
    expect(banner()).toContain("Tak bisa lagi capai 80%");
    // Said once: the banner has it, so the header only counts.
    expect(header()).not.toContain("Tak bisa lagi capai 80%");
    expect(s.button(/^Ingatkan nanti: KU5014: /).textContent).toBe("Ingatkan nanti");

    await snooze("KU5014: Tak bisa lagi capai 80%", "Sebelum kuliah berikutnya");
    expect(banner()).toBe("");
    expect(toastText()).toContain("Diingatkan lagi Kam, 15 Okt, 15:00");
    // Focus goes on to what follows the banner, not back to the start of the page.
    await frame();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.querySelector("main")?.contains(document.activeElement)).toBe(true);
    // The header still says where attendance stands, in words, not by its color alone.
    expect(header()).toContain("Tak bisa lagi capai 80%");

    await s.click([...document.querySelectorAll<HTMLButtonElement>("aside nav button")].find((b) => b.textContent?.startsWith("Beranda"))!);
    expect(titles().some((t) => t.startsWith("KU5014"))).toBe(false);

    s.world.six.setAttendance("KU5014", 2, 7);
    await s.engineDoes(() => s.engine.refresh("six"));
    expect(titles().some((t) => t.startsWith("KU5014"))).toBe(true);
  });
});

describe("Settings", () => {
  it("counts what's put off and shows it all again", async () => {
    const s = await open();
    expect(s.has(/^Tampilkan semua lagi/)).toBe(false);
    await snooze("UTS Komunikasi Pemasaran", "Besok pagi");
    await snooze("KU5014 tak bisa lagi capai 80%", "Besok pagi");
    await s.apply({ type: "command", command: "settings" });
    const dialog = () => document.querySelector("[role=dialog]")?.textContent ?? "";
    expect(dialog()).toContain("Pengingat yang ditunda (2)");
    expect(dialog()).toContain("Notifikasi tetap muncul.");
    await s.click("Tampilkan semua lagi");
    expect(toastText()).toContain("Semua pengingat tampil lagi");
    await s.key("Escape");
    expect(heading()).toBe("Perlu perhatianmu 6");
  });

  it("counts a course banner put off under the course's own target", async () => {
    // Thursday: DK4073 has class today, so Beranda says its risk in that class's row, not in "Perlu perhatianmu".
    const s = await open({ world: new PretendWorld() });
    // DK4073 keeps 80% as its own target while the default moves to 75%: still no absence to spare.
    await s.engineDoes(() => s.engine.updateSettings({ attendanceTarget: 75, attendanceTargets: { DK4073: 80 } }));
    await s.click([...document.querySelectorAll<HTMLButtonElement>("aside button")].find((b) => b.textContent?.startsWith("DK4073"))!);
    await snooze("DK4073: Jangan absen lagi", "Besok pagi");
    await s.apply({ type: "command", command: "settings" });
    expect(document.querySelector("[role=dialog]")?.textContent).toContain("Pengingat yang ditunda (1)");
  });

  it("doesn't count a snooze whose item came back by changing", async () => {
    const s = await open();
    const id = s.world.edunex.postTask(95059, { name: "Ringkasan K6", end_at: "2026-10-14T23:59:00+07:00" });
    await s.engineDoes(() => s.engine.refresh("edunex"));
    await snooze("Ringkasan K6 · PL3032", "Sampai ada perubahan");
    await snooze("UTS Komunikasi Pemasaran", "Besok pagi");
    s.world.edunex.moveDeadline(id, "2026-10-16T23:59:00+07:00");
    await s.engineDoes(() => s.engine.refresh("edunex"));
    expect(titles().some((t) => t.startsWith("Ringkasan K6"))).toBe(true);
    expect(needs()?.textContent).toContain("1 ditunda");

    await s.apply({ type: "command", command: "settings" });
    const dialog = document.querySelector("[role=dialog]")?.textContent ?? "";
    expect(dialog).toContain("Pengingat yang ditunda (1)");
  });
});
