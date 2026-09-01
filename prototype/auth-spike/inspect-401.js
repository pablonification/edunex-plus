// PROTOTYPE (throwaway) — inspection only, for wayfinder ticket #14 follow-up:
// what does the SPA's login page offer (forms/buttons/links), and what cookies
// did the partition retain? Reads DOM and cookie metadata only; enters nothing.
const { app, BrowserWindow, session } = require('electron');
const fs = require('fs');
const path = require('path');

const PARTITION = 'persist:spike-edunex-auth';
const EDUNEX = 'https://edunex.itb.ac.id';
const OUT = path.join(__dirname, 'findings-401-inspect.json');

const findings = { cookies: [], loginPage: null, notes: [] };

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

app.whenReady().then(async () => {
  const ses = session.fromPartition(PARTITION);
  const cookies = await ses.cookies.get({});
  findings.cookies = cookies.map((c) => ({
    domain: c.domain, name: c.name, path: c.path,
    secure: c.secure, httpOnly: c.httpOnly,
    expires: c.expirationDate ? new Date(c.expirationDate * 1000).toISOString() : 'session',
    // value intentionally never read
  }));
  log(`cookies in partition: ${cookies.length}`);
  for (const c of findings.cookies) log(`  ${c.domain} ${c.name} expires=${c.expires}`);

  const win = new BrowserWindow({ show: false, webPreferences: { partition: PARTITION } });
  win.loadURL(EDUNEX).catch(() => {});
  await waitUntilSettled(win.webContents);
  await new Promise((r) => setTimeout(r, 3000)); // let the SPA settle/route

  try {
    findings.loginPage = await win.webContents.executeJavaScript(`(() => {
      const form = document.querySelector('form');
      const q = (sel) => [...document.querySelectorAll(sel)].map((el) => ({
        tag: el.tagName.toLowerCase(), type: el.type || null, name: el.name || null,
        id: el.id || null, text: (el.innerText || el.value || '').trim().slice(0, 60),
        href: el.href ? el.href.slice(0, 120) : null,
      }));
      return {
        url: location.href,
        title: document.title.slice(0, 80),
        formAction: form ? form.action.slice(0, 150) : null,
        formMethod: form ? form.method : null,
        inputs: q('input').filter((i) => i.type !== 'hidden'),
        buttons: q('button'),
        ssoLinks: q('a').filter((a) => /sso|ina|azure|login|microsoft|saml|oauth/i.test((a.href || '') + ' ' + (a.innerText || ''))),
        iframeSrcs: [...document.querySelectorAll('iframe')].map((f) => f.src.slice(0, 120)),
        bodyText: (document.body.innerText || '').slice(0, 600).replace(/\\s+/g, ' '),
      };
    })()`, true);
  } catch (e) {
    findings.notes.push(`dom dump failed: ${String(e)}`);
  }
  log(`login page: ${JSON.stringify(findings.loginPage, null, 2)}`);
  fs.writeFileSync(OUT, JSON.stringify(findings, null, 2));
  setTimeout(() => app.quit(), 1000);
});
