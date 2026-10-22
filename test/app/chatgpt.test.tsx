// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryVault } from "../pretend/memory";
import { type Options, openApp } from "./harness";

const identity = { issuer: "https://auth.openai.com" as const, clientId: "oaiapp_pretend", subject: "pretend-student", name: "Dimas Pratama" };
let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});
async function settings(options: Options = {}) {
  screen = await openApp({ signedIn: true, ...options });
  await screen.apply({ type: "command", command: "settings" });
  return screen;
}
async function confirm() {
  const buttons = document.querySelectorAll<HTMLButtonElement>("[role=alertdialog] button");
  await screen!.click(buttons[buttons.length - 1]);
}

describe("ChatGPT in Settings", () => {
  it("explains unavailable configuration and keeps the connection optional", async () => {
    const s = await settings();
    expect(s.button("Continue with ChatGPT").disabled).toBe(true);
    expect(s.text()).toContain("Koneksi ChatGPT belum tersedia");
    expect(s.text()).toContain("Belum ada data kuliah yang dikirim");
  });

  it("connects, confirms disconnect, and forgets the identity on sign-out of everything", async () => {
    const saved = new MemoryVault();
    const s = await settings({ vault: saved, chatgptSignIn: async () => identity });
    await s.click("Continue with ChatGPT");
    expect(s.text()).toContain("Terhubung sebagai Dimas Pratama");
    expect(saved.secrets.has("chatgpt.identity")).toBe(true);
    await s.click("Putuskan ChatGPT");
    expect(document.querySelector("[role=alertdialog]")?.textContent).toContain("Akun ChatGPT dilupakan di komputer ini");
    await s.click("Batal");
    expect(saved.secrets.has("chatgpt.identity")).toBe(true);
    await s.click("Putuskan ChatGPT");
    await confirm();
    expect(saved.secrets.has("chatgpt.identity")).toBe(false);
    await s.click("Continue with ChatGPT");
    await s.click("Keluar & hapus data");
    await confirm();
    expect(saved.secrets.has("chatgpt.identity")).toBe(false);
  });

  it("says when sign-in fails and lets the Student retry", async () => {
    const s = await settings({
      chatgptSignIn: async () => {
        throw new Error("pretend offline");
      },
    });
    await s.click("Continue with ChatGPT");
    expect(document.querySelector("[role=alert]")?.textContent).toContain("ChatGPT belum terhubung. Coba masuk lagi.");
    expect(s.button("Continue with ChatGPT").disabled).toBe(false);
  });

  it("can cancel in the browser without showing a failure or saving the late result", async () => {
    let finish: (value: typeof identity) => void = () => undefined;
    const saved = new MemoryVault();
    const s = await settings({
      vault: saved,
      chatgptSignIn: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    await s.click("Continue with ChatGPT");
    expect(s.text()).toContain("Selesaikan masuk di browser");
    await s.click("Batalkan masuk");
    await act(async () => {
      finish(identity);
    });
    expect(saved.secrets.has("chatgpt.identity")).toBe(false);
    expect(s.text()).not.toContain("ChatGPT belum terhubung");
    expect(s.button("Continue with ChatGPT").disabled).toBe(false);
  });

  it("keeps track of sign-in when Settings closes and opens again", async () => {
    let finish: (value: typeof identity) => void = () => undefined;
    const s = await settings({
      chatgptSignIn: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    await s.click("Continue with ChatGPT");
    await s.key("Escape");
    await s.apply({ type: "command", command: "settings" });
    expect(s.has("Batalkan masuk")).toBe(true);
    await act(async () => {
      finish(identity);
    });
    expect(s.text()).toContain("Terhubung sebagai Dimas Pratama");
  });
});
