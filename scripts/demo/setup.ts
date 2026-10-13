// The demo's world, set up before the app's main process loads (./main.ts):
// the pretend Edunex, SIX and ITB pages from the tests, with made-up student
// data, on a clock that starts at a chosen moment and then runs in real time.
//
//   EDUNEX_DEMO=signed-in    (default) both systems connected, synced, on Beranda
//   EDUNEX_DEMO=edunex-only  Edunex connected, SIX not
//   EDUNEX_DEMO=first-run    nobody signed in: the welcome screen
//   EDUNEX_DEMO_NOW=<ISO>    the moment the demo starts (default: the recorded Thursday morning)
//
// Every run starts from an empty profile (deleted again on quit), so each begins the same way.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { app, dialog, net, session, shell } from "electron";
import type { DemoHooks } from "../../src/desktop/demo";
import { PRETEND_TOKEN } from "../../test/pretend/edunex";
import { PRETEND_SIX_COOKIE } from "../../test/pretend/six";
import { PretendWorld } from "../../test/pretend/world";

type Scenario = "signed-in" | "edunex-only" | "first-run";
const scenario = (process.env.EDUNEX_DEMO ?? "signed-in") as Scenario;
if (!["signed-in", "edunex-only", "first-run"].includes(scenario)) throw new Error(`Unknown EDUNEX_DEMO scenario "${scenario}"`);

// Signed-in demos start a few minutes early: the first sync (SIX at a page every two seconds, ITB's catalog) is played fast before the window opens.
const start = process.env.EDUNEX_DEMO_NOW ?? (scenario === "first-run" ? "2026-10-08T08:10:00+07:00" : "2026-10-08T08:07:00+07:00");
const world = new PretendWorld({ now: start });
// Each run gets its own throwaway profile, so several demos can run side by side.
const profile = `Edunex Plus Demo/${scenario}-${process.pid}`;
const profileDir = path.join(app.getPath("appData"), profile);
fs.rmSync(profileDir, { recursive: true, force: true });
app.on("quit", () => fs.rmSync(profileDir, { recursive: true, force: true }));

// Nothing leaves the demo: links the app would open in the browser are only
// noted, the system's file pickers answer with a made-up file, and Edunex's
// files download from the pretend storage into a throwaway folder.
const scratch = path.join(os.tmpdir(), `edunex-plus-demo-${process.pid}`);
fs.mkdirSync(path.join(scratch, "Downloads"), { recursive: true });
app.on("quit", () => fs.rmSync(scratch, { recursive: true, force: true }));
app.setPath("downloads", path.join(scratch, "Downloads"));
const SAMPLE_PDF = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n";
const answer = path.join(scratch, "Laporan Tugas - Dimas Pratama.pdf");
fs.writeFileSync(answer, SAMPLE_PDF);
const opened: string[] = [];
shell.openExternal = async (url: string) => void opened.push(url);
shell.openPath = async () => "";
shell.showItemInFolder = () => undefined;
const lastOptions = (args: unknown[]) => (args.at(-1) ?? {}) as { properties?: string[]; defaultPath?: string };
dialog.showOpenDialog = (async (...args: unknown[]) => {
  const folder = lastOptions(args).properties?.includes("openDirectory");
  if (folder) fs.mkdirSync(path.join(scratch, "Offline"), { recursive: true });
  return { canceled: false, filePaths: [folder ? path.join(scratch, "Offline") : answer] };
}) as typeof dialog.showOpenDialog;
dialog.showSaveDialog = (async (...args: unknown[]) => ({
  canceled: false,
  filePath: path.join(scratch, path.basename(lastOptions(args).defaultPath ?? "export")),
})) as typeof dialog.showSaveDialog;
void app.whenReady().then(() =>
  session.defaultSession.protocol.handle("https", async (request) => {
    const url = new URL(request.url);
    if (!url.host.endsWith(".blob.core.windows.net")) return net.fetch(request, { bypassCustomProtocolHandlers: true });
    const stored = await world.request({ method: "GET", url: request.url }).catch(() => null);
    return new Response(stored?.status === 200 ? stored.body : SAMPLE_PDF, { headers: { "content-type": "application/pdf" } });
  }),
);

/** Lets the pretend clock run fast until `work` is done (at most ten pretend minutes). */
async function fastForward<T>(work: Promise<T>): Promise<T> {
  let outcome: { value: T } | { error: unknown } | null = null;
  void work.then(
    (value) => (outcome = { value }),
    (error: unknown) => (outcome = { error }),
  );
  for (let second = 0; second < 600 && !outcome; second++) await world.clock.advance(1_000);
  if (!outcome) throw new Error("the demo's first sync didn't finish");
  const done = outcome as { value: T } | { error: unknown };
  if ("error" in done) throw done.error;
  return done.value;
}

/** From now on the pretend clock keeps pace with the real one. */
function runInRealTime(): void {
  let last = Date.now();
  let busy = false;
  setInterval(() => {
    if (busy) return;
    busy = true;
    const now = Date.now();
    void world.clock.advance(now - last).finally(() => {
      last = now;
      busy = false;
    });
  }, 200).unref();
}

const hooks: DemoHooks = {
  transport: world,
  clock: world.clock,
  profile,
  async signIn(source) {
    // About as long as a sign-in window that remembers the Microsoft account.
    await new Promise((resolve) => setTimeout(resolve, 900));
    return source === "edunex" ? PRETEND_TOKEN : PRETEND_SIX_COOKIE;
  },
  async prepare(engine) {
    if (scenario === "first-run") {
      runInRealTime();
      return false;
    }
    engine.start();
    await fastForward(engine.signIn("edunex", { token: PRETEND_TOKEN }));
    if (scenario === "signed-in") await fastForward(engine.signIn("six", { cookie: PRETEND_SIX_COOKIE }));
    // ITB's calendar, the public catalog's pages (one every 3.5 s), and the first alerts settle.
    await world.clock.advance(200_000);
    await engine.updateSettings({ firstScanDone: true });
    runInRealTime();
    return true;
  },
  clockOffset: () => world.clock.now() - Date.now(),
};

globalThis.__edunexPlusDemo = hooks;
// For scripts that drive the demo (Playwright's electronApp.evaluate runs in this process).
Object.assign(globalThis, { __edunexPlusDemoWorld: world, __edunexPlusDemoOpened: opened });
