// The scoreboard for "same data": every item the desktop shows, for the demo's
// made-up Student and each scenario of the pretend Edunex, SIX and ITB, as
// mobile/flows/expected/<scenario>.json. It drives the real desktop demo the way
// scripts/demo/capture.mjs does, visits every screen and its key states, reads
// what each shows (./inventory-harvest.mjs) and keeps, per item a Student would
// look for, the short texts that must all be visible on the phone too
// (./inventory-tokens.mjs). Then it checks the screens against the datasets the
// demo's engine saved, and lists what no screen shows (README.md there).
//
//   npm run demo:build && node mobile/scripts/inventory.mjs [scenario ...] [--jobs 3]
//
// Only the demo's made-up data and the scrubbed recordings in test/fixtures ever appear.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { launchDemo, settle } from "../../scripts/demo/drive.mjs";
import { harvest } from "./inventory-harvest.mjs";
import { loadStrings, makeTokenizer, norm, strong } from "./inventory-tokens.mjs";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const OUT = path.join(ROOT, "mobile", "flows", "expected");

/** Each scenario: the demo it launches (scripts/demo/setup.ts) and the EDUNEX_DEMO_* it sets. */
export const SCENARIOS = [
  { name: "signed-in", about: "Both systems connected, synced, on the recorded Thursday morning (8 Oct 2026, 08:07 WIB)" },
  { name: "edunex-only", demo: "edunex-only", about: "Edunex connected, SIX not" },
  { name: "first-run", demo: "first-run", about: "Nobody signed in: the welcome screen, signing in, the first scan's summary" },
  { name: "check-in-open", env: { EDUNEX_DEMO_CHECK_IN: "open" }, about: "SIX's Tandai Hadir shows in the morning's PL3002 class" },
  { name: "quiz", env: { EDUNEX_DEMO_QUIZ: "1" }, about: "DK4073 has an Edunex quiz open 19–30 Oct" },
  { name: "after-class-counted", env: { EDUNEX_DEMO_AFTER_CLASS: "counted" }, about: "16:05: SIX counted PL3002's and DK4073's classes" },
  { name: "after-class-absent", env: { EDUNEX_DEMO_AFTER_CLASS: "absent" }, about: "16:05: SIX marked DK4073's 11:00 class absent" },
  { name: "after-class-missing", env: { EDUNEX_DEMO_AFTER_CLASS: "missing" }, about: "16:05: SIX hasn't counted DK4073's 11:00 class" },
  { name: "sick", env: { EDUNEX_DEMO_SICK: "1" }, about: "SIX writes DK4073's attendance with sick days (two percentages)" },
  { name: "odd", env: { EDUNEX_DEMO_ODD: "1" }, about: "SIX writes this term's UKT payment and FI1101's grade another way" },
  { name: "course-table-changed", env: { EDUNEX_DEMO_COURSE_TABLE: "changed" }, about: "SIX's course table can't be read after the first sync" },
  { name: "course-table-lost", env: { EDUNEX_DEMO_COURSE_TABLE: "lost" }, about: "SIX writes KU5014's code another way, so its row is lost" },
  { name: "course-table-blank", env: { EDUNEX_DEMO_COURSE_TABLE: "blank" }, about: "SIX's course table has no attendance column" },
  { name: "timetable-unread", env: { EDUNEX_DEMO_TIMETABLE: "unread" }, about: "SIX writes the time of DK4073's Thursday class with dots" },
  { name: "edit", env: { EDUNEX_DEMO_EDIT: "1" }, about: "The lecturer revised Tugas 01 Bab I after the first sync" },
];

const SEARCHES = ["bab 2", "PL3002", "UTS", "inovasi"];

// ---------------------------------------------------------------- walking the demo

/** One scenario: launches the demo, walks every screen, returns what each showed and the engine's datasets. */
async function capture(scenario) {
  const env = scenario.env ?? {};
  // launchDemo copies process.env before its first await, so these reach only this scenario's demo.
  const saved = { ...process.env };
  Object.assign(process.env, env, { TZ: "Asia/Jakarta" });
  const launching = launchDemo({ scenario: scenario.demo ?? "signed-in", shots: path.join(ROOT, ".scratch", "inventory", scenario.name) });
  for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
  Object.assign(process.env, saved);
  const demo = await launching;
  const { page } = demo;
  page.setDefaultTimeout(8_000);
  const captures = [];
  const missed = [];
  const log = (...args) => console.log(`[${scenario.name}]`, ...args);

  const attempt = async (what, fn) => {
    try {
      await fn();
    } catch (error) {
      missed.push({ what, why: String(error).split("\n")[0] });
      log(`! ${what}: ${String(error).split("\n")[0]}`);
      await page.keyboard.press("Escape").catch(() => {});
    }
  };
  /** Opens every fold in `root` (a module's notes, a past semester), a few rounds for folds inside folds. */
  const unfold = async (root) => {
    for (let round = 0; round < 4; round++) {
      const folds = page.locator(`${root} button[aria-expanded=false][aria-controls]:not([aria-haspopup])`);
      const count = await folds.count();
      if (!count) return;
      for (let i = count - 1; i >= 0; i--)
        await folds
          .nth(i)
          .click({ timeout: 2_000 })
          .catch(() => {});
      await settle(page, 300);
    }
  };
  /** Reads `root` as `screen` in `state`; `about` says how the walk got there (the list a Task is on, a class's name). */
  const read = async (screen, state, root = "main", { exclude, fold = true, about } = {}) => {
    if (fold) await unfold(root);
    const result = await page.evaluate(harvest, { root, exclude });
    if (!result) throw new Error(`nothing at ${root}`);
    captures.push({ screen, state: state ?? null, about, ...result });
  };
  const nav = async (label) => {
    await page.keyboard.press("Escape").catch(() => {});
    await page
      .locator("aside nav button")
      .filter({ hasText: new RegExp(`^${label}`) })
      .first()
      .click();
    await settle(page, 500);
  };
  const dialog = "[role=dialog]";
  /** Settings' "Ringkasan saat pertama terhubung": what the first read of Edunex and SIX found. */
  const openFirstScan = async () => {
    await page.keyboard.press("Escape").catch(() => {});
    await page.locator("aside > div:last-child button").first().click();
    await settle(page, 400);
    await page.getByRole("button", { name: /^Lihat: Ringkasan saat pertama terhubung/ }).click();
    await page.getByRole("dialog", { name: "Ringkasan saat pertama terhubung" }).waitFor();
    await settle(page, 600);
  };

  await page.waitForTimeout(1500);
  const snapshot = await page.evaluate(() => window.edunexPlus.invoke("app.snapshot", {}));

  if (scenario.demo === "first-run") {
    // The welcome plays its opening (no data in it), then "Mulai" leads to the sign-in step.
    await attempt("welcome", async () => {
      const start = page.getByRole("button", { name: "Mulai" });
      await start.waitFor({ timeout: 60_000 });
      await start.click();
    });
    await attempt("sign in", async () => {
      await page.getByRole("button", { name: "Hubungkan Edunex" }).click({ timeout: 30_000 });
      await page.waitForFunction(() => /\d{8}/.test(document.body.innerText), null, { timeout: 30_000 });
      await page.waitForFunction(() => /Teknik Informasi|Teknologi Informasi/.test(document.body.innerText), null, { timeout: 90_000 });
      await settle(page, 400);
      await read("welcome", "connected", "#root");
      await page.getByRole("button", { name: /^Lanjut/ }).click();
    });
    // "Semua siap" (with what was read) comes once the first read is done: SIX at a page every two seconds and
    // ITB's catalog at one every 3.5 s, minutes in real time, so the pretend clock runs ahead until it shows.
    await attempt("ready", async () => {
      const open = page.getByRole("button", { name: "Buka Edunex Plus" });
      for (let i = 0; i < 40 && !(await open.count()); i++) {
        await demo.world(async (world) => {
          for (let s = 0; s < 30; s++) await world.clock.advance(1_000);
        });
        await page.waitForTimeout(300);
      }
      await settle(page, 1_500);
      await read("welcome", "ready", "#root", { fold: false });
      await open.click();
    });
    await attempt("first scan", async () => {
      const summary = page.getByRole("dialog", { name: "Ringkasan saat pertama terhubung" });
      await summary.waitFor({ timeout: 30_000 }).catch(() => {});
      if (!(await summary.count())) await openFirstScan();
      await settle(page, 600);
      await read("first-scan", null, dialog, { fold: false });
    });
    const after = await page.evaluate(() => window.edunexPlus.invoke("app.snapshot", {}));
    await demo.close();
    return { captures, missed, snapshot: after.value ?? after };
  }

  await attempt("beranda", () => read("home", null));
  await attempt("courses", () => read("courses", null, "aside", { exclude: "aside nav", fold: false }));
  await attempt("what changed", async () => {
    const all = page.locator("main section[aria-labelledby=home-changes] button", { hasText: /^Lihat semua$/ });
    if (!(await all.count())) return;
    await all.first().click();
    await settle(page, 500);
    await read("changes", null, (await page.locator(dialog).count()) ? dialog : "main");
    await page.keyboard.press("Escape");
  });

  // Tugas & Ujian: both lists, then each Task and exam on them (a row's id names it when it has one).
  const rowButtons = "main li > button:not([aria-controls])";
  const items = [];
  for (const [show, label] of [
    ["todo", /^Belum selesai/],
    ["done", /^Selesai/],
  ]) {
    await attempt(`tasks ${show}`, async () => {
      await nav("Tugas & Ujian");
      await page.getByRole("radio", { name: label }).first().click();
      await settle(page, 400);
      await read("tasks", show);
      const rows = await page.locator(rowButtons).evaluateAll((all) => all.map((b) => ({ id: b.id || null, title: b.innerText })));
      for (const [index, row] of rows.entries()) items.push({ ...row, index, show, label });
    });
  }
  for (const { id, title, index, show, label } of items) {
    await attempt(`detail ${id ?? title}`, async () => {
      await nav("Tugas & Ujian");
      await page.getByRole("radio", { name: label }).first().click();
      await settle(page, 300);
      await unfold("main");
      await page.locator(rowButtons).nth(index).click();
      await settle(page, 600);
      const task = await page.locator("main #task-instructions, main #task-files").count();
      // A done Task's row has no id: its title finds it in Edunex's list.
      const known = (snapshot.value ?? snapshot).datasets?.find((d) => d.name === "edunex.tasks")?.value?.find((t) => norm(title).startsWith(norm(t.title)));
      const key = /^(?:todo|done)-(?:task|exam):(.+)$/.exec(id ?? "")?.[1] ?? (known ? String(known.id) : `${show}-${slug(title).slice(0, 40)}`);
      await read(task ? "task" : "exam", key, "main", { fold: !task, about: { list: show, title: norm(title) } });
    });
  }

  // Jadwal: this week, each class's detail, next week, the month.
  await attempt("schedule", async () => {
    await nav("Jadwal");
    await read("schedule", "week");
    const classes = await page.locator("main [role=grid] button, main [data-time-grid] button").count();
    const blocks = classes
      ? page.locator("main [role=grid] button, main [data-time-grid] button")
      : page.locator("main button").filter({ hasText: /[A-Z]{2}\d{4}/ });
    const count = await blocks.count();
    for (let i = 0; i < count; i++) {
      await attempt(`class ${i}`, async () => {
        const name = norm((await blocks.nth(i).innerText()).split("\n").join(" "));
        await blocks.nth(i).click();
        await settle(page, 400);
        if (!(await page.locator(dialog).count())) return;
        // Named by its first course and start ("pl3002-08-00"): a block in a clash names both courses.
        const [, start] = /(\d{2}:\d{2})/.exec(name) ?? [];
        const [course] = /[A-Z]{2}\d{4}/.exec(name) ?? [`${i + 1}`];
        await read("class", slug(`${course} ${start ?? ""}`), dialog, { fold: false, about: { title: name } });
        await page.keyboard.press("Escape");
        await settle(page, 200);
      });
    }
    await page
      .getByRole("button", { name: /Minggu berikutnya|Berikutnya/ })
      .first()
      .click();
    await settle(page, 400);
    await read("schedule", "next-week");
    await page.getByRole("radio", { name: "Bulan" }).first().click();
    await settle(page, 400);
    await read("schedule", "month");
    await page.getByRole("radio", { name: "Minggu" }).first().click();
  });

  await attempt("presence", async () => {
    await nav("Presensi");
    await read("presence", null);
  });
  await attempt("grades", async () => {
    await nav("Nilai");
    const transcript = 'main ul[aria-label="Transkrip"]';
    await read("grades", null, "main", { exclude: transcript });
    // The transcript opens one semester at a time.
    const terms = page.locator(`${transcript} > li > button`);
    const count = await terms.count();
    for (let i = 0; i < count; i++) {
      await attempt(`transcript ${i + 1}`, async () => {
        if ((await terms.nth(i).getAttribute("aria-expanded")) !== "true") await terms.nth(i).click();
        await settle(page, 300);
        const name = norm(await terms.nth(i).innerText())
          .split(" ")
          .slice(0, 2)
          .join(" ");
        await read("grades", `transcript/${slug(name)}`, `${transcript} > li:nth-child(${i + 1})`, { fold: false });
      });
    }
  });
  await attempt("plan", async () => {
    await nav("Rencana studi");
    const tabs = page.locator("main [role=tab]");
    const names = await tabs.allInnerTexts();
    for (const [i, name] of names.entries()) {
      await attempt(`plan ${name}`, async () => {
        await tabs.nth(i).click();
        await settle(page, 500);
        await read("plan", slug(name), "main [role=tabpanel][data-state=active]");
      });
    }
  });

  // Every course page: its header, then each tab, and on Modul each module.
  const codes = await page.evaluate(() =>
    [...document.querySelectorAll("aside button")].map((b) => /^[A-Z]{2}\d{4}/.exec(b.innerText.trim())?.[0]).filter(Boolean),
  );
  for (const code of [...new Set(codes)]) {
    await attempt(`course ${code}`, async () => {
      await page.keyboard.press("Escape").catch(() => {});
      await page.locator("aside button", { hasText: code }).first().click();
      await settle(page, 600);
      await read("course", code, "main", { exclude: "[role=tabpanel]" });
      const panel = "main [role=tabpanel][data-state=active]";
      const tabs = await page.locator("main [role=tab]").evaluateAll((all) => all.map((t) => t.dataset.highlight ?? t.textContent));
      for (const tab of tabs) {
        await attempt(`course ${code} ${tab}`, async () => {
          await page.locator(`main [role=tab][data-highlight="${tab}"]`).click();
          await settle(page, 500);
          if (tab !== "modules") return void (await read("course", `${code}/${tab}`, panel));
          await read("course", `${code}/modules`, `${panel} nav[aria-label="Daftar isi"]`, { fold: false });
          const modules = page.locator(`${panel} nav[aria-label="Daftar isi"] li button`);
          const count = await modules.count();
          for (let i = 0; i < count; i++) {
            // Named by the module ("modul-4"; "pengantar" for the course-wide notes before Modul 1).
            const title = (await modules.nth(i).locator("[title]").first().getAttribute("title")) ?? (await modules.nth(i).innerText());
            await modules.nth(i).click();
            await settle(page, 400);
            await read("course", `${code}/modules/${slug(title.split(" · ")[0])}`, panel, { exclude: 'nav[aria-label="Daftar isi"]' });
          }
        });
      }
    });
  }

  for (const query of SEARCHES) {
    await attempt(`search ${query}`, async () => {
      await nav("Beranda");
      await page.keyboard.press("ControlOrMeta+K");
      await page.keyboard.type(query, { delay: 20 });
      await settle(page, 600);
      await read("search", query, dialog, { fold: false, exclude: "input" });
      await page.keyboard.press("Escape");
    });
  }
  await attempt("alerts", async () => {
    await page.locator("header button[aria-label^='Notifikasi']").first().click();
    await settle(page, 500);
    await read("alerts", null, "[role=dialog], [data-radix-popper-content-wrapper]", { fold: false });
    await page.keyboard.press("Escape");
  });
  await attempt("settings", async () => {
    await page.locator("aside > div:last-child button").first().click();
    await settle(page, 500);
    await read("settings", null, dialog, { fold: false });
    await page.keyboard.press("Escape");
  });
  await attempt("first scan", async () => {
    await openFirstScan();
    await read("first-scan", null, dialog, { fold: false });
    await page.keyboard.press("Escape");
  });

  await demo.close();
  return { captures, missed, snapshot: snapshot.value ?? snapshot };
}

const slug = (text) =>
  norm(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

// ---------------------------------------------------------------- from pieces to entries

/** What kind of item an entry is, from where it is and what it says. */
function kindOf(screen, state, context, tokens, rowId) {
  const ctx = context ?? "";
  const all = tokens.join(" ");
  if (rowId?.startsWith("need-")) return "need";
  if (/(?:^|-)exam:/.test(rowId ?? "")) return "exam";
  if (/(?:^|-)task:/.test(rowId ?? "")) return "task";
  switch (screen) {
    case "home":
      if (/Perlu perhatian/.test(ctx)) return "need";
      if (/Yang berubah/.test(ctx)) return "change";
      if (/Mata kuliah/.test(ctx)) return "absence-budget";
      if (/Sekarang/.test(ctx)) return "now";
      if (/Hari ini|Besok|Lusa|^(Sen|Sel|Rab|Kam|Jum|Sab|Min)/.test(ctx)) return "class-session";
      return "banner";
    case "changes":
      return "change";
    case "courses":
      return /[A-Z]{2}\d{4}/.test(all) ? "course" : "account";
    case "tasks":
      if (/Masa (UTS|UAS)/.test(all)) return "exam-period";
      return /\b(UTS|UAS|Kuis)\b/.test(all) ? "exam" : "task";
    case "task":
    case "exam":
      return `${screen}-detail`;
    case "schedule":
    case "class":
      return "class-session";
    case "presence":
      return /[A-Z]{2}\d{4}/.test(all) ? "attendance" : "note";
    case "grades":
      if (/^Smt \d/.test(all) || /\bIPK?\b/.test(`${ctx} ${all}`)) return /[A-Z]{2}\d{4}/.test(all) ? "grade" : "ip";
      return /[A-Z]{2}\d{4}/.test(all) ? "grade" : "note";
    case "plan":
      if (state === "krs") return /[A-Z]{2}\d{4}/.test(all) ? "krs-row" : "krs";
      if (state === "ukt") return "bill";
      if (state === "kalender-akademik") return "academic-date";
      if (state === "kurikulum") return /[A-Z]{2}\d{4}/.test(all) ? "curriculum-course" : "curriculum";
      return /[A-Z]{2}\d{4}/.test(all) ? "planned-course" : "plan";
    case "course": {
      const tab = state?.split("/")[1];
      if (!tab) return "course";
      if (tab === "modules") return state.split("/").length === 2 ? "module" : "material";
      if (tab === "meetings") return "meeting";
      if (tab === "tasks") return /\b(UTS|UAS|Kuis)\b/.test(all) ? "exam" : "task";
      if (tab === "grades") return "grade";
      if (tab === "announcements") return "announcement";
      return tab;
    }
    case "search":
      return "search-result";
    case "alerts":
      return "alert";
    case "settings":
      return "setting";
    case "welcome":
      return "account";
    case "first-scan":
      return "first-scan";
    default:
      return "item";
  }
}

/** Entries of one screen state: one per row (list item, table row), one per box of loose text. */
function entriesOf(capture, tokenizer) {
  const groups = new Map();
  for (const piece of capture.pieces) {
    const key = piece.row !== undefined ? `row:${piece.row}` : `box:${piece.box}`;
    if (!groups.has(key)) {
      const row = piece.row !== undefined ? capture.rows[piece.row] : null;
      groups.set(key, { row, context: row ? row.context : piece.context, pieces: [] });
    }
    groups.get(key).pieces.push(piece);
  }
  const out = [];
  for (const group of groups.values()) {
    const tokens = [];
    let banner = false;
    let label = null;
    let dataful = false;
    // A count drawn apart from its word ("5" over "mata kuliah") reads as one: "5 mata kuliah".
    const pieces = [];
    for (const piece of group.pieces) {
      const last = pieces.at(-1);
      if (last && /^\d{1,3}$/.test(last.text) && /^\p{Ll}[\p{L} ]{0,20}$/u.test(piece.text))
        pieces[pieces.length - 1] = { ...last, text: `${last.text} ${piece.text}` };
      else pieces.push(piece);
    }
    for (const piece of pieces) {
      const { tokens: found, fixed } = tokenizer.read(piece.text);
      if (!found.length) continue;
      if (fixed) {
        // The app's own words: a heading or a button's caption is chrome; a short state inside a row
        // ("Belum dikerjakan", "Jatah absen habis") is a fact about that row.
        if (piece.heading || piece.caption || found[0].length > 48) continue;
        if (!group.row && !piece.banner) continue;
      } else dataful = true;
      if (piece.banner) banner = true;
      if (!label && (piece.titled || piece.heading) && !fixed) label = found[0];
      tokens.push(...found);
    }
    if (!dataful && !banner) continue;
    // A row of only the app's words and bare letters ("A ≥", "%") is a form, not an item.
    if (!banner && !tokens.some(strong)) continue;
    const unique = [...new Set(tokens)];
    // A token inside a longer one is already looked for.
    const kept = unique.filter((t) => !unique.some((other) => other !== t && other.includes(t)));
    const kind = banner ? "banner" : kindOf(capture.screen, capture.state, group.context, kept, group.row?.id);
    // A change or alert ends with the time the app noticed it ("08:11"): that follows the run, not the data.
    if (kind === "change" || kind === "alert") {
      let last = kept.length - 1;
      while (last >= 0 && tokenizer.read(kept[last]).fixed) last--;
      if (last >= 0 && /^\d{2}:\d{2}$/.test(kept[last])) kept.splice(last, 1);
    }
    if (!kept.length) continue;
    out.push({
      screen: capture.screen,
      state: capture.state,
      kind,
      label: label ?? kept[0],
      context: group.context ?? undefined,
      rowId: group.row?.id ?? undefined,
      tokens: kept,
    });
  }
  return out;
}

/** Stable ids: screen, state and the entry's own name (its row's id when it has one). */
function withIds(entries) {
  const seen = new Map();
  return entries.map((entry) => {
    const base = [entry.screen, entry.state && slug(entry.state), entry.kind, entry.rowId ? slug(entry.rowId) : slug(entry.label)].filter(Boolean).join(".");
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const { rowId: _rowId, ...rest } = entry;
    return { id: n === 1 ? base : `${base}-${n}`, ...rest };
  });
}

// ---------------------------------------------------------------- what the datasets hold

const wib = (options) => new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", ...options });
const dayMonth = (ms) => wib({ day: "numeric", month: "short" }).format(ms).replace(".", "");
const time = (ms) => wib({ hour: "2-digit", minute: "2-digit", hour12: false }).format(ms).replace(".", ":");
const plain = (html) =>
  norm(
    String(html ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&"),
  );

/**
 * Facts the engine stored, each as the text a screen would show for it and where it would (a screen, or a
 * screen and state, as a pattern): a fact the walk read nowhere there is a gap, either a screen or state the
 * walk doesn't reach, or data the desktop keeps without showing.
 */
function datasetFacts(snapshot) {
  const facts = [];
  const add = (dataset, what, text, where = /./) => {
    const t = text === null || text === undefined ? null : norm(String(text));
    if (t && t.length >= 2) facts.push({ dataset, what, text: t, where });
  };
  const data = Object.fromEntries((snapshot.datasets ?? []).map((d) => [d.name, d.value]));
  const perCourse = (name, fn) => {
    for (const [code, list] of Object.entries(data[name] ?? {})) for (const item of Array.isArray(list) ? list : [list]) fn(item, code);
  };
  for (const c of data["edunex.courses"] ?? []) {
    add("edunex.courses", `${c.code}: code`, c.code, /^courses/);
    add("edunex.courses", `${c.code}: Edunex's name`, c.name);
  }
  for (const t of data["edunex.tasks"] ?? []) {
    add("edunex.tasks", `task ${t.id}: title`, t.title, /^(tasks|task|exam)\//);
    if (t.dueAt) add("edunex.tasks", `task ${t.id}: deadline`, dayMonth(t.dueAt), new RegExp(`^(task|exam)/.*${t.id}`));
  }
  perCourse("edunex.outline", (o, code) => {
    if (o?.lecturer) add("edunex.outline", `${code}: lecturer`, o.lecturer, new RegExp(`^course/${code}`));
    for (const m of o?.modules ?? []) add("edunex.outline", `${code}: module ${m.number}`, m.title, new RegExp(`^course/${code}/modules`));
  });
  perCourse("edunex.materials", (m, code) => add("edunex.materials", `${code}: ${m.type} ${m.id}`, m.title, new RegExp(`^course/${code}/modules/`)));
  perCourse("edunex.announcements", (a, code) =>
    add("edunex.announcements", `${code}: announcement ${a.id}`, plain(a.text).split("\n")[0].slice(0, 40), new RegExp(`^course/${code}/announcements`)),
  );
  perCourse("edunex.exams", (e, code) => add("edunex.exams", `${code}: exam ${e.id}`, e.name ?? e.attributes?.name, /^(tasks|exam|course)\//));
  perCourse("edunex.presence", (p, code) => {
    add("edunex.presence", `${code}: Presence ${p.id} day`, dayMonth(p.start), new RegExp(`^course/${code}/meetings`));
    if (p.topic) add("edunex.presence", `${code}: Presence ${p.id} topic`, p.topic, new RegExp(`^course/${code}/meetings`));
  });
  for (const n of data["edunex.notifications"] ?? []) add("edunex.notifications", `notification ${n.type} ${n.objectId}`, n.title);
  if (data["edunex.account"]) add("edunex.account", "name", data["edunex.account"].name);
  const student = data["six.student"];
  if (student) {
    add("six.student", "name", student.name, /^settings/);
    add("six.student", "NIM", student.nim, /^settings/);
    add("six.student", "program", student.program);
  }
  for (const c of data["six.courses"] ?? []) {
    add("six.courses", `${c.code}: name`, c.name, /^(courses|course\/)/);
    if (c.attendance) add("six.courses", `${c.code}: attendance`, `${c.attendance.attended} dari ${c.attendance.held}`, /^(presence|course\/)/);
  }
  for (const m of data["six.schedule"] ?? [])
    add(
      "six.schedule",
      `meeting ${m.id} (${m.courseCode}, ${dayMonth(m.start)})`,
      `${time(m.start)}–${time(m.end)}`,
      new RegExp(`^(schedule|class|course/${m.courseCode}/meetings)`),
    );
  const krs = data["six.krs"];
  if (krs) {
    add("six.krs", "advisor", krs.advisor, /^plan\/krs/);
    for (const c of krs.courses ?? []) add("six.krs", `KRS ${c.code}`, c.code, /^plan\/krs/);
  }
  for (const b of data["six.bills"] ?? []) add("six.bills", `bill ${b.term}`, `Rp${Number(b.amount).toLocaleString("id-ID")}`, /^plan\/ukt/);
  for (const term of data["six.transcript"]?.terms ?? [])
    for (const c of term.courses ?? []) {
      add("six.transcript", `${term.term} ${c.code}: code`, c.code, /^grades/);
      add("six.transcript", `${term.term} ${c.code}: SIX's name`, c.name, /^grades/);
    }
  const curriculum = data["six.curriculum"];
  for (const c of curriculum?.required ?? []) add("six.curriculum", `required ${c.code}`, c.code, /^plan\/kurikulum/);
  for (const spec of curriculum?.specializations ?? []) add("six.curriculum", `specialization`, spec.name, /^plan\//);
  for (const e of data["itb.calendar"]?.events ?? [])
    add("itb.calendar", `${e.firstDay} ${e.kind}: ${e.title}`, dayMonth(Date.parse(`${e.firstDay}T12:00:00+07:00`)), /^plan\/kalender/);
  for (const m of data["itb.catalog"]?.minors ?? []) add("itb.catalog", `minor ${m.id}`, m.name.replace(/^Minor /, ""), /^plan\//);
  return facts;
}

/** Facts the walk read nowhere they'd show. */
function gaps(facts, captures) {
  const texts = captures.map((c) => ({
    where: `${c.screen}/${c.state ?? ""}`,
    text: norm(c.pieces.map((p) => p.text).join(" \n ")).toLowerCase(),
  }));
  return facts.filter((f) => !texts.some((t) => f.where.test(t.where) && t.text.includes(f.text.toLowerCase())));
}

/** Per dataset: how many of its facts some screen shows. */
function coverage(facts, missing) {
  const out = {};
  for (const f of facts) (out[f.dataset] ??= { facts: 0, shown: 0 }).facts++;
  for (const f of facts) if (!missing.includes(f)) out[f.dataset].shown++;
  return out;
}

// ---------------------------------------------------------------- README

// What the walk reads but can't turn into entries, or doesn't read: said once in the README.
const NOT_CAPTURED = [
  "Charts (Nilai's and Rencana studi's IP/IPK lines) are drawn as pictures; the same numbers are in their tables, which are captured (`ip` entries).",
  "Files opened in the app's viewers (PDF, Word, Excel, PowerPoint) and their highlights and notes: the phone opens them in other apps (PROGRESS.md A13, A14).",
  "Menus and pickers that only open on a click: Ingatkan nanti (snooze), course colors, the attendance target, the grade calculator's inputs (only filled values are read).",
  "Toasts, OS notifications and the tray menu: they come and go with events, not with a screen (A3, D1).",
  'The week grid\'s day headers and empty days ("Kosong"), and counts on tabs and badges: layout, not items.',
  'Relative times ("dalam 7 hari", "baru saja", the greeting): they move with the clock, so no token holds them.',
  "English: every scenario is read in Bahasa Indonesia, as the demo starts.",
  "first-run reads only the welcome (connected, ready) and the first-scan summary; the screens after it are the signed-in scenario's.",
];

// Why the datasets hold what no screen shows (read from the lists above; checked by hand).
const GAP_NOTES = [
  "Why, as far as the screens go:",
  "",
  "- edunex.courses: Edunex names courses in English; every screen uses SIX's Indonesian name (the code matches).",
  "- edunex.notifications: Edunex's own notification list isn't a screen; the alert history shows the app's alerts, and",
  "  most notification titles show as materials or Tasks. The two left name content that isn't in Edunex's materials or",
  "  Tasks any more (renamed or taken down), so nothing shows them.",
  "- six.bills: terms not billed yet (no amount) show no amount: short terms aren't listed, next term shows its due date.",
  "- sick: the screens are the same as signed-in, as they should be: the app reads SIX's first percentage (meetings",
  "  attended) and leaves the one with sick days.",
  "- itb.calendar: Kalender akademik shows this term's dates a Student acts on (UTS, UAS, questionnaire, grade",
  "  deadlines), not the whole public feed of the year.",
  "- itb.catalog: Rencana studi shows the minors closest to done, not the catalog's every minor.",
  "- first-run: only the welcome and the summary are read, so nearly every fact counts as not shown there.",
];

/** mobile/flows/expected/README.md, from every inventory there. */
export function writeReadme() {
  const all = fs
    .readdirSync(OUT)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8")))
    .sort((a, b) => SCENARIOS.findIndex((s) => s.name === a.scenario) - SCENARIOS.findIndex((s) => s.name === b.scenario));
  const screens = [...new Set(all.flatMap((f) => f.entries.map((e) => e.screen)))];
  const count = (f, screen) => f.entries.filter((e) => e.screen === screen).length;
  const out = [
    "# What the desktop shows: the inventory",
    "",
    "Generated by `mobile/scripts/inventory.mjs`: don't edit by hand. One file per scenario of the desktop demo",
    "(`scripts/demo/setup.ts`), each entry an item a Student would look for: its `id`, the `screen` and `state` it's on,",
    "its `kind`, and `tokens`, the short texts that must all be visible on the phone for it to count as found (titles,",
    "codes, rooms, percentages, counts, dates and times as `src/core/format` writes them; no wording around them).",
    "",
    "## Regenerate",
    "",
    "```sh",
    "npm ci && npm run demo:build",
    "node mobile/scripts/inventory.mjs                 # every scenario, 3 demos at a time (about 10 minutes)",
    "node mobile/scripts/inventory.mjs signed-in quiz  # some scenarios (this README is rewritten from all files)",
    "node mobile/scripts/flows-from-inventory.mjs      # the Maestro flows in mobile/flows/data",
    "```",
    "",
    "Then on the phone: `maestro test --debug-output .scratch/maestro --format junit --output .scratch/maestro/report.xml",
    "mobile/flows/data/<scenario>` and `node mobile/scripts/flows-from-inventory-report.mjs .scratch/maestro [--missing]`",
    'prints "found N of M" per scenario and per screen. How each screen is reached: `mobile/flows/screens.json`.',
    "",
    "## Scenarios",
    "",
    "| Scenario | What's different | Entries |",
    "| --- | --- | ---: |",
    ...all.map((f) => `| ${f.scenario} | ${f.about} | ${f.count} |`),
    "",
    "## Entries per screen",
    "",
    `| Screen | ${all.map((f) => f.scenario).join(" | ")} |`,
    `| --- | ${all.map(() => "---:").join(" | ")} |`,
    ...screens.map((screen) => `| ${screen} | ${all.map((f) => count(f, screen) || "").join(" | ")} |`),
    `| **all** | ${all.map((f) => `**${f.count}**`).join(" | ")} |`,
    "",
    "## Is it complete? The engine's datasets against the screens",
    "",
    "Each scenario also saves what the demo's engine stored (`app.snapshot`) and looks for each stored fact (a title, a",
    "code, a date, an amount, as a screen would write it) on the screens where it would show. `datasets` in each file",
    "counts them, `notShown` lists the ones no screen showed.",
    "",
    `| Dataset | ${all.map((f) => f.scenario).join(" | ")} |`,
    `| --- | ${all.map(() => "---:").join(" | ")} |`,
  ];
  const datasets = [...new Set(all.flatMap((f) => Object.keys(f.datasets ?? {})))];
  for (const d of datasets) out.push(`| ${d} | ${all.map((f) => (f.datasets?.[d] ? `${f.datasets[d].shown}/${f.datasets[d].facts}` : "")).join(" | ")} |`);
  // The gaps, once: what signed-in doesn't show, then what each other scenario adds.
  const base = all.find((f) => f.scenario === "signed-in");
  const key = (n) => `${n.dataset}|${n.what}|${n.text}`;
  const baseKeys = new Set((base?.notShown ?? []).map(key));
  const group = (list) => {
    const by = new Map();
    for (const n of list) by.set(n.dataset, [...(by.get(n.dataset) ?? []), n]);
    return [...by].flatMap(([dataset, items]) => [
      `- **${dataset}** (${items.length}): ${items
        .slice(0, 6)
        .map((n) => `${n.what} "${n.text}"`)
        .join("; ")}${items.length > 6 ? `; and ${items.length - 6} more` : ""}`,
    ]);
  };
  out.push("", "### Held but not shown", "");
  if (base) out.push("In signed-in:", "", ...group(base.notShown), "");
  for (const f of all) {
    if (f === base || f.scenario === "first-run") continue;
    const extra = f.notShown.filter((n) => !baseKeys.has(key(n)));
    if (extra.length) out.push(`Only in ${f.scenario}:`, "", ...group(extra), "");
  }
  out.push(...GAP_NOTES, "", "### Shown but not captured", "", ...NOT_CAPTURED.map((n) => `- ${n}`));
  const missed = all.flatMap((f) => f.notCaptured.map((m) => `- ${f.scenario}: ${m.what} (${m.why})`));
  out.push(
    "",
    missed.length ? "Steps of the last walk that failed:" : "Every step of the last walk read its screen.",
    ...(missed.length ? ["", ...missed] : []),
  );
  fs.writeFileSync(path.join(OUT, "README.md"), `${out.join("\n")}\n`);
}

// ---------------------------------------------------------------- run

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--readme")) return writeReadme();
  const jobsAt = args.indexOf("--jobs");
  const jobs = jobsAt >= 0 ? Number(args[jobsAt + 1]) : 3;
  const names = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--jobs");
  const picked = names.length ? SCENARIOS.filter((s) => names.includes(s.name)) : SCENARIOS;
  if (names.length && picked.length !== names.length) throw new Error(`Unknown scenario in ${names.join(", ")}`);
  const tokenizer = makeTokenizer(await loadStrings());
  fs.mkdirSync(OUT, { recursive: true });

  const queue = [...picked];
  const summaries = [];
  const worker = async () => {
    for (let scenario = queue.shift(); scenario; scenario = queue.shift()) {
      const started = Date.now();
      const { captures, missed, snapshot } = await capture(scenario);
      const entries = withIds(captures.flatMap((c) => entriesOf(c, tokenizer)));
      const facts = datasetFacts(snapshot);
      const missing = gaps(facts, captures);
      const file = {
        scenario: scenario.name,
        about: scenario.about,
        demo: { EDUNEX_DEMO: scenario.demo ?? "signed-in", ...(scenario.env ?? {}) },
        lang: "id",
        count: entries.length,
        // Every screen and state the walk read, in order, with how it got there: the flows visit them the same way.
        states: captures.map(({ screen, state, about }) => ({ screen, state, ...(about ?? {}) })),
        entries,
        datasets: coverage(facts, missing),
        notShown: missing.map(({ dataset, what, text }) => ({ dataset, what, text })),
        notCaptured: missed,
      };
      fs.writeFileSync(path.join(OUT, `${scenario.name}.json`), `${JSON.stringify(file, null, 2)}\n`);
      summaries.push(file);
      console.log(
        `[${scenario.name}] ${entries.length} entries, ${missing.length} facts not shown, ${missed.length} steps missed (${Math.round((Date.now() - started) / 1000)} s)`,
      );
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, jobs) }, worker));
  writeReadme();
  // Written the way the repository's formatter (biome) writes JSON, so `npm run check` stays green.
  execFileSync(path.join(ROOT, "node_modules", ".bin", "biome"), ["format", "--write", OUT], { cwd: ROOT, stdio: "ignore" });
}

if (import.meta.main ?? process.argv[1] === import.meta.filename) await main();
