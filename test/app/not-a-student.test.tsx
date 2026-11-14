// @vitest-environment jsdom
// #345–#352: a lecturer signed in. The window says the account isn't a student's, offers nothing to report, and its
// "Keluar" signs out of everything: one system alone would keep Microsoft's sign-in, which would bring the same account back.
import { afterEach, expect, it } from "vitest";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

it("a lecturer's Edunex says it isn't a student's account, and Keluar signs out of everything", async () => {
  const world = new PretendWorld();
  const { code: _nim, ...me } = world.edunex.me as Record<string, unknown>;
  world.edunex.me = { ...me, level: "LECTURER" };
  screen = await openApp({ world, signedIn: true });

  expect(screen.text()).toContain("Akun Edunex ini bukan akun mahasiswa. Edunex Plus hanya untuk mahasiswa. Keluar, lalu masuk dengan akun mahasiswamu.");
  expect(screen.text()).not.toContain("Edunex berubah");
  expect(screen.has("Laporkan")).toBe(false);

  await screen.click("Keluar");
  expect(screen.calls.find((call) => call.name === "auth.signOut")).toEqual({ name: "auth.signOut", input: {} });
});
