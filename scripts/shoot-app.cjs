// Development tool: opens the real built app (npm run build first) and saves
// screenshots of its window in each state. Runs on the development profile.
//
//   electron scripts/shoot-app.cjs <out-dir>                 welcome screen (signed out)
//   SHOOT_STEPS=home electron scripts/shoot-app.cjs <out-dir> signed-in screens
//   electron scripts/shoot-app.cjs --seed <auth.json>        stores a saved EduNex session
//                                                            (the website's localStorage.auth)
//                                                            in the development vault, then exits
const { app, safeStorage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const args = process.argv.slice(2).filter((a) => !a.startsWith("--inspect"));

if (args[0] === "--seed") {
  app.setName("Edunex Plus Dev");
  app.setPath("userData", path.join(app.getPath("appData"), "Edunex Plus Dev"));
  app.whenReady().then(async () => {
    const auth = JSON.parse(fs.readFileSync(path.resolve(args[1]), "utf8"));
    const encrypted = await safeStorage.encryptStringAsync(JSON.stringify({ token: auth.accessToken, savedAt: Date.now() }));
    const dir = path.join(app.getPath("userData"), "v2", "vault");
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(dir, "edunex.session.bin"), encrypted.toString("base64"), { mode: 0o600 });
    console.log("seeded the development vault");
    app.exit(0);
  });
} else {
  const out = path.resolve(args[0] ?? "shots");
  const steps = process.env.SHOOT_STEPS ?? "welcome";
  fs.mkdirSync(out, { recursive: true });
  let count = 0;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const run = (win, js) => win.webContents.executeJavaScript(js, true);
  const waitFor = async (win, js, ms = 20_000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await run(win, js).catch(() => false)) return;
      await sleep(250);
    }
    console.log("[page] url:", win.webContents.getURL());
    console.log("[page] body:", (await run(win, "document.body.innerHTML").catch((e) => String(e))).slice(0, 400));
    throw new Error(`timed out waiting for: ${js}`);
  };
  const shot = async (win, name) => {
    await sleep(1_200);
    const image = await win.webContents.capturePage();
    const file = path.join(out, `${String(++count).padStart(2, "0")}-${name}.png`);
    fs.writeFileSync(file, image.toPNG());
    console.log("saved", file);
  };
  const settings = (win, patch) => run(win, `window.edunexPlus.invoke("settings.update", ${JSON.stringify(patch)})`);
  const escape = (win) => run(win, `document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))`);

  async function script(win) {
    await waitFor(win, `document.querySelector("#root")?.children.length > 0`);
    await settings(win, { theme: "light", lang: "id" });
    if (steps === "signin") {
      // From the signed-in shell, sign out of everything first.
      if (await run(win, `!!document.querySelector("aside")`)) {
        await run(win, `document.querySelector("aside > div:last-child button").click()`);
        await waitFor(win, `!!document.querySelector("[role=dialog]")`);
        await run(win, `[...document.querySelectorAll("[role=dialog] button")].filter((b) => b.textContent === "Keluar").at(-1).click()`);
        await waitFor(win, `!!document.querySelector("[role=alertdialog]")`);
        await shot(win, "sign-out-confirm");
        await run(win, `[...document.querySelectorAll("[role=alertdialog] button")].find((b) => b.textContent === "Keluar").click()`);
        await waitFor(win, `document.body.textContent.includes("Selamat datang")`);
      }
      await run(win, `[...document.querySelectorAll("button")].find((b) => b.textContent.includes("Hubungkan")).click()`);
      const end = Date.now() + 20_000;
      while (windows.length < 2 && Date.now() < end) await sleep(200);
      const signIn = windows[1];
      if (!signIn) throw new Error("no sign-in window opened");
      while (Date.now() < end && !/login\.(microsoftonline|microsoft|live)\.com/.test(signIn.webContents.getURL())) await sleep(250);
      console.log("[sign-in] at", new URL(signIn.webContents.getURL()).host);
      await sleep(2_500);
      await shot(signIn, "signin-window");
      await shot(win, "welcome-waiting");
      signIn.close();
      await waitFor(win, `![...document.querySelectorAll("button")].find((b) => b.textContent.includes("Hubungkan")).disabled`);
      await shot(win, "welcome-after-closing-sign-in");
    } else if (steps === "welcome") {
      await shot(win, "welcome-light-id");
      await settings(win, { theme: "dark" });
      await shot(win, "welcome-dark-id");
      await settings(win, { lang: "en" });
      await shot(win, "welcome-dark-en");
    } else {
      await waitFor(win, `document.querySelectorAll("main ul li").length > 0`, 30_000);
      await shot(win, "home-light-id");
      await run(win, `document.querySelector("aside > div:last-child button").click()`);
      await waitFor(win, `!!document.querySelector("[role=dialog]")`);
      await shot(win, "settings-light-id");
      await escape(win);
      await settings(win, { theme: "dark" });
      await shot(win, "home-dark-id");
      await settings(win, { lang: "en" });
      await shot(win, "home-dark-en");
      await run(win, `document.querySelector("aside > div:last-child button").click()`);
      await waitFor(win, `!!document.querySelector("[role=dialog]")`);
      await shot(win, "settings-dark-en");
      await escape(win);
    }
    await settings(win, { theme: "system", lang: "id" });
    app.exit(0);
  }

  const windows = [];
  app.on("browser-window-created", (_event, win) => {
    windows.push(win);
    if (windows.length > 1) return;
    win.webContents.on("console-message", (event) => console.log(`[page:${event.level}]`, event.message));
    win.webContents.on("did-fail-load", (_e, code, description, url) => console.log("[page] failed to load", code, description, url));
    win.webContents.on("preload-error", (_e, file, error) => console.log("[page] preload error", file, error));
    win.once("show", () =>
      void script(win).catch((error) => {
        console.error(error);
        app.exit(1);
      }),
    );
  });
  require("../dist/desktop/main.cjs");
}
