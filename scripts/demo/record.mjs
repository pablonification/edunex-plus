// Records the demo window as a crisp H.264 video, for walkthroughs: frames
// come straight from Chromium (DevTools screencast, at up to 1920×1200) and
// stream into ffmpeg at a steady 30 fps. A visible pointer and captions are
// drawn inside the page while recording, so a viewer can follow every click.
//
//   const rec = await startRecording(demo.page, "out/clip.mp4");
//   await caption(demo.page, "Beranda tells you what to do now");
//   await pointAndClick(demo.page, demo.page.getByRole("button", { name: "Jadwal" }));
//   await rec.stop();
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const FPS = 30;

/** Starts recording `page` into `file` (.mp4). Returns { stop() }. */
export async function startRecording(page, file, { width = 1920, height = 1200 } = {}) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const ffmpeg = spawn(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "image2pipe",
      "-framerate",
      String(FPS),
      "-c:v",
      "mjpeg",
      "-i",
      "-",
      "-vf",
      `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=white,format=yuv420p`,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "18",
      "-movflags",
      "+faststart",
      path.resolve(file),
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const cdp = await page.context().newCDPSession(page);
  let latest = null;
  cdp.on("Page.screencastFrame", ({ data, sessionId }) => {
    latest = Buffer.from(data, "base64");
    void cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => undefined);
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: width, maxHeight: height, everyNthFrame: 1 });
  // Chromium sends frames only when something changes: keep the stream steady by repeating the latest one.
  // While paused (a long wait the viewer needn't sit through), no frames are written and the clock stops.
  let started = Date.now();
  let pausedAt = null;
  let written = 0;
  const timer = setInterval(() => {
    if (!latest || pausedAt !== null) return;
    const due = Math.floor(((Date.now() - started) / 1000) * FPS);
    while (written < due) {
      ffmpeg.stdin.write(latest);
      written++;
    }
  }, 1000 / FPS);
  return {
    /** Stops adding frames until resume(): the video jumps over the wait. */
    pause() {
      if (pausedAt === null) pausedAt = Date.now();
    },
    resume() {
      if (pausedAt === null) return;
      started += Date.now() - pausedAt;
      pausedAt = null;
    },
    async stop() {
      clearInterval(timer);
      await cdp.send("Page.stopScreencast").catch(() => undefined);
      await cdp.detach().catch(() => undefined);
      ffmpeg.stdin.end();
      await new Promise((resolve) => ffmpeg.on("close", resolve));
      return { file: path.resolve(file), seconds: written / FPS };
    },
  };
}

const OVERLAY = `
(() => {
  if (document.getElementById("demo-overlay")) return;
  const style = document.createElement("style");
  style.textContent = \`
    #demo-pointer { position: fixed; z-index: 2147483647; left: 0; top: 0; width: 22px; height: 22px; pointer-events: none;
      transform: translate(-100px, -100px); transition: transform 520ms cubic-bezier(.2,.8,.2,1); }
    #demo-pointer svg { filter: drop-shadow(0 1px 2px rgba(0,0,0,.35)); }
    #demo-ripple { position: fixed; z-index: 2147483646; width: 34px; height: 34px; margin: -17px 0 0 -17px; border-radius: 999px;
      pointer-events: none; background: rgba(51,102,240,.28); opacity: 0; }
    #demo-ripple.on { animation: demo-ripple 520ms ease-out; }
    @keyframes demo-ripple { from { opacity: 1; transform: scale(.4); } to { opacity: 0; transform: scale(1.6); } }
    #demo-caption { position: fixed; z-index: 2147483645; left: 50%; bottom: 28px; transform: translate(-50%, 12px); max-width: 78%;
      padding: 12px 20px; border-radius: 14px; background: rgba(17,17,20,.88); color: #fff; font: 600 17px/1.4 -apple-system, system-ui, sans-serif;
      letter-spacing: -.01em; text-align: center; opacity: 0; transition: opacity 260ms ease, transform 260ms ease; pointer-events: none;
      box-shadow: 0 10px 40px -10px rgba(0,0,0,.5); }
    #demo-caption.on { opacity: 1; transform: translate(-50%, 0); }
    #demo-caption small { display: block; margin-top: 3px; font-weight: 500; font-size: 14px; opacity: .78; }
    #demo-title { position: fixed; z-index: 2147483647; inset: 0; display: grid; place-items: center; pointer-events: none;
      background: rgba(250,250,252,.96); opacity: 0; transition: opacity 380ms ease; font-family: -apple-system, system-ui, sans-serif; }
    #demo-title.on { opacity: 1; }
    #demo-title .kicker { font: 600 15px/1 -apple-system, system-ui; letter-spacing: .08em; text-transform: uppercase; color: #3366f0; text-align: center; }
    #demo-title .text { margin-top: 14px; font: 650 40px/1.15 -apple-system, system-ui; letter-spacing: -.025em; color: #1d1d1f; text-align: center; max-width: 900px; }
    #demo-title .sub { margin-top: 14px; font: 450 19px/1.45 -apple-system, system-ui; color: #5b5b61; text-align: center; max-width: 760px; }
  \`;
  document.head.appendChild(style);
  const root = document.createElement("div");
  root.id = "demo-overlay";
  root.innerHTML = '<div id="demo-ripple"></div><div id="demo-pointer"><svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2l16 9.5-7.2 1.6L9.2 20z" fill="#1d1d1f" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg></div><div id="demo-caption"></div><div id="demo-title"><div><div class="kicker"></div><div class="text"></div><div class="sub"></div></div></div>';
  document.body.appendChild(root);
})()`;

async function overlay(page) {
  await page.evaluate(OVERLAY);
}

/**
 * Keeps captions off the app: the window is `height` taller than the app, the
 * app keeps its usual area at the top, and captions sit in a band below it.
 */
export async function captionBand(page, height = 84) {
  await overlay(page);
  await page.evaluate((h) => {
    if (document.getElementById("demo-band")) return;
    const style = document.createElement("style");
    style.id = "demo-band";
    style.textContent = `
      .h-screen { height: calc(100vh - ${h}px) !important; }
      /* Dialogs centre on the app's area, above the band; toasts sit above it too. */
      [role="dialog"].fixed, [role="alertdialog"].fixed { top: calc(50% - ${h / 2}px) !important; max-height: calc(100vh - ${h + 48}px) !important; }
      div[aria-live="polite"].fixed.bottom-5 { bottom: ${h + 20}px !important; }
      #demo-caption { left: 0 !important; right: 0; bottom: 0 !important; max-width: none !important; height: ${h}px; border-radius: 0 !important;
        transform: none !important; display: flex; flex-direction: column; align-items: center; justify-content: center;
        background: #111114 !important; box-shadow: none !important; opacity: 1 !important; padding: 0 40px !important; }
      #demo-caption:not(.on) { color: transparent; }
      #demo-caption small { margin-top: 2px !important; }
    `;
    document.head.appendChild(style);
  }, height);
}

/** Shows a caption at the bottom (empty text hides it). */
export async function caption(page, text, sub = "") {
  await overlay(page);
  await page.evaluate(
    ([t, s]) => {
      const el = document.getElementById("demo-caption");
      if (!t) return el.classList.remove("on");
      el.innerHTML = "";
      el.append(document.createTextNode(t));
      if (s) {
        const small = document.createElement("small");
        small.textContent = s;
        el.append(small);
      }
      el.classList.add("on");
    },
    [text, sub],
  );
}

/** A full-window title card over the app, for chapter breaks. */
export async function titleCard(page, kicker, text, sub = "", ms = 2600) {
  await overlay(page);
  await page.evaluate(
    ([k, t, s]) => {
      const el = document.getElementById("demo-title");
      el.querySelector(".kicker").textContent = k;
      el.querySelector(".text").textContent = t;
      el.querySelector(".sub").textContent = s;
      el.classList.add("on");
    },
    [kicker, text, sub],
  );
  await page.waitForTimeout(ms);
  await page.evaluate(() => document.getElementById("demo-title").classList.remove("on"));
  await page.waitForTimeout(420);
}

/** Moves the visible pointer onto `locator`, waits a beat, then clicks it (with a ripple). */
export async function pointAndClick(page, locator, { pause = 650, hover = 0 } = {}) {
  await overlay(page);
  await locator.scrollIntoViewIfNeeded().catch(() => undefined);
  const box = await locator.boundingBox();
  if (!box) throw new Error("pointAndClick: target not visible");
  const x = box.x + Math.min(box.width / 2, 60);
  const y = box.y + box.height / 2;
  await page.evaluate(
    ([px, py]) => {
      document.getElementById("demo-pointer").style.transform = `translate(${px - 4}px, ${py - 2}px)`;
    },
    [x, y],
  );
  await page.waitForTimeout(pause);
  await page.mouse.move(x, y);
  if (hover) await page.waitForTimeout(hover);
  await page.evaluate(
    ([px, py]) => {
      const ripple = document.getElementById("demo-ripple");
      ripple.style.left = `${px}px`;
      ripple.style.top = `${py}px`;
      ripple.classList.remove("on");
      void ripple.offsetWidth;
      ripple.classList.add("on");
    },
    [x, y],
  );
  await locator.click();
}

/** Moves the visible pointer somewhere without clicking (to point at something). */
export async function pointAt(page, locator, pause = 700) {
  await overlay(page);
  const box = await locator.boundingBox();
  if (!box) return;
  await page.evaluate(
    ([px, py]) => {
      document.getElementById("demo-pointer").style.transform = `translate(${px - 4}px, ${py - 2}px)`;
    },
    [box.x + Math.min(box.width / 2, 60), box.y + box.height / 2],
  );
  await page.mouse.move(box.x + Math.min(box.width / 2, 60), box.y + box.height / 2);
  await page.waitForTimeout(pause);
}

/** Types like a person: one key at a time. */
export async function typeSlowly(page, text, delay = 70) {
  await page.keyboard.type(text, { delay });
}

/** Joins clips into one video (same size and rate), with short cross-fades. */
export async function joinClips(clips, out, fade = 0.4) {
  const durations = await Promise.all(clips.map(probeSeconds));
  const inputs = clips.flatMap((clip) => ["-i", clip]);
  let filter = "";
  let last = "[0:v]";
  let offset = 0;
  for (let i = 1; i < clips.length; i++) {
    offset += durations[i - 1] - fade;
    const label = i === clips.length - 1 ? "[v]" : `[x${i}]`;
    filter += `${last}[${i}:v]xfade=transition=fade:duration=${fade}:offset=${offset.toFixed(3)}${label};`;
    last = label;
  }
  const args =
    clips.length > 1
      ? [
          "-y",
          "-loglevel",
          "error",
          ...inputs,
          "-filter_complex",
          filter.slice(0, -1),
          "-map",
          "[v]",
          "-c:v",
          "libx264",
          "-preset",
          "medium",
          "-crf",
          "19",
          "-pix_fmt",
          "yuv420p",
          "-movflags",
          "+faststart",
          out,
        ]
      : ["-y", "-loglevel", "error", "-i", clips[0], "-c", "copy", out];
  await new Promise((resolve, reject) =>
    spawn("ffmpeg", args, { stdio: "inherit" }).on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)))),
  );
  return out;
}

function probeSeconds(file) {
  return new Promise((resolve, reject) => {
    const probe = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nk=1:nw=1", file]);
    let out = "";
    probe.stdout.on("data", (chunk) => (out += chunk));
    probe.on("close", (code) => (code === 0 ? resolve(Number(out.trim())) : reject(new Error(`ffprobe failed on ${file}`))));
  });
}
