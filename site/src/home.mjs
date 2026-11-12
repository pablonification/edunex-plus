// The home page: what Edunex Plus is, what's in it, whether it's safe, and how to get it. Written for a
// student who has never heard of it and doesn't study computing.
import { DEVICES, esc, GITHUB, href, icon, ORIGIN, page, RELEASES } from "./layout.mjs";

/** A phone around a picture of the app. */
export const phone = (src, alt, extra = "") =>
  `<div class="phone ${extra}"><img src="/assets/${src}.webp" width="600" height="1333" alt="${esc(alt)}" loading="lazy" decoding="async"></div>`;

/** A laptop around a picture of the app. */
export const laptop = (src, alt, { eager = false, extra = "" } = {}) =>
  `<div class="laptop ${extra}"><div class="laptop-screen"><img src="/assets/${src}-1000.webp" srcset="/assets/${src}-1000.webp 1000w, /assets/${src}.webp 2000w" sizes="(max-width: 900px) 90vw, 760px" width="2000" height="1250" alt="${esc(alt)}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"></div><div class="laptop-base"></div></div>`;

const head = (part, center = false) => `<div class="section-head${center ? " center" : ""}">
  <p class="label">${esc(part.label)}</p>
  <h2>${esc(part.title)}</h2>
  ${part.body ? `<p class="lead">${esc(part.body)}</p>` : ""}
</div>`;

/** The device cards: one per system, each leading to its picture guide. Used on the home page and the install page. */
export const deviceCards = (words, lang) => {
  const w = words.home.install;
  return `<div class="devices">${DEVICES.map(
    (device) => `<a class="device" href="${href(lang, `/install/${device}/`)}" data-device="${device}">
    <span class="device-icon">${icon(device, 26)}</span>
    <span class="device-name">${esc(words.devices[device])}<span class="device-yours" hidden>${esc(w.yours)}</span></span>
    <span class="device-body">${esc(w.cards[device].body)}</span>
    <span class="device-foot"><span class="device-time">${icon("clock", 14)}${esc(w.cards[device].time)}</span><span class="device-go">${esc(w.open)}${icon("arrow", 14)}</span></span>
  </a>`,
  ).join("")}</div>`;
};

const feature = (key, item, picture, extra = "") => `<article class="tile tile-${key} ${extra}">
  <div class="tile-text">
    <p class="tile-name">${esc(item.name)}</p>
    <h3>${esc(item.title)}</h3>
    <p>${esc(item.body)}</p>
  </div>
  ${picture}
</article>`;

export function home({ words, lang, assets, data }) {
  const w = words.home;
  const f = w.features.items;
  const hero = `<section class="hero">
  <div class="hero-art" aria-hidden="true"><i></i><i></i></div>
  <div class="container hero-inner">
    <p class="hero-badge">${esc(w.hero.badge)}</p>
    <h1>${w.hero.title.map((line) => `<span>${esc(line)}</span>`).join(" ")}</h1>
    <p class="hero-sub">${esc(w.hero.sub)}</p>
    <div class="hero-actions">
      <a class="btn btn-white btn-lg" href="${href(lang, "/install/")}" data-install>${icon("download", 18)}<span data-install-label>${esc(words.cta.installGeneric)}</span></a>
      <a class="btn btn-clear btn-lg" href="#fitur">${esc(words.cta.features)}</a>
    </div>
    <p class="hero-meta" data-install-meta>${esc(words.cta.free)}</p>
    <div class="stage">
      ${phone("phone-home", w.hero.phoneHomeAlt, "stage-left")}
      ${laptop("desktop-home", w.hero.laptopAlt, { eager: true })}
      ${phone("phone-schedule", w.hero.phoneScheduleAlt, "stage-right")}
    </div>
  </div>
</section>`;

  const what = `<section class="section" id="apa">
  <div class="container">
    ${head(w.what, true)}
    <div class="points">${w.what.points
      .map(
        (point, i) => `<div class="point">
      <span class="point-icon">${icon(["key", "stack", "code"][i], 22)}</span>
      <h3>${esc(point.title)}</h3>
      <p>${esc(point.body)}</p>
    </div>`,
      )
      .join("")}</div>
    <div class="reads" role="group" aria-label="${esc(w.what.sourcesTitle)}">
      <p class="reads-title">${esc(w.what.sourcesTitle)}</p>
      <ul class="sources">${w.what.sources.map((source) => `<li><strong>${esc(source.name)}</strong><span>${esc(source.body)}</span></li>`).join("")}</ul>
    </div>
  </div>
</section>`;

  const notes = `<div class="notes" aria-hidden="true">${f.alerts.notes
    .map(
      (note) =>
        `<div class="note"><img src="/assets/icon-128.png" alt="" width="32" height="32"><span class="note-app">Edunex Plus</span><span class="note-time">${esc(note.time)}</span><span class="note-title">${esc(note.title)}</span><span class="note-body">${esc(note.body)}</span></div>`,
    )
    .join("")}</div>`;

  const features = `<section class="section" id="fitur">
  <div class="container">
    ${head(w.features, true)}
    <div class="bento">
      ${feature("home", f.home, phone("phone-home", f.home.alt), "span-4")}
      ${feature("tasks", f.tasks, phone("phone-tasks", f.tasks.alt), "span-2")}
      ${feature("presence", f.presence, phone("phone-courses", f.presence.alt), "span-2")}
      ${feature("schedule", f.schedule, phone("phone-schedule", f.schedule.alt), "span-2")}
      ${feature("grades", f.grades, phone("phone-grades", f.grades.alt), "span-2")}
      ${feature("alerts", f.alerts, notes, "span-3")}
      <article class="tile tile-more span-3">
        <ul class="checks">${w.features.more.map((line) => `<li>${icon("check", 16)}<span>${esc(line)}</span></li>`).join("")}</ul>
        <p class="never">${icon("shield", 20)}<span>${esc(w.features.never)}</span></p>
      </article>
    </div>
  </div>
</section>`;

  const everywhere = `<section class="section">
  <div class="container split">
    ${head(w.everywhere)}
    <div class="both">
      ${laptop("desktop-tasks", w.everywhere.laptopAlt)}
      ${phone("phone-tasks", "", "both-phone")}
    </div>
  </div>
</section>`;

  const flowIcons = ["key", "lock", "shield"];
  const privacy = `<section class="section section-soft" id="aman">
  <div class="container">
    ${head(w.privacy, true)}
    <ol class="flow" aria-label="${esc(w.privacy.flowAlt)}">${w.privacy.flow
      .map(
        (step, i) =>
          `<li class="flow-step${i === 2 ? " flow-app" : ""}"><span class="flow-icon">${i === 2 ? '<img src="/assets/icon-128.png" alt="" width="28" height="28">' : icon(flowIcons[i], 22)}</span><strong>${esc(step.who)}</strong><span>${esc(step.what)}</span></li>`,
      )
      .join(`<li class="flow-arrow" aria-hidden="true">${icon("arrow", 20)}</li>`)}</ol>
    <div class="safe">${w.privacy.points
      .map(
        (point, i) => `<div class="safe-point">
      <span class="point-icon">${icon(["lock", "stack", "eyeOff", "trash"][i], 22)}</span>
      <div><h3>${esc(point.title)}</h3><p>${esc(point.body)}</p></div>
    </div>`,
      )
      .join("")}</div>
    <p class="center"><a class="text-link" href="${GITHUB}/blob/main/docs/privacy.md" target="_blank" rel="noopener noreferrer">${esc(w.privacy.link)}${icon("arrow", 14)}</a></p>
  </div>
</section>`;

  const install = `<section class="section" id="pasang">
  <div class="container">
    ${head(w.install, true)}
    ${deviceCards(words, lang)}
    <div class="why">
      <span class="why-icon">${icon("warn", 22)}</span>
      <div><h3>${esc(w.install.warnTitle)}</h3><p>${esc(w.install.warnBody)}</p></div>
    </div>
  </div>
</section>`;

  const faq = `<section class="section" id="tanya">
  <div class="container narrow">
    ${head(w.faq, true)}
    <div class="faq">${w.faq.items.map((item) => `<details><summary>${esc(item.q)}${icon("chevron", 18)}</summary><p>${esc(item.a)}</p></details>`).join("")}</div>
  </div>
</section>`;

  const closing = `<section class="section closing-wrap">
  <div class="container">
    <div class="closing">
      <h2>${esc(w.closing.title)}</h2>
      <p>${esc(w.closing.body)}</p>
      <div class="hero-actions">
        <a class="btn btn-white btn-lg" href="${href(lang, "/install/")}" data-install>${icon("download", 18)}<span data-install-label>${esc(words.cta.installGeneric)}</span></a>
        <a class="btn btn-clear btn-lg" href="${href(lang, "/install/")}">${esc(words.cta.how)}</a>
      </div>
      <p class="hero-meta" data-install-meta>${esc(words.cta.free)}</p>
      <a class="backer" href="https://ganesaspace.com" target="_blank" rel="noopener noreferrer">${esc(w.closing.backer)} <img src="/assets/ganesa-space.png" alt="" width="18" height="18"><strong>Ganesa Space</strong></a>
    </div>
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
    body: [hero, what, features, everywhere, privacy, install, faq, closing].join("\n"),
    assets,
    data,
  });
}
