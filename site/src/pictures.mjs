// The drawings beside each install step: the screen the student is about to see, with the button to press
// marked. Drawn in HTML and CSS rather than photographed, so they stay sharp on a phone, load at once on
// mobile data, read in both languages, and can be corrected by changing a word. Each drawing is one picture to
// a screen reader (its step already says the same in words).
import { esc } from "./layout.mjs";

/** The mark on the thing to press: a ring, and a number when a picture has more than one. */
const mark = (n) => `<span class="mark">${n ?? ""}</span>`;
const target = (html, n) => `<span class="target">${html}${mark(n)}</span>`;

const frame = (label, inner, extra = "") =>
  `<div class="pic ${extra}" role="img" aria-label="${esc(label)}"><div class="pic-in" aria-hidden="true">${inner}</div></div>`;

/** A small Android phone showing `screen`. */
const droid = (screen) => `<div class="m-phone m-droid"><div class="m-status"><span>9:41</span><i></i></div>${screen}</div>`;
/** A small iPhone showing `screen`. */
const iphone = (screen) => `<div class="m-phone m-ios"><div class="m-island"></div>${screen}</div>`;
const lines = (n) => `<div class="m-lines">${"<i></i>".repeat(n)}</div>`;
const appIcon = '<img class="m-app" src="/assets/icon-128.png" alt="" width="36" height="36">';
/** A desktop window with a title bar. */
const win = (title, body, extra = "") => `<div class="m-win ${extra}"><div class="m-bar"><i></i><i></i><i></i><span>${esc(title)}</span></div>${body}</div>`;

const PICTURES = {
  androidDownload: (p) =>
    droid(`${lines(5)}<div class="m-sheet">
      <div class="m-file"><span class="m-apk">APK</span><span><b>${esc(p.android.file)}</b><small>${esc(p.android.harmful)}</small></span></div>
      <div class="m-actions"><span class="m-btn">${esc(p.android.cancel)}</span>${target(`<span class="m-btn m-btn-fill">${esc(p.android.keep)}</span>`)}</div>
    </div>`),

  androidOpen: (p) =>
    droid(`<div class="m-toast">
      <span class="m-apk">APK</span><span><b>${esc(p.android.done)}</b><small>${esc(p.android.file)}</small></span>
      ${target(`<span class="m-btn m-btn-fill">${esc(p.android.open)}</span>`)}
    </div>${lines(6)}`),

  androidAllow: (p) =>
    `<div class="duo">${droid(`${lines(3)}<div class="m-dialog">
      <b>${esc(p.android.unknownTitle)}</b>
      <p>${esc(p.android.unknownBody)}</p>
      <div class="m-actions"><span class="m-btn">${esc(p.android.cancel)}</span>${target(`<span class="m-btn m-btn-text">${esc(p.android.settings)}</span>`, 1)}</div>
    </div>`)}${droid(`<div class="m-title">${esc(p.android.allowTitle)}</div>
      <div class="m-row-app"><span class="m-browser"></span><b>Chrome</b></div>
      <div class="m-row"><span>${esc(p.android.allow)}</span>${target('<span class="m-switch on"></span>', 2)}</div>${lines(2)}`)}</div>`,

  androidInstall: (p) =>
    `<div class="duo">${droid(`${lines(3)}<div class="m-dialog">
      <div class="m-row-app">${appIcon}<b>Edunex Plus</b></div>
      <p>${esc(p.android.installAsk)}</p>
      <div class="m-actions"><span class="m-btn">${esc(p.android.cancel)}</span>${target(`<span class="m-btn m-btn-text">${esc(p.android.install)}</span>`, 1)}</div>
    </div>`)}${droid(`${lines(2)}<div class="m-dialog">
      <span class="m-shield"></span>
      <b>${esc(p.android.protectTitle)}</b>
      ${target(`<span class="m-link">${esc(p.android.more)}</span>`, 2)}
      ${target(`<span class="m-link">${esc(p.android.anyway)}</span>`, 3)}
      <div class="m-actions"><span class="m-btn m-btn-fill">${esc(p.android.ok)}</span></div>
    </div>`)}</div>`,

  ipaAndSideloadly: () =>
    `<div class="m-pair">
      <div class="m-tile"><span class="m-ipa">IPA</span><b>Edunex-Plus-iphone.ipa</b></div>
      <span class="m-plus">+</span>
      <div class="m-tile"><span class="m-side">S</span><b>Sideloadly</b><small>sideloadly.io</small></div>
    </div>`,

  iosTrust: (p) =>
    iphone(`${lines(4)}<div class="m-alert">
      <b>${esc(p.ios.trustTitle)}</b>
      <p>${esc(p.ios.trustBody)}</p>
      <div class="m-alert-actions">${target(`<span>${esc(p.ios.trust)}</span>`)}<span>${esc(p.ios.dontTrust)}</span></div>
    </div>`),

  sideloadly: (p) =>
    win(
      "Sideloadly",
      `<div class="m-side-body">
      <div class="m-field"><label>${esc(p.sideloadly.device)}</label>${target(`<span class="m-input">${esc(p.sideloadly.phone)}</span>`, 1)}</div>
      <div class="m-field"><label>${esc(p.sideloadly.appleId)}</label>${target(`<span class="m-input">${esc(p.sideloadly.mail)}</span>`, 2)}</div>
      <div class="m-side-row">${target(`<span class="m-drop"><span class="m-ipa">IPA</span><small>${esc(p.sideloadly.drop)}</small></span>`, 3)}${target(`<span class="m-btn m-btn-fill m-start">${esc(p.sideloadly.start)}</span>`, 4)}</div>
    </div>`,
      "m-dark",
    ),

  iosDevMode: (p) =>
    iphone(`<div class="m-ios-nav"><span>‹ ${esc(p.ios.settings)}</span><b>${esc(p.ios.privacy)}</b></div>
      <div class="m-ios-list"><div><i></i></div><div><i></i></div><div><i></i></div></div>
      <div class="m-ios-list"><div><span>${esc(p.ios.devMode)}</span>${target('<span class="m-switch m-switch-ios on"></span>')}</div></div>`),

  iosTrustDev: (p) =>
    iphone(`<div class="m-ios-nav"><span>‹ ${esc(p.ios.general)}</span><b>${esc(p.ios.vpn)}</b></div>
      <small class="m-ios-head">${esc(p.ios.devApp)}</small>
      <div class="m-ios-list"><div>${target(`<span>${esc(p.ios.appleId)}</span>`, 1)}<em>›</em></div></div>
      <div class="m-ios-list"><div>${target(`<span class="m-ios-link">${esc(p.ios.trustApp)}</span>`, 2)}</div></div>`),

  edgeKeep: (p) =>
    `<div class="m-flyout">
      <div class="m-flyout-title">${esc(p.windows.edgeTitle)}</div>
      <div class="m-flyout-item"><span class="m-warn">!</span><span><b>${esc(p.windows.zip)}</b> ${esc(p.windows.edgeWarn)}</span>${target('<span class="m-more">⋯</span>', 1)}</div>
      <div class="m-menu"><span>${esc(p.windows.remove)}</span>${target(`<span class="m-menu-pick">${esc(p.windows.keep)}</span>`, 2)}</div>
      <div class="m-menu m-menu-next"><span>${esc(p.windows.more)} ⌄</span>${target(`<span class="m-menu-pick">${esc(p.windows.keepAnyway)}</span>`, 3)}</div>
    </div>`,

  winZip: (p) =>
    win(
      p.windows.zip,
      `<div class="m-explorer"><div class="m-explorer-head"><span>${esc(p.windows.colName)}</span><span>${esc(p.windows.colType)}</span></div>
      ${target(`<div class="m-explorer-row"><span class="m-exe"></span><b>${esc(p.windows.setup)}</b><small>${esc(p.windows.type)}</small></div>`)}</div>`,
      "m-light m-winos",
    ),

  smartscreen: (p) =>
    `<div class="m-ss-pair">
      <div class="m-ss"><b>${esc(p.windows.ssTitle)}</b><p>${esc(p.windows.ssBody)}</p>${target(`<span class="m-ss-link">${esc(p.windows.ssMore)}</span>`, 1)}<div class="m-ss-actions"><span class="m-ss-btn">${esc(p.windows.ssDont)}</span></div></div>
      <div class="m-ss"><b>${esc(p.windows.ssTitle)}</b><p>${esc(p.windows.ssApp)}</p><div class="m-ss-actions">${target(`<span class="m-ss-btn">${esc(p.windows.ssRun)}</span>`, 2)}<span class="m-ss-btn">${esc(p.windows.ssDont)}</span></div></div>
    </div>`,

  macAbout: (p) =>
    win(
      p.mac.about,
      `<div class="m-about"><span class="m-mac"></span><b>MacBook Air</b>
      <div class="m-about-rows">${target(`<span class="m-about-row"><span>${esc(p.mac.chip)}</span><b>${esc(p.mac.chipValue)}</b></span>`)}<span class="m-about-row"><span>${esc(p.mac.macos)}</span><b>Sequoia</b></span></div>
      <small>${esc(p.mac.chipValue)} = ${esc(p.mac.silicon)}</small></div>`,
      "m-light",
    ),

  dmg: (p) =>
    win(
      "Edunex Plus",
      `<div class="m-dmg">
      <img class="m-dmg-bg" src="/assets/mac-installer.png" width="1280" height="960" alt="" loading="lazy" decoding="async">
      <span class="m-dmg-icon" style="--x:170;--y:150"><img src="/assets/icon-128.png" alt="" width="128" height="128"><span>Edunex Plus</span></span>
      <span class="m-dmg-icon" style="--x:470;--y:150"><svg viewBox="0 0 52 52"><path d="M5 13a4 4 0 0 1 4-4h11l4 5h19a4 4 0 0 1 4 4v23a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" fill="#3d9bf5"/><path d="M5 19h42v22a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" fill="#62b2ff"/></svg><span>${esc(p.mac.applications)}</span></span>
      <span class="m-dmg-icon" style="--x:118;--y:350"><span class="m-term-icon">&gt;_</span><span>${esc(p.mac.terminal)}</span></span>
    </div>`,
      "m-light m-dmg-win",
    ),

  terminal: (p, step) => win(p.mac.terminal, `<div class="m-term"><code><span>% </span>${esc(step.command ?? "")}<i></i></code></div>`, "m-dark"),

  macOpenAnyway: (p) =>
    win(
      p.mac.settings,
      `<div class="m-settings"><div class="m-settings-side">${lines(5)}</div><div class="m-settings-main">${lines(2)}<div class="m-settings-card"><p>${esc(p.mac.blocked)}</p>${target(`<span class="m-btn m-btn-plain">${esc(p.mac.openAnyway)}</span>`)}</div></div></div>`,
      "m-light",
    ),
};

/** The drawing called `name`, described to a screen reader by `label`. Nothing for a step without one. */
export function picture(name, words, label, step = {}) {
  if (!name) return "";
  const draw = PICTURES[name];
  if (!draw) throw new Error(`No picture called ${name}`);
  return frame(label, draw(words.pic, step), `pic-${name}`);
}
