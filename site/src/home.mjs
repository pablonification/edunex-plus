// The home page: what Edunex Plus is, what it looks like, whether it's safe, and how to get it. Written
// for a student who has never heard of it and doesn't study computing. The pictures of the app do the
// showing, in the frames of the devices they're used on.
import { DEVICES, esc, GITHUB, href, icon, ORIGIN, page, RELEASES } from "./layout.mjs";

// What an iPhone draws over every app, beside the clock and the island: its signal, wifi and battery.
const STATUS = `<svg viewBox="0 0 68 14" fill="currentColor" aria-hidden="true"><path d="M1 9.5h3v4H1zM6 7h3v6.5H6zM11 4.5h3v9h-3zM16 2h3v11.5h-3z"/><path d="M33 3.2c3 0 5.6 1.2 7.5 3.1l-1.7 1.7A8.2 8.2 0 0 0 33 5.6c-2.3 0-4.3.9-5.8 2.4l-1.7-1.7A10.6 10.6 0 0 1 33 3.2zm0 4.2c1.8 0 3.4.7 4.6 1.9l-1.7 1.7a4.1 4.1 0 0 0-5.8 0l-1.7-1.7A6.5 6.5 0 0 1 33 7.4zm0 3.9c.7 0 1.3.3 1.7.7L33 13.8 31.3 12c.4-.4 1-.7 1.7-.7z"/><rect x="46.5" y="1.5" width="18" height="11" rx="3.2" fill="none" stroke="currentColor" opacity=".45"/><rect x="48" y="3" width="15" height="8" rx="2"/><path d="M66 5v4c.8-.3 1.3-1.1 1.3-2S66.8 5.3 66 5z" opacity=".5"/></svg>`;

/** A phone around `screen`: an iPhone, with its island, clock and home bar drawn over what it shows. */
export const phoneFrame = (screen, { extra = "", onDark = false, android = false, hidden = false } = {}) =>
  `<div class="iphone${onDark ? " iphone-on-dark" : ""}${android ? " is-android" : ""}${extra ? ` ${extra}` : ""}"${hidden ? ' aria-hidden="true"' : ""}><div class="iphone-body"><div class="iphone-screen">${screen}<div class="iphone-status" aria-hidden="true"><span>9:41</span><span class="iphone-island"></span>${STATUS}</div><span class="iphone-home" aria-hidden="true"></span></div></div></div>`;

/** An iPhone around a picture of the app (`onDark` when the picture's top is dark, `android` for an Android phone). */
export const iphone = (src, alt, options = {}) =>
  phoneFrame(
    `<img src="/assets/${src}.webp" width="660" height="1467" alt="${esc(alt)}"${options.eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">`,
    options,
  );

const screenshot = (src, alt, eager) =>
  `<img src="/assets/${src}-1000.webp" srcset="/assets/${src}-1000.webp 1000w, /assets/${src}.webp 2000w" sizes="(max-width: 960px) 90vw, 860px" width="2000" height="1250" alt="${esc(alt)}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">`;

/** A MacBook around a picture of the app. */
export const macbook = (src, alt, { eager = false } = {}) =>
  `<div class="macbook"><div class="macbook-lid">${screenshot(src, alt, eager)}<span class="macbook-notch"></span></div><div class="macbook-base"></div></div>`;

/** The app's window on any other computer. */
export const appWindow = (src, alt) => `<div class="window">${screenshot(src, alt, false)}</div>`;

/** The devices, one row each, leading to their picture guides. On the home page and the install page. */
export const deviceRows = (words, lang) => {
  const w = words.home.install;
  return `<div class="rows">${DEVICES.map(
    (device) => `<a class="row" href="${href(lang, `/install/${device}/`)}" data-device="${device}">
    ${icon(device, 26)}
    <span class="row-name">${esc(words.devices[device])}<span class="row-yours" hidden>${esc(w.yours)}</span></span>
    <span class="row-body">${esc(w.cards[device].body)}</span>
    <span class="row-time">${esc(w.cards[device].time)}</span>
    ${icon("next", 18)}
  </a>`,
  ).join("")}</div>`;
};

/** Why the phone or laptop warns: said once, under the devices. */
export const whyWarned = (words) => `<div class="aside"><h3>${esc(words.home.install.warnTitle)}</h3><p>${esc(words.home.install.warnBody)}</p></div>`;

// The screens shown beside their questions, in the order of the words' `screens.items`.
const SCREENS = ["phone-home", "phone-tasks", "phone-courses", "phone-schedule", "phone-grades"];

export function home({ words, lang, assets, data }) {
  const w = words.home;

  const hero = `<section class="hero">
  <div class="container hero-inner">
    <h1>${w.hero.title.map((line) => `<span>${esc(line)}</span>`).join(" ")}</h1>
    <p class="hero-sub">${esc(w.hero.sub)}</p>
    <div class="hero-actions">
      <a class="btn btn-white" href="${href(lang, "/install/")}" data-install>${icon("download", 18)}<span data-install-label>${esc(words.cta.installGeneric)}</span></a>
      <p class="hero-meta" data-install-meta>${esc(words.cta.free)}</p>
    </div>
    <div class="hero-devices">
      ${macbook("desktop-home", w.hero.laptopAlt, { eager: true })}
      ${iphone("phone-home", w.hero.phoneAlt, { eager: true })}
    </div>
  </div>
</section>`;

  const what = `<section class="section">
  <div class="container what">
    <div>
      <h2>${esc(w.what.title)}</h2>
      <p class="lead">${esc(w.what.body)}</p>
    </div>
    <div>
      <p class="sources-title" id="dibaca">${esc(w.what.sourcesTitle)}</p>
      <dl class="sources" aria-labelledby="dibaca">${w.what.sources.map((source) => `<div><dt>${esc(source.name)}</dt><dd>${esc(source.body)}</dd></div>`).join("")}</dl>
    </div>
  </div>
</section>`;

  const screens = `<section class="section" id="fitur">
  <div class="container">
    <h2>${esc(w.screens.title)}</h2>
    <div class="strip">${w.screens.items
      .map((item, i) => `<figure><figcaption><h3>${esc(item.q)}</h3><p>${esc(item.a)}</p></figcaption>${iphone(SCREENS[i], item.alt)}</figure>`)
      .join("")}</div>
  </div>
</section>`;

  const lock = `<div class="lock"><span class="lock-day">${esc(w.alerts.day)}</span><span class="lock-time">12:00</span>${w.alerts.notes
    .map(
      (note) =>
        `<div class="note"><img src="/assets/icon-128.png" alt="" width="128" height="128"><b>${esc(note.title)}</b><time>${esc(note.time)}</time><span>${esc(note.body)}</span></div>`,
    )
    .join("")}</div>`;
  const alerts = `<section class="section">
  <div class="container pair">
    <div>
      <h2>${esc(w.alerts.title)}</h2>
      <p class="lead">${esc(w.alerts.body)}</p>
    </div>
    <div role="img" aria-label="${esc(w.alerts.alt)}">${phoneFrame(lock, { onDark: true, hidden: true })}</div>
  </div>
</section>`;

  const laptop = `<section class="section">
  <div class="container">
    <h2>${esc(w.laptop.title)}</h2>
    <div class="laptop-view">${macbook("desktop-tasks", w.laptop.alt)}</div>
    <div class="also">
      <p class="sources-title" id="juga">${esc(w.laptop.alsoTitle)}</p>
      <ul aria-labelledby="juga">${w.laptop.also.map((line) => `<li>${esc(line)}</li>`).join("")}</ul>
    </div>
  </div>
</section>`;

  const privacy = `<section class="section" id="aman">
  <div class="container">
    <h2>${esc(w.privacy.title)}</h2>
    <div class="points">${w.privacy.points.map((point) => `<div><h3>${esc(point.title)}</h3><p>${esc(point.body)}</p></div>`).join("")}</div>
    <p class="never">${esc(w.privacy.never)}</p>
    <p><a class="link" href="${GITHUB}/blob/main/docs/privacy.md" target="_blank" rel="noopener noreferrer">${esc(w.privacy.link)}</a></p>
  </div>
</section>`;

  const install = `<section class="section" id="pasang">
  <div class="container">
    <h2>${esc(w.install.title)}</h2>
    ${deviceRows(words, lang)}
    ${whyWarned(words)}
  </div>
</section>`;

  const faq = `<section class="section" id="tanya">
  <div class="container">
    <h2>${esc(w.faq.title)}</h2>
    <div class="faq">${w.faq.items.map((item) => `<details><summary>${esc(item.q)}${icon("chevron", 18)}</summary><p>${esc(item.a)}</p></details>`).join("")}</div>
  </div>
</section>`;

  const closing = `<section class="closing">
  <div class="container">
    <h2>${esc(w.closing.title)}</h2>
    <a class="btn btn-white" href="${href(lang, "/install/")}" data-install>${icon("download", 18)}<span data-install-label>${esc(words.cta.installGeneric)}</span></a>
  </div>
</section>`;

  const url = ORIGIN + href(lang);
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Edunex Plus",
      description: w.description,
      url,
      image: `${ORIGIN}/assets/social-card-${lang}.jpg`,
      screenshot: `${ORIGIN}/assets/desktop-home.webp`,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Android, iOS, Windows, macOS, Linux",
      downloadUrl: RELEASES,
      installUrl: ORIGIN + href(lang, "/install/"),
      softwareVersion: data.release?.version,
      inLanguage: ["id", "en"],
      isAccessibleForFree: true,
      license: "https://opensource.org/licenses/MIT",
      offers: { "@type": "Offer", price: "0", priceCurrency: "IDR" },
      sameAs: [GITHUB],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: w.faq.items.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
    },
    { "@context": "https://schema.org", "@type": "WebSite", name: "Edunex Plus", url: `${ORIGIN}/`, inLanguage: ["id", "en"] },
  ];

  return page({
    words,
    lang,
    path: "/",
    title: w.title,
    description: w.description,
    og: { title: w.ogTitle, description: w.ogDescription },
    jsonLd,
    hero: true,
    body: [hero, what, screens, alerts, laptop, privacy, install, faq, closing].join("\n"),
    assets,
    data,
  });
}
