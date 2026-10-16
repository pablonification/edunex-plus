// @vitest-environment jsdom
// Settings' "Notifikasi di HP" in the window, with the real engine behind the
// bridge and a pretend ntfy behind the engine: connect, the QR code and the
// code to paste, a test, what a failure says, quiet hours, and disconnecting.
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { openApp } from "./harness";

const MINUTE = 60_000;

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const hour = (label: string) => document.querySelector<HTMLSelectElement>(`select[aria-label='${label}']`);
async function choose(label: string, value: string) {
  await act(async () => {
    const select = hour(label)!;
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

const qr = () => document.querySelector("svg[role=img][aria-label='Kode QR untuk Android']");

async function settings() {
  screen = await openApp({ signedIn: true });
  await screen.wait(5 * MINUTE);
  await screen.apply({ type: "command", command: "settings" });
  return screen;
}

describe("phone notifications in Settings", () => {
  it("is off until the Student connects, then shows the QR code, the code for iPhone, the steps and the privacy line", async () => {
    const s = await settings();
    expect(s.text()).toContain("Notifikasi di HP");
    expect(s.text()).toContain("Orang lain tidak bisa membacanya tanpa kode ini, tapi pengelola ntfy bisa.");
    expect(qr()).toBeNull();
    expect(s.ntfy.log).toEqual([]);

    await s.click("Hubungkan HP");
    const link = s.engine.phone.link();
    if (!link.connected) throw new Error("not linked");
    expect(link.link).toBe(`ntfy://ntfy.sh/${link.topic}?display=Edunex%20Plus`);
    // Drawn from the code's modules, as SVG elements.
    expect(qr()?.querySelector("path")?.getAttribute("d")).toMatch(/^M\d+ \d+h1v1h-1z/);
    expect(s.text()).toContain(link.topic);
    expect(s.text()).toContain("iPhone: di ntfy, ketuk +, lalu tempel kode di bawah.");

    await s.click("Salin kode");
    expect(s.copied).toEqual([link.topic]);
  });

  it("sends a test, says when it couldn't, and disconnects", async () => {
    const s = await settings();
    await s.click("Hubungkan HP");
    await s.click("Kirim tes");
    expect(s.ntfy.sent.at(-1)).toMatchObject({ title: "Edunex Plus terhubung" });
    expect(s.text()).toContain("Terkirim. Tidak sampai?");

    s.ntfy.answer = "busy";
    await s.click("Kirim tes");
    expect(s.text()).toContain("Belum terkirim ke HP: ntfy sedang sibuk. Dicoba lagi nanti.");
    expect(s.text()).not.toContain("Terkirim. Tidak sampai?");
    s.ntfy.answer = "offline";
    await s.click("Kirim tes");
    expect(s.text()).toContain("Belum terkirim ke HP: tidak ada koneksi.");

    s.ntfy.answer = "ok";
    await s.click("Putuskan");
    expect(qr()).toBeNull();
    expect(s.has("Hubungkan HP")).toBe(true);
    expect(s.engine.phone.link()).toEqual({ connected: false });
  });

  it("holds alerts that can wait during quiet hours, 22:00 to 06:00 until the Student changes them or turns them off", async () => {
    const s = await settings();
    expect(s.has("Jam tenang")).toBe(false);
    await s.click("Hubungkan HP");
    expect(s.text()).toContain("Notifikasi yang tidak mendesak ditahan sampai jam tenang selesai. Presensi dan tenggat dekat tetap masuk.");
    expect(s.button("Jam tenang").getAttribute("aria-checked")).toBe("true");
    expect(hour("Jam tenang mulai")?.selectedOptions[0].textContent).toBe("22:00");
    expect(hour("Jam tenang selesai")?.selectedOptions[0].textContent).toBe("06:00");
    // An end can't be its own start.
    expect([...hour("Jam tenang selesai")!.options].map((option) => option.textContent)).not.toContain("22:00");

    await choose("Jam tenang mulai", "23");
    await choose("Jam tenang selesai", "7");
    expect(s.engine.snapshot().settings.phoneQuietHours).toEqual({ start: 23, end: 7 });
    expect(hour("Jam tenang mulai")?.value).toBe("23");

    await s.click("Jam tenang");
    expect(s.engine.snapshot().settings.phoneQuietHours).toBeNull();
    expect(hour("Jam tenang mulai")).toBeNull();
    await s.click("Jam tenang");
    expect(s.engine.snapshot().settings.phoneQuietHours).toEqual({ start: 22, end: 6 });
  });
});
