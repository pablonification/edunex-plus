// @vitest-environment jsdom
// Course colors in the window: every course draws a palette color that reads
// in light and dark (never the grey of "unknown" or a status hue), the first
// time this version shows them each keeps the color nearest the one it had,
// and they're remembered, so connecting SIX or a restart never moves them. A
// course the app doesn't know is an outline, never grey. The Student picks a
// course's color where they see it (the sidebar, the course page) or in
// Settings: the screen behind the picker is the preview, it's saved once when
// the picker closes, and Undo or "Kembalikan semua ke otomatis" go back.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { CourseDot } from "../../src/app/ui/display";
import { PRETEND_SIX_COOKIE } from "../pretend/six";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
  document.body.replaceChildren();
});

/** Each sidebar course and the color its dot draws, as "PL3002 indigo". */
const sidebar = () =>
  [...document.querySelectorAll<HTMLButtonElement>("aside li button")].map((button) => {
    const tone = button.querySelector<HTMLElement>('[style*="--course-"]')?.style.background ?? "";
    return `${button.querySelector(".tabular-nums")?.textContent} ${/--course-([a-z-]+)/.exec(tone)?.[1] ?? "none"}`;
  });
const colorWrites = () => screen!.calls.filter((call) => call.name === "local.set" && (call.input as { name: string }).name === "local.courseColors");

describe("each course's color", () => {
  it("comes from the palette; the first time, each keeps the color nearest its old one and the grey and the brown are gone", async () => {
    screen = await openApp({ signedIn: true, six: true });
    // Before: DK4073 sky, II4091 purple, KU5014 brown, PL3002 slate (it looked switched off), PL3032 pink.
    expect(sidebar()).toEqual(["DK4073 blue", "II4091 purple", "KU5014 cyan", "PL3002 indigo", "PL3032 pink"]);
    // Remembered at once, in one write.
    expect(colorWrites()).toHaveLength(1);
    expect(screen.engine.snapshot().datasets.find((d) => d.name === "local.courseColors")?.value).toEqual({
      picks: {},
      automatic: { DK4073: "blue", II4091: "purple", KU5014: "cyan", PL3002: "indigo", PL3032: "pink" },
    });
  });

  it("never moves by itself: not when SIX connects, not after a restart, and nothing more is written", async () => {
    screen = await openApp({ signedIn: true });
    const before = sidebar();
    expect(colorWrites()).toHaveLength(1);
    await screen.engineDoes(() => screen!.engine.signIn("six", { cookie: PRETEND_SIX_COOKIE }));
    expect(screen.engine.snapshot().datasets.some((d) => d.name === "six.courses")).toBe(true);
    expect(sidebar()).toEqual(before);
    const first = screen;
    first.close();
    screen = await openApp({ world: first.world, storage: first.storage, vault: first.vault });
    expect(sidebar()).toEqual(before);
    expect(colorWrites()).toHaveLength(0);
  });

  it("in the rail (zoomed in), each course's code stays under its dot: the color is never the only way to tell them apart", async () => {
    screen = await openApp({ signedIn: true, six: true });
    const code = [...document.querySelectorAll("aside li button span")].find((span) => span.textContent === "PL3002")!;
    expect(code.className).not.toContain("sr-only");
    expect(code.className).toContain("max-[52rem]:text-micro");
  });
});

describe("a course the app doesn't know", () => {
  it("is an outline, never a grey square: grey isn't a course color", () => {
    const container = document.body.appendChild(document.createElement("div"));
    const root = createRoot(container);
    act(() => root.render(<CourseDot color={undefined} />));
    const mark = container.firstElementChild as HTMLElement;
    expect(mark.style.background).toBe("");
    expect(mark.className).toContain("border-faint");
    act(() => root.unmount());
  });
});

// ---------------------------------------------------------------- picking a color

/** The open color picker. */
const picker = () => document.querySelector<HTMLElement>('[role=dialog][aria-label^="Warna "]');
/** A choice in the picker, by the start of its name. */
const choice = (name: string) =>
  [...(picker()?.querySelectorAll<HTMLElement>("[role=radio]") ?? [])].find(
    (r) => r.getAttribute("aria-label")?.startsWith(name) || r.textContent?.startsWith(name),
  );
const checked = () => picker()?.querySelector("[role=radio][aria-checked=true]");
const note = () => picker()?.querySelector("[aria-live=polite]")?.textContent ?? "";
const toasts = () => [...document.querySelectorAll("[role=status]")].map((el) => el.textContent ?? "").join(" | ");
/** The Urungkan buttons of the toasts still showing (a leaving one is inert). */
const toastUndos = () =>
  [...document.querySelectorAll<HTMLButtonElement>("[role=status]:not([inert]) button")].filter((button) => button.textContent === "Urungkan");
const sidebarRow = (code: string) => [...document.querySelectorAll<HTMLButtonElement>("aside li button")].find((b) => b.textContent?.startsWith(code))!;
/** What's saved, as "CODE id" for each pick. */
const savedPicks = () => {
  const value = screen!.engine.snapshot().datasets.find((d) => d.name === "local.courseColors")?.value as
    | { picks: Record<string, { color: string }> }
    | undefined;
  return Object.entries(value?.picks ?? {}).map(([code, pick]) => `${code} ${pick.color}`);
};

/** Pressing a button as the keyboard (or the window, on a click) does: focused first. */
async function press(button: HTMLElement) {
  button.focus();
  await screen!.click(button);
}

/** A right-click on a sidebar course, as the mouse does it. */
async function rightClick(element: HTMLElement) {
  await act(async () => {
    element.focus();
    element.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("picking a course's color in the sidebar", () => {
  it("right-click opens the picker named for the course, on its current choice; moving through it redraws the course everywhere, unsaved", async () => {
    screen = await openApp({ signedIn: true, six: true });
    const s = screen;
    await s.click(/^Jadwal\d*$/);
    const writes = colorWrites().length;
    await rightClick(sidebarRow("PL3002"));
    expect(picker()).not.toBeNull();
    expect(picker()!.textContent).toContain("Warna PL3002");
    expect(picker()!.textContent).toContain("Ekonomi dan Inovasi dalam Perencanaan");
    expect(picker()!.textContent).toContain("Otomatis: Nila");
    // Focus on what's on: automatic.
    expect(document.activeElement).toBe(checked());
    expect(checked()?.textContent).toBe("Otomatis (Nila)");
    // Each swatch says its color and who has it, in whole words.
    expect(choice("Biru muda")?.getAttribute("aria-label")).toBe("Biru muda, dipakai KU5014, yang akan pindah ke Nila");
    // A course moved out of the way takes the first free color: PL3002's own, once PL3002 has another.
    expect(choice("Merah muda")?.getAttribute("aria-label")).toBe("Merah muda, dipakai PL3032, yang akan pindah ke Nila");
    expect(choice("Lavender")?.getAttribute("aria-label")).toBe("Lavender");

    // ↓ to the first color: PL3002 is cyan at once, in the sidebar and in the week; KU5014, which had it, moves.
    await s.key("ArrowDown");
    expect(checked()?.getAttribute("aria-label")).toMatch(/^Biru muda/);
    expect(document.activeElement).toBe(checked());
    expect(sidebar()).toEqual(["DK4073 blue", "II4091 purple", "KU5014 indigo", "PL3002 cyan", "PL3032 pink"]);
    const week = [...document.querySelectorAll<HTMLButtonElement>("main section button")].find((b) => b.getAttribute("aria-label")?.startsWith("PL3002 ·"))!;
    expect(week.querySelector<HTMLElement>('[style*="--course-"]')?.style.background).toBe("var(--course-cyan)");
    expect(picker()!.textContent).toContain("Pilihanmu: Biru muda. Otomatisnya Nila.");
    expect(note()).toBe("KU5014 tadinya otomatis Biru muda, jadi pindah ke Nila.");
    // → twice: blue, then indigo. Moving on puts KU5014 back: everything is worked out from when the picker opened.
    await s.key("ArrowRight");
    await s.key("ArrowRight");
    expect(sidebar()).toEqual(["DK4073 blue", "II4091 purple", "KU5014 cyan", "PL3002 indigo", "PL3032 pink"]);
    expect(note()).toBe("");
    // Nothing saved yet.
    expect(colorWrites().length).toBe(writes);

    // Escape puts everything back, and saves nothing.
    await s.key("Escape");
    expect(picker()).toBeNull();
    expect(sidebar()).toEqual(["DK4073 blue", "II4091 purple", "KU5014 cyan", "PL3002 indigo", "PL3032 pink"]);
    expect(colorWrites().length).toBe(writes);
    expect(document.activeElement).toBe(sidebarRow("PL3002"));
  });

  it("Enter saves once and says so, naming the course that moved; Urungkan puts both back", async () => {
    screen = await openApp({ signedIn: true, six: true });
    const s = screen;
    const writes = colorWrites().length;
    sidebarRow("PL3002").focus();
    // The context-menu key (or Shift+F10) opens it from the keyboard.
    await s.key("ContextMenu");
    expect(picker()).not.toBeNull();
    await s.key("ArrowDown");
    await s.key("Enter");
    expect(picker()).toBeNull();
    expect(colorWrites().length).toBe(writes + 1);
    expect(savedPicks()).toEqual(["PL3002 cyan"]);
    expect(sidebar()).toEqual(["DK4073 blue", "II4091 purple", "KU5014 indigo", "PL3002 cyan", "PL3032 pink"]);
    expect(toasts()).toContain("PL3002 sekarang Biru muda. KU5014 pindah ke Nila.");
    // A restart keeps the pick and the course it moved.
    await s.click("Urungkan");
    expect(savedPicks()).toEqual([]);
    expect(sidebar()).toEqual(["DK4073 blue", "II4091 purple", "KU5014 cyan", "PL3002 indigo", "PL3032 pink"]);
  });

  it("a color picked for two courses is allowed, and said once in neutral words", async () => {
    screen = await openApp({ signedIn: true, six: true });
    const s = screen;
    await rightClick(sidebarRow("PL3002"));
    await s.click(choice("Biru,")!);
    await s.key("Enter");
    // DK4073 had blue automatically: it moved to PL3002's old indigo.
    expect(sidebar()).toEqual(["DK4073 indigo", "II4091 purple", "KU5014 cyan", "PL3002 blue", "PL3032 pink"]);
    await rightClick(sidebarRow("II4091"));
    // Before picking it: the swatch says who has it.
    expect(choice("Biru,")?.getAttribute("aria-label")).toBe("Biru, juga dipilih untuk PL3002");
    await s.click(choice("Biru,")!);
    expect(note()).toBe("PL3002 juga Biru. Pilih warna lain supaya mudah dibedakan.");
    expect(picker()!.querySelector("[class*=warning]")).toBeNull();
    await s.key("Enter");
    expect(savedPicks()).toEqual(["PL3002 blue", "II4091 blue"]);
    expect(sidebar()).toEqual(["DK4073 indigo", "II4091 blue", "KU5014 cyan", "PL3002 blue", "PL3032 pink"]);
  });
});

describe("picking a course's color on its page", () => {
  it("the dot and code above the title, and Lainnya's Ganti warna, open the same picker", async () => {
    screen = await openApp({ signedIn: true, six: true });
    const s = screen;
    await s.click(sidebarRow("DK4073"));
    await press(s.button("Warna DK4073: Biru"));
    expect(picker()?.textContent).toContain("Warna DK4073");
    expect(document.activeElement).toBe(checked());
    await s.key("Escape");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Warna DK4073: Biru");

    await press(s.button("Lainnya"));
    const item = [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].find((el) => el.textContent?.startsWith("Ganti warna"))!;
    expect(item.textContent).toBe("Ganti warnaBiru · otomatis");
    await s.click(item);
    expect(picker()?.textContent).toContain("Warna DK4073");
    expect(document.activeElement).toBe(checked());
    await s.key("End");
    await s.key("Enter");
    expect(savedPicks()).toEqual(["DK4073 berry"]);
    expect(s.has("Warna DK4073: Beri")).toBe(true);
  });
});

describe("course colors in Settings", () => {
  it("the sidebar's palette button opens the list: picks, shared colors, and every course back to automatic with Undo", async () => {
    screen = await openApp({ signedIn: true, six: true });
    const s = screen;
    await s.click("Warna mata kuliah");
    const dialog = () => document.querySelector('[role=dialog][aria-label="Pengaturan"], [role=dialog]')?.textContent ?? "";
    expect(dialog()).toContain("Warna mata kuliah");
    expect(dialog()).toContain("Ekonomi dan Inovasi dalam PerencanaanPL3002 · otomatis");
    expect(dialog()).toContain("Semua mata kuliahSemua otomatis");
    // Opened here, focus is on the first course's color.
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Warna DK4073: Biru");

    // DK4073 picks PL3002's indigo: both rows say they share it.
    await press(s.button("Warna DK4073: Biru"));
    await s.click(choice("Nila")!);
    await s.key("Enter");
    expect(savedPicks()).toEqual(["DK4073 indigo"]);
    expect(dialog()).toContain("Komunikasi PemasaranDK4073 · pilihanmu");
    // PL3002 had indigo automatically: it moved, so the two don't share it.
    expect(dialog()).toContain("PL3002 · otomatis");
    expect(dialog()).toContain("Semua mata kuliah1 pilihanmu");

    await press(s.button("Warna II4091: Ungu"));
    await s.click(choice("Nila")!);
    await s.key("Enter");
    expect(dialog()).toContain("DK4073 · pilihanmu · sama dengan II4091");
    expect(dialog()).toContain("II4091 · pilihanmu · sama dengan DK4073");

    const reset = s.button("Kembalikan semua ke otomatis");
    await press(reset);
    expect(savedPicks()).toEqual([]);
    // One toast: a newer change takes the older one's place, whose Undo would undo this one too.
    expect(toasts()).toContain("2 mata kuliah kembali ke warna otomatis");
    expect(toastUndos()).toHaveLength(1);
    expect(dialog()).toContain("Semua mata kuliahSemua otomatis");
    // Settings keeps focus inside it, out of the toast's reach: the same button, still focused, is Urungkan now.
    expect(document.activeElement).toBe(reset);
    expect(reset.textContent).toBe("Urungkan");
    await press(reset);
    expect(savedPicks()).toEqual(["DK4073 indigo", "II4091 indigo"]);
    // Its toast goes with it, so the one Undo can't run twice.
    expect(toastUndos()).toHaveLength(0);
    expect(document.activeElement).toBe(reset);
    expect(reset.textContent).toBe("Kembalikan semua ke otomatis");
  });

  it("Settings comes back at its top, opened any other way", async () => {
    screen = await openApp({ signedIn: true, six: true });
    const s = screen;
    await s.click("Warna mata kuliah");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Warna DK4073: Biru");
    await s.key("Escape");
    await s.click(/Dimas Pratama/);
    expect(document.querySelector("[role=dialog]")).not.toBeNull();
    expect(document.activeElement?.getAttribute("aria-label") ?? "").not.toMatch(/^Warna /);
  });

  it("Urungkan on the toast over Settings puts the color back and leaves Settings open", async () => {
    screen = await openApp({ signedIn: true, six: true });
    const s = screen;
    await s.click("Warna mata kuliah");
    await press(s.button("Warna DK4073: Biru"));
    await s.click(choice("Nila")!);
    await s.key("Enter");
    expect(savedPicks()).toEqual(["DK4073 indigo"]);
    const [undo] = toastUndos();
    // The press lands outside Settings, as a mouse's does.
    await act(async () => {
      undo.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
    });
    await s.click(undo);
    expect(savedPicks()).toEqual([]);
    expect(document.querySelector("[role=dialog]")?.textContent).toContain("Semua mata kuliah");
  });

  it("signing out of everything says the course colors go too", async () => {
    screen = await openApp({ signedIn: true });
    await screen.click(/Dimas Pratama/);
    const row = [...document.querySelectorAll("[role=dialog] div")].find((el) => el.textContent?.startsWith("Keluar dari semua akun"));
    await screen.click(row!.querySelector("button")!);
    expect(document.querySelector("[role=alertdialog]")?.textContent).toContain("target kehadiran per mata kuliah, warna mata kuliah, pengingat yang ditunda");
  });
});
