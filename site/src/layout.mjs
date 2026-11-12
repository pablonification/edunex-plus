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

// One drawing each, used by name: bare glyphs on a 24 grid, the stroke taking the text's colour. Only what a
// button or a row needs; nothing sits in a tinted square.
const ICONS = {
  download: '<path d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M5 20h14"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  next: '<path d="m9 6 6 6-6 6"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M5.5 15.5h-1v-11h11v1"/>',
  android: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.8"/><circle cx="12" cy="5.6" r=".6" fill="currentColor"/>',
  iphone: '<rect x="6.5" y="2.5" width="11" height="19" rx="3.2"/><path d="M10.6 5.4h2.8"/>',
  windows: '<path d="M4 5.5 10.8 4.5v6.7H4zM13 4.2l7-1v8H13zM4 13h6.8v6.5L4 18.5zM13 13h7v8l-7-1z"/>',
  mac: '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M2 19.5h20"/>',
  linux: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="m7.5 10 2.5 2.5-2.5 2.5M12.5 15h4"/>',
};

const sprite = () =>
  `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${Object.entries(ICONS)
    .map(
      ([name, paths]) =>
        `<symbol id="i-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</symbol>`,
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
    '<link rel="preload" href="/fonts/plus-jakarta-sans-latin-800-normal.woff2" as="font" type="font/woff2" crossorigin>',
    `<link rel="stylesheet" href="${assets.css}">`,
  ];
  const nav = `<header class="nav${hero ? " nav-on-hero" : ""}" id="nav">
  <div class="nav-inner">
    <a class="brand" href="${href(lang)}" aria-label="${esc(words.nav.home)}"><img src="/assets/icon-128.png" alt="" width="28" height="28">Edunex Plus</a>
    <nav class="nav-links" aria-label="${esc(words.nav.menu)}">
      <a href="${href(lang)}#fitur">${esc(words.nav.features)}</a>
      <a href="${href(lang, "/install/")}"${path.startsWith("/install/") ? ' aria-current="page"' : ""}>${esc(words.nav.install)}</a>
      <a href="${href(lang)}#tanya">${esc(words.nav.faq)}</a>
      <a class="lang" href="${href(other, path)}" lang="${other}" hreflang="${other}" aria-label="${esc(words.nav.language)}: ${esc(words.switchTo)}">${esc(words.switchTo)}</a>
    </nav>
    <a class="btn btn-small" href="${href(lang, "/install/")}" data-install-link>${esc(words.nav.get)}</a>
  </div>
</header>`;
  const links = words.footer.links;
  const footer = `<footer class="footer">
  <div class="container footer-inner">
    <nav class="footer-links" aria-label="Edunex Plus">
      <a href="${href(lang, "/install/")}">${esc(links.install)}</a>
      <a href="${GITHUB}/blob/main/docs/privacy.md" target="_blank" rel="noopener noreferrer">${esc(links.privacy)}</a>
      <a href="${GITHUB}/blob/main/docs/code-signing.md" target="_blank" rel="noopener noreferrer">${esc(links.signing)}</a>
      <a href="${GITHUB}/issues" target="_blank" rel="noopener noreferrer">${esc(links.report)}</a>
      <a href="${GITHUB}" target="_blank" rel="noopener noreferrer">${esc(links.github)}</a>
      <a href="${href(other, path)}" lang="${other}" hreflang="${other}">${esc(words.switchTo)}</a>
    </nav>
    <p>${esc(words.footer.made)} <a href="https://ganesaspace.com" target="_blank" rel="noopener noreferrer">Ganesa Space</a>.</p>
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
  const body = `<section class="not-found">
  <div class="container">
    <img src="/assets/icon-128.png" alt="" width="64" height="64">
    <h1>${esc(id.notFound.h1)}</h1>
    <p>${esc(id.notFound.body)}</p>
    <a class="btn" href="/">${esc(id.notFound.home)}</a>
    <p lang="en">${esc(en.notFound.h1)} <a class="link" href="/en/">${esc(en.notFound.home)}</a></p>
  </div>
</section>`;
  return page({ words: id, lang: "id", path: "/", title: id.notFound.title, description: id.notFound.body, body, noindex: true, assets, data });
}
