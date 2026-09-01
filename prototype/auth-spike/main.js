// PROTOTYPE (throwaway) — Electron auth-loop spike for wayfinder ticket #5.
// Answers, empirically:
//   1. Does the full INA SSO (Auth0-spa-js over Azure AD) complete inside an
//      Electron BrowserWindow with a persistent partition? Any popups?
//   2. Can we read localStorage.auth from the webview after redirect-back?
//   3. What are the refresh mechanics (endpoint, grant, expiry)?
//   4. Does safeStorage work here (candidate token home)?
// It opens a login window (persistent partition) plus a console window, logs
// everything, and writes findings.json next to this file. Tokens are never
// written in full — only shapes, claims and previews. Login is yours to do.
const { app, BrowserWindow, session, safeStorage, net } = require('electron');
const fs = require('fs');
const path = require('path');

const PARTITION = 'persist:spike-edunex-auth';
const EDUNEX = 'https://edunex.itb.ac.id';
const API_HOST = 'api-edunex.cognisia.id';
const FINDINGS_PATH = path.join(__dirname, 'findings.json');
const NET_FILTER = {
  urls: [
    `https://${API_HOST}/*`,
    'https://*.auth0.com/*',
    'https://login.microsoftonline.com/*',
  ],
};

const findings = {
  capturedAt: null,
  startupHadAuth: null,
  authShape: null,        // keys + brief previews of localStorage.auth
  jwtClaims: null,        // decoded payload of accessToken
  accounts: null,         // keys of the accounts map (multi-account surface)
  apiCalls: [],           // our direct API probes
  spaApiRequests: [],     // API requests the SPA itself made (observed)
  ssoRequests: [],        // auth0 / azure AD traffic observed
  refreshAttempts: [],    // token-endpoint POSTs observed or performed
  auth0: null,            // { authorizeUrl, clientId } parsed from traffic
  safeStorage: null,
  popups: [],
  notes: [],
};

let consoleWin = null;
let loginWin = null;
let captured = false;
let refreshTestDone = false;

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

function brief(s) {
  return typeof s === 'string' && s.length ? `${s.slice(0, 12)}…(${s.length} chars)` : s;
}

function decodeJwt(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  } catch (e) {
    return { decodeError: String(e) };
  }
}

function pushCapped(arr, entry, cap = 300) {
  if (arr.length < cap) arr.push(entry);
}

// ---- network observation ----------------------------------------------------

function attachNetObservers() {
  const ses = session.fromPartition(PARTITION);

  // Token-endpoint POSTs reveal the refresh grant; other auth0 traffic reveals
  // the SPA's client_id / authorize flow. Bodies are only summarized (keys,
  // grant_type) — values are secrets.
  ses.webRequest.onBeforeRequest(NET_FILTER, (details, callback) => {
    try {
      if (details.uploadData && details.method === 'POST') {
        const body = details.uploadData.map((p) => (p.bytes ? Buffer.from(p.bytes).toString('utf8') : '')).join('');
        const params = new URLSearchParams(body);
        const entry = {
          url: details.url.slice(0, 200),
          grantType: params.get('grant_type') || null,
          bodyKeys: [...params.keys()],
        };
        if (params.toString()) {
          pushCapped(findings.refreshAttempts, entry);
          log(`POST ${safeUrl(details.url)} grant_type=${entry.grantType || '—'} bodyKeys=${entry.bodyKeys.join(',')}`);
        }
      }
    } catch (e) { /* prototype */ }
    callback({});
  });

  ses.webRequest.onBeforeSendHeaders(NET_FILTER, (details, callback) => {
    try {
      const headers = details.requestHeaders;
      const auth = headers.Authorization || headers.authorization;
      const u = safeUrl(details.url);
      if (details.url.includes(API_HOST)) {
        pushCapped(findings.spaApiRequests, { method: details.method, url: details.url, bearer: Boolean(auth) });
        log(`SPA→ ${details.method} ${u} ${auth ? '[bearer]' : '[NO AUTH]'}`);
      } else {
        const entry = { method: details.method, url: details.url.slice(0, 250), authScheme: auth ? auth.split(' ')[0] : null };
        pushCapped(findings.ssoRequests, entry);
        // Capture the SPA's auth0 config from the first authorize call.
        if (!findings.auth0 && /auth0\.com\/authorize/.test(details.url)) {
          const q = new URL(details.url).searchParams;
          findings.auth0 = {
            authorizeUrl: details.url.slice(0, 400),
            clientId: q.get('client_id'),
            redirectUri: q.get('redirect_uri'),
            prompt: q.get('prompt'),
          };
          log(`auth0 authorize observed: client_id=${findings.auth0.clientId} redirect=${findings.auth0.redirectUri}`);
        }
        log(`SSO→ ${details.method} ${u}`);
      }
    } catch (e) { /* prototype */ }
    callback({ requestHeaders: details.requestHeaders });
  });
}

function safeUrl(u) {
  try {
    const parsed = new URL(u);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return String(u).slice(0, 120);
  }
}

// ---- capture + probes --------------------------------------------------------

async function tryCapture() {
  if (captured || !loginWin || loginWin.isDestroyed()) return;
  let url;
  try { url = loginWin.webContents.getURL(); } catch { return; }
  if (!url || !url.startsWith(EDUNEX)) return;

  let raw = null;
  try {
    raw = await loginWin.webContents.executeJavaScript('localStorage.getItem("auth")', true);
  } catch (e) { /* page mid-navigation; try again next tick */ }
  if (!raw) return;

  captured = true;
  findings.capturedAt = new Date().toISOString();
  log('localStorage.auth FOUND — capture succeeded');

  let auth = null;
  try { auth = JSON.parse(raw); } catch (e) {
    findings.authShape = { parseError: String(e), rawLength: raw.length };
    log('…but it is not valid JSON; see findings.json');
    saveFindings();
    return;
  }

  findings.authShape = {
    keys: Object.keys(auth),
    accessToken: brief(auth.accessToken),
    refreshToken: brief(auth.refreshToken),
    expirationDate: auth.expirationDate,
    verified: auth.verified,
  };
  findings.jwtClaims = auth.accessToken ? decodeJwt(auth.accessToken) : null;
  findings.accounts = auth.accounts ? Object.keys(auth.accounts) : null;

  const expClaim = findings.jwtClaims && findings.jwtClaims.exp;
  log(`auth keys: ${findings.authShape.keys.join(', ')}`);
  log(`refreshToken: ${brief(auth.refreshToken) || 'ABSENT'}`);
  log(`expirationDate field: ${auth.expirationDate}`);
  if (expClaim) log(`JWT exp claim: ${new Date(expClaim * 1000).toISOString()} (now: ${new Date().toISOString()})`);
  log(`accounts: ${(findings.accounts || []).join(', ') || 'none/absent'}`);
  saveFindings();

  testSafeStorage();
  await probeApi(auth.accessToken);
  await tryRefreshProbe(auth.refreshToken);

  log('Spike done. Keep the app open to observe the SPA refreshing on its own; findings.json keeps updating. Close windows when finished.');
}

function testSafeStorage() {
  try {
    const available = safeStorage.isEncryptionAvailable();
    let detail = null;
    if (available) {
      const enc = safeStorage.encryptString('spike-secret');
      detail = `encrypted ${enc.length} bytes (platform=${process.platform})`;
    }
    findings.safeStorage = { available, detail, platform: process.platform };
    log(`safeStorage: available=${available}${detail ? ' — ' + detail : ''}`);
  } catch (e) {
    findings.safeStorage = { error: String(e) };
    log(`safeStorage probe failed: ${e}`);
  }
}

async function probeApi(token) {
  const candidates = ['/todo', '/course/courses', '/api/todo'];
  for (const p of candidates) {
    const url = `https://${API_HOST}${p}`;
    const started = Date.now();
    try {
      const res = await net.fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'EduNexDesktop-AuthSpike/0 (prototype; contact: repo owner)',
        },
      });
      const text = await res.text();
      findings.apiCalls.push({
        url, status: res.status, ms: Date.now() - started,
        contentType: res.headers.get('content-type'),
        bodyPreview: text.slice(0, 400),
      });
      log(`API GET ${p}: HTTP ${res.status} in ${Date.now() - started}ms — ${text.slice(0, 100).replace(/\s+/g, ' ')}`);
      if (res.status === 200 && !p.startsWith('/api')) break; // no need to keep guessing
    } catch (e) {
      findings.apiCalls.push({ url, error: String(e) });
      log(`API GET ${p} failed: ${String(e).slice(0, 120)}`);
    }
  }
  saveFindings();
}

async function tryRefreshProbe(refreshToken) {
  if (!refreshToken || !findings.auth0 || !findings.auth0.clientId) {
    log('refresh probe skipped (no refreshToken in localStorage.auth or no auth0 client_id observed yet)');
    findings.notes.push('refresh probe skipped: missing refreshToken or client_id');
    refreshTestDone = true;
    saveFindings();
    return;
  }
  const domain = new URL(findings.auth0.authorizeUrl).origin;
  try {
    log(`refresh probe: POST ${domain}/oauth/token (grant_type=refresh_token)…`);
    const res = await net.fetch(`${domain}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: findings.auth0.clientId,
        refresh_token: refreshToken,
      }).toString(),
    });
    const text = await res.text();
    let keys = null;
    let expiresIn = null;
    try {
      const json = JSON.parse(text);
      keys = Object.keys(json);
      expiresIn = json.expires_in;
    } catch { /* not json */ }
    findings.refreshAttempts.push({
      probe: true, url: `${domain}/oauth/token`, status: res.status,
      responseKeys: keys, expiresIn,
      note: 'values redacted; NOTE refresh tokens may be single-use/rotated',
    });
    log(`refresh probe: HTTP ${res.status}${expiresIn ? `, expires_in=${expiresIn}s` : ''} responseKeys=${(keys || []).join(',') || '?'}`);
  } catch (e) {
    findings.refreshAttempts.push({ probe: true, error: String(e) });
    log(`refresh probe failed: ${String(e).slice(0, 160)}`);
  }
  refreshTestDone = true;
  saveFindings();
}

// ---- windows ------------------------------------------------------------------

function createWindows() {
  consoleWin = new BrowserWindow({
    width: 620,
    height: 740,
    title: 'EduNex auth spike — console (PROTOTYPE)',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  consoleWin.loadFile('console.html');

  loginWin = new BrowserWindow({
    width: 1150,
    height: 820,
    title: 'EduNex — log in with INA (spike)',
    webPreferences: { partition: PARTITION },
  });
  loginWin.webContents.setWindowOpenHandler(({ url }) => {
    findings.popups.push({ url: url.slice(0, 250), at: new Date().toISOString() });
    log(`popup requested: ${safeUrl(url)} — allowing (child inherits session)`);
    saveFindings();
    return { action: 'allow' };
  });
  loginWin.webContents.on('did-redirect-navigation', (_e, url) => {
    log(`redirect → ${safeUrl(url)}`);
  });
  loginWin.loadURL(EDUNEX).then(async () => {
    // Persistent partition means a previous spike run may have left auth behind.
    try {
      const pre = await loginWin.webContents.executeJavaScript('localStorage.getItem("auth")', true);
      findings.startupHadAuth = Boolean(pre);
      log(`loaded ${EDUNEX} — auth present from previous run: ${Boolean(pre)}`);
    } catch { /* prototype */ }
    saveFindings();
  });

  setInterval(tryCapture, 2000);
}

app.whenReady().then(() => {
  attachNetObservers();
  createWindows();
  log('spike running. Log in with INA in the EduNex window.');
});

app.on('window-all-closed', () => app.quit());
