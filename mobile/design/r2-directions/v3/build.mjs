// Round 2, v3: built from the reference apps' real screens. Edunex blue in one header area (as GoPay holds its balance),
// content on a grey sheet over it, white grouped sections with hairlines, course icons on white tiles, outlined status
// chips, Roboto at medium weights; Jadwal and the class sheet calm as Todoist, red only for "now".
import fs from "node:fs";
import path from "node:path";

const OUT = process.argv[2] ?? "/tmp/mock/out3";
fs.mkdirSync(OUT, { recursive: true });
const I = JSON.parse(fs.readFileSync("/tmp/mock/icons2.json", "utf8"));
const icon = (name, { size = 24, weight = "regular", color = "currentColor", duo = 0.25 } = {}) => {
  const ps = I[name][weight] ?? I[name].regular;
  const body = weight === "duotone" ? `<path d="${ps[0]}" opacity="${duo}"/><path d="${ps[1]}"/>` : ps.map((d) => `<path d="${d}"/>`).join("");
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 256 256" fill="${color}">${body}</svg>`;
};

const COURSES = {
  PL3002: { c: ["#6e46fb", "#9d86ff"], i: "ChartLineUp", s: "Ekonomi dan Inovasi", n: "Ekonomi dan Inovasi dalam Perencanaan" },
  DK4073: { c: ["#0a6fbf", "#5aa7ea"], i: "Megaphone", s: "Komunikasi Pemasaran", n: "Komunikasi Pemasaran" },
  PL3032: { c: ["#c2307f", "#ff86c6"], i: "Train", s: "Ekonomi Infrastruktur", n: "Ekonomi Infrastruktur dan Transportasi" },
  KU5014: { c: ["#0a8aa8", "#3ccbe9"], i: "PuzzlePiece", s: "Penyelesaian Masalah", n: "Teknik Penyelesaian Masalah Terstruktur" },
  II4091: { c: ["#8a2be2", "#c08bff"], i: "GraduationCap", s: "Proposal Tugas Akhir", n: "Proposal Tugas Akhir" },
};

const VARS = {
  light:
    "--page:#f2f4f7;--white:#ffffff;--fg:#121417;--fg2:#4a5160;--muted:#6b7280;--line:#e7e9ee;--brand:#2f6feb;--brandDeep:#2357c9;--onbrand:#ffffff;--tile:#ffffff;--tileLine:#e9ecf1;--bar:#ffffff;--pill:#dde7fd;--now:#d93025;--warn:#b25e00;--danger:#c5221f;--shadow:0 1px 2px rgba(16,24,40,.04)",
  dark:
    "--page:#0d0f13;--white:#171a20;--fg:#eef0f4;--fg2:#c3c8d2;--muted:#9097a5;--line:#252932;--brand:#2f6feb;--brandDeep:#1c3f8f;--onbrand:#ffffff;--tile:#1e222a;--tileLine:#2a2f39;--bar:#131619;--pill:#24366b;--now:#ff6b5e;--warn:#ffb15c;--danger:#ff7b72;--shadow:none",
};

const CSS = `
@font-face{font-family:RobotoX;src:url(file:///tmp/mock/font/Roboto.ttf);font-weight:100 900}
*{box-sizing:border-box;margin:0;padding:0}
.phone{width:390px;height:844px;position:relative;overflow:hidden;background:var(--page);color:var(--fg);font-family:RobotoX,sans-serif;-webkit-font-smoothing:antialiased;letter-spacing:.1px}
.ic{display:block;flex-shrink:0}
.sb{height:28px;display:flex;align-items:center;justify-content:space-between;padding:0 22px;font-size:13px;font-weight:500;position:relative;z-index:2}
.content{position:absolute;top:0;left:0;right:0;bottom:80px;overflow:hidden}
.tabbar{position:absolute;left:0;right:0;bottom:0;height:80px;background:var(--bar);display:flex;justify-content:space-around;padding-top:10px;border-top:1px solid var(--line)}
.tab{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px;font-weight:500;color:var(--muted);width:72px}
.tab .pl{width:56px;height:30px;border-radius:15px;display:flex;align-items:center;justify-content:center}
.tab.on{color:var(--fg)} .tab.on .pl{background:var(--pill);color:var(--brand)}
.gesture{position:absolute;bottom:6px;left:50%;transform:translateX(-50%);width:108px;height:4px;border-radius:2px;background:var(--fg);opacity:.3}
/* header area: Edunex blue, a faint pattern of the e+ mark's diagonal */
.head{background:var(--brand);color:var(--onbrand);padding:28px 20px 44px;position:relative;
  background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.045) 0 1px,transparent 1px 14px)}
.phone.dark .head{background-color:#1a47a8}
.hrow{display:flex;align-items:center;justify-content:space-between;height:52px}
.hello{font-size:15px;font-weight:500;opacity:.92}
.hbtn{width:40px;height:40px;border-radius:20px;display:flex;align-items:center;justify-content:center;position:relative}
.hbtn i{position:absolute;top:8px;right:9px;width:8px;height:8px;border-radius:4px;background:#ffcc4d;border:1.5px solid var(--brand)}
.kick{font-size:13px;font-weight:500;opacity:.85;margin-top:10px;display:flex;align-items:center;gap:6px}
.kick b{width:6px;height:6px;border-radius:3px;background:#7ff0b2;display:block}
.cname{font-size:24px;line-height:30px;font-weight:500;margin-top:6px;letter-spacing:-.2px}
.cmeta{display:flex;align-items:center;gap:6px;font-size:14px;opacity:.88;margin-top:6px}
.hacts{display:flex;gap:10px;margin-top:18px}
.hb{height:44px;border-radius:22px;padding:0 18px;display:flex;align-items:center;gap:8px;font-size:15px;font-weight:600}
.hb.solid{background:#fff;color:var(--brandDeep)} .dark .hb.solid{color:#1d4fb8}
.hb.line{border:1px solid rgba(255,255,255,.55);color:#fff;font-weight:500}
.sheetp{position:relative;margin-top:-24px;background:var(--page);border-radius:24px 24px 0 0;padding:16px 16px 0}
.group{background:var(--white);border-radius:20px;overflow:hidden;box-shadow:var(--shadow)}
.gh{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 4px;font-size:17px;font-weight:600}
.gh small{font-size:14px;font-weight:500;color:var(--brand)} .dark .gh small{color:#8eb0ff}
.row{display:flex;align-items:center;gap:14px;padding:12px 16px;min-height:68px}
.row{position:relative}
.row + .row:before{content:"";position:absolute;top:0;right:0;left:72px;height:1px;background:var(--line)}
.row.t + .row.t:before{left:76px}
.tile{width:42px;height:42px;border-radius:13px;background:var(--tile);border:1px solid var(--tileLine);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.rt{font-size:16px;font-weight:500;line-height:21px} .rm{font-size:14px;color:var(--muted);margin-top:2px;font-variant-numeric:tabular-nums}
.chip{margin-left:auto;font-size:12px;font-weight:500;padding:4px 10px;border-radius:999px;white-space:nowrap;border:1px solid currentColor}
.chip.d{color:var(--danger)} .chip.w{color:var(--warn)}
.tm{width:48px;margin-right:14px;font-size:15px;font-weight:500;font-variant-numeric:tabular-nums}
.gap{height:12px}
/* Jadwal: calm as Todoist */
.jhead{padding:28px 16px 0 20px;background:var(--white)}
.jtop{display:flex;align-items:center;justify-content:space-between;height:56px}
.jtop h1{font-size:22px;font-weight:500}
.month{display:flex;align-items:center;gap:4px;font-size:15px;font-weight:500;color:var(--fg2);margin-top:2px}
.week{display:flex;justify-content:space-between;padding:14px 0 12px}
.wd{width:44px;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px;color:var(--muted)}
.wd b{width:36px;height:36px;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:500;color:var(--fg)}
.wd.on{color:var(--now);font-weight:600} .wd.on b{background:var(--now);color:#fff}
.wd i{width:4px;height:4px;border-radius:2px;background:var(--muted);opacity:.5;display:block} .wd.none i{opacity:0}
.cal{background:var(--white);border-top:1px solid var(--line);position:relative;height:100%;padding-top:${62 / 2}px}
.hr{position:relative;height:62px;border-top:1px solid var(--line);margin-left:56px}
.hr span{position:absolute;left:-48px;top:-8px;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.ev{position:absolute;left:62px;right:14px;border-radius:10px;padding:8px 12px;overflow:hidden;font-size:14px;font-weight:500;line-height:18px}
.ev small{display:block;font-size:12px;font-weight:400;opacity:.8;margin-top:2px}
.ev:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px}
.nowl{position:absolute;left:52px;right:0;height:2px;background:var(--now)}
.nowl:before{content:"";position:absolute;left:-5px;top:-4px;width:10px;height:10px;border-radius:5px;background:var(--now)}
.nowt{position:absolute;left:10px;background:var(--white);padding:0 2px;font-size:11px;font-weight:600;color:var(--now);font-variant-numeric:tabular-nums}
/* class sheet: Todoist's task sheet */
.scrim{position:absolute;inset:0;background:rgba(0,0,0,.32);z-index:4}
.sheet{position:absolute;z-index:5;left:0;right:0;bottom:0;background:var(--white);border-radius:28px 28px 0 0;padding:10px 22px 34px}
.handle{width:32px;height:4px;border-radius:2px;background:var(--muted);opacity:.45;margin:0 auto 16px}
.crumb{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--muted);font-weight:500}
.crumb i{width:10px;height:10px;border-radius:3px;display:block}
.stitle{font-size:22px;line-height:28px;font-weight:500;margin-top:10px}
.fact{display:flex;align-items:center;gap:14px;font-size:16px;color:var(--fg2);margin-top:16px}
.fact .ic{color:var(--muted)}
.pbtn{margin-top:24px;height:52px;border-radius:26px;background:var(--brand);color:#fff;display:flex;align-items:center;justify-content:center;gap:8px;font-size:16px;font-weight:600}
.sbtn{margin-top:10px;height:48px;border-radius:24px;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:500;color:var(--fg)}
`;

const sb = (light) => `<div class="sb" style="color:${light ? "#fff" : "var(--fg)"}"><span>08:07</span><span>▾ ▴ ▮</span></div>`;
function tabbar(on) {
  const tabs = [["Beranda", "House"], ["Jadwal", "CalendarBlank"], ["Tugas", "ListChecks"], ["Kuliah", "BookOpen"], ["Akademik", "GraduationCap"]];
  return `<div class="tabbar">${tabs.map(([l, i], n) => `<div class="tab${n === on ? " on" : ""}"><div class="pl">${icon(i, { weight: n === on ? "fill" : "regular" })}</div>${l}</div>`).join("")}</div><div class="gesture"></div>`;
}
const tile = (code, d) => {
  const k = COURSES[code];
  return `<div class="tile">${icon(k.i, { size: 22, weight: "duotone", color: k.c[d ? 1 : 0], duo: 0.28 })}</div>`;
};

function beranda(d) {
  return `<div class="head">
  <div class="hrow"><span class="hello">Pagi, Dimas</span><span style="display:flex;gap:2px"><span class="hbtn">${icon("MagnifyingGlass", { color: "#fff" })}</span><span class="hbtn">${icon("Bell", { color: "#fff" })}<i></i></span></span></div>
  <div class="kick"><b></b>Sekarang · sampai 10:00</div>
  <div class="cname">Ekonomi dan Inovasi dalam Perencanaan</div>
  <div class="cmeta">${icon("MapPin", { size: 16, color: "#fff" })}R.SG PWK LT.6</div>
  <div class="hacts"><div class="hb solid">${icon("Hand", { size: 20, weight: "fill", color: d ? "#1d4fb8" : "#2357c9" })}Tandai Hadir</div></div>
</div>
<div class="sheetp">
  <div class="group">
    <div class="gh">Perlu kamu urus</div>
    <div class="row">${tile("DK4073", d)}<div><div class="rt">UTS Komunikasi Pemasaran</div><div class="rm">Kamis, 15 Okt · 11:00</div></div></div>
    <div class="row">${tile("II4091", d)}<div><div class="rt">Tugas 02 Bab II</div><div class="rm">Jumat, 16 Okt · 23:59</div></div></div>
  </div>
  <div class="gap"></div>
  <div class="group">
    <div class="gh">Nanti hari ini</div>
    <div class="row t"><div class="tm">11:00</div><div class="rt">Komunikasi Pemasaran</div><span class="chip d">Jatah habis</span></div>
    <div class="row t"><div class="tm">15:00</div><div class="rt">Ekonomi Infrastruktur</div><span class="chip w">Bentrok</span></div>
  </div>
</div>`;
}

function jadwal(d) {
  const days = [["Sen", 5], ["Sel", 6], ["Rab", 7], ["Kam", 8, "on"], ["Jum", 9], ["Sab", 10, "none"], ["Min", 11, "none"]];
  const HOUR = 62;
  const top0 = 7.5; // the grid starts half an hour before the first class
  const y = (h, m) => (h - top0) * HOUR + (m / 60) * HOUR;
  const ev = (code, h1, m1, h2, m2, sub) => {
    const k = COURSES[code];
    const col = k.c[d ? 1 : 0];
    return `<div class="ev" style="top:${y(h1, m1) + 2}px;height:${y(h2, m2) - y(h1, m1) - 4}px;background:${col}${d ? "2e" : "1a"};color:${d ? "#eef0f4" : "#121417"}"><span style="position:absolute;left:0;top:0;bottom:0;width:4px;background:${col}"></span>${k.s}<small>${sub}</small></div>`;
  };
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16];
  return `<div class="jhead">
  <div class="jtop"><div><h1>Jadwal</h1></div><span style="display:flex;gap:4px">${icon("CalendarDots")}</span></div>
  <div class="month">Oktober 2026 <span style="font-size:11px">▾</span></div>
  <div class="week">${days.map(([w, n, s]) => `<div class="wd ${s ?? ""}">${w}<b>${n}</b><i></i></div>`).join("")}</div>
</div>
<div class="cal">
  ${hours.map((h) => `<div class="hr"><span${h === 8 ? ' style="opacity:0"' : ""}>${String(h).padStart(2, "0")}:00</span></div>`).join("")}
  ${ev("PL3002", 8, 0, 10, 0, "R.SG PWK LT.6")}
  ${ev("DK4073", 11, 0, 12, 59, "TVST C")}
  ${ev("PL3032", 15, 0, 16, 30, "R.SG PWK LT.6")}
  <div class="nowl" style="top:${y(8, 7)}px"></div><div class="nowt" style="top:${y(8, 7) - 7}px">08:07</div>
</div>`;
}

function sheet(d) {
  return `<div class="handle"></div>
<div class="crumb"><i style="background:${COURSES.PL3002.c[d ? 1 : 0]}"></i>PL3002 · Kuliah</div>
<div class="stitle">Ekonomi dan Inovasi dalam Perencanaan</div>
<div class="fact">${icon("Clock", { size: 22 })}Kamis, 8 Okt · 08:00–10:00</div>
<div class="fact">${icon("MapPin", { size: 22 })}R.SG PWK LT.6</div>
<div class="fact">${icon("Hand", { size: 22 })}Boleh absen 1× lagi</div>
<div class="pbtn">${icon("Hand", { size: 20, weight: "fill", color: "#fff" })}Tandai Hadir</div>
<div class="sbtn">Buka mata kuliah</div>`;
}

export function phone(screen, theme) {
  const d = theme === "dark";
  const inner =
    screen === "sheet"
      ? `<div class="content">${beranda(d)}</div>${tabbar(0)}<div class="scrim"></div><div class="sheet">${sheet(d)}</div>`
      : `<div class="content">${screen === "beranda" ? beranda(d) : jadwal(d)}</div>${tabbar(screen === "beranda" ? 0 : 1)}`;
  return `<div class="phone ${theme}" style="${VARS[theme]}"><div style="position:absolute;top:0;left:0;right:0;z-index:3">${sb(screen !== "jadwal")}</div>${inner}</div>`;
}
const COUNT_JS = `
function countWords(ph){
  const sheet = ph.querySelector('.sheet'); const area = sheet ?? ph.querySelector('.content');
  const top = area.getBoundingClientRect().top + (sheet ? 0 : 28); const limit = sheet ? ph.getBoundingClientRect().bottom : ph.querySelector('.tabbar').getBoundingClientRect().top;
  let n = 0; const w = document.createTreeWalker(area, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) { const t = w.currentNode; const r = document.createRange(); r.selectNodeContents(t); const b = r.getBoundingClientRect();
    if (!b.height || b.top >= limit || b.bottom <= top) continue; n += (t.textContent.match(/[\\p{L}\\p{N}][\\p{L}\\p{N}.:,×%–-]*/gu) || []).length; }
  return n; }
for (const ph of document.querySelectorAll('.phone')) ph.dataset.words = countWords(ph);`;
for (const s of ["beranda", "jadwal", "sheet"])
  for (const t of ["light", "dark"])
    fs.writeFileSync(path.join(OUT, `v3-${s}-${t}.html`), `<!doctype html><meta charset="utf-8"><style>${CSS}</style><body style="margin:0">${phone(s, t)}<script>${COUNT_JS}</script></body>`);
