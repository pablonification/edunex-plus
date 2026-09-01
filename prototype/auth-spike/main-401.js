// PROTOTYPE (throwaway) — 401-recovery variant of the auth spike, for wayfinder
// ticket #14. Question: when the login webview is re-opened after a 401/token
// loss, does the SSO flow complete silently from the persisted cookies (no
// password, no MFA), or does it need human interaction?
// Method: same persistent partition as the original spike (cookies intact),
// clear ONLY localStorage.auth, reload, and watch navigation + localStorage
// for the next two minutes. No credentials are ever entered by this code;
// at most it clicks an on-page login button to let the redirect chain start.
const { app, BrowserWindow, session } = require('electron');
const fs = require('fs');
const path = require('path');

const PARTITION = 'persist:spike-edunex-auth';
const EDUNEX = 'https://edunex.itb.ac.id';
const API_HOST = 'api-edunex.cognisia.id';
const WATCH_MS = 120000;
const POLL_MS = 2000;
const FINDINGS_PATH = path.join(__dirname, 'findings-401.json');
const SHOTS_DIR = path.join(__dirname, 'spike-401-shots');

const findings = {
  startedAt: null,
  startupHadAuth: null,
  authClearedAt: null,
  reloadAt: null,
  navigations: [],
  apiRequests: [],
  ssoRequests: [],
  reauth: null, // { silent: Boolean, elapsedMs, how } | { timedOut: true }
  finalUrl: null,
  pageStates: [],
  notes: [],
};

let consoleWin = null;
let win = null;
let reloadTime = null;
let done = false;

function saveFindings() {
  try { fs.writeFileSync(FINDINGS_PATH, JSON.stringify(findings, null, 2)); } catch (e) { /* prototype */ }
}

function log(line) {
  const text = `[${new Date().toISOString().slice(11, 19)}] ${line}`;
  process.stdout.write(text + '\n');
  if (consoleWin && !consoleWin.isDestroyed()) {
    consoleWin.webContents.send('spike:log', text);
  }
}

async function shot(name) {
  try {
    fs.mkdirSync(SHOTS_DIR, { recursive: true });
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(SHOTS_DIR, `${name}.png`), img.toPNG());
    log(`screenshot: ${name}.png`);
  } catch (e) { /* prototype */ }
}

async function pageState(tag) {
  try {
    const url = win.webContents.getURL();
    const state = await win.webContents.executeJavaScript(`(() => ({
      hasAuth: !!localStorage.getItem("auth"),
      passwordInput: !!document.querySelector('input[type=password]'),
      title: document.title.slice(0, 80),
      bodyHint: (document.body && document.body.innerText || '').slice(0, 300).replace(/\\s+/g, ' '),
    }))()`, true);
    state.tag = tag;
    state.url = url.slice(0, 200);
    findings.pageStates.push(state);
    log(`page[${tag}] url=${url.slice(0, 90)} hasAuth=${state.hasAuth} passwordInput=${state.passwordInput} title="${state.title}"`);
    return state;
  } catch (e) {
    return null;
  }
}

function attachObservers() {
  const ses = session.fromPartition(PARTITION);
  ses.webRequest.onBeforeSendHeaders({ urls: ['https://*/*'] }, (details, callback) => {
    try {
      const auth = details.requestHeaders.Authorization || details.requestHeaders.authorization;
      const entry = { method: details.method, url: details.url.slice(0, 250), bearer: Boolean(auth) };
      if (details.url.includes(API_HOST)) {
        findings.apiRequests.push(entry);
        log(`SPA→ ${details.method} ${entry.url.slice(0, 80)} ${auth ? '[bearer]' : '[NO AUTH]'}`);
      } else if (/microsoftonline|sso-edunex|auth0\.com/.test(details.url)) {
        findings.ssoRequests.push(entry);
        log(`SSO→ ${details.method} ${entry.url.slice(0, 110)}`);
      }
    } catch (e) { /* prototype */ }
    callback({ requestHeaders: details.requestHeaders });
  });
}

async function finish(result) {
  if (done) return;
  done = true;
  findings.reauth = result;
  try { findings.finalUrl = win.webContents.getURL(); } catch { /* prototype */ }
  await pageState('final');
  await shot('final');
  saveFindings();
  log(`RESULT: ${JSON.stringify(result)}`);
  log('done — findings-401.json written; closing in 5s');
  setTimeout(() => app.quit(), 5000);
}

async function poll() {
  if (done || !win || win.isDestroyed()) return;
  try {
    const raw = await win.webContents.executeJavaScript('localStorage.getItem("auth")', true);
    if (raw) {
      const elapsedMs = Date.now() - reloadTime;
      const url = win.webContents.getURL();
      let shape = null;
      try { shape = Object.keys(JSON.parse(raw)); } catch { /* prototype */ }
      log(`localStorage.auth REAPPEARED after ${elapsedMs}ms — keys: ${(shape || []).join(', ')}`);
      await pageState('reauth');
      await shot('reauthenticated');
      await finish({ silent: true, elapsedMs, keys: shape, finalUrl: url.slice(0, 200), how: 'auth repopulated with no observed login steps' });
    }
  } catch { /* page mid-navigation */ }
}

function createWindows() {
  consoleWin = new BrowserWindow({
    width: 620, height: 740,
    title: 'EduNex 401-recovery spike — console (PROTOTYPE)',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  consoleWin.loadFile('console.html');

  win = new BrowserWindow({
    width: 1150, height: 820,
    title: 'EduNex — 401 recovery test (spike)',
    webPreferences: { partition: PARTITION },
  });
  win.webContents.on('did-navigate', (_e, url) => {
    findings.navigations.push({ at: Date.now() - (reloadTime || Date.now()), url: url.slice(0, 250) });
    log(`navigate → ${url.slice(0, 110)}`);
  });
  win.webContents.on('did-redirect-navigation', (_e, url) => {
    findings.navigations.push({ at: Date.now() - (reloadTime || Date.now()), redirect: url.slice(0, 250) });
    log(`redirect → ${url.slice(0, 110)}`);
  });

  // The SPA's in-page auth0 traffic aborts the initial load, so loadURL's
  // promise may reject; wait for a settled, scriptable page instead.
  win.loadURL(EDUNEX).catch(() => {});
  waitUntilSettled(win.webContents).then(() => runExperiment());
}

async function waitUntilSettled(wc, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (!wc.isLoading() && (await wc.executeJavaScript('document.readyState', true)) === 'complete') return;
    } catch { /* not scriptable yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function runExperiment() {
  try {
    findings.startedAt = new Date().toISOString();
    const pre = await win.webContents.executeJavaScript('localStorage.getItem("auth")', true);
    findings.startupHadAuth = Boolean(pre);
    log(`loaded ${EDUNEX} — auth present from previous run: ${Boolean(pre)}`);
    if (!pre) findings.notes.push('expected auth from previous spike run; absent — cookies/partition may have been cleared');

    // The experiment: wipe the token, keep every cookie.
    await win.webContents.executeJavaScript('localStorage.removeItem("auth"); localStorage.getItem("auth") === null', true);
    findings.authClearedAt = new Date().toISOString();
    log('localStorage.auth cleared — cookies left untouched');

    reloadTime = Date.now();
    findings.reloadAt = new Date().toISOString();
    await win.webContents.reload();
    log('reloaded — watching for silent re-auth vs credential screen…');
    await pageState('post-reload');
    await shot('post-reload');

    const poller = setInterval(poll, POLL_MS);
    setTimeout(() => {
      clearInterval(poller);
      finish({ timedOut: true, watchMs: WATCH_MS, note: 'no re-auth within watch window' });
    }, WATCH_MS);
  } catch (e) {
    findings.notes.push(`experiment error: ${String(e)}`);
    saveFindings();
    log(`experiment error: ${String(e).slice(0, 160)}`);
    setTimeout(() => app.quit(), 2000);
  }
}

app.whenReady().then(() => {
  attachObservers();
  createWindows();
  log('401-recovery spike running (ticket #14): cookies kept, localStorage.auth cleared.');
});

app.on('window-all-closed', () => app.quit());
