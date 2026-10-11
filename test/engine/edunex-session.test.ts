// v2-03 (#71): the engine signs in to EduNex, shows saved data first, and
// keeps an honest status through restarts, outages and vendor changes.
import { describe, expect, it } from "vitest";
import { PRETEND_TOKEN } from "../pretend/edunex";
import { MemoryVault } from "../pretend/memory";
import { startEngine } from "./harness";

const signedIn = async () => {
  const h = await startEngine();
  await h.engine.signIn("edunex", { token: PRETEND_TOKEN });
  return h;
};

describe("EduNex sign-in → your courses", () => {
  it("first sign-in loads the account and this term's courses", async () => {
    const h = await startEngine();
    expect(h.status("edunex").state).toBe("signed-out");
    await h.engine.signIn("edunex", { token: PRETEND_TOKEN });
    expect(h.status("edunex")).toMatchObject({ state: "live", detail: null });
    expect(h.status("edunex").updatedAt).toBe(h.world.clock.now());
    expect(h.dataset("edunex.account")).toEqual({ name: "Dimas Pratama", nim: "18223901" });
    const courses = h.dataset("edunex.courses")!;
    expect(courses.map((c) => c.code)).toEqual(["DK4073", "II4091", "KU5014", "PL3002", "PL3032"]);
    const ii4091 = courses.find((c) => c.code === "II4091")!;
    expect(ii4091).toMatchObject({ name: "Final Project Proposal", classNo: "01", term: "2026-1" });
    expect(ii4091.edunex).toEqual({ courseId: 95326, classId: 87103, relatedCourseIds: [97602] });
  });

  it("keeps the session only in the vault, never in saved data", async () => {
    const h = await signedIn();
    expect(JSON.parse(h.vault.secrets.get("edunex.session")!).token).toBe(PRETEND_TOKEN);
    for (const text of h.storage.files.values()) expect(text).not.toContain(PRETEND_TOKEN);
  });

  it("restarting offline shows saved data at once, then says offline", async () => {
    const first = await signedIn();
    first.engine.stop();
    first.world.setOffline(true);
    const again = await startEngine({ world: first.world, storage: first.storage, vault: first.vault, start: false });
    // Before any network call: everything saved is there and the session counts.
    expect(again.dataset("edunex.courses")).toHaveLength(5);
    expect(again.status("edunex").state).toBe("connecting");
    const requestsBefore = first.world.log.length;
    again.engine.start();
    await again.wait();
    expect(first.world.log.length).toBeGreaterThan(requestsBefore);
    expect(again.status("edunex")).toMatchObject({ state: "offline", detail: "EduNex is unreachable" });
    expect(again.dataset("edunex.courses")).toHaveLength(5);
    // Back online: the next attempt recovers on its own.
    first.world.setOffline(false);
    await again.wait(60_000);
    expect(again.status("edunex").state).toBe("live");
  });

  it("an ended session expires EduNex only, and keeps the data readable", async () => {
    const h = await signedIn();
    h.world.edunex.expireSession();
    await h.engine.refresh("edunex");
    expect(h.status("edunex").state).toBe("expired");
    expect(h.vault.secrets.has("edunex.session")).toBe(false);
    expect(h.dataset("edunex.courses")).toHaveLength(5);
    // Still expired after a restart, until the Student signs in again.
    const again = await startEngine({ world: h.world, storage: h.storage, vault: h.vault });
    expect(again.status("edunex").state).toBe("expired");
  });

  it("a 401 on any call other than the liveness check doesn't sign the Student out", async () => {
    const h = await signedIn();
    h.world.edunex.fail(/^\/course\/presences\/list$/, 401, 1);
    await h.engine.refresh("edunex");
    await h.wait();
    expect(h.status("edunex").state).toBe("live");
    expect(h.vault.secrets.has("edunex.session")).toBe(true);
  });

  it("EduNex down for maintenance: offline with the reason, data kept", async () => {
    const h = await signedIn();
    h.world.edunex.maintenance();
    await h.engine.refresh("edunex");
    expect(h.status("edunex")).toMatchObject({ state: "offline", detail: "EduNex answered 503" });
    expect(h.dataset("edunex.courses")).toHaveLength(5);
    h.world.edunex.maintenance(false);
    await h.wait(60_000);
    expect(h.status("edunex").state).toBe("live");
  });

  it("EduNex changed a field: says so, keeps the last good data", async () => {
    const h = await signedIn();
    h.world.edunex.mangle(/^\/course\/presences\/list$/, { kind: "missing-field", field: "course_code" });
    await h.engine.refresh("edunex");
    expect(h.status("edunex").state).toBe("changed");
    expect(h.status("edunex").detail).toContain("course_code");
    expect(h.dataset("edunex.courses")).toHaveLength(5);
  });

  it("an unknown new field changes nothing", async () => {
    const h = await signedIn();
    const before = h.events.length;
    h.world.edunex.mangle(/^\/course\/presences\/list$/, { kind: "unknown-field", field: "new_thing" });
    await h.engine.refresh("edunex");
    expect(h.status("edunex").state).toBe("live");
    expect(h.events.slice(before).filter((e) => e.type === "dataset")).toEqual([]);
  });

  it("HTML instead of data is a vendor change, not an empty list", async () => {
    const h = await signedIn();
    h.world.edunex.mangle(/^\/course\/presences\/list$/, { kind: "html" });
    await h.engine.refresh("edunex");
    expect(h.status("edunex").state).toBe("changed");
    expect(h.dataset("edunex.courses")).toHaveLength(5);
  });

  it.each([
    ["a field with the wrong type", { kind: "wrong-type", field: "course_id" }],
    ["an empty answer", { kind: "empty-body" }],
  ] as const)("%s is a vendor change, with the last good data kept", async (_name, breakage) => {
    const h = await signedIn();
    h.world.edunex.mangle(/^\/course\/presences\/list$/, breakage);
    await h.engine.refresh("edunex");
    expect(h.status("edunex").state).toBe("changed");
    expect(h.dataset("edunex.courses")).toHaveLength(5);
  });

  it.each([403, 404])("EduNex refusing the course list (%i) says it changed something, without signing out", async (status) => {
    const h = await signedIn();
    h.world.edunex.fail(/^\/course\/presences\/list$/, status);
    await h.engine.refresh("edunex");
    expect(h.status("edunex")).toMatchObject({ state: "changed", detail: `EduNex answered ${status} for /course/presences/list` });
    expect(h.vault.secrets.has("edunex.session")).toBe(true);
  });

  it("being rate-limited (429) counts as offline and recovers", async () => {
    const h = await signedIn();
    h.world.edunex.fail(/^\/login\/me$/, 429, 1);
    await h.engine.refresh("edunex");
    expect(h.status("edunex")).toMatchObject({ state: "offline", detail: "EduNex answered 429" });
    await h.wait(60_000);
    expect(h.status("edunex").state).toBe("live");
  });

  it("a slow network times out after 15 seconds instead of hanging", async () => {
    const h = await signedIn();
    h.world.setLatency(20_000);
    const refresh = h.engine.refresh("edunex");
    await h.wait(16_000);
    await refresh;
    expect(h.status("edunex")).toMatchObject({ state: "offline", detail: "EduNex didn't answer in time" });
    h.world.setLatency(2_000);
    await h.wait(120_000);
    expect(h.status("edunex").state).toBe("live");
  });

  it("tells the screens only when data really changed", async () => {
    const h = await signedIn();
    const before = h.events.filter((e) => e.type === "dataset").length;
    await h.engine.refresh("edunex");
    expect(h.events.filter((e) => e.type === "dataset").length).toBe(before);
  });

  it("one failing feed doesn't slow the others down", async () => {
    const h = await signedIn();
    h.world.edunex.fail(/^\/course\/presences\/list$/, 500);
    const start = h.world.clock.now();
    await h.wait(60 * 60_000);
    const checks = h.world.log.filter((r) => r.url.endsWith("/login/me") && r.at > start).map((r) => r.at - start);
    // The liveness check keeps its ~10-minute rhythm while the course list backs off.
    expect(checks.length).toBeGreaterThanOrEqual(5);
    const gaps = checks.slice(1).map((at, i) => at - checks[i]);
    for (const gap of gaps) expect(gap).toBeGreaterThan(8 * 60_000);
    expect(h.status("edunex").state).toBe("offline");
  });

  it("signing out of everything lets the next Student get their own first-run scan", async () => {
    const h = await signedIn();
    await h.engine.updateSettings({ firstScanDone: true, theme: "dark" });
    await h.engine.signOut("edunex");
    expect(h.engine.snapshot().settings.firstScanDone).toBe(true);
    await h.engine.signOut();
    expect(h.engine.snapshot().settings).toMatchObject({ firstScanDone: false, theme: "dark" });
  });

  it("sign-out removes the session and every saved trace", async () => {
    const h = await signedIn();
    await h.engine.signOut();
    expect(h.vault.secrets.size).toBe(0);
    // ITB's public pages hold nothing personal and stay.
    expect([...h.storage.files.keys()].filter((k) => k.startsWith("datasets/") && !k.startsWith("datasets/itb."))).toEqual([]);
    expect(h.status("edunex")).toMatchObject({ state: "signed-out", updatedAt: null });
    expect(h.engine.snapshot().datasets.filter((d) => !d.name.startsWith("itb."))).toEqual([]);
  });

  it("signing out while a sync is still running never brings the data back", async () => {
    const h = await signedIn();
    h.world.setLatency(2_000);
    const refresh = h.engine.refresh("edunex");
    await h.engine.signOut();
    await h.wait(5_000);
    await refresh;
    expect(h.engine.snapshot().datasets.filter((d) => !d.name.startsWith("itb."))).toEqual([]);
    expect(h.status("edunex")).toMatchObject({ state: "signed-out", updatedAt: null });
  });

  it("an ended session stays ended even if a sync was still running", async () => {
    const h = await signedIn();
    h.world.setLatency(2_000);
    h.world.edunex.fail(/^\/course\/presences\/list$/, 500);
    const refresh = h.engine.refresh("edunex");
    h.world.edunex.expireSession();
    await h.wait(5_000);
    await refresh;
    expect(h.status("edunex").state).toBe("expired");
  });

  it("a different Student signing in never sees the previous one's data", async () => {
    const h = await signedIn();
    h.world.edunex.me = { ...h.world.edunex.me, name: "Rina Sari", code: "18224999" };
    h.world.edunex.pairs = h.world.edunex.pairs.slice(0, 1);
    await h.engine.signIn("edunex", { token: PRETEND_TOKEN });
    expect(h.dataset("edunex.account")?.nim).toBe("18224999");
    expect(h.dataset("edunex.courses")).toHaveLength(1);
  });

  it("a damaged saved session counts as signed out instead of stopping the app", async () => {
    const vault = new MemoryVault();
    vault.secrets.set("edunex.session", "{not json");
    const h = await startEngine({ vault });
    expect(h.status("edunex").state).toBe("signed-out");
  });

  it("remembers settings across restarts", async () => {
    const h = await startEngine();
    await h.engine.updateSettings({ theme: "dark", lang: "en" });
    const again = await startEngine({ world: h.world, storage: h.storage, vault: h.vault });
    expect(again.engine.snapshot().settings).toMatchObject({ theme: "dark", lang: "en" });
  });
});
