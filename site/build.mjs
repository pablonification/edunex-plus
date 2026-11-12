// Builds the website (edunex-plus.arqilasp.com) into site/dist: every page in Indonesian and English from
// one set of templates (src/) and words (src/words/), plus the sitemap. No packages: plain Node.
//
//   node site/build.mjs [--out <folder>] [--release <release.json>] [--cards]
//
// --release takes GitHub's answer for the newest release (`gh api repos/<repo>/releases/latest`). With it the
// download buttons point straight at each file and say its version, without a visitor's browser asking
// GitHub (whose limit a campus network shares). Without it they open the release page, and the page's
// script asks GitHub itself. --cards also writes the two pages the link-preview pictures are photographed
// from (site/README.md), which the published site doesn't need.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { card } from "./src/card.mjs";
import { home } from "./src/home.mjs";
import { FILES, guide, installHub } from "./src/install.mjs";
import { DEVICES, fill, href, notFound, ORIGIN, REPO } from "./src/layout.mjs";
import en from "./src/words/en.mjs";
import id from "./src/words/id.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const WORDS = { id, en };
export const LANGS = Object.keys(WORDS);

/** Every page, by its address without the language: the same list in both languages. */
export const ROUTES = [
  { path: "/", render: home },
  { path: "/install/", render: installHub },
  ...DEVICES.map((device) => ({ path: `/install/${device}/`, render: (page) => guide({ ...page, device }) })),
];

/** What the pages need from GitHub's release: its version and each file's name, address and size. */
export function releaseFrom(json) {
  if (!json?.tag_name || !Array.isArray(json.assets)) return null;
  return {
    version: json.tag_name.replace(/^v/, ""),
    assets: json.assets.map(({ name, browser_download_url, size }) => ({ name, url: browser_download_url, size })),
  };
}

const hashed = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 10);

/** Every file of the site as text: its path in the output folder, and what it holds. */
export function render({ release = null, cards = false } = {}) {
  // The stylesheet and script carry their content's hash, so a new version is never served from an old cache.
  const assets = {
    css: `/site.css?v=${hashed(path.join(here, "src/site.css"))}`,
    js: `/site.js?v=${hashed(path.join(here, "src/site.js"))}`,
  };
  const files = new Map();
  for (const lang of LANGS) {
    const words = WORDS[lang];
    // What the page's script needs: the release, how to tell its files apart, and the words it writes.
    const data = {
      lang,
      repo: REPO,
      release,
      files: FILES,
      install: Object.fromEntries(
        DEVICES.map((device) => [device, { label: fill(words.cta.install, { device: words.devices[device] }), href: href(lang, `/install/${device}/`) }]),
      ),
      words: { version: words.cta.version, others: words.cta.others, othersHref: href(lang, "/install/") },
    };
    for (const route of ROUTES) {
      files.set(`${href(lang, route.path).slice(1)}index.html`, route.render({ words, lang, assets, data }));
    }
    if (cards) files.set(`social-card-${lang}.html`, card({ words, assets }));
  }
  files.set("404.html", notFound({ id, en, assets, data: { lang: "id", repo: REPO, release, files: FILES, install: {}, words: {} } }));

  const urls = ROUTES.map((route) => {
    const alternates = LANGS.map((lang) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${ORIGIN}${href(lang, route.path)}"/>`).join("\n");
    return LANGS.map((lang) => `  <url>\n    <loc>${ORIGIN}${href(lang, route.path)}</loc>\n${alternates}\n  </url>`).join("\n");
  }).join("\n");
  files.set(
    "sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`,
  );
  files.set("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);
  return files;
}

/** Writes the whole site into `out`: the pages, the stylesheet and script, and everything in public/. */
export function build({ out = path.join(here, "dist"), release = null, cards = false } = {}) {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  fs.cpSync(path.join(here, "public"), out, { recursive: true });
  for (const name of ["site.css", "site.js"]) fs.copyFileSync(path.join(here, "src", name), path.join(out, name));
  const files = render({ release, cards });
  for (const [file, text] of files) {
    fs.mkdirSync(path.dirname(path.join(out, file)), { recursive: true });
    fs.writeFileSync(path.join(out, file), text);
  }
  return [...files.keys()];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { out: { type: "string" }, release: { type: "string" }, cards: { type: "boolean", default: false } } });
  let release = null;
  if (values.release) {
    release = releaseFrom(JSON.parse(fs.readFileSync(values.release, "utf8")));
    if (!release) console.warn(`${values.release} isn't a release: the download buttons open the release page.`);
  }
  const out = values.out ? path.resolve(values.out) : path.join(here, "dist");
  const written = build({ out, release, cards: values.cards });
  console.log(`Built ${written.length} files into ${path.relative(process.cwd(), out) || "."}${release ? `, for version ${release.version}` : ""}.`);
}
