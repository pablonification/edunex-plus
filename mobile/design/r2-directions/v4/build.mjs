// Round 2, v4: v3's calm structure plus what makes the reference apps alive in a still: course colour as tinted
// filled tiles (Grab/GoPay service tiles), number-forward cards (GoPay's balance), a brand face for headings and
// numbers (Plus Jakarta Sans), M3 Expressive's wavy progress and cookie shape, and real motion (live HTML).
import fs from "node:fs";
import path from "node:path";

const OUT = process.argv[2] ?? "/tmp/mock/v4/out";
fs.mkdirSync(OUT, { recursive: true });
const I = JSON.parse(fs.readFileSync("/tmp/mock/icons2.json", "utf8"));
const icon = (name, { size = 24, weight = "regular", color = "currentColor", duo = 0.3, cls = "" } = {}) => {
  const ps = I[name][weight] ?? I[name].regular;
  const body = weight === "duotone" ? `<path d="${ps[0]}" opacity="${duo}"/><path d="${ps[1]}"/>` : ps.map((d) => `<path d="${d}"/>`).join("");
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 256 256" fill="${color}">${body}</svg>`;
};
const font = (f) => "data:font/ttf;base64," + fs.readFileSync(`/tmp/mock/font/${f}`).toString("base64");

// course colour: [ink on light, ink on dark, tint on light, tint on dark]
const C = {
  PL3002: { k: ["#5b3df0", "#b3a3ff", "#efebff", "#262046"], i: "ChartLineUp", s: "Ekonomi dan Inovasi", n: "Ekonomi dan Inovasi dalam Perencanaan" },
  DK4073: { k: ["#0a64ad", "#8cc4f5", "#e6f1fb", "#14283c"], i: "Megaphone", s: "Komunikasi Pemasaran", n: "Komunikasi Pemasaran" },
  PL3032: { k: ["#b0256f", "#ff9fd2", "#fce9f3", "#3a1a2c"], i: "Train", s: "Ekonomi Infrastruktur", n: "Ekonomi Infrastruktur dan Transportasi" },
  II4091: { k: ["#0b7a5a", "#7fe0bf", "#e5f5ef", "#13332a"], i: "GraduationCap", s: "Proposal Tugas Akhir", n: "Proposal Tugas Akhir" },
};
const ink = (c, d) => C[c].k[d ? 1 : 0];
const tint = (c, d) => C[c].k[d ? 3 : 2];

const VARS = {
  light: "--page:#f1f3f7;--card:#fff;--fg:#14171c;--fg2:#3f4652;--muted:#5f6673;--line:#e6e9ef;--brand:#1f63e0;--onbtn:#ffffff;--head:#1f63e0;--onbrand:#fff;--bar:#fff;--pill:#dbe6ff;--pillfg:#1450c4;--now:#d93025;--redbg:#fde7e6;--redfg:#a8201a;--ambbg:#fff0d9;--ambfg:#7f4500;--okbg:#e3f4e8;--okfg:#11692f;--shadow:0 1px 2px rgba(16,24,40,.05),0 6px 20px rgba(16,24,40,.06)",
  dark: "--page:#0c0e12;--card:#171a20;--fg:#eef0f4;--fg2:#c8cdd6;--muted:#9aa1ae;--line:#262a33;--brand:#a9c4ff;--onbtn:#0a2a66;--head:#163f94;--onbrand:#fff;--bar:#121418;--pill:#22355f;--pillfg:#b9ceff;--now:#ff6b5e;--redbg:#3d1b1a;--redfg:#ffb4ab;--ambbg:#3a2a12;--ambfg:#ffcf8a;--okbg:#14301f;--okfg:#8fe0a8;--shadow:none",
};

const CSS = `
@font-face{font-family:Rob;src:url(${font("Roboto.ttf")});font-weight:100 900}
@font-face{font-family:Jak;src:url(${font("Jakarta.ttf")});font-weight:200 800}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#d9dde4;font-family:Rob,sans-serif}
.stage{display:flex;gap:28px;padding:28px;flex-wrap:wrap;align-items:flex-start}
.cap{font:500 13px Rob;color:#3f4652;margin-top:10px;text-align:center;width:390px}
.phone{width:390px;height:844px;position:relative;overflow:hidden;background:var(--page);color:var(--fg);-webkit-font-smoothing:antialiased;border-radius:28px;box-shadow:0 10px 40px rgba(0,0,0,.18)}
.j{font-family:Jak,Rob,sans-serif}
.ic{display:block;flex-shrink:0}
.sb{height:28px;display:flex;align-items:center;justify-content:space-between;padding:0 22px;font-size:13px;font-weight:500;position:absolute;top:0;left:0;right:0;z-index:3}
.content{position:absolute;top:0;left:0;right:0;bottom:80px;overflow:hidden}
.tabbar{position:absolute;left:0;right:0;bottom:0;height:80px;background:var(--bar);display:flex;justify-content:space-around;padding-top:10px;border-top:1px solid var(--line)}
.tab{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px;font-weight:500;color:var(--muted);width:72px}
.tab .pl{width:56px;height:30px;border-radius:15px;display:flex;align-items:center;justify-content:center}
.tab.on{color:var(--fg);font-weight:600} .tab.on .pl{background:var(--pill);color:var(--pillfg)}
.gesture{position:absolute;bottom:6px;left:50%;transform:translateX(-50%);width:108px;height:4px;border-radius:2px;background:var(--fg);opacity:.3}
/* press: give a little, come back on a spring */
.press{transition:transform .38s cubic-bezier(.34,1.56,.64,1);cursor:pointer;-webkit-tap-highlight-color:transparent}
.press:active{transform:scale(.965);transition-duration:.12s;transition-timing-function:cubic-bezier(.2,0,0,1)}
/* enter: rise on an expressive spring, staggered */
.in{animation:rise .62s cubic-bezier(.34,1.3,.64,1) both;animation-delay:calc(var(--i,0) * 55ms + 80ms)}
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.head{background:var(--head);color:var(--onbrand);padding:28px 20px 84px}
.hrow{display:flex;align-items:center;justify-content:space-between;height:56px}
.hello{font-size:22px;font-weight:700;letter-spacing:-.3px}
.date{font-size:14px;opacity:.85;margin-top:-6px}
.hbtn{width:48px;height:48px;border-radius:24px;display:flex;align-items:center;justify-content:center;position:relative}
.hbtn i{position:absolute;top:12px;right:13px;width:9px;height:9px;border-radius:5px;background:#ffcc4d;border:2px solid var(--head)}
.body{position:relative;margin-top:-60px;padding:0 16px}
.now{background:var(--card);border-radius:24px;padding:16px;box-shadow:var(--shadow)}
.nrow{display:flex;gap:12px;align-items:flex-start}
.tile{width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.kick{font-size:13px;font-weight:500;color:var(--muted);display:flex;align-items:center;gap:6px}
.kick b{width:7px;height:7px;border-radius:4px;background:#1e9e5a;display:block;box-shadow:0 0 0 0 rgba(30,158,90,.5);animation:pulse 2s infinite}
@keyframes pulse{70%{box-shadow:0 0 0 6px rgba(30,158,90,0)}100%{box-shadow:0 0 0 0 rgba(30,158,90,0)}}
.cname{font-size:18px;line-height:24px;font-weight:700;letter-spacing:-.2px;margin-top:3px}
.prog{display:flex;align-items:center;gap:12px;margin:16px 0 14px}
.wave{flex:1;height:14px;overflow:visible}
.wave .w{animation:wv 1.1s linear infinite}
@keyframes wv{to{transform:translateX(-20px)}}
.left{font-size:15px;font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums}
.left span{font-family:Rob;font-weight:500;color:var(--muted);font-size:13px;margin-left:3px}
.cta{height:52px;border-radius:26px;background:var(--brand);color:var(--onbtn);display:flex;align-items:center;justify-content:center;gap:8px;font-size:16px;font-weight:600;position:relative;overflow:hidden;
  transition:background .35s,color .35s,transform .38s cubic-bezier(.34,1.56,.64,1)}
.cta .lbl{display:flex;align-items:center;gap:8px;transition:opacity .15s,transform .3s}
.cta .ok{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:8px;opacity:0;color:var(--okfg);font-weight:600}
.cta.done{background:var(--okbg)} .cta.done .lbl{opacity:0;transform:translateY(-10px)} .cta.done .ok{opacity:1}
.cookie{width:28px;height:28px;transform:scale(.3) rotate(-90deg);transition:transform .7s cubic-bezier(.34,1.56,.64,1) .05s}
.cta.done .cookie{transform:scale(1) rotate(0)}
.cookie .ck{stroke-dasharray:24;stroke-dashoffset:24;transition:stroke-dashoffset .35s cubic-bezier(.2,0,0,1) .35s}
.cta.done .cookie .ck{stroke-dashoffset:0}
.sec{display:flex;align-items:center;justify-content:space-between;margin:24px 4px 10px}
.sec h2{font-size:17px;font-weight:700;letter-spacing:-.2px}
.sec a{font-size:14px;font-weight:600;color:var(--brand)}
.due{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.dc{border-radius:20px;padding:14px;min-height:148px;display:flex;flex-direction:column}
.dc .top{display:flex;justify-content:space-between;align-items:center}
.dc .kind{font-size:12px;font-weight:600;padding:3px 9px;border-radius:999px;background:var(--card)}
.big{font-size:36px;font-weight:800;letter-spacing:-1px;line-height:1;margin-top:14px;font-variant-numeric:tabular-nums}
.big small{font-size:15px;font-weight:600;letter-spacing:0;margin-left:4px}
.dc .t{font-size:14px;line-height:19px;font-weight:500;margin-top:auto;padding-top:10px;color:var(--fg)}
.group{background:var(--card);border-radius:20px;overflow:hidden}
.row{display:flex;align-items:center;gap:12px;padding:12px 14px;min-height:68px;position:relative}
.row + .row:before{content:"";position:absolute;top:0;right:0;left:70px;height:1px;background:var(--line)}
.rt{font-size:16px;font-weight:500;line-height:21px} .rm{font-size:14px;color:var(--muted);margin-top:2px;font-variant-numeric:tabular-nums}
.chip{margin-left:auto;font-size:12px;font-weight:600;padding:5px 10px;border-radius:999px;white-space:nowrap}
.chip.r{background:var(--redbg);color:var(--redfg)} .chip.a{background:var(--ambbg);color:var(--ambfg)}
/* sheet: scrim fades, sheet rides a spring */
.scrim{position:absolute;inset:0;background:rgba(0,0,0,.32);z-index:4;opacity:0;pointer-events:none;transition:opacity .28s cubic-bezier(.2,0,0,1)}
.sheet{position:absolute;z-index:5;left:0;right:0;bottom:0;background:var(--card);border-radius:28px 28px 0 0;padding:10px 22px 30px;transform:translateY(105%);transition:transform .5s cubic-bezier(.34,1.18,.64,1)}
.open .scrim{opacity:1;pointer-events:auto} .open .sheet{transform:none}
.handle{width:32px;height:4px;border-radius:2px;background:var(--muted);opacity:.45;margin:0 auto 16px}
.shd{display:flex;gap:14px;align-items:center}
.crumb{font-size:13px;color:var(--muted);font-weight:500}
.stitle{font-size:20px;line-height:26px;font-weight:700;letter-spacing:-.2px;margin-top:2px}
.fact{display:flex;align-items:center;gap:14px;font-size:16px;color:var(--fg2);height:48px}
.fact .ic{color:var(--muted)}
.facts{margin-top:14px}
.pips{margin-left:auto;display:flex;gap:4px} .pips i{width:18px;height:8px;border-radius:4px;background:var(--line)} .pips i.u{background:var(--redfg);opacity:.75}
.sbtn{margin-top:10px;height:52px;border-radius:26px;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;color:var(--fg)}
/* Jadwal */
.jhead{padding:28px 16px 0 20px;background:var(--card)}
.jtop{display:flex;align-items:center;justify-content:space-between;height:56px}
.jtop h1{font-size:22px;font-weight:700;letter-spacing:-.3px}
.month{display:flex;align-items:center;gap:4px;font-size:15px;font-weight:500;color:var(--fg2)}
.week{display:flex;justify-content:space-between;padding:12px 0 10px}
.wd{width:44px;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px;color:var(--muted)}
.wd b{width:38px;height:38px;border-radius:19px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;color:var(--fg)}
.wd.on{color:var(--now);font-weight:700} .wd.on b{background:var(--now);color:#fff}
.wd .dots{display:flex;gap:3px;height:5px} .wd .dots i{width:5px;height:5px;border-radius:3px;display:block}
.cal{background:var(--card);border-top:1px solid var(--line);position:relative;height:100%;padding-top:20px}
.hr{position:relative;height:66px;border-top:1px solid var(--line);margin-left:58px}
.hr span{position:absolute;left:-48px;top:-8px;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.ev{position:absolute;left:66px;right:14px;border-radius:14px;padding:10px 12px;overflow:hidden;font-size:15px;font-weight:600;line-height:19px;display:flex;gap:10px}
.ev small{display:block;font-size:13px;font-weight:400;color:var(--fg2);margin-top:3px}
.ev .done{position:absolute;left:0;right:0;top:0;opacity:.14}
.nowl{position:absolute;left:54px;right:0;height:2px;background:var(--now);z-index:2}
.nowl:before{content:"";position:absolute;left:-5px;top:-4px;width:10px;height:10px;border-radius:5px;background:var(--now)}
.nowt{position:absolute;left:8px;background:var(--card);padding:0 2px;font-size:11px;font-weight:700;color:var(--now);z-index:2}
`;

const sb = (white) => `<div class="sb" style="color:${white ? "#fff" : "var(--fg)"}"><span>09:07</span><span>▾ ▴ ▮</span></div>`;
function tabbar(on) {
  const tabs = [["Beranda", "House"], ["Jadwal", "CalendarBlank"], ["Tugas", "ListChecks"], ["Kuliah", "BookOpen"], ["Akademik", "GraduationCap"]];
  return `<div class="tabbar">${tabs.map(([l, i], n) => `<div class="tab press${n === on ? " on" : ""}"><div class="pl">${icon(i, { weight: n === on ? "fill" : "regular" })}</div>${l}</div>`).join("")}</div><div class="gesture"></div>`;
}
const tile = (c, d, size = 44) =>
  `<div class="tile" style="background:${tint(c, d)};width:${size}px;height:${size}px;border-radius:${size * 0.32}px">${icon(C[c].i, { size: size * 0.52, weight: "duotone", color: ink(c, d), duo: 0.35 })}</div>`;

// M3 Expressive wavy progress: a moving wave up to "now", a flat track after, a stop dot at the end
function wave(c, d, p = 0.56) {
  const W = 230, x = W * p;
  let path = "M-20 7";
  for (let i = 0; i < 20; i++) path += " q5 -5 10 0 t10 0";
  return `<svg class="wave" viewBox="0 0 ${W} 14" preserveAspectRatio="none"><defs><clipPath id="cp${d}"><rect x="0" y="0" width="${x}" height="14"/></clipPath></defs>
<g clip-path="url(#cp${d})"><path class="w" d="${path}" fill="none" stroke="${ink(c, d)}" stroke-width="4" stroke-linecap="round"/></g>
<line x1="${x + 8}" y1="7" x2="${W - 6}" y2="7" stroke="${tint(c, d)}" stroke-width="4" stroke-linecap="round" style="filter:brightness(${d ? 1.6 : 0.93})"/>
<circle cx="${W - 2}" cy="7" r="2" fill="${ink(c, d)}"/></svg>`;
}
// a cookie (M3 shape) holding a check that draws itself
const COOKIE = (() => {
  let p = "";
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2, r = 12.4 + 1.3 * Math.cos(a * 9);
    p += `${i ? "L" : "M"}${(14 + r * Math.cos(a)).toFixed(2)} ${(14 + r * Math.sin(a)).toFixed(2)} `;
  }
  return p + "Z";
})();

function beranda(d, done = false) {
  return `<div class="head">
  <div class="hrow"><div><div class="hello j">Pagi, Dimas</div></div><span style="display:flex"><span class="hbtn press">${icon("MagnifyingGlass", { color: "#fff" })}</span><span class="hbtn press">${icon("Bell", { color: "#fff" })}<i></i></span></span></div>
</div>
<div class="body">
  <div class="now in" style="--i:0">
    <div class="nrow">${tile("PL3002", d)}<div><div class="kick"><b></b>Sekarang · R.SG PWK LT.6</div><div class="cname j">Ekonomi dan Inovasi dalam Perencanaan</div></div></div>
    <div class="prog">${wave("PL3002", d)}<div class="left j"><span class="count" data-to="53" style="all:unset">53</span> mnt<span>lagi</span></div></div>
    <div class="cta press${done ? " done" : ""}" onclick="this.classList.toggle('done')">
      <span class="lbl">${icon("Hand", { size: 20, weight: "fill", color: "currentColor" })}Tandai Hadir</span>
      <span class="ok"><svg class="cookie" viewBox="0 0 28 28"><path d="${COOKIE}" fill="var(--okfg)"/><path class="ck" d="M9 14.5l3.4 3.4L19.5 10.6" fill="none" stroke="var(--okbg)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Hadir · 09:07</span>
    </div>
  </div>
  <div class="sec in" style="--i:1"><h2 class="j">Perlu kamu urus</h2><a class="press hbtn" style="width:40px;height:40px;margin:-10px -8px -10px 0;color:var(--muted)">${icon("CaretRight", { size: 20 })}</a></div>
  <div class="due">
    <div class="dc press in" style="--i:2;background:${tint("DK4073", d)}"><div class="top">${icon(C.DK4073.i, { size: 22, weight: "duotone", color: ink("DK4073", d), duo: 0.35 })}<span class="kind" style="color:${ink("DK4073", d)}">UTS</span></div>
      <div class="big j" style="color:${ink("DK4073", d)}"><span class="count" data-to="7">7</span><small>hari</small></div><div class="t">Komunikasi Pemasaran</div></div>
    <div class="dc press in" style="--i:3;background:${tint("II4091", d)}"><div class="top">${icon(C.II4091.i, { size: 22, weight: "duotone", color: ink("II4091", d), duo: 0.35 })}<span class="kind" style="color:${ink("II4091", d)}">Tugas</span></div>
      <div class="big j" style="color:${ink("II4091", d)}"><span class="count" data-to="8">8</span><small>hari</small></div><div class="t">Tugas 02 Bab II</div></div>
  </div>
  <div class="sec in" style="--i:4"><h2 class="j">Nanti hari ini</h2></div>
  <div class="group in" style="--i:5">
    <div class="row press" onclick="this.closest('.phone').classList.add('open')">${tile("DK4073", d)}<div><div class="rt">Komunikasi Pemasaran</div><div class="rm">11:00 · TVST C</div></div><span class="chip r">Jatah habis</span></div>
    <div class="row press" onclick="this.closest('.phone').classList.add('open')">${tile("PL3032", d)}<div><div class="rt">Ekonomi Infrastruktur</div><div class="rm">15:00 · R.SG PWK LT.6</div></div><span class="chip a">Bentrok</span></div>
  </div>
</div>`;
}

function sheet(d) {
  return `<div class="handle"></div>
<div class="shd">${tile("DK4073", d, 52)}<div><div class="crumb">DK4073 · Kuliah</div><div class="stitle j">Komunikasi Pemasaran</div></div></div>
<div class="facts">
<div class="fact">${icon("Clock", { size: 22 })}Kamis · 11:00–13:00</div>
<div class="fact">${icon("MapPin", { size: 22 })}TVST C</div>
<div class="fact">${icon("Hand", { size: 22 })}Jatah absen habis<span class="pips"><i class="u"></i><i class="u"></i><i class="u"></i></span></div>
</div>
<div class="sbtn press">Buka mata kuliah</div>`;
}

function jadwal(d) {
  const days = [["Sen", 5, ["PL3002", "DK4073"]], ["Sel", 6, ["PL3032"]], ["Rab", 7, ["II4091", "DK4073"]], ["Kam", 8, ["PL3002", "DK4073", "PL3032"], "on"], ["Jum", 9, ["II4091"]], ["Sab", 10, []], ["Min", 11, []]];
  const H = 66, top0 = 8;
  const y = (h, m) => (h - top0) * H + (m / 60) * H + 20;
  const ev = (c, h1, m1, h2, m2, sub, past = 0) =>
    `<div class="ev press" style="top:${y(h1, m1) + 2}px;height:${y(h2, m2) - y(h1, m1) - 4}px;background:${tint(c, d)}">${past ? `<div class="done" style="height:${past * 100}%;background:${ink(c, d)}"></div>` : ""}${icon(C[c].i, { size: 22, weight: "duotone", color: ink(c, d), duo: 0.35 })}<div style="position:relative">${C[c].s}<small>${sub}</small></div></div>`;
  return `<div class="jhead">
  <div class="jtop"><h1 class="j">Oktober</h1><span class="hbtn press" style="color:var(--fg)">${icon("CalendarDots")}</span></div>
  <div class="week">${days.map(([w, n, cs, s], i) => `<div class="wd press in ${s ?? ""}" style="--i:${i}">${w}<b class="j">${n}</b><span class="dots">${cs.map((c) => `<i style="background:${ink(c, d)}"></i>`).join("")}</span></div>`).join("")}</div>
</div>
<div class="cal">
  ${[8, 9, 10, 11, 12, 13, 14, 15, 16].map((h) => `<div class="hr"><span${h === 9 ? ' style="opacity:0"' : ""}>${String(h).padStart(2, "0")}:00</span></div>`).join("")}
  ${ev("PL3002", 8, 0, 10, 0, "R.SG PWK LT.6", 0.56)}
  ${ev("DK4073", 11, 0, 13, 0, "TVST C")}
  ${ev("PL3032", 15, 0, 16, 30, "R.SG PWK LT.6")}
  <div class="nowl" style="top:${y(9, 7)}px"></div><div class="nowt" style="top:${y(9, 7) - 7}px">09:07</div>
</div>`;
}

function phone(screen, theme, opts = {}) {
  const d = theme === "dark";
  const content = screen === "jadwal" ? jadwal(d) : beranda(d, opts.done);
  return `<div class="phone ${theme}${opts.open ? " open" : ""}" style="${VARS[theme]}">${sb(screen !== "jadwal")}<div class="content">${content}</div>${tabbar(screen === "jadwal" ? 1 : 0)}
<div class="scrim" onclick="this.closest('.phone').classList.remove('open')"></div><div class="sheet">${sheet(d)}</div></div>`;
}

const JS = `
for (const el of document.querySelectorAll('.count')) { const to = +el.dataset.to, t0 = performance.now() + 250;
  const f = (t) => { const k = Math.min(1, Math.max(0, (t - t0) / 700)); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); }
function countWords(ph){ const open = ph.classList.contains('open'); const area = open ? ph.querySelector('.sheet') : ph.querySelector('.content');
  const top = open ? area.getBoundingClientRect().top : ph.getBoundingClientRect().top + 28; const limit = open ? ph.getBoundingClientRect().bottom : ph.querySelector('.tabbar').getBoundingClientRect().top;
  let n = 0; const w = document.createTreeWalker(area, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) { const t = w.currentNode; if (t.parentElement.closest('.ok')) continue; const r = document.createRange(); r.selectNodeContents(t); const b = r.getBoundingClientRect();
    if (!b.height || b.top >= limit || b.bottom <= top) continue; n += (t.textContent.match(/[\\p{L}\\p{N}][\\p{L}\\p{N}.:,×%–-]*/gu) || []).length; }
  return n; }
setTimeout(() => { for (const ph of document.querySelectorAll('.phone')) ph.dataset.words = countWords(ph); }, 1500);`;

const page = (body) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${CSS}</style><body>${body}<script>${JS}</script></body>`;
const frames = [
  ["beranda", "light", {}, "Beranda · tap Tandai Hadir, tap a class row"],
  ["beranda", "dark", {}, "Beranda · dark"],
  ["beranda", "light", { done: true }, "After Tandai Hadir"],
  ["beranda", "light", { open: true }, "Class sheet (scrim fades, sheet springs)"],
  ["jadwal", "light", {}, "Jadwal"],
  ["jadwal", "dark", {}, "Jadwal · dark"],
];
fs.writeFileSync(path.join(OUT, "v4-live.html"), page(`<div class="stage">${frames.map(([s, t, o, cap]) => `<div>${phone(s, t, o)}<div class="cap">${cap}</div></div>`).join("")}</div>`));
for (const [s, t, o] of frames) {
  const name = `v4-${s}${o.done ? "-hadir" : ""}${o.open ? "-sheet" : ""}-${t}`;
  fs.writeFileSync(path.join(OUT, name + ".html"), page(phone(s, t, o)).replace("body{background:#d9dde4", "body{background:transparent").replace("border-radius:28px;box-shadow:0 10px 40px rgba(0,0,0,.18)", ""));
}
