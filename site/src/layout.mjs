// What every page shares: the document's head (what search engines and link previews read), the bar at
// the top, the footer, and the small helpers the pages are written with.

export const ORIGIN = "https://edunex-plus.arqilasp.com";
export const REPO = "pablonification/edunex-plus";
export const GITHUB = `https://github.com/${REPO}`;
export const RELEASES = `${GITHUB}/releases/latest`;
export const DEVICES = ["android", "iphone", "windows", "mac", "linux"];
const PHONES = new Set(["android", "iphone"]);
export const isPhone = (device) => PHONES.has(device);

/** Text as HTML: the five characters HTML reads as its own. */
export const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** A sentence with its `{name}` holes filled in. */
export const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");

/** A page's address in a language: Indonesian at the root, English under /en. */
export const href = (lang, path = "/") => (lang === "id" ? path : `/en${path}`);

export const icon = (name, size = 20) => `<svg class="icon" width="${size}" height="${size}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

// One drawing each, used by name. Line icons on a 24 grid, the stroke taking the text's color.
const ICONS = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  download: '<path d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M5 20h14"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  warn: '<path d="M12 4 2.5 20h19L12 4z"/><path d="M12 10v4.5M12 17.5v.01"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.5 3.1 8.2 7.5 9.5 4.4-1.3 7.5-5 7.5-9.5V6L12 3z"/><path d="m9 12 2.2 2.2L15.2 10"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  eyeOff: '<path d="M4 4l16 16M10 6.2A9.6 9.6 0 0 1 12 6c5 0 8.5 4 9.5 6-.5 1-1.5 2.4-3 3.6M14 17.7c-.6.2-1.3.3-2 .3-5 0-8.5-4-9.5-6 .6-1.2 1.8-2.8 3.6-4.1"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5M16 7l2.5 2.5M13.5 9.5 15.5 11.5"/>',
  stack: '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 12.5 9 5 9-5M3 17l9 5 9-5"/>',
  code: '<path d="m8.5 7-5 5 5 5M15.5 7l5 5-5 5M13.5 4l-3 16"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M5.5 15.5h-1v-11h11v1"/>',
  android: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.8"/><path d="M10.5 18h3"/>',
  iphone: '<rect x="6.5" y="2.5" width="11" height="19" rx="3.2"/><path d="M10.5 5.3h3"/>',
  windows: '<path d="M4 5.5 10.8 4.5v6.7H4zM13 4.2l7-1v8H13zM4 13h6.8v6.5L4 18.5zM13 13h7v8l-7-1z"/>',
  mac: '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M2 19.5h20"/>',
  linux: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="m7.5 10 2.5 2.5-2.5 2.5M12.5 15h4"/>',
};

const sprite = () =>
  `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${Object.entries(ICONS)
    .map(
      ([name, paths]) =>
        `<symbol id="i-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths}</symbol>`,
    )
    .join("")}</svg>`;

/** The page as a whole document. `page` says what the head needs; `body` is everything inside <main>. */
export function page({ words, lang, path, title, description, og, jsonLd = [], body, hero = false, noindex = false, assets, data }) {
  const url = ORIGIN + href(lang, path);
  const other = lang === "id" ? "en" : "id";
  const image = `${ORIGIN}/assets/social-card-${lang}.jpg`;
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    '<meta name="color-scheme" content="light dark">',
    '<meta name="theme-color" content="#2f6feb">',
    noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${url}">`,
    // The same page in the other language, for search engines. Indonesian is the one to show when unsure.
    ...(noindex
      ? []
      : [
          `<link rel="alternate" hreflang="id" href="${ORIGIN}${href("id", path)}">`,
          `<link rel="alternate" hreflang="en" href="${ORIGIN}${href("en", path)}">`,
          `<link rel="alternate" hreflang="x-default" href="${ORIGIN}${href("id", path)}">`,
        ]),
    // How the link looks when shared (WhatsApp, LINE, X, Discord).
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Edunex Plus">',
    `<meta property="og:locale" content="${words.locale}">`,
    `<meta property="og:locale:alternate" content="${lang === "id" ? "en_US" : "id_ID"}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:title" content="${esc(og?.title ?? title)}">`,
    `<meta property="og:description" content="${esc(og?.description ?? description)}">`,
    `<meta property="og:image" content="${image}">`,
    '<meta property="og:image:type" content="image/jpeg">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${esc(words.home.ogAlt)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${esc(og?.title ?? title)}">`,
    `<meta name="twitter:description" content="${esc(og?.description ?? description)}">`,
    `<meta name="twitter:image" content="${image}">`,
    `<meta name="twitter:image:alt" content="${esc(words.home.ogAlt)}">`,
    ...jsonLd.map((thing) => `<script type="application/ld+json">${JSON.stringify(thing).replace(/</g, "\\u003c")}</script>`),
    '<link rel="icon" href="/favicon.ico" sizes="any">',
    '<link rel="icon" type="image/png" sizes="32x32" href="/assets/icon-32.png">',
    '<link rel="apple-touch-icon" href="/assets/icon-180.png">',
    '<link rel="preload" href="/fonts/dm-sans-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>',
    '<link rel="preload" href="/fonts/dm-sans-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>',
    `<link rel="stylesheet" href="${assets.css}">`,
  ];
  const nav = `<header class="nav${hero ? " nav-on-hero" : ""}" id="nav">
  <div class="nav-inner">
    <a class="brand" href="${href(lang)}" aria-label="${esc(words.nav.home)}"><img src="/assets/icon-128.png" alt="" width="28" height="28">Edunex Plus</a>
    <nav class="nav-links" aria-label="${esc(words.nav.menu)}">
      <a href="${href(lang)}#fitur">${esc(words.nav.features)}</a>
      <a href="${href(lang, "/install/")}">${esc(words.nav.install)}</a>
      <a href="${href(lang)}#tanya">${esc(words.nav.faq)}</a>
    </nav>
    <div class="nav-end">
      <a class="lang" href="${href(other, path)}" lang="${other}" hreflang="${other}" aria-label="${esc(words.nav.language)}: ${esc(words.switchTo)}">${icon("globe", 16)}<span>${esc(words.switchTo)}</span></a>
      <a class="btn btn-small nav-cta" href="${href(lang, "/install/")}" data-install-link>${esc(words.nav.get)}</a>
    </div>
  </div>
</header>`;
  const links = words.footer.links;
  const footer = `<footer class="footer">
  <div class="container footer-inner">
    <div class="footer-top">
      <a class="brand" href="${href(lang)}"><img src="/assets/icon-128.png" alt="" width="24" height="24">Edunex Plus</a>
      <nav class="footer-links" aria-label="Edunex Plus">
        <a href="${href(lang, "/install/")}">${esc(links.install)}</a>
        <a href="${GITHUB}/blob/main/docs/privacy.md" target="_blank" rel="noopener noreferrer">${esc(links.privacy)}</a>
        <a href="${GITHUB}/blob/main/docs/code-signing.md" target="_blank" rel="noopener noreferrer">${esc(links.signing)}</a>
        <a href="${GITHUB}/issues" target="_blank" rel="noopener noreferrer">${esc(links.report)}</a>
        <a href="${GITHUB}" target="_blank" rel="noopener noreferrer">${esc(links.github)}</a>
        <a href="${href(other, path)}" lang="${other}" hreflang="${other}">${esc(words.switchTo)}</a>
      </nav>
    </div>
    <p class="footer-made">${esc(words.footer.made)} <a href="https://ganesaspace.com" target="_blank" rel="noopener noreferrer"><img src="/assets/ganesa-space.png" alt="" width="16" height="16">Ganesa Space</a></p>
    <p class="disclaimer">${esc(words.footer.disclaimer)}</p>
  </div>
</footer>`;
  return `<!doctype html>
<html lang="${lang}">
<head>
${head.map((line) => `  ${line}`).join("\n")}
</head>
<body>
${sprite()}
<a class="skip" href="#isi">${esc(words.nav.skip)}</a>
${nav}
<main id="isi">
${body}
</main>
${footer}
<script type="application/json" id="site-data">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>
<script src="${assets.js}" defer></script>
</body>
</html>
`;
}

/** The page GitHub Pages shows for an address that isn't there. In both languages, since it can't know which. */
export function notFound({ id, en, assets, data }) {
  const body = `<section class="plain-hero not-found">
  <div class="container">
    <img src="/assets/icon-128.png" alt="" width="64" height="64">
    <h1>${esc(id.notFound.h1)}</h1>
    <p>${esc(id.notFound.body)}</p>
    <a class="btn btn-primary btn-lg" href="/">${esc(id.notFound.home)}</a>
    <p class="not-found-alt" lang="en">${esc(en.notFound.h1)} <a href="/en/">${esc(en.notFound.home)}</a></p>
  </div>
</section>`;
  return page({ words: id, lang: "id", path: "/", title: id.notFound.title, description: id.notFound.body, body, noindex: true, assets, data });
}
