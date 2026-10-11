// Development tool: opens the real built app (npm run build first) and saves
// screenshots of its window in each state. Runs on the development profile.
//
//   electron scripts/shoot-app.cjs <out-dir>                 welcome screen (signed out)
//   SHOOT_STEPS=home electron scripts/shoot-app.cjs <out-dir> signed-in screens
//   electron scripts/shoot-app.cjs --seed <auth.json>        stores a saved Edunex session
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
    // Ask for a fresh frame first: right after a theme switch, the capture can hand back the previous one.
    win.webContents.invalidate();
    await Promise.race([run(win, "new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))"), sleep(2_000)]).catch(() => {});
    const image = await win.webContents.capturePage();
    const file = path.join(out, `${String(++count).padStart(2, "0")}-${name}.png`);
    fs.writeFileSync(file, image.toPNG());
    console.log("saved", file);
  };
  const settings = (win, patch) => run(win, `window.edunexPlus.invoke("settings.update", ${JSON.stringify(patch)})`);
  const escape = (win) => run(win, `document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))`);

  async function script(win) {
    // Keep painting while other windows cover this one.
    win.webContents.setBackgroundThrottling(false);
    await waitFor(win, `document.querySelector("#root")?.children.length > 0`);
    await settings(win, { theme: "light", lang: "id" });
    if (steps === "tour") {
      // Every screen and every tab, as a Student would click through them.
      // Sidebar entries first; their text can end in a count ("Tugas & Ujian5").
      const click = (label) =>
        run(win, `(() => { const all = [...document.querySelectorAll("aside button, aside a"), ...document.querySelectorAll("button, [role=tab], a")]; const el = all.find((e) => e.textContent.trim() === ${JSON.stringify(label)} || e.getAttribute("aria-label") === ${JSON.stringify(label)}) ?? all.find((e) => e.closest("aside") && e.textContent.trim().startsWith(${JSON.stringify(label)})); if (!el) return false; el.click(); return true; })()`);
      const tabs = () => run(win, `[...document.querySelectorAll("main [role=tab]")].map((t) => t.textContent.trim())`);
      // Radix tabs switch on mousedown (left button), not on click.
      const clickTab = (i) => run(win, `(() => { const tab = document.querySelectorAll("main [role=tab]")[${i}]; tab.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 })); tab.click(); })()`);
      const shotTabs = async (name) => {
        const labels = await tabs();
        if (!labels.length) return shot(win, name);
        for (let i = 0; i < labels.length; i++) {
          await clickTab(i);
          await shot(win, `${name}-${i + 1}-${labels[i].toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);
        }
      };
      await waitFor(win, `!!document.querySelector("aside")`, 30_000);
      await sleep(4_000);
      // The first-run scan opens by itself once: keep a picture of it, then close it.
      if (await run(win, `!!document.querySelector("[role=dialog]")`)) {
        await shot(win, "first-scan");
        await escape(win);
        await sleep(500);
      }
      await shot(win, "home");
      for (const [label, name] of [["Tugas & Ujian", "tasks"], ["Jadwal", "schedule"], ["Presensi", "presence"], ["Nilai", "grades"], ["Rencana studi", "plan"]]) {
        if (!(await click(label))) {
          console.log("[tour] no", label);
          continue;
        }
        await shotTabs(name);
        if (name === "tasks") {
          // A Task's page: the exams listed above the Tasks open their own page.
          const opened = await run(win, `(() => { const row = document.querySelector("main section:not([aria-label=Ujian]):not([aria-label=Exams]) li button, main [data-task]"); if (!row) return false; row.click(); return true; })()`);
          if (opened) await shot(win, "task-page");
        }
      }
      const codes = await run(win, `[...document.querySelectorAll("aside ul button")].map((b) => b.textContent.trim().slice(0, 6))`);
      for (const code of codes.slice(0, 2)) {
        await run(win, `[...document.querySelectorAll("aside ul button")].find((b) => b.textContent.trim().startsWith(${JSON.stringify(code)}))?.click()`);
        await shotTabs(`course-${code}`);
      }
      await settings(win, { theme: "dark" });
      await click("Beranda");
      await shot(win, "home-dark");
      if (codes[0]) {
        await run(win, `[...document.querySelectorAll("aside ul button")].find((b) => b.textContent.trim().startsWith(${JSON.stringify(codes[0])}))?.click()`);
        await shot(win, "course-dark");
      }
    } else if (steps === "signin") {
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
