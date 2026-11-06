// The pages behind a read that went wrong (src/engine/report/kept-pages.ts) go to the read that got
// them while feeds run at once, without Node's AsyncLocalStorage: the phone's JavaScript (Hermes)
// has nothing like it, so each read's FeedRead is handed down explicitly, the same code on both.
// Here AsyncLocalStorage fails if anything asks for it, as it would on the phone.
import { describe, expect, it, vi } from "vitest";
import { EngineError } from "../../src/engine/errors";
import type { HttpRequest, HttpResponse, Transport } from "../../src/engine/http/transport";
import { type FeedRead, KeptPages, noting } from "../../src/engine/report/kept-pages";
import { PRETEND_TOKEN } from "../pretend/edunex";
import { PRETEND_SIX_COOKIE } from "../pretend/six";
import { type Harness, startEngine } from "./harness";

vi.mock("node:async_hooks", () => ({
  get AsyncLocalStorage(): never {
    throw new Error("The phone has no AsyncLocalStorage");
  },
}));

/** A network whose answers come back only when the test says, in any order. */
function heldNetwork() {
  const held = new Map<string, (response: HttpResponse) => void>();
  const transport: Transport = {
    request: (request: HttpRequest) => new Promise((resolve) => held.set(new URL(request.url).pathname, resolve)),
  };
  const answer = async (path: string) => {
    for (let tries = 0; !held.has(path); tries++) {
      if (tries > 100) throw new Error(`nothing asked for ${path}`);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    held.get(path)!({ status: 200, headers: {}, body: `the page at ${path}`, url: `https://six.itb.ac.id${path}` });
    held.delete(path);
  };
  return { transport, answer };
}

const paths = (kept: KeptPages, feed: string) =>
  kept
    .list()
    .find((one) => one.feed === feed)
    ?.pages.map((page) => new URL(page.url).pathname);

describe("reads running at once", () => {
  it("each keep the pages they got, whatever order the answers come back in", async () => {
    const { transport, answer } = heldNetwork();
    const kept = new KeptPages();
    const read = (feed: string, pages: string[]) =>
      kept.during({ feed, shows: undefined, now: () => 0, current: () => true }, async (notes: FeedRead) => {
        const door = noting(transport, notes);
        for (const path of pages) await door.request({ method: "GET", url: `https://six.itb.ac.id${path}` });
        throw new EngineError("VendorChanged", `${feed} didn't fit`);
      });
    const first = read("six.bills", ["/a1", "/a2"]);
    const second = read("six.krs", ["/b1", "/b2", "/b3"]);
    // A request that isn't any read's (a hand-in, the report's own) is noted for none.
    const loose = transport.request({ method: "GET", url: "https://six.itb.ac.id/loose" });
    for (const path of ["/b1", "/a1", "/loose", "/b2", "/a2", "/b3"]) await answer(path);
    await Promise.all([expect(first).rejects.toThrow("six.bills"), expect(second).rejects.toThrow("six.krs"), loose]);
    expect(paths(kept, "six.bills")).toEqual(["/a1", "/a2"]);
    expect(paths(kept, "six.krs")).toEqual(["/b1", "/b2", "/b3"]);
  });

  it("each note what they stored and left out, for their own feed", async () => {
    const kept = new KeptPages();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const read = (feed: string, dataset: "six.krs" | "six.bills", why: string) =>
      kept.during({ feed, shows: undefined, now: () => 0, current: () => true }, async (notes) => {
        await gate;
        notes.stored(dataset, [{ row: `a row of ${dataset}`, why }]);
      });
    const both = Promise.all([read("six.krs", "six.krs", "krs row"), read("six.bills", "six.bills", "bills row")]);
    release();
    await both;
    expect(kept.list().map(({ feed, datasets, check }) => ({ feed, datasets, check }))).toEqual(
      expect.arrayContaining([
        { feed: "six.krs", datasets: ["six.krs"], check: "krs row" },
        { feed: "six.bills", datasets: ["six.bills"], check: "bills row" },
      ]),
    );
  });
});

/** Lets the fake clock run until `work` is done (SIX is read at human pace). */
async function until<T>(h: Harness, work: Promise<T>): Promise<T> {
  let done = false;
  const settled = work.finally(() => (done = true));
  for (let second = 0; second < 900 && !done; second++) await h.world.clock.advance(1_000);
  return settled;
}

describe("the engine's feeds running at once", () => {
  it("keep each SIX page with the feed that read it, while every SIX feed reads in the same line", async () => {
    const h = await startEngine();
    await until(h, h.engine.signIn("six", { cookie: PRETEND_SIX_COOKIE }));
    h.world.six.changeLayout(/\/keuangan$/, "<th class='text-left'>Semester</th>", "<th>Periode</th>");
    h.world.six.editPage(/\/registrasi\/rencanastudi\/\d+$/, () => "<html><body><a href='/logout'>Keluar</a><main>Halaman baru</main></body></html>");
    await until(h, h.engine.refresh("six"));

    const { problems } = await h.engine.report({ source: "six" });
    const pagesOf = (feed: string) => problems.find((problem) => problem.feed === feed)?.pages.map((page) => page.path);
    expect(problems.map((problem) => problem.feed).sort()).toEqual(["six.bills", "six.krs"]);
    expect(pagesOf("six.bills")).toEqual(["/app/mahasiswa:18223901/keuangan"]);
    expect(pagesOf("six.krs")).toEqual([expect.stringMatching(/\/registrasi\/rencanastudi\/\d+$/)]);
  });

  it("keep each Edunex answer with the feed that asked, while their requests overlap", async () => {
    const h = await startEngine();
    await h.engine.signIn("edunex", { token: PRETEND_TOKEN });
    // Every answer takes a while, so every Edunex feed's requests are out at once.
    h.world.setLatency(1_500);
    h.world.edunex.mangle(/^\/course\/presences\/list$/, { kind: "missing-field", field: "course_code" });
    await until(h, h.engine.refresh("edunex"));

    const [problem] = (await h.engine.report({ source: "edunex" })).problems;
    expect(problem).toMatchObject({ feed: "edunex.courses", kind: "changed" });
    expect(problem!.pages.map((page) => page.path)).toEqual(["/course/presences/list"]);
  });
});
