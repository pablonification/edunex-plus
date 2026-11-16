// @vitest-environment jsdom
// An answer typed or files attached and not saved yet live only in the window, so "Perbarui
// otomatis" doesn't restart the app under them (src/desktop/main.ts asks handingInNow each
// minute): the window tells main, and main waits until they're saved or thrown away.
import { afterEach, describe, expect, it } from "vitest";
import { handingInNow } from "../../src/desktop/hand-in";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

async function openTask() {
  const s = await openApp({ signedIn: true, world: new PretendWorld() });
  screen = s;
  await s.click(/^Tugas & Ujian\d*(, Perlu perhatianmu)?$/);
  const row = () => [...document.querySelectorAll<HTMLButtonElement>("main li button")].find((b) => b.textContent?.startsWith("Tugas 02 Bab II"));
  if (!row()) await s.click(/^Selesai/);
  await s.click(row()!);
  return s;
}

describe("an answer not saved yet", () => {
  it("holds off a restart for an update until it's saved, the attached file too", async () => {
    const s = await openTask();
    expect(handingInNow()).toBe(false);
    await s.write("<p>Separuh jalan</p>");
    expect(handingInNow()).toBe(true);
    s.willPick([{ name: "Bab II.pdf", content: "%PDF bab dua" }]);
    await s.click(/^Lampirkan berkas · Lepas berkas di sini/);
    await s.click("Simpan draf");
    expect(document.querySelector("main aside")?.textContent).toContain("belum diserahkan");
    expect(handingInNow()).toBe(false);
  });

  it("holds it off until it's thrown away", async () => {
    const s = await openTask();
    await s.write("<p>Coba-coba</p>");
    expect(handingInNow()).toBe(true);
    await s.click("Buang perubahan");
    expect(handingInNow()).toBe(false);
  });
});
