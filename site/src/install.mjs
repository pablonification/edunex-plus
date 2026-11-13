// The install pages: one that lists the devices, and a picture guide for each. A guide is its steps
// (words/*.mjs, `guides`), each beside a drawing of the screen it's about (pictures.mjs).
import { appWindow, deviceRows, iphone, macbook, whyWarned } from "./home.mjs";
import { DEVICES, esc, fill, GITHUB, href, icon, isPhone, ORIGIN, page, RELEASES } from "./layout.mjs";
import { picture } from "./pictures.mjs";

// Each file on a release, by the name it has there. Windows gets its installer in a zip (from
// 0.1.0-alpha.17): browsers hold a zip back less often than the installer itself.
export const FILES = {
  android: "-android\\.apk$",
  iphone: "-iphone\\.ipa$",
  "win-x64": "-windows-x64\\.zip$",
  "win-arm": "-windows-arm64\\.zip$",
  "mac-arm": "arm64\\.dmg$",
  "mac-intel": "x64\\.dmg$",
  "linux-deb": "_amd64\\.deb$",
  "linux-appimage": "x86_64\\.AppImage$",
};

/** The newest release's file for `key`, when the site was built knowing the release. */
export const fileOf = (release, key) => release?.assets.find((asset) => new RegExp(FILES[key]).test(asset.name));

const megabytes = (bytes) => `${Math.round(bytes / 1_000_000)} MB`;

/** Where a guide sits: the home page, the install page, then the guide. */
const crumbs = (words, lang, last) =>
  `<nav class="crumbs" aria-label="${esc(words.nav.crumbs)}"><a href="${href(lang)}">Edunex Plus</a><span aria-hidden="true">›</span><a href="${href(lang, "/install/")}">${esc(words.install.crumb)}</a><span aria-hidden="true">›</span><span aria-current="page">${esc(last)}</span></nav>`;

const breadcrumbLd = (words, lang, last, path) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Edunex Plus", item: ORIGIN + href(lang) },
    { "@type": "ListItem", position: 2, name: words.install.crumb, item: ORIGIN + href(lang, "/install/") },
    { "@type": "ListItem", position: 3, name: last, item: ORIGIN + href(lang, path) },
  ],
});

export function installHub({ words, lang, assets, data }) {
  const w = words.install;
  const body = `<section class="top">
  <div class="container">
    <h1>${esc(w.h1)}</h1>
    ${deviceRows(words, lang)}
    ${whyWarned(words, 2)}
  </div>
</section>
<section class="section">
  <div class="container" data-reveal>
    <h2>${esc(w.before.title)}</h2>
    <ul class="plain-list">${w.before.items.map((line) => `<li>${esc(line)}</li>`).join("")}</ul>
  </div>
</section>`;
  return page({
    words,
    lang,
    path: "/install/",
    title: `${w.title} · Edunex Plus`,
    description: w.description,
    body,
    assets,
    data,
  });
}

/** The files a step fetches: this computer's as the button, the other as a link under it. */
const downloads = (keys, words, release, device) => {
  // The site knows the newest release and it has no such file (a release from before the phone app): no button
  // that leads nowhere, only where to look.
  if (release && !keys.some((key) => fileOf(release, key)))
    return `<p class="file-note">${esc(fill(words.install.guide.notYet, { device: words.devices[device] }))} <a class="link" href="${RELEASES}" target="_blank" rel="noopener noreferrer">${esc(words.install.guide.releasePage)}</a></p>`;
  const buttons = keys
    .filter((key) => !release || fileOf(release, key))
    .map((key) => {
      const file = fileOf(release, key);
      const size = file?.size ? `<small>${megabytes(file.size)}</small>` : "";
      return `<a class="btn" href="${file?.url ?? RELEASES}" data-file="${key}"${file ? " download" : ' target="_blank" rel="noopener noreferrer"'}>${icon("download", 18)}<span>${esc(words.downloads[key])}</span>${size}</a>`;
    })
    .join("");
  const version = release ? `<p class="file-version">${esc(fill(words.cta.version, { version: release.version }))}</p>` : "";
  return `<div class="files">${buttons}</div>${version}`;
};

const command = (step, words, release) => {
  if (!step.command) return "";
  // The real file name once the release is known, so the line can be pasted as it is.
  const line = release ? step.command.replace(/<vers(i|ion)>/g, release.version) : step.command;
  return `<div class="command"><code>${esc(line)}</code><button class="copy" type="button" hidden data-copy="${esc(line)}" data-copied="${esc(words.install.guide.copied)}">${icon("copy", 16)}<span aria-live="polite">${esc(words.install.guide.copy)}</span></button></div>`;
};

/** The app's first screen, on the device the guide is for, with the button to press ringed. */
const firstScreen = (device, w) => {
  if (device === "iphone") return iphone("phone-welcome", w.signIn.phoneAlt, { onDark: true, press: true });
  if (device === "android") return iphone("phone-welcome", w.signIn.phoneAlt, { onDark: true, android: true, press: true });
  if (device === "mac") return macbook("desktop-welcome", w.signIn.computerAlt, { press: true });
  return appWindow("desktop-welcome", w.signIn.computerAlt, { press: true });
};

export function guide({ words, lang, device, assets, data }) {
  const g = words.guides[device];
  const w = words.install.guide;
  const release = data.release;
  const path = `/install/${device}/`;
  const signIn = {
    title: w.signIn.title,
    body: [isPhone(device) ? w.signIn.phone : w.signIn.computer, w.signIn.once],
  };
  const steps = [...g.steps, signIn];

  const stepHtml = steps
    .map((step, i) => {
      const last = i === steps.length - 1;
      const art = last ? `<div class="pic pic-app">${firstScreen(device, w)}</div>` : picture(step.pic, words, step.title, step);
      const alt = step.alt
        ? `<details class="alt"><summary>${esc(step.alt.title)}${icon("chevron", 16)}</summary><p>${step.alt.body}</p>${picture(step.alt.pic, words, step.alt.title)}</details>`
        : "";
      return `<li class="step" id="step-${i + 1}" data-reveal>
      <span class="step-n" aria-hidden="true">${i + 1}</span>
      <div class="step-text">
        <h2>${esc(step.title)}</h2>
        ${step.body.map((line) => `<p>${line}</p>`).join("")}
        ${step.download ? downloads(step.download, words, release, device) : ""}
        ${command(step, words, release)}
        ${alt}
      </div>
      ${art}
    </li>`;
    })
    .join("\n");

  const body = `<section class="top">
  <div class="container">
    ${crumbs(words, lang, words.devices[device])}
    <h1>${esc(g.h1)}</h1>
    <p class="lead">${esc(g.lead)}</p>
    <ul class="needs"><li>${esc(g.time)}</li>${g.needs.map((need) => `<li>${esc(need)}</li>`).join("")}</ul>
    ${g.callout ? `<div class="heads-up"><h2>${esc(g.callout.title)}</h2><p>${esc(g.callout.body)}</p></div>` : ""}
  </div>
</section>
<div class="container">
  <ol class="steps">
${stepHtml}
  </ol>
  <p class="pic-note">${esc(w.picNote)}</p>
</div>
<section class="section">
  <div class="container after">
    <div>
      <h2>${esc(w.troubleTitle)}</h2>
      <div class="faq">${g.trouble.map((item) => `<details><summary>${esc(item.q)}${icon("chevron", 18)}</summary><p>${esc(item.a)}</p></details>`).join("")}</div>
      <p class="after-links">
        <a class="link" href="${GITHUB}/blob/main/docs/install.md" target="_blank" rel="noopener noreferrer">${esc(w.full)}</a>
        <a class="link" href="${GITHUB}/issues" target="_blank" rel="noopener noreferrer">${esc(w.report)}</a>
      </p>
    </div>
    <div class="after-side">
      <div><h3>${esc(w.updateTitle)}</h3><p>${g.update}</p></div>
      <div><h3>${esc(w.removeTitle)}</h3><p>${g.remove}</p></div>
      <div><h3>${esc(w.othersTitle)}</h3><p class="others">${DEVICES.filter((other) => other !== device)
        .map((other) => `<a class="link" href="${href(lang, `/install/${other}/`)}">${esc(words.devices[other])}</a>`)
        .join("")}</p></div>
    </div>
  </div>
</section>`;

  const strip = (html) => html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&");
  const jsonLd = [
    breadcrumbLd(words, lang, words.devices[device], path),
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: g.title,
      description: g.description,
      inLanguage: lang,
      step: steps.map((step, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: step.title,
        text: step.body.map(strip).join(" "),
        url: `${ORIGIN}${href(lang, path)}#step-${i + 1}`,
      })),
    },
  ];

  return page({ words, lang, path, title: `${g.title} · Edunex Plus`, description: g.description, jsonLd, body, assets, data });
}
