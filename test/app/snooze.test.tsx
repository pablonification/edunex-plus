// @vitest-environment jsdom
// "Ingatkan nanti" (Remind me later), seam 2: putting off Beranda's items and a
// course's attendance banner as the Student does, with the real engine and the
// pretend Edunex and SIX behind the bridge, on the Monday of the UTS week.
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

/** "Ingatkan nanti" on the row (or banner) named so, then the choice starting with `choice`. */
async function snooze(name: string, choice: string | RegExp) {
  await screen!.click(`Ingatkan nanti: ${name}`);
  const item = [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].find((el) =>
    typeof choice === "string" ? el.textContent?.startsWith(choice) : choice.test(el.textContent ?? ""),
  );
  if (!item) throw new Error(`No choice ${String(choice)} in ${menuItems().join(" | ")}`);
  await screen!.click(item);
}

describe("putting off what needs you on Beranda", () => {
  it("offers moments that fit, hides the row, says when it's back, and Undo brings it back", async () => {
    const s = await open();
    expect(heading()).toBe("Perlu perhatianmu 6");
    expect(titles()).toContain("UTS Komunikasi PemasaranDK4073 · Kam, 15 Okt, 11:00–12:59 · TVST CSIX dan Edunex beda tanggaldalam 3 hari");

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
    const control = s.button("Ingatkan nanti: UTS Komunikasi Pemasaran");
    expect(control.closest("li")?.querySelector(":scope > button")?.contains(control)).toBe(false);
    expect(control.getAttribute("aria-haspopup")).toBe("menu");
    const next = control.closest("li")?.nextElementSibling?.querySelector("button");
    await snooze("UTS Komunikasi Pemasaran", "Besok pagi");
    await s.wait(50);
    expect(document.activeElement).toBe(next);
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
    await snooze("Ringkasan K6", "Sampai ada perubahan");
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
    expect(list).toEqual([
      "UTS Komunikasi PemasaranKembali Besok, 07:00Ingatkan sekarang",
      "KU5014 tak bisa lagi capai 80%Sampai ada perubahan, paling lambat Sen, 26 Okt, 07:00Ingatkan sekarang",
    ]);
    await s.click("Ingatkan sekarang: UTS Komunikasi Pemasaran");
    expect(titles().some((t) => t.startsWith("UTS Komunikasi Pemasaran"))).toBe(true);
    expect(needs()?.textContent).toContain("1 ditunda");
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
    const text = needs()?.textContent ?? "";
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
    expect(banner()).toContain("80% tak terkejar");
    expect(s.button(/^Ingatkan nanti: KU5014: /).textContent).toBe("Ingatkan nanti");

    await snooze("KU5014: 80% tak terkejar", "Sebelum kuliah berikutnya");
    expect(banner()).toBe("");
    expect(toastText()).toContain("Diingatkan lagi Kam, 15 Okt, 15:00");
    // The header still says where attendance stands.
    expect(document.querySelector("main header")?.textContent).toContain("80% tak terkejar");

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

  it("doesn't count a snooze whose item came back by changing", async () => {
    const s = await open();
    const id = s.world.edunex.postTask(95059, { name: "Ringkasan K6", end_at: "2026-10-14T23:59:00+07:00" });
    await s.engineDoes(() => s.engine.refresh("edunex"));
    await snooze("Ringkasan K6", "Sampai ada perubahan");
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
