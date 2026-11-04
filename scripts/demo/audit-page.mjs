// A page to audit a UI change on: the demo's pictures before and after, side by
// side or flipped in place, each with an OK box and a note that the browser
// keeps, and "Copy my notes" to paste back to whoever made the change
// (docs/agents/ui-review.md). Pictures are paired by file name and built into
// the page, so it opens anywhere and can be passed on.
//
//   node scripts/demo/capture.mjs .scratch/ui/before   (on the old code)
//   node scripts/demo/capture.mjs .scratch/ui/after    (on the new code)
//   node scripts/demo/audit-page.mjs .scratch/ui/before .scratch/ui/after [out.html] [--only 01-beranda,13-presensi]
//     [--title "Less text"] [--note "What changed, in a sentence or two."]
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(name);
  if (at === -1) return undefined;
  const [, value] = args.splice(at, 2);
  return value;
};
const only = flag("--only")?.split(",");
const title = flag("--title") ?? "Before and after";
const note = flag("--note") ?? "";
const [beforeDir, afterDir, outArg] = args;
if (!beforeDir || !afterDir) {
  console.error("usage: node scripts/demo/audit-page.mjs <before-dir> <after-dir> [out.html] [--only a,b] [--title t] [--note n]");
  process.exit(1);
}
const out = path.resolve(outArg ?? ".scratch/ui/audit.html");

const shots = (dir) =>
  new Set(
    fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".png"))
      .map((f) => f.slice(0, -4)),
  );
const before = shots(beforeDir);
const names = [...shots(afterDir)].filter((n) => before.has(n) && (!only || only.includes(n))).sort();
if (names.length === 0) {
  console.error("No pictures with the same name in both folders.");
  process.exit(1);
}
const picture = (dir, name) => `data:image/png;base64,${fs.readFileSync(path.join(dir, `${name}.png`)).toString("base64")}`;
const items = names.map((id) => ({
  id,
  title: id
    .replace(/^\d+-/, "")
    .replaceAll("-", " ")
    .replace(/^./, (c) => c.toUpperCase()),
  before: picture(beforeDir, id),
  after: picture(afterDir, id),
}));
const html = (text) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${html(title)}</title>
<style>
  :root { color-scheme: light dark; --bg:#fafaf9; --fg:#1c1917; --muted:#78716c; --line:#e7e5e4; --card:#fff; --good:#15803d; }
  @media (prefers-color-scheme: dark) { :root { --bg:#1c1917; --fg:#f5f5f4; --muted:#a8a29e; --line:#44403c; --card:#292524; --good:#4ade80; } }
  * { box-sizing: border-box; }
  body { margin:0; font:15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:var(--bg); color:var(--fg); }
  header { position:sticky; top:0; z-index:5; background:var(--bg); border-bottom:1px solid var(--line); padding:12px 24px; display:flex; gap:16px; align-items:center; flex-wrap:wrap; }
  header h1 { font-size:17px; margin:0; margin-right:auto; }
  .seg { display:inline-flex; border:1px solid var(--line); border-radius:8px; overflow:hidden; }
  .seg button { border:0; background:transparent; color:var(--fg); padding:6px 12px; font:inherit; font-size:13px; cursor:pointer; }
  .seg button[aria-pressed=true] { background:var(--fg); color:var(--bg); }
  button.plain { border:1px solid var(--line); background:var(--card); color:var(--fg); border-radius:8px; padding:6px 12px; font:inherit; font-size:13px; cursor:pointer; }
  main { max-width:1500px; margin:0 auto; padding:24px; }
  .note { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:16px 20px; margin-bottom:24px; }
  nav { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:24px; }
  nav a { font-size:13px; padding:3px 10px; border:1px solid var(--line); border-radius:999px; color:var(--fg); text-decoration:none; }
  nav a.done { background:var(--good); color:var(--bg); border-color:transparent; }
  section { margin-bottom:48px; scroll-margin-top:70px; }
  h2 { margin:0 0 10px; font-size:16px; }
  .pair { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  figure { margin:0; }
  figcaption { font-size:12px; color:var(--muted); margin-bottom:4px; text-transform:uppercase; letter-spacing:.04em; }
  img { width:100%; display:block; border:1px solid var(--line); border-radius:8px; cursor:zoom-in; }
  .flip { display:none; position:relative; max-width:1100px; }
  .flip .tag { position:absolute; top:8px; left:8px; background:var(--fg); color:var(--bg); font-size:12px; padding:2px 8px; border-radius:6px; pointer-events:none; }
  body.flipping .pair { display:none; } body.flipping .flip { display:block; }
  .review { display:flex; gap:12px; margin-top:10px; align-items:flex-start; }
  .review textarea { flex:1; min-height:44px; resize:vertical; font:inherit; font-size:14px; padding:8px 10px; border:1px solid var(--line); border-radius:8px; background:var(--card); color:var(--fg); }
  .review label { white-space:nowrap; font-size:14px; padding-top:10px; }
  #zoom { position:fixed; inset:0; background:rgba(0,0,0,.85); display:none; z-index:10; overflow:auto; cursor:zoom-out; }
  #zoom img { margin:24px auto; width:min(1600px, 96vw); cursor:zoom-out; }
</style>
</head>
<body>
<header>
  <h1>${html(title)}</h1>
  <div class="seg" role="group" aria-label="View">
    <button id="side" aria-pressed="true">Side by side</button>
    <button id="flip" aria-pressed="false">Flip (click a picture)</button>
  </div>
  <button class="plain" id="copy">Copy my notes</button>
</header>
<main>
  ${note ? `<p class="note">${html(note)}</p>` : ""}
  <nav id="toc"></nav>
  <div id="screens"></div>
</main>
<div id="zoom"><img alt=""></div>
<script>
const DATA = ${JSON.stringify(items)};
const KEY = ${JSON.stringify(`audit:${title}`)};
const notes = JSON.parse(localStorage.getItem(KEY) || "{}");
const save = () => localStorage.setItem(KEY, JSON.stringify(notes));
const toc = document.getElementById("toc"), wrap = document.getElementById("screens");
for (const d of DATA) {
  const n = notes[d.id] || {};
  toc.insertAdjacentHTML("beforeend", '<a href="#' + d.id + '" data-toc="' + d.id + '">' + d.title + "</a>");
  wrap.insertAdjacentHTML("beforeend",
    '<section id="' + d.id + '"><h2>' + d.id.slice(0, 2) + ". " + d.title + "</h2>" +
    '<div class="pair"><figure><figcaption>Before</figcaption><img loading="lazy" src="' + d.before + '" alt=""></figure>' +
    '<figure><figcaption>After</figcaption><img loading="lazy" src="' + d.after + '" alt=""></figure></div>' +
    '<div class="flip"><span class="tag">After</span><img loading="lazy" src="' + d.after + '" data-flip="' + d.id + '" alt=""></div>' +
    '<div class="review"><label><input type="checkbox" data-ok="' + d.id + '"' + (n.ok ? " checked" : "") + "> OK</label>" +
    '<textarea data-note="' + d.id + '" placeholder="What still bothers you here?"></textarea></div></section>');
  wrap.querySelector('[data-note="' + d.id + '"]').value = n.text || "";
}
const mark = () => document.querySelectorAll("[data-toc]").forEach((a) => a.classList.toggle("done", !!notes[a.dataset.toc]?.ok));
mark();
wrap.addEventListener("input", (e) => {
  const id = e.target.dataset.note || e.target.dataset.ok;
  if (!id) return;
  notes[id] = notes[id] || {};
  if (e.target.dataset.note) notes[id].text = e.target.value;
  else notes[id].ok = e.target.checked;
  save();
  mark();
});
const zoom = document.getElementById("zoom");
wrap.addEventListener("click", (e) => {
  const img = e.target.closest("img");
  if (!img) return;
  if (img.dataset.flip) {
    const d = DATA.find((x) => x.id === img.dataset.flip);
    const showingAfter = img.src === d.after;
    img.src = showingAfter ? d.before : d.after;
    img.previousElementSibling.textContent = showingAfter ? "Before" : "After";
    return;
  }
  zoom.firstElementChild.src = img.src;
  zoom.style.display = "block";
});
zoom.addEventListener("click", () => (zoom.style.display = "none"));
document.addEventListener("keydown", (e) => e.key === "Escape" && (zoom.style.display = "none"));
const mode = (flip) => {
  document.body.classList.toggle("flipping", flip);
  document.getElementById("side").setAttribute("aria-pressed", String(!flip));
  document.getElementById("flip").setAttribute("aria-pressed", String(flip));
};
document.getElementById("side").onclick = () => mode(false);
document.getElementById("flip").onclick = () => mode(true);
document.getElementById("copy").onclick = async (e) => {
  const lines = DATA.map((d) => {
    const n = notes[d.id] || {};
    if (!n.ok && !n.text) return null;
    return "- " + d.id + " " + d.title + ": " + [n.ok ? "OK" : "", n.text || ""].filter(Boolean).join(". ");
  }).filter(Boolean);
  await navigator.clipboard.writeText(lines.length ? "Audit notes:\\n" + lines.join("\\n") : "No notes yet");
  e.target.textContent = "Copied";
  setTimeout(() => (e.target.textContent = "Copy my notes"), 1200);
};
</script>
</body>
</html>
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, page);
console.log(`${out}: ${items.length} screens, ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
