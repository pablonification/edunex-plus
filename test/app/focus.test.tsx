// @vitest-environment jsdom
// Keyboard use: a dialog or panel closed with Escape puts focus back on what
// opened it, so the next Tab carries on from there instead of the top of the page.
import { afterEach, describe, expect, it } from "vitest";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

async function openAndEscape(opener: HTMLElement) {
  opener.focus();
  await screen!.click(opener);
  expect(document.querySelector("[role=dialog]")).not.toBeNull();
  await screen!.key("Escape");
  await tick();
  expect(document.querySelector("[role=dialog]")).toBeNull();
}

describe("focus after closing", () => {
  it("Settings, opened from the sidebar, gives focus back to its button", async () => {
    screen = await openApp({ signedIn: true });
    const opener = screen.button(/Pengaturan$/);
    await openAndEscape(opener);
    expect(document.activeElement).toBe(opener);
  });

  it("search gives focus back to the search button", async () => {
    screen = await openApp({ signedIn: true });
    const opener = screen.button("Cari");
    await openAndEscape(opener);
    expect(document.activeElement).toBe(opener);
  });

  it("the phone-calendar dialog gives focus back to its button", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await screen.click(/^Jadwal$/);
    const opener = screen.button(/kalender HP/);
    await openAndEscape(opener);
    expect(document.activeElement).toBe(opener);
  });
});
