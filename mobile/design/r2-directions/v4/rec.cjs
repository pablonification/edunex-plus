const { chromium } = require("/home/pabs/coding/edunex-plus/node_modules/playwright-core");
const fs = require("fs");
(async () => {
  const exe = fs.readdirSync(process.env.HOME + "/.cache/ms-playwright").filter(d=>d.startsWith("chromium_headless_shell")).sort().map(d=>process.env.HOME+"/.cache/ms-playwright/"+d+"/chrome-headless-shell-linux64/chrome-headless-shell").find(p=>fs.existsSync(p));
  const b = await chromium.launch({ executablePath: exe });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  fs.rmSync("/tmp/mock/v4/frames", { recursive: true, force: true }); fs.mkdirSync("/tmp/mock/v4/frames");
  const cdp = await ctx.newCDPSession(p); const frames = [];
  cdp.on("Page.screencastFrame", async (f) => { const n = frames.length; fs.writeFileSync(`/tmp/mock/v4/frames/${String(n).padStart(5, "0")}.jpg`, Buffer.from(f.data, "base64")); frames.push(f.metadata.timestamp); cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {}); });
  const startCast = () => cdp.send("Page.startScreencast", { format: "jpeg", quality: 85, everyNthFrame: 1 });
  // a visible touch dot, since a phone shows none
  const dot = `const d=document.createElement('div');d.style.cssText='position:fixed;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:20px;background:rgba(120,120,120,.35);pointer-events:none;z-index:99;opacity:0;transition:opacity .15s';document.body.appendChild(d);
    addEventListener('pointerdown',e=>{d.style.left=e.clientX+'px';d.style.top=e.clientY+'px';d.style.opacity=1});addEventListener('pointerup',()=>d.style.opacity=0);`;
  const tap = async (sel, hold = 140) => { const r = await p.locator(sel).first().boundingBox(); await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await p.mouse.down(); await p.waitForTimeout(hold); await p.mouse.up(); };
  await startCast(); await p.goto("file:///tmp/mock/v4/out/v4-beranda-light.html"); await p.evaluate(dot); await p.waitForTimeout(2600);
  await tap(".cta"); await p.waitForTimeout(1800);
  await tap(".dc"); await p.waitForTimeout(700);
  await tap(".row"); await p.waitForTimeout(1900);
  await tap(".scrim", 80); await p.waitForTimeout(1100);
  await p.goto("file:///tmp/mock/v4/out/v4-jadwal-light.html"); await p.evaluate(dot); await p.waitForTimeout(2000);
  await tap(".wd:nth-child(5)"); await p.waitForTimeout(900);
  await cdp.send("Page.stopScreencast");
  let txt = ""; for (let i = 0; i < frames.length; i++) { const dur = i + 1 < frames.length ? frames[i + 1] - frames[i] : 0.5; txt += `file '/tmp/mock/v4/frames/${String(i).padStart(5, "0")}.jpg'\nduration ${dur.toFixed(4)}\n`; }
  fs.writeFileSync("/tmp/mock/v4/frames/list.txt", txt); console.log(frames.length, "frames");
  await ctx.close(); await b.close();
})();
