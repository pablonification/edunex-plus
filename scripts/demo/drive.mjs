// Drives the demo app with Playwright, the way a Student would use it: launch
// (scenario, window size, optional video), then click, type and look.
//
//   import { launchDemo } from "./scripts/demo/drive.mjs";
//   const demo = await launchDemo({ scenario: "signed-in" });
//   await demo.page.getByRole("button", { name: "Jadwal" }).click();
//   await demo.shot("jadwal");
//   await demo.close();
//
// Build first: `npm run demo:build` (the window, the main process and the demo's main).
// `dev: true` serves the window from Vite instead (`npm run demo:dev` starts it), so
// edits to the screens show without a rebuild.
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { _electron } from "playwright-core";

const root = path.resolve(import.meta.dirname, "..", "..");
const electronBinary = createRequire(import.meta.url)("electron");

/**
 * @param {{ scenario?: "signed-in" | "edunex-only" | "first-run", now?: string, size?: { width: number, height: number },
 *           theme?: "light" | "dark", lang?: "id" | "en", video?: string, shots?: string, devServer?: string,
 *           platform?: "darwin" | "win32" | "linux" }} options  `platform`: the page drawn as on that system
 */
export async function launchDemo(options = {}) {
  const size = options.size ?? { width: 1280, height: 800 };
  const env = { ...process.env, EDUNEX_DEMO: options.scenario ?? "signed-in" };
  delete env.ELECTRON_RUN_AS_NODE;
  if (options.now) env.EDUNEX_DEMO_NOW = options.now;
  if (options.platform) env.EDUNEX_DEMO_PLATFORM = options.platform;
  if (options.devServer) env.ELECTRON_START_URL = options.devServer;
  const main = path.join(root, "dist", "desktop", "demo-main.cjs");
  if (!fs.existsSync(main)) throw new Error("No demo build: run `npm run demo:build` first");

  // A cold start on a busy CI machine now and then takes longer than usual: wait up to a minute
  // there, and start once more before giving up, so one slow start doesn't lose every picture.
  const wait = process.env.CI ? 60_000 : 30_000;
  const start = async () => {
    const app = await _electron.launch({
      executablePath: electronBinary,
      args: [main],
      env,
      timeout: wait,
      recordVideo: options.video ? { dir: options.video, size } : undefined,
    });
    try {
      const page = await app.firstWindow({ timeout: wait });
      await app.evaluate(({ BrowserWindow }, { width, height }) => {
        const window = BrowserWindow.getAllWindows()[0];
        window.setContentSize(width, height);
        window.center();
      }, size);
      // The page is up once its root has drawn the saved data.
      await page.waitForFunction(() => (document.getElementById("root")?.children.length ?? 0) > 0, null, { timeout: wait });
      return { app, page };
    } catch (error) {
      await app.close().catch(() => {});
      throw error;
    }
  };
  const { app, page } = await start().catch(() => start());

  const shotsDir = options.shots ? path.resolve(options.shots) : path.join(root, ".scratch", "demo-shots");
  fs.mkdirSync(shotsDir, { recursive: true });

  const demo = {
    app,
    page,
    /** Saves a picture of the window as <shots>/<name>.png. */
    async shot(name, { fullPage = false } = {}) {
      await settle(page);
      const file = path.join(shotsDir, `${name}.png`);
      await page.screenshot({ path: file, fullPage });
      return file;
    },
    /** Changes settings the way the Settings screen does. */
    async settings(patch) {
      await page.evaluate((p) => window.edunexPlus.invoke("settings.update", p), patch);
      // Playwright pins the page to light; the app follows the theme through prefers-color-scheme.
      if (patch.theme) await page.emulateMedia({ colorScheme: patch.theme === "system" ? null : patch.theme });
      await settle(page);
    },
    /** Runs a function on the pretend world in the main process (post a Task, go offline, ...). */
    world(fn, arg) {
      return app.evaluate(
        (_electron, [source, value]) => {
          const world = globalThis.__edunexPlusDemoWorld;
          return new Function("world", "arg", `return (${source})(world, arg)`)(world, value);
        },
        [fn.toString(), arg],
      );
    },
    /** The window's visible text, for quick checks. */
    text: () => page.evaluate(() => document.body.innerText),
    async close() {
      const video = page.video();
      await app.close();
      return video ? await video.path() : null;
    },
  };
  if (options.theme || options.lang)
    await demo.settings({ ...(options.theme ? { theme: options.theme } : {}), ...(options.lang ? { lang: options.lang } : {}) });
  return demo;
}

/** Waits until fonts are in and two frames have been painted. */
export async function settle(page, ms = 250) {
  await page.evaluate(() => document.fonts?.ready).catch(() => undefined);
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  await page.waitForTimeout(ms);
}
