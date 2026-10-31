// Round 2, direction v2 ("Hidup"): the same budget, with personality. Each course has its colour and icon tile, the
// class now is a vivid card with a live progress bar, big numbers for what needs you, Plus Jakarta Sans for type.
import fs from "node:fs";
import path from "node:path";

const OUT = process.argv[2] ?? "/tmp/mock/out2";
fs.mkdirSync(OUT, { recursive: true });
const I = JSON.parse(fs.readFileSync("/tmp/mock/icons2.json", "utf8"));
const icon = (name, { size = 24, weight = "regular", color = "currentColor", duo = 0.3 } = {}) => {
  const ps = I[name][weight] ?? I[name].regular;
  const body =
    weight === "duotone" ? `<path d="${ps[0]}" opacity="${duo}"/><path d="${ps[1]}"/>` : ps.map((d) => `<path d="${d}"/>`).join("");
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 256 256" fill="${color}">${body}</svg>`;
};

// The demo's courses: colour (light, dark) and an icon for what each is about.
const COURSES = {
  PL3002: { c: ["#6e46fb", "#8370ff"], i: "ChartLineUp", n: "Ekonomi dan Inovasi dalam Perencanaan", s: "Ekonomi dan Inovasi" },
  DK4073: { c: ["#0a74c9", "#3c9be8"], i: "Megaphone", n: "Komunikasi Pemasaran", s: "Komunikasi Pemasaran" },
  PL3032: { c: ["#d6459b", "#ff7ac3"], i: "Train", n: "Ekonomi Infrastruktur dan Transportasi", s: "Ekonomi Infrastruktur" },
  KU5014: { c: ["#0b97b8", "#06bfe7"], i: "PuzzlePiece", n: "Teknik Penyelesaian Masalah Terstruktur", s: "Penyelesaian Masalah" },
  II4091: { c: ["#9333ea", "#b56cff"], i: "GraduationCap", n: "Proposal Tugas Akhir", s: "Proposal Tugas Akhir" },
};

const VARS = {
  light:
    "--bg:#f5f6fa;--card:#ffffff;--fg:#10131a;--muted:#6a7080;--soft:#eef0f5;--bar:#ffffff;--pill:#e6e9ff;--sheet:#ffffff;--brand:#3b5bfd;--onbrand:#fff;--ring:rgba(16,19,26,.06);--shadow:0 6px 20px rgba(28,39,76,.08);--warn:#b45309;--warnbg:#fff3e0;--danger:#d92d20;--dangerbg:#ffebe9;--ok:#0f9d58;--okbg:#e3f6ea;--fire:#f97316",
  dark:
    "--bg:#0a0c11;--card:#151820;--fg:#f1f3f8;--muted:#9aa1b2;--soft:#1c2029;--bar:#11141b;--pill:#283163;--sheet:#151820;--brand:#7d93ff;--onbrand:#0a0f2e;--ring:rgba(255,255,255,.06);--shadow:0 6px 24px rgba(0,0,0,.45);--warn:#ffb057;--warnbg:#3a2810;--danger:#ff7a6e;--dangerbg:#3b1714;--ok:#4ed38a;--okbg:#10301f;--fire:#ff9a4d",
};

const CSS = `
@font-face{font-family:Jakarta;src:url(file:///tmp/mock/font/Jakarta.ttf);font-weight:200 800}
@font-face{font-family:RobotoX;src:url(file:///tmp/mock/font/Roboto.ttf);font-weight:100 900}
*{box-sizing:border-box;margin:0;padding:0}
.phone{width:390px;height:844px;position:relative;overflow:hidden;background:var(--bg);color:var(--fg);font-family:RobotoX,sans-serif;-webkit-font-smoothing:antialiased}
.j{font-family:Jakarta,RobotoX,sans-serif}
.ic{display:block;flex-shrink:0}
.sb{height:28px;display:flex;align-items:center;justify-content:space-between;padding:0 22px;font-size:13px;font-weight:600}
.content{position:absolute;top:28px;left:0;right:0;bottom:80px;overflow:hidden}
.tabbar{position:absolute;left:0;right:0;bottom:0;height:80px;background:var(--bar);display:flex;justify-content:space-around;padding-top:10px;box-shadow:0 -1px 0 var(--ring)}
.tab{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px;font-weight:500;color:var(--muted);width:72px}
.tab .pl{width:56px;height:30px;border-radius:15px;display:flex;align-items:center;justify-content:center}
.tab.on{color:var(--fg);font-weight:700} .tab.on .pl{background:var(--pill);color:var(--brand)}
.gesture{position:absolute;bottom:6px;left:50%;transform:translateX(-50%);width:108px;height:4px;border-radius:2px;background:var(--fg);opacity:.3}
.tile{border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.chip{font-size:12px;font-weight:700;padding:5px 10px;border-radius:999px;white-space:nowrap;display:inline-flex;align-items:center;gap:4px}
.chip.d{background:var(--dangerbg);color:var(--danger)} .chip.w{background:var(--warnbg);color:var(--warn)} .chip.o{background:var(--okbg);color:var(--ok)}
/* Beranda */
.top{display:flex;align-items:center;gap:12px;padding:14px 20px 4px}
.av{width:44px;height:44px;border-radius:22px;background:conic-gradient(from 200deg,#3b5bfd,#9b5cff,#ff7ac3,#3b5bfd);padding:2px}
.av div{width:100%;height:100%;border-radius:20px;background:var(--card);display:flex;align-items:center;justify-content:center;font:800 14px Jakarta,sans-serif;color:var(--brand)}
.greet small{display:block;font-size:13px;color:var(--muted);font-weight:500}
.greet b{display:flex;align-items:center;gap:6px;font:800 21px/26px Jakarta,sans-serif;letter-spacing:-.3px}
.bell{margin-left:auto;width:44px;height:44px;border-radius:22px;background:var(--card);display:flex;align-items:center;justify-content:center;position:relative;box-shadow:var(--shadow)}
.bell i{position:absolute;top:10px;right:11px;width:9px;height:9px;border-radius:5px;background:var(--danger);border:2px solid var(--card)}
.hero{margin:14px 16px 0;border-radius:28px;padding:18px 18px 16px;color:#fff;position:relative;overflow:hidden}
.hero .blob{position:absolute;border-radius:50%;filter:blur(30px);opacity:.55}
.hero .row{display:flex;justify-content:space-between;align-items:flex-start;position:relative}
.glass{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.18);backdrop-filter:blur(8px)}
.glass i{width:7px;height:7px;border-radius:4px;background:#7dffb0;box-shadow:0 0 0 3px rgba(125,255,176,.25)}
.hero h2{font:800 23px/28px Jakarta,sans-serif;letter-spacing:-.4px;margin-top:12px;position:relative;max-width:270px}
.hero .meta{display:flex;align-items:center;gap:6px;font-size:14px;opacity:.9;margin-top:6px;position:relative}
.prog{position:relative;margin-top:16px}
.prog .track{height:6px;border-radius:3px;background:rgba(255,255,255,.25)} .prog .fill{height:6px;border-radius:3px;background:#fff;width:12%;position:relative}
.prog .fill:after{content:"";position:absolute;right:-5px;top:-4px;width:14px;height:14px;border-radius:7px;background:#fff;box-shadow:0 0 0 4px rgba(255,255,255,.3)}
.prog .lab{display:flex;justify-content:space-between;font-size:12px;font-weight:600;opacity:.9;margin-top:8px;font-variant-numeric:tabular-nums}
.cta{margin-top:16px;height:52px;border-radius:26px;background:#fff;display:flex;align-items:center;justify-content:center;gap:8px;font:800 16px Jakarta,sans-serif;position:relative;box-shadow:0 6px 16px rgba(0,0,0,.18)}
.stats{display:flex;gap:10px;padding:14px 16px 0}
.stat{flex:1;background:var(--card);border-radius:20px;padding:12px;box-shadow:var(--shadow)}
.stat .n{font:800 26px/30px Jakarta,sans-serif;letter-spacing:-.5px;display:flex;align-items:center;gap:6px}
.stat .l{font-size:12px;color:var(--muted);font-weight:600;margin-top:2px}
.sec{display:flex;justify-content:space-between;align-items:center;padding:20px 20px 10px;font:800 16px Jakarta,sans-serif}
.list{margin:0 16px;background:var(--card);border-radius:22px;box-shadow:var(--shadow);overflow:hidden}
.li{display:flex;align-items:center;gap:12px;padding:12px 14px;min-height:68px}
.li + .li{box-shadow:inset 0 1px 0 var(--ring)}
.li .t{font-size:15px;font-weight:700;line-height:20px}
.li .m{font-size:13px;color:var(--muted);margin-top:1px;font-variant-numeric:tabular-nums}
.li .chip{margin-left:auto}
/* Jadwal */
.jt{display:flex;justify-content:space-between;align-items:center;padding:14px 16px 6px 20px}
.jt h1{font:800 30px Jakarta,sans-serif;letter-spacing:-.6px}
.iconbtn{width:44px;height:44px;border-radius:22px;background:var(--card);display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow)}
.days{display:flex;gap:8px;padding:10px 16px 6px}
.dy{flex:1;height:76px;border-radius:20px;background:var(--card);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;box-shadow:var(--shadow)}
.dy small{font-size:12px;color:var(--muted);font-weight:600} .dy b{font:800 19px Jakarta,sans-serif}
.dy .dots{display:flex;gap:3px;height:6px;margin-top:3px} .dy .dots i{width:5px;height:5px;border-radius:3px;display:block}
.dy.on{background:linear-gradient(160deg,#4f6bff,#7b4dff);color:#fff} .dy.on small{color:rgba(255,255,255,.85)}
.ag{padding:6px 16px 0}
.cl{display:flex;gap:12px;align-items:center;background:var(--card);border-radius:22px;padding:12px 14px;margin-top:10px;box-shadow:var(--shadow);position:relative;overflow:hidden}
.cl .t{font-size:15px;font-weight:700} .cl .m{font-size:13px;color:var(--muted);margin-top:2px;font-variant-numeric:tabular-nums}
.cl .chip{margin-left:auto}
.cl .pb{position:absolute;left:0;bottom:0;height:4px;width:12%}
.now{display:flex;align-items:center;gap:8px;margin:10px 4px 0;font-size:12px;font-weight:800;color:var(--danger)}
.now i{flex:1;height:2px;background:var(--danger);border-radius:1px} .now b{width:8px;height:8px;border-radius:4px;background:var(--danger)}
/* Sheet */
.scrim{position:absolute;inset:0;background:rgba(5,8,20,.45);z-index:4}
.sheet{position:absolute;z-index:5;left:0;right:0;bottom:0;background:var(--sheet);border-radius:30px 30px 0 0;overflow:hidden}
.sh-top{padding:12px 22px 20px;color:#fff;position:relative;overflow:hidden}
.sh-top .handle{width:36px;height:4px;border-radius:2px;background:rgba(255,255,255,.6);margin:0 auto 14px}
.sh-top .code{font-size:13px;font-weight:700;opacity:.9;display:flex;align-items:center;gap:8px;position:relative}
.sh-top h2{font:800 22px/27px Jakarta,sans-serif;margin-top:8px;position:relative;max-width:280px}
.sh-body{padding:18px 20px 36px}
.big{font:800 34px Jakarta,sans-serif;letter-spacing:-.8px;font-variant-numeric:tabular-nums}
.where{display:flex;align-items:center;gap:6px;font-size:15px;color:var(--muted);margin-top:4px}
.tiles2{display:flex;gap:10px;margin-top:16px}
.t2{flex:1;border-radius:18px;background:var(--soft);padding:12px 14px}
.t2 .n{font:800 22px Jakarta,sans-serif;display:flex;gap:6px;align-items:center} .t2 .l{font-size:12px;font-weight:600;color:var(--muted);margin-top:2px}
.bigbtn{margin-top:18px;height:56px;border-radius:28px;background:linear-gradient(135deg,#4f6bff,#7b4dff);color:#fff;display:flex;align-items:center;justify-content:center;gap:8px;font:800 17px Jakarta,sans-serif;box-shadow:0 8px 20px rgba(79,107,255,.35)}
.ghost{height:48px;display:flex;align-items:center;justify-content:center;font:700 15px Jakarta,sans-serif;color:var(--brand);margin-top:6px}
`;

const sb = `<div class="sb"><span>08:07</span><span>▾ ▴ ▮</span></div>`;
function tabbar(on) {
  const tabs = [["Beranda", "House"], ["Jadwal", "CalendarBlank"], ["Tugas", "ListChecks"], ["Kuliah", "BookOpen"], ["Akademik", "GraduationCap"]];
  return `<div class="tabbar">${tabs.map(([l, i], n) => `<div class="tab${n === on ? " on" : ""}"><div class="pl">${icon(i, { weight: n === on ? "fill" : "regular" })}</div>${l}</div>`).join("")}</div><div class="gesture"></div>`;
}
const tileFor = (code, d, size = 44, r = 14) => {
  const k = COURSES[code];
  const col = k.c[d ? 1 : 0];
  return `<div class="tile" style="width:${size}px;height:${size}px;border-radius:${r}px;background:${col}22">${icon(k.i, { size: size * 0.55, weight: "duotone", color: col, duo: 0.35 })}</div>`;
};
const heroBg = (d) =>
  d
    ? "linear-gradient(145deg,#3b2bb3 0%,#5a3fe0 55%,#7a4dff 100%)"
    : "linear-gradient(145deg,#5b3df5 0%,#6e46fb 50%,#9a62ff 100%)";

function beranda(d) {
  return `
<div class="top"><div class="av"><div>DP</div></div><div class="greet"><small>Kamis, 8 Okt</small><b class="j">Pagi, Dimas ${icon("Sun", { size: 22, weight: "duotone", color: "#f59e0b", duo: 0.5 })}</b></div><div class="bell">${icon("Bell")}<i></i></div></div>
<div class="hero" style="background:${heroBg(d)}">
  <div class="blob" style="width:180px;height:180px;background:#ff7ac3;right:-50px;top:-60px"></div>
  <div class="blob" style="width:140px;height:140px;background:#3cc8ff;left:-40px;bottom:-60px"></div>
  <div class="row"><span class="glass"><i></i>Berlangsung</span><div class="tile" style="width:46px;height:46px;background:rgba(255,255,255,.18)">${icon("ChartLineUp", { size: 26, weight: "duotone", color: "#fff", duo: 0.4 })}</div></div>
  <h2>Ekonomi dan Inovasi dalam Perencanaan</h2>
  <div class="meta">${icon("MapPin", { size: 16, weight: "fill", color: "#fff" })}R.SG PWK LT.6</div>
  <div class="prog"><div class="track"><div class="fill"></div></div><div class="lab"><span>08:00</span><span>1j 53m lagi</span><span>10:00</span></div></div>
  <div class="cta" style="color:${d ? "#4a33d6" : "#5b3df5"}">${icon("Hand", { size: 22, weight: "fill", color: d ? "#4a33d6" : "#5b3df5" })}Tandai Hadir</div>
</div>
<div class="stats">
  <div class="stat"><div class="n">${icon("Fire", { size: 22, weight: "fill", color: "var(--fire)" })}2</div><div class="l">tenggat</div></div>
  <div class="stat"><div class="n">${icon("Exam", { size: 22, weight: "fill", color: "var(--danger)" })}1</div><div class="l">ujian</div></div>
  <div class="stat"><div class="n">${icon("Hand", { size: 22, weight: "fill", color: "var(--ok)" })}1×</div><div class="l">boleh absen</div></div>
</div>
<div class="sec j">Perlu kamu urus</div>
<div class="list">
  <div class="li">${tileFor("DK4073", d)}<div><div class="t">UTS Komunikasi Pemasaran</div><div class="m">Kamis · 11:00</div></div><span class="chip d">7 hari</span></div>
  <div class="li">${tileFor("II4091", d)}<div><div class="t">Tugas 02 Bab II</div><div class="m">Jumat · 23:59</div></div><span class="chip w">8 hari</span></div>
</div>`;
}

function jadwal(d) {
  const day = (w, n, on, codes = []) =>
    `<div class="dy${on ? " on" : ""}"><small>${w}</small><b>${n}</b><div class="dots">${codes.map((c) => `<i style="background:${on ? "#fff" : COURSES[c].c[d ? 1 : 0]}"></i>`).join("")}</div></div>`;
  const cl = (code, time, room, chip, nowish) => {
    const k = COURSES[code];
    const col = k.c[d ? 1 : 0];
    return `<div class="cl" ${nowish ? `style="background:${col}${d ? "26" : "14"}"` : ""}>${tileFor(code, d)}<div><div class="t">${k.s}</div><div class="m">${time} · ${room}</div></div>${chip ?? ""}${nowish ? `<div class="pb" style="background:${col}"></div>` : ""}</div>`;
  };
  return `
<div class="jt"><h1>Jadwal</h1><div class="iconbtn">${icon("CalendarDots")}</div></div>
<div class="days">${day("Sen", 5, 0, ["PL3002", "II4091"])}${day("Sel", 6, 0, ["KU5014"])}${day("Rab", 7, 0, ["DK4073"])}${day("Kam", 8, 1, ["PL3002", "DK4073", "KU5014"])}${day("Jum", 9, 0, ["II4091"])}</div>
<div class="ag">
${cl("PL3002", "08:00", "R.SG PWK LT.6", `<span class="chip w">Jam berubah</span>`, true)}
<div class="now"><b></b>08:07<i></i></div>
${cl("DK4073", "11:00", "TVST C")}
${cl("PL3032", "15:00", "R.SG PWK LT.6", `<span class="chip w">Bentrok</span>`)}
${cl("KU5014", "16:00", "9134")}
</div>`;
}

function sheet(d) {
  return `<div class="sh-top" style="background:${heroBg(d)}">
  <div class="blob" style="position:absolute;width:160px;height:160px;border-radius:50%;filter:blur(30px);opacity:.5;background:#ff7ac3;right:-40px;top:-50px"></div>
  <div class="handle"></div>
  <div class="code"><div class="tile" style="width:36px;height:36px;border-radius:12px;background:rgba(255,255,255,.2)">${icon("ChartLineUp", { size: 20, weight: "duotone", color: "#fff", duo: 0.4 })}</div>PL3002 · Kuliah</div>
  <h2>Ekonomi dan Inovasi dalam Perencanaan</h2></div>
<div class="sh-body">
  <div class="big j">08:00–10:00</div>
  <div class="where">${icon("MapPin", { size: 18, weight: "fill" })}R.SG PWK LT.6</div>
  <div class="tiles2"><div class="t2"><div class="n">${icon("Hand", { size: 20, weight: "fill", color: "var(--ok)" })}1×</div><div class="l">boleh absen</div></div><div class="t2"><div class="n">85%</div><div class="l">kehadiran</div></div></div>
  <div class="bigbtn">${icon("Hand", { size: 22, weight: "fill", color: "#fff" })}Tandai Hadir</div>
  <div class="ghost">Buka mata kuliah</div>
</div>`;
}

export function phone(screen, theme) {
  const d = theme === "dark";
  const inner =
    screen === "sheet"
      ? `<div class="content">${beranda(d)}</div>${tabbar(0)}<div class="scrim"></div><div class="sheet">${sheet(d)}</div>`
      : `<div class="content">${screen === "beranda" ? beranda(d) : jadwal(d)}</div>${tabbar(screen === "beranda" ? 0 : 1)}`;
  return `<div class="phone" style="${VARS[theme]}">${sb}${inner}</div>`;
}
export const COUNT_JS = `
function countWords(ph){
  const sheet = ph.querySelector('.sheet'); const area = sheet ?? ph.querySelector('.content');
  const top = area.getBoundingClientRect().top; const limit = sheet ? ph.getBoundingClientRect().bottom : ph.querySelector('.tabbar').getBoundingClientRect().top;
  let n = 0; const w = document.createTreeWalker(area, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) { const t = w.currentNode; const r = document.createRange(); r.selectNodeContents(t); const b = r.getBoundingClientRect();
    if (!b.height || b.top >= limit || b.bottom <= top) continue; n += (t.textContent.match(/[\\p{L}\\p{N}][\\p{L}\\p{N}.:,×%–-]*/gu) || []).length; }
  return n; }
for (const ph of document.querySelectorAll('.phone')) ph.dataset.words = countWords(ph);`;
export { CSS };
for (const s of ["beranda", "jadwal", "sheet"])
  for (const t of ["light", "dark"])
    fs.writeFileSync(path.join(OUT, `v2-${s}-${t}.html`), `<!doctype html><meta charset="utf-8"><style>${CSS}</style><body style="margin:0">${phone(s, t)}<script>${COUNT_JS}</script></body>`);
