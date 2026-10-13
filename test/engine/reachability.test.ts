// Whether Edunex, SIX and ITB can be reached follows the latest evidence: a
// lost connection on a hand-in is checked at once, one answer after an outage
// is enough to say "connected" again, and "Perbarui sekarang" doesn't wait
// minutes on ITB's catalog.
import { describe, expect, it } from "vitest";
import { isEngineError } from "../../src/engine/errors";
import { PRETEND_TOKEN } from "../pretend/edunex";
import { type Harness, startEngine } from "./harness";

const signedIn = async () => {
  const h = await startEngine();
  await h.engine.signIn("edunex", { token: PRETEND_TOKEN });
  return h;
};
const upload = (h: Harness) => h.engine.act("edunex", "uploadFile", { name: "jawaban.pdf", contentType: "application/pdf", bytes: new TextEncoder().encode("%PDF jawaban") });
const failure = async (work: Promise<unknown>) => {
  try {
    await work;
  } catch (error) {
    if (isEngineError(error)) return error;
    throw error;
  }
  throw new Error("expected the action to fail");
};
const requestsTo = (h: Harness, path: RegExp, since: number) => h.world.log.slice(since).filter((r) => path.test(new URL(r.url).pathname));

describe("reaching the sources", () => {
  it("a hand-in that loses the connection asks at once: the status says so without waiting for the next sync", async () => {
    const h = await signedIn();
    h.world.setOffline(true);
    expect((await failure(upload(h))).kind).toBe("Offline");
    await h.wait(1_000);
    expect(h.status("edunex")).toMatchObject({ state: "offline", detail: "Edunex is unreachable" });
  });

  it("a storage hiccup while Edunex itself answers leaves the status alone", async () => {
    const h = await signedIn();
    h.world.failUploads("network");
    expect((await failure(upload(h))).kind).toBe("Offline");
    await h.wait(1_000);
    expect(h.status("edunex").state).toBe("live");
  });

  it("back online, one answer is enough: connected again before every feed has had its turn", async () => {
    const h = await signedIn();
    h.world.setOffline(true);
    await h.engine.refresh("edunex");
    expect(h.status("edunex").state).toBe("offline");

    h.world.setOffline(false);
    const since = h.world.log.length;
    // Only the account check runs (asked by the upload's hiccup); the Tasks feed waits for its own retry.
    h.world.failUploads("network");
    await failure(upload(h));
    await h.wait(1_000);
    expect(requestsTo(h, /^\/course\/tasks/, since)).toEqual([]);
    expect(h.status("edunex")).toMatchObject({ state: "live", detail: null });
  });

  it("an answer that began before the outage doesn't hide it", async () => {
    const h = await signedIn();
    h.world.setLatency(2_000);
    const slow = h.engine.refresh("edunex");
    // The connection drops while the first calls are still on their way back.
    await h.world.clock.advance(1_000);
    h.world.setOffline(true);
    await h.world.clock.advance(10_000);
    await slow;
    expect(h.status("edunex").state).toBe("offline");
  });
});

describe("Perbarui sekarang", () => {
  it("reads the Student's data again without waiting on ITB's catalog, read a page every few seconds", async () => {
    const h = await signedIn();
    // The catalog's first read is under way.
    await h.wait(10_000);
    expect(h.world.itb.requests.some((r) => r.host === "six.itb.ac.id")).toBe(true);
    const since = h.world.log.length;
    let done = false;
    void h.engine.refresh().then(() => (done = true));
    await h.wait(5_000);
    expect(done).toBe(true);
    expect(requestsTo(h, /^\/course\/tasks/, since).length).toBeGreaterThan(0);
  });

  it("the catalog losing the connection halfway tries again quietly: the calendar the Student sees is fine", async () => {
    const h = await startEngine();
    while (!h.world.itb.requests.some((r) => r.path === "/pub/kur2024/182")) await h.wait(1_000);
    h.world.setOffline(true);
    await h.wait(30_000);
    expect(h.status("itb").state).toBe("live");
    expect(h.dataset("itb.catalog")!.programs.find((p) => p.id === "154")?.state).toBe("pending");
    // Back online, it picks up where it stopped on its own.
    h.world.setOffline(false);
    await h.wait(30 * 60_000);
    expect(h.dataset("itb.catalog")!.programs.find((p) => p.id === "154")?.state).toBe("ready");
  });
});
