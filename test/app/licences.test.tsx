// @vitest-environment jsdom
// Seam 2: Settings → Tentang says what the app is (version, its own licence,
// that it isn't ITB's or Cognisia's) and opens the list of the open-source
// software it's built with. The list (licences.json, next to the window) is read
// only when the Student opens it; a search narrows it, a row opens its licence
// text, and a source opens in the browser through main's link rule.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Licence } from "../../src/app/licences";
import { openApp } from "./harness";
// The page loads on first use; here it's loaded already, so opening it settles at once.
import "../../src/app/shell/licences";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;

/** What the window's file holds: made-up texts, in the shape the build writes. */
const LIST: Licence[] = [
  {
    name: "@radix-ui/react-dialog",
    version: "1.2.0",
    licence: "MIT",
    source: "https://github.com/radix-ui/primitives/tree/HEAD/packages/react/dialog",
    text: "MIT License\n\nCopyright (c) Example Dialog Authors",
  },
  { name: "Chromium", version: null, licence: "BSD-3-Clause", source: "https://www.chromium.org/", file: "LICENSES.chromium.html" },
  { name: "Liberation Sans", version: null, licence: "GPL-2.0 with font exception", source: "https://github.com/mozilla/pdf.js", text: "Font licence text" },
  { name: "pdfjs-dist", version: "6.4.299", licence: "Apache-2.0", source: "git://example.com/pdf.js.git", text: "Apache License\nVersion 2.0" },
  { name: "zod", version: "4.6.5", licence: "MIT", source: "https://github.com/colinhacks/zod", text: "MIT License\n\nCopyright (c) Example Zod Authors" },
];

/** What the window's request for licences.json gets: the list, or a missing file. */
let file: "list" | "missing" = "list";
const reads: string[] = [];
beforeEach(() => {
  file = "list";
  reads.length = 0;
  vi.stubGlobal("fetch", async (url: URL | string) => {
    reads.push(String(url));
    return file === "list" ? new Response(JSON.stringify(LIST), { headers: { "content-type": "application/json" } }) : new Response("", { status: 404 });
  });
});
afterEach(() => {
  screen?.close();
  screen = null;
  vi.unstubAllGlobals();
});

const dialog = () => document.querySelector<HTMLElement>("[role=dialog]");
const title = () => dialog()?.querySelector("h2")?.textContent;
const search = () => dialog()?.querySelector<HTMLInputElement>("input");
/** The list's rows, by what their button says to a screen reader ("zod · 4.6.5 · MIT"). */
const rows = () => [...(dialog()?.querySelectorAll("ul > li") ?? [])].map((li) => li.querySelector("button")?.getAttribute("aria-label") ?? "");
const row = (name: string) =>
  [...(dialog()?.querySelectorAll<HTMLButtonElement>("ul > li > div > button") ?? [])].find((b) => b.getAttribute("aria-label")?.startsWith(`${name} ·`));

/** Waits until the window shows what `check` looks for (the list arrives after its file is read). */
async function until(check: () => boolean) {
  for (let round = 0; round < 200 && !check(); round++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  expect(check()).toBe(true);
}

/** Types into the search, as the Student does. */
async function type(text: string) {
  const input = search();
  if (!input) throw new Error("No search");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function openLicences() {
  await screen!.apply({ type: "command", command: "settings" });
  await screen!.click("Lihat lisensi sumber terbuka");
  await until(() => rows().length > 0);
}

describe("Settings → Tentang", () => {
  it("says the version, the app's own licence and that it isn't ITB's or Cognisia's, without reading the list", async () => {
    screen = await openApp({ signedIn: true });
    await screen.apply({ type: "command", command: "settings" });
    const text = dialog()?.textContent ?? "";
    expect(text).toContain("Tentang");
    expect(text).toContain("Versi 2.0.0-test");
    expect(text).toContain("Sumber terbuka, dengan lisensi MIT");
    expect(text).toContain("Edunex Plus bukan aplikasi resmi ITB atau Cognisia, pembuat Edunex.");
    expect(text).toContain("Perangkat lunak yang dipakai Edunex Plus, beserta lisensinya");
    expect(reads).toEqual([]);
  });

  it("opens the list as a page of Settings: how many, each with its version and licence, the search ready to type in", async () => {
    screen = await openApp({ signedIn: true });
    await openLicences();
    expect(title()).toBe("Lisensi sumber terbuka");
    expect(reads).toHaveLength(1);
    expect(reads[0]).toMatch(/\/licences\.json$/);
    expect(dialog()?.textContent).toContain("Edunex Plus dibangun dengan 5 perangkat lunak sumber terbuka, masing-masing dengan lisensinya sendiri.");
    expect(rows()).toEqual([
      "@radix-ui/react-dialog · 1.2.0 · MIT",
      "Chromium · BSD-3-Clause",
      "Liberation Sans · GPL-2.0 with font exception",
      "pdfjs-dist · 6.4.299 · Apache-2.0",
      "zod · 4.6.5 · MIT",
    ]);
    expect(document.activeElement).toBe(search());
  });

  it("keeps the dialog at its full height, so the search stays where it is while the results change", async () => {
    screen = await openApp({ signedIn: true });
    await openLicences();
    // Sized to the rows, it would shrink and re-centre with each narrower search, moving the box the Student types in.
    expect(dialog()?.classList.contains("h-[min(720px,86vh)]")).toBe(true);
  });

  it("keeps a row reached from the keyboard clear of the search pinned over the top of the list", async () => {
    screen = await openApp({ signedIn: true });
    await openLicences();
    // Going back up with Shift+Tab scrolls each row in at the top edge, where the search would cover it whole.
    expect(dialog()?.querySelector("ul")?.className).toContain("[&_button]:scroll-mt-16");
  });

  it("a search narrows the list by name or licence, says how many, and says when nothing matches", async () => {
    screen = await openApp({ signedIn: true });
    await openLicences();
    await type("mit");
    expect(rows()).toEqual(["@radix-ui/react-dialog · 1.2.0 · MIT", "zod · 4.6.5 · MIT"]);
    expect(dialog()?.textContent).toContain("2 hasil");
    await type("radix dialog");
    expect(rows()).toEqual(["@radix-ui/react-dialog · 1.2.0 · MIT"]);
    await type("tiptap");
    expect(rows()).toEqual([]);
    expect(dialog()?.textContent).toContain("Tidak ada yang cocok dengan “tiptap”");
    await type("");
    expect(rows()).toHaveLength(5);
  });

  it("a row opens its licence text under it and closes it again, each on its own; Chromium's says which file beside the app has them", async () => {
    screen = await openApp({ signedIn: true });
    await openLicences();
    const zod = row("zod")!;
    expect(zod.getAttribute("aria-expanded")).toBe("false");
    await screen.click(zod);
    expect(zod.getAttribute("aria-expanded")).toBe("true");
    const text = document.getElementById(zod.getAttribute("aria-controls")!);
    expect([...(text?.querySelectorAll("p") ?? [])].map((p) => p.textContent)).toEqual(["MIT License", "Copyright (c) Example Zod Authors"]);

    // Opening another leaves this one open: closing a long text above the row the Student clicked would pull that row out of view.
    const radix = row("@radix-ui/react-dialog")!;
    await screen.click(radix);
    expect(radix.getAttribute("aria-expanded")).toBe("true");
    expect(zod.getAttribute("aria-expanded")).toBe("true");
    expect(dialog()?.textContent).toContain("Example Zod Authors");
    await screen.click(zod);
    expect(zod.getAttribute("aria-expanded")).toBe("false");
    expect(dialog()?.textContent).not.toContain("Example Zod Authors");
    expect(radix.getAttribute("aria-expanded")).toBe("true");

    const chromium = row("Chromium")!;
    await screen.click(chromium);
    expect(document.getElementById(chromium.getAttribute("aria-controls")!)?.textContent).toBe(
      "Lisensi Chromium dan Node.js, juga semua perangkat lunak sumber terbuka di dalamnya, ada di berkas LICENSES.chromium.html di folder aplikasi.",
    );
  });

  it("a source opens in the browser through main's rule for links; one that isn't a web page has no link", async () => {
    screen = await openApp({ signedIn: true });
    await openLicences();
    await screen.click("Kode sumber zod");
    expect(screen.calls.at(-1)).toEqual({ name: "shell.openLink", input: { url: "https://github.com/colinhacks/zod" } });
    expect(screen.has("Kode sumber pdfjs-dist")).toBe(false);
    expect(screen.has("Kode sumber Chromium")).toBe(true);
  });

  it("goes back to Settings on the button that opened the list, and Settings opens on its own page again", async () => {
    screen = await openApp({ signedIn: true });
    await openLicences();
    await screen.click("Kembali ke Pengaturan");
    expect(title()).toBe("Pengaturan");
    expect(document.activeElement).toBe(screen.button("Lihat lisensi sumber terbuka"));

    await screen.click("Lihat lisensi sumber terbuka");
    await until(() => rows().length > 0);
    await screen.key("Escape");
    await screen.apply({ type: "command", command: "settings" });
    expect(title()).toBe("Pengaturan");
  });

  it("a list that can't be read says so, and Coba lagi reads it again", async () => {
    file = "missing";
    screen = await openApp({ signedIn: true });
    await screen.apply({ type: "command", command: "settings" });
    await screen.click("Lihat lisensi sumber terbuka");
    await until(() => (dialog()?.textContent ?? "").includes("Daftar lisensi belum bisa dimuat"));
    // Said to a screen reader too, where the Student is.
    expect(dialog()?.querySelector("[role=status]")?.textContent).toContain("Daftar lisensi belum bisa dimuat");
    file = "list";
    await screen.click("Coba lagi");
    await until(() => rows().length === 5);
    expect(reads).toHaveLength(2);
  });

  it("in English", async () => {
    screen = await openApp({ signedIn: true });
    await screen.engineDoes(() => screen!.engine.updateSettings({ lang: "en" }));
    await screen.apply({ type: "command", command: "settings" });
    const text = dialog()?.textContent ?? "";
    expect(text).toContain("About");
    expect(text).toContain("Open source, under the MIT licence");
    expect(text).toContain("Edunex Plus isn't an official app of ITB or of Cognisia, the maker of Edunex.");
    await screen.click("View open-source licences");
    await until(() => rows().length > 0);
    expect(title()).toBe("Open-source licences");
    expect(dialog()?.textContent).toContain("Edunex Plus is built with 5 open-source projects, each under its own licence.");
    expect(search()?.getAttribute("aria-label")).toBe("Search by name or licence");
    await type("mit");
    expect(dialog()?.textContent).toContain("2 results");
    expect(screen.has("Source code of zod")).toBe(true);
    await type("chromium");
    await screen.click(row("Chromium")!);
    expect(dialog()?.textContent).toContain(
      "The licences of Chromium and Node.js, and of all the open-source software inside them, are in LICENSES.chromium.html, in the app's folder.",
    );
    await screen.click("Back to Settings");
    expect(title()).toBe("Settings");
  });
});
