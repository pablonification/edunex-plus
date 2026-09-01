// PROTOTYPE (throwaway) — Electron sync-architecture spike for wayfinder ticket #9.
// Proves, empirically, in Electron 44's main process:
//   1. A jittered tick loop in the MAIN process keeps its cadence while every
//      window is hidden — while a renderer timer visibly throttles (the
//      contrast that justifies "never poll from hidden renderers").
//   2. Snapshot diff on /todo detects a "new" Task id and fires an OS
//      notification exactly once; the seen-ledger survives a restart.
//   3. Presence-open scheduling: the next tick is event-aligned to a window's
//      presence_start and fires an OS notification when it opens (synthetic
//      window; mapping to the real endpoint is implementation work).
//   4. Backoff on failure, reset on success (SPIKE_FAIL_TICK=3 simulates one).
//   5. JSON snapshots persist across restarts and are served as the offline
//      baseline.
// Tokens: reuses the auth spike's verified persist:spike-edunex-auth partition
// (#11: persisted auth survives restart). API data is logged as counts, ids
// and field names only — never contents.
// Test-scale timings: 5s base tick ± 2s jitter, backoff cap 60s. The real app
// targets 90s ± 30s, cap ~15min (map issue #4 stance).
const { app, BrowserWindow, Notification, ipcMain, net } = require('electron');
const fs = require('fs');
const path = require('path');

const PARTITION = 'persist:spike-edunex-auth';
const EDUNEX = 'https://edunex.itb.ac.id';
const API = 'https://api-edunex.cognisia.id';
const SNAPDIR = path.join(__dirname, 'snapshots'); // PROTOTYPE scratch, gitignored
const UA = 'EduNexDesktop-SyncSpike/0 (prototype; contact: repo owner)';

const TICK_BASE_MS = 5000;
const TICK_JITTER_MS = 2000;
const BACKOFF_CAP_MS = 60000;
const SPIKE_FAIL_TICK = parseInt(process.env.SPIKE_FAIL_TICK || '0', 10); // e.g. 3
const AUTO_QUIT_MS = 75000;

let consoleWin = null;
let tokenWin = null;
let token = null;
let tickNo = 0;
let nextDelay = TICK_BASE_MS;
let running = false; // single-flight guard

const files = {
  prevTodo: path.join(SNAPDIR, 'prev-todo.json'),
  prevPresence: path.join(SNAPDIR, 'prev-presence.json'),
  seenTasks: path.join(SNAPDIR, 'seen-tasks.json'),
  seenPresence: path.join(SNAPDIR, 'seen-presence.json'),
};

function log(line) {
  const text = `[${new Date().toISOString().slice(11, 19)}] ${line}`;
  process.stdout.write(text + '\n');
  if (consoleWin && !consoleWin.isDestroyed()) {
    consoleWin.webContents.send('spike:log', text);
  }
}

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}
function writeJson(p, value) {
  fs.mkdirSync(SNAPDIR, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(value, null, 2));
}

// ---- token capture (partition reuse, per ticket #11) ------------------------

async function captureTokenFromPartition() {
  tokenWin = new BrowserWindow({
    show: false,
    webPreferences: { partition: PARTITION },
  });
  // The SPA navigates (and its dead auth0 code hard-fails) mid-load, so the
  // loadURL promise can reject — the page is still usable for localStorage.
  try { await tokenWin.loadURL(EDUNEX); } catch { /* expected: SPA redirects */ }
  for (let i = 0; i < 20; i++) {
    try {
      const raw = await tokenWin.webContents.executeJavaScript('localStorage.getItem("auth")', true);
      if (raw) {
        const auth = JSON.parse(raw);
        if (auth.accessToken) return auth.accessToken;
      }
    } catch { /* page mid-navigation */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  // Partition lost auth: fall back to the proven manual login loop (spike #5).
  log('no auth in partition — showing login window; log in with your INA account');
  tokenWin.show();
  for (let i = 0; i < 150; i++) {
    try {
      const url = tokenWin.webContents.getURL();
      if (url && url.startsWith(EDUNEX)) {
        const raw = await tokenWin.webContents.executeJavaScript('localStorage.getItem("auth")', true);
        if (raw) {
          const auth = JSON.parse(raw);
          if (auth.accessToken) return auth.accessToken;
        }
      }
    } catch { /* page mid-navigation */ }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

// ---- API + courtesy guardrails ----------------------------------------------

async function apiGet(p) {
  const started = Date.now();
  const res = await net.fetch(`${API}${p}`, {
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': UA },
  });
  const ms = Date.now() - started;
  let json = null;
  const text = await res.text();
  try { json = JSON.parse(text); } catch { /* html error page etc. */ }
  return { status: res.status, ms, json };
}

function shapeOf(json) {
  if (json === null || typeof json !== 'object') return String(typeof json);
  if (Array.isArray(json)) return `array[${json.length}]`;
  const parts = Object.entries(json).map(([k, v]) =>
    `${k}:${Array.isArray(v) ? `array[${v.length}]` : typeof v}`);
  return `{${parts.join(', ')}}`;
}

function fieldsOf(json) {
  const first = Array.isArray(json) ? json[0]
    : (json && typeof json === 'object' ? Object.values(json).find((v) => Array.isArray(v) && v.length && typeof v[0] === 'object')?.[0] : null);
  return first && typeof first === 'object' ? Object.keys(first).join(',') : '(none)';
}

// ---- the SyncService under proof ---------------------------------------------

function taskIdsOf(todoJson) {
  const tasks = todoJson && Array.isArray(todoJson.tasks) ? todoJson.tasks : [];
  return tasks.map((t) => String(t && t.id)).filter((id) => id && id !== 'undefined');
}

function windowsOf() {
  const prev = readJson(files.prevPresence, { windows: [] });
  return Array.isArray(prev.windows) ? prev.windows : [];
}

function fireOsNotification(title, body) {
  if (!Notification.isSupported()) {
    log(`OS notification NOT SUPPORTED on this platform — would have shown: "${title}" / "${body}"`);
    return;
  }
  new Notification({ title, body, silent: true }).show();
}

async function tick() {
  tickNo++;
  const tLabel = `tick ${tickNo}`;
  if (SPIKE_FAIL_TICK === tickNo) {
    // Simulated network failure, to prove backoff without hammering the API.
    log(`${tLabel}: SIMULATED network failure`);
    nextDelay = Math.min(nextDelay * 2, BACKOFF_CAP_MS);
    scheduleNext(`backoff after failure → ${nextDelay}ms`);
    return;
  }

  let todo = null;
  try {
    const r = await apiGet('/todo');
    if (r.status === 401) {
      log(`${tLabel}: GET /todo → 401 — session dead. In the real app: pause sync, reopen the login webview (decision in ticket #11). Spike stops here.`);
      running = false;
      return;
    }
    todo = r.json;
    log(`${tLabel}: GET /todo ${r.status} in ${r.ms}ms — ${shapeOf(todo)}`);
  } catch (e) {
    log(`${tLabel}: GET /todo network error: ${String(e).slice(0, 120)}`);
    nextDelay = Math.min(nextDelay * 2, BACKOFF_CAP_MS);
    scheduleNext(`backoff after error → ${nextDelay}ms`);
    return;
  }

  const currentIds = taskIdsOf(todo);
  const prevTodo = readJson(files.prevTodo, null);

  if (!prevTodo) {
    // First run: seed the simulations that make detection observable.
    // 1) Baseline = this snapshot minus a task → next tick must flag it.
    //    With ≥2 tasks drop one; with exactly 1, baseline becomes empty.
    const seeded = JSON.parse(JSON.stringify(todo));
    if (Array.isArray(seeded.tasks) && seeded.tasks.length >= 2) {
      const victim = seeded.tasks[Math.floor(seeded.tasks.length / 2)];
      seeded.tasks = seeded.tasks.filter((t) => String(t.id) !== String(victim.id));
      writeJson(files.prevTodo, seeded);
      log(`${tLabel}: SIMULATION — baseline seeded WITHOUT task id=${victim.id} (course ${victim.course_code || '?'})`);
    } else if (Array.isArray(seeded.tasks) && seeded.tasks.length === 1) {
      seeded.tasks = [];
      writeJson(files.prevTodo, seeded);
      log(`${tLabel}: SIMULATION — baseline seeded EMPTY (only 1 task live); next tick must flag the real task id=${currentIds[0]}`);
    } else {
      writeJson(files.prevTodo, todo);
      log(`${tLabel}: /todo has no tasks — diff simulation unseeded`);
    }
    // 2) Synthetic presence window opening 8s from now.
    const start = new Date(Date.now() + 8000).toISOString();
    const end = new Date(Date.now() + 60000).toISOString();
    writeJson(files.prevPresence, { windows: [{ id: 'SIM-WIN-1', course_code: 'SIM', presence_start: start, presence_end: end }] });
    log(`${tLabel}: SIMULATION — synthetic presence window SIM-WIN-1 opens ${start}`);
  } else {
    // The load-bearing diff: ids present now but absent from the previous snapshot.
    const prevIds = new Set(taskIdsOf(prevTodo));
    const seenTasks = new Set(readJson(files.seenTasks, []));
    const wouldBeNew = currentIds.filter((id) => !prevIds.has(id));
    const suppressed = wouldBeNew.filter((id) => seenTasks.has(id));
    if (suppressed.length) log(`${tLabel}: LEDGER suppressed re-notification for id(s): ${suppressed.join(', ')}`);
    const fresh = wouldBeNew.filter((id) => !seenTasks.has(id));
    for (const id of fresh) {
      seenTasks.add(id);
      fireOsNotification('EduNex sync spike', `New task id=${id} (check your To Do)`);
      log(`${tLabel}: DIFF → NEW TASK id=${id} — OS notification fired`);
    }
    if (!fresh.length) log(`${tLabel}: DIFF → no new tasks (baseline ${prevIds.size} ids, current ${currentIds.length})`);
    writeJson(files.seenTasks, [...seenTasks]);
    writeJson(files.prevTodo, todo);
  }

  // Presence: a window "opening" is a clock fact computed against explicit
  // presence_start/presence_end, not a diff. Notify once per window id.
  const now = Date.now();
  const seenPresence = new Set(readJson(files.seenPresence, []));
  let openedNext = null;
  for (const w of windowsOf()) {
    const start = Date.parse(w.presence_start);
    const end = Date.parse(w.presence_end);
    if (Number.isNaN(start)) continue;
    if (now >= start && now <= end && !seenPresence.has(w.id)) {
      seenPresence.add(w.id);
      fireOsNotification('EduNex sync spike', `Presence window opened for ${w.course_code || w.id}`);
      log(`${tLabel}: PRESENCE OPEN → ${w.id} — OS notification fired`);
    }
    if (start > now && (!openedNext || start < openedNext.start)) {
      openedNext = { id: w.id, start };
    }
  }
  writeJson(files.seenPresence, [...seenPresence]);

  // Event-aligned cadence: never sleep past a window opening by more than a
  // 1.5s grace, otherwise the normal jittered tick.
  const base = TICK_BASE_MS + Math.floor(Math.random() * TICK_JITTER_MS * 2) - TICK_JITTER_MS;
  let delay = base;
  let why = `regular jittered tick → ${delay}ms`;
  if (openedNext) {
    const aligned = Math.max(1000, openedNext.start - now + 1500);
    if (aligned < delay) { delay = aligned; why = `event-aligned to window ${openedNext.id} opening → ${delay}ms`; }
  }
  nextDelay = delay;
  scheduleNext(why);
}

function scheduleNext(why) {
  if (!running) return;
  log(`schedule: ${why}`);
  setTimeout(() => { if (running) tick(); }, nextDelay);
}

// ---- one-time endpoint probes (field names only, values never logged) --------

// The SPA calls GET /notifications/{user.id} (bundle: `get("/notifications/"+r.user.userInfo.id)`)
// and PATCH /notifications to mark read — bare /notifications 404s.
function candidateUserIds() {
  try {
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    log(`JWT claim keys: ${Object.keys(claims).join(', ')}`);
    return ['sub', 'id', 'user_id', 'uid'].map((k) => claims[k]).filter((v) => v != null).map(String);
  } catch { return []; }
}

async function probeEndpoints() {
  for (const p of ['/course/tasks', '/course/agenda', '/course/presences/list']) {
    try {
      const r = await apiGet(p);
      log(`probe GET ${p} → ${r.status} ${r.status === 200 ? shapeOf(r.json) + ' fields: ' + fieldsOf(r.json) : ''}`);
    } catch (e) {
      log(`probe GET ${p} error: ${String(e).slice(0, 100)}`);
    }
  }
  for (const id of candidateUserIds().slice(0, 2)) {
    try {
      const r = await apiGet(`/notifications/${encodeURIComponent(id)}`);
      log(`probe GET /notifications/${id} → ${r.status} ${r.status === 200 ? shapeOf(r.json) : ''}`);
      if (r.status === 200) break;
    } catch (e) {
      log(`probe GET /notifications/${id} error: ${String(e).slice(0, 100)}`);
    }
  }
}

// ---- wiring -------------------------------------------------------------------

ipcMain.on('spike:render-ticks', (_e, n) => {
  log(`renderer heartbeat: ${n} fire(s) in the last 1s ${n <= 1 ? '← THROTTLED (window hidden)' : ''}`);
});

app.whenReady().then(async () => {
  consoleWin = new BrowserWindow({
    width: 760, height: 800,
    title: 'EduNex sync spike — console (PROTOTYPE)',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  consoleWin.loadFile('console.html');
  log('sync spike starting — reusing auth spike partition (ticket #11 proved it persists)');

  token = await captureTokenFromPartition();
  if (tokenWin && !tokenWin.isDestroyed()) tokenWin.destroy();
  if (!token) {
    log('no auth in partition — in the real app the login webview opens (spike #5 proved that loop). Spike ends.');
    app.quit();
    return;
  }
  log(`bearer token recovered (${String(token).slice(0, 10)}…, ${token.length} chars)`);

  // Contrast experiment: hide the console window mid-run; the renderer
  // heartbeat throttles while the main-process tick keeps cadence.
  setTimeout(() => { log('EXPERIMENT: hiding console window — main tick should keep cadence, renderer heartbeat should throttle'); consoleWin.hide(); }, 15000);
  setTimeout(() => { log('EXPERIMENT: showing console window again'); consoleWin.show(); }, 35000);

  await probeEndpoints();

  const seenTasks = readJson(files.seenTasks, []);
  const seenPresence = readJson(files.seenPresence, []);
  if (seenTasks.length || seenPresence.length) {
    log(`restart: seen-ledger loaded — ${seenTasks.length} task id(s), ${seenPresence.length} presence window(s) already notified; they must NOT re-notify`);
  }

  running = true;
  setTimeout(() => { log('spike auto-quit'); app.quit(); }, AUTO_QUIT_MS);
  await tick();
}).catch((e) => {
  log(`FATAL: ${String(e && e.stack || e).slice(0, 300)}`);
  app.exit(1);
});

app.on('window-all-closed', () => app.quit());
