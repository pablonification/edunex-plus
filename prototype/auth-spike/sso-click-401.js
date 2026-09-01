// PROTOTYPE (throwaway) — follows the SPA login page's "ITB Account/SSO Login"
// link (a click, no credentials) and records where the flow lands: silent
// redirect back vs Azure AD credential screen. For wayfinder ticket #14.
const { app, BrowserWindow, session } = require('electron');
const fs = require('fs');
const path = require('path');

const PARTITION = 'persist:spike-edunex-auth';
const EDUNEX = 'https://edunex.itb.ac.id';
const OUT = path.join(__dirname, 'findings-401-sso-click.json');
const findings = { navigations: [], landings: [] };

function log(l) { process.stdout.write(l + '\n'); }

async function waitUntilSettled(wc, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (!wc.isLoading() && (await wc.executeJavaScript('document.readyState', true)) === 'complete') return;
    } catch { /* not scriptable yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function describe(wc, tag) {
  try {
    const state = await wc.executeJavaScript(`(() => ({
      url: location.href.slice(0, 200),
      passwordInput: !!document.querySelector('input[type=password]'),
      title: document.title.slice(0, 80),
      bodyText: (document.body && document.body.innerText || '').slice(0, 300).replace(/\\s+/g, ' '),
    }))()`, true);
    state.tag = tag;
    findings.landings.push(state);
    log(`[${tag}] ${state.url} passwordInput=${state.passwordInput} title="${state.title}"`);
    log(`      body: ${state.bodyText.slice(0, 160)}`);
  } catch (e) { /* prototype */ }
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1150, height: 820, webPreferences: { partition: PARTITION } });
  win.webContents.on('did-navigate', (_e, url) => { findings.navigations.push({ navigate: url.slice(0, 250) }); log(`navigate → ${url.slice(0, 110)}`); });
  win.webContents.on('did-redirect-navigation', (_e, url) => { findings.navigations.push({ redirect: url.slice(0, 250) }); log(`redirect → ${url.slice(0, 110)}`); });

  win.loadURL(EDUNEX).catch(() => {});
  await waitUntilSettled(win.webContents);
  await new Promise((r) => setTimeout(r, 3000));
  await describe(win.webContents, 'login-page');

  // One click on the SSO link — no credentials, ever.
  const clicked = await win.webContents.executeJavaScript(`(() => {
    const a = [...document.querySelectorAll('a')].find((x) => /SSO Login/i.test(x.innerText || ''));
    if (!a) return false;
    a.click();
    return true;
  })()`, true);
  log(`clicked SSO link: ${clicked}`);
  await new Promise((r) => setTimeout(r, 15000));
  await waitUntilSettled(win.webContents, 10000);
  await describe(win.webContents, 'after-sso-click');
  fs.writeFileSync(OUT, JSON.stringify(findings, null, 2));
  setTimeout(() => app.quit(), 1000);
});
