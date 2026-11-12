// The website (site/), built as GitHub Pages serves it, and read the way a visitor, a search engine and a
// link preview read it.
import fs from "node:fs";
import path from "node:path";
import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { LANGS, ROUTES, releaseFrom, render } from "../../site/build.mjs";
import en from "../../site/src/words/en.mjs";
import id from "../../site/src/words/id.mjs";

const ORIGIN = "https://edunex-plus.arqilasp.com";
const PUBLIC = path.resolve("site/public");

/** GitHub's answer for a release that has every file the site offers. */
const githubRelease = (names: string[]) => ({
  tag_name: "v1.2.3",
  assets: names.map((name) => ({
    name,
    browser_download_url: `https://github.com/pablonification/edunex-plus/releases/download/v1.2.3/${name}`,
    size: 31_000_000,
  })),
});
const EVERY_FILE = [
  "Edunex-Plus-1.2.3-android.apk",
  "Edunex-Plus-1.2.3-iphone.ipa",
  "Edunex-Plus-Setup-1.2.3-windows-x64.zip",
  "Edunex-Plus-1.2.3-windows-arm64.zip",
  "Edunex-Plus-1.2.3-arm64.dmg",
  "Edunex-Plus-1.2.3-x64.dmg",
  "edunex-plus_1.2.3_amd64.deb",
  "Edunex-Plus-1.2.3-x86_64.AppImage",
  "Edunex-Plus-1.2.3-arm64-mac.zip",
  "latest.yml",
];

const site = render();
const pages = [...site].filter(([file]) => file.endsWith("index.html"));
const pageAt = (files: Map<string, string>, address: string) => {
  const html = files.get(`${address.slice(1)}index.html`);
  if (!html) throw new Error(`No page at ${address}`);
  return load(html);
};
/** A page's address from its file: "en/install/index.html" is "/en/install/". */
const addressOf = (file: string) => `/${file.replace(/index\.html$/, "")}`;
/** Whether the site has something at `address`: a page, a built file, or a file in public/. */
const exists = (address: string) => {
  const clean = address.split(/[?#]/)[0] ?? "";
  if (clean.endsWith("/")) return site.has(`${clean.slice(1)}index.html`);
  return site.has(clean.slice(1)) || ["/site.css", "/site.js"].includes(clean) || fs.existsSync(path.join(PUBLIC, clean));
};

describe("the website's pages", () => {
  it("has every page in Indonesian at the root and in English under /en", () => {
    const addresses = pages.map(([file]) => addressOf(file)).sort();
    const expected = ROUTES.flatMap((route) => [route.path, `/en${route.path}`]).sort();
    expect(addresses).toEqual(expected);
    expect(LANGS).toEqual(["id", "en"]);
    expect(expected).toContain("/install/android/");
    expect(expected).toContain("/en/install/iphone/");
  });

  it("links only to pages and files that exist, and to parts of a page that are there", () => {
    const broken: string[] = [];
    for (const [file, html] of site) {
      if (!file.endsWith(".html")) continue;
      const $ = load(html);
      const targets = [
        ...$("[href]")
          .map((_, el) => $(el).attr("href"))
          .get(),
        ...$("[src]")
          .map((_, el) => $(el).attr("src"))
          .get(),
        ...$("[srcset]")
          .map((_, el) => ($(el).attr("srcset") ?? "").split(",").map((part) => part.trim().split(" ")[0]))
          .get(),
      ];
      for (const target of targets) {
        if (!target || /^(https?:|mailto:)/.test(target)) continue;
        if (target.startsWith("#")) {
          if ($(`[id="${target.slice(1)}"]`).length === 0) broken.push(`${file}: ${target}`);
          continue;
        }
        if (!target.startsWith("/")) {
          broken.push(`${file}: ${target} isn't from the site's root`);
          continue;
        }
        if (!exists(target)) broken.push(`${file}: ${target}`);
        const [address, anchor] = target.split("#");
        if (anchor && address?.endsWith("/") && exists(address) && pageAt(site, address)(`[id="${anchor}"]`).length === 0) broken.push(`${file}: ${target}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("gives every picture its size and its words", () => {
    const missing: string[] = [];
    for (const [file, html] of pages) {
      const $ = load(html);
      $("img").each((_, el) => {
        const img = $(el);
        if (img.attr("alt") === undefined || !img.attr("width") || !img.attr("height")) missing.push(`${file}: ${img.attr("src")}`);
      });
      // A drawing is one picture to a screen reader, named after its step.
      $(".pic[role=img]").each((_, el) => {
        if (!$(el).attr("aria-label")) missing.push(`${file}: a drawing without a name`);
      });
    }
    expect(missing).toEqual([]);
  });
});

describe("what search engines and link previews read", () => {
  it("says each page's title, description, address and language", () => {
    const titles = new Set<string>();
    for (const [file, html] of pages) {
      const $ = load(html);
      const address = addressOf(file);
      const lang = address.startsWith("/en/") ? "en" : "id";
      const title = $("title").text();
      const description = $('meta[name="description"]').attr("content") ?? "";
      expect($("html").attr("lang"), file).toBe(lang);
      expect($("h1"), file).toHaveLength(1);
      expect(title.length, `${file}: ${title}`).toBeGreaterThan(20);
      expect(title.length, `${file}: ${title}`).toBeLessThanOrEqual(75);
      expect(description.length, `${file}: ${description}`).toBeGreaterThanOrEqual(70);
      expect(description.length, `${file}: ${description}`).toBeLessThanOrEqual(165);
      expect(titles.has(title), `${title} is used twice`).toBe(false);
      titles.add(title);
      expect($('link[rel="canonical"]').attr("href"), file).toBe(ORIGIN + address);
      expect($('meta[property="og:url"]').attr("content"), file).toBe(ORIGIN + address);
    }
  });

  it("points each page at the same page in the other language", () => {
    for (const route of ROUTES) {
      for (const address of [route.path, `/en${route.path}`]) {
        const $ = pageAt(site, address);
        expect($('link[hreflang="id"]').attr("href"), address).toBe(ORIGIN + route.path);
        expect($('link[hreflang="en"]').attr("href"), address).toBe(`${ORIGIN}/en${route.path}`);
        expect($('link[hreflang="x-default"]').attr("href"), address).toBe(ORIGIN + route.path);
        // The visitor's own way across: the language link in the top bar.
        const other = address.startsWith("/en/") ? route.path : `/en${route.path}`;
        expect($(".nav .lang").attr("href"), address).toBe(other);
      }
    }
  });

  it("shares a picture of the right size, in the page's language", () => {
    for (const [file, html] of pages) {
      const $ = load(html);
      const image = $('meta[property="og:image"]').attr("content") ?? "";
      const lang = $("html").attr("lang");
      expect(image, file).toBe(`${ORIGIN}/assets/social-card-${lang}.jpg`);
      const bytes = fs.readFileSync(path.join(PUBLIC, image.slice(ORIGIN.length)));
      // A JPEG's size is in its start-of-frame block: height, then width.
      const frame = bytes.findIndex((byte, i) => byte === 0xff && [0xc0, 0xc2].includes(bytes[i + 1] ?? 0));
      expect([bytes.readUInt16BE(frame + 7), bytes.readUInt16BE(frame + 5)], image).toEqual([1200, 630]);
      expect($('meta[name="twitter:card"]').attr("content")).toBe("summary_large_image");
    }
  });

  it("describes the app, its questions and each guide's steps in a form search engines read", () => {
    const things = (address: string) =>
      pageAt(
        site,
        address,
      )('script[type="application/ld+json"]')
        .map((_, el) => JSON.parse(pageAt(site, address)(el).text()))
        .get();
    const home = things("/");
    expect(home.map((thing) => thing["@type"])).toEqual(["SoftwareApplication", "FAQPage", "WebSite"]);
    expect(home[1].mainEntity).toHaveLength(id.home.faq.items.length);
    const android = things("/install/android/");
    expect(android.map((thing) => thing["@type"])).toEqual(["BreadcrumbList", "HowTo"]);
    // Every step of the guide, and signing in last.
    expect(android[1].step).toHaveLength(id.guides.android.steps.length + 1);
    expect(android[1].step.at(-1).name).toBe(id.install.guide.signIn.title);
  });

  it("lists every page in the sitemap, which robots.txt names", () => {
    const sitemap = site.get("sitemap.xml") ?? "";
    const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]).sort();
    expect(listed).toEqual(pages.map(([file]) => ORIGIN + addressOf(file)).sort());
    expect(site.get("robots.txt")).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
    // The page for an address that isn't there stays out of search.
    expect(load(site.get("404.html") ?? "")('meta[name="robots"]').attr("content")).toBe("noindex");
    expect(sitemap).not.toContain("404");
  });
});

describe("the install guides", () => {
  const devices = ["android", "iphone", "windows", "mac", "linux"] as const;

  it("has a guide for each device, each step with what to do and a picture, a line to copy or a file to fetch", () => {
    for (const lang of ["id", "en"] as const) {
      for (const device of devices) {
        const address = `${lang === "id" ? "" : "/en"}/install/${device}/`;
        const $ = pageAt(site, address);
        const steps = $(".steps > .step");
        expect(steps.length, address).toBeGreaterThanOrEqual(4);
        steps.each((i, el) => {
          const step = $(el);
          expect(step.find("h2").text().trim().length, `${address} step ${i + 1}`).toBeGreaterThan(5);
          expect(step.find(".step-text > p").length, `${address} step ${i + 1}`).toBeGreaterThanOrEqual(1);
          const shows = step.find(".pic").length + step.find(".command").length + step.find(".files").length;
          expect(shows, `${address} step ${i + 1} shows nothing`).toBeGreaterThan(0);
        });
        // The last step is the same everywhere: signing in.
        expect(steps.last().find("h2").text()).toBe((lang === "id" ? id : en).install.guide.signIn.title);
        expect($(".faq details").length, address).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("opens the release page for a file until the site knows the release", () => {
    const $ = pageAt(site, "/install/android/");
    expect($('[data-file="android"]').attr("href")).toBe("https://github.com/pablonification/edunex-plus/releases/latest");
    expect($(".file-note")).toHaveLength(0);
  });

  it("fetches each device's own file, and says its version, once it does", () => {
    const release = releaseFrom(githubRelease(EVERY_FILE));
    const built = render({ release });
    const file = (address: string, key: string) => pageAt(built, address)(`[data-file="${key}"]`).attr("href")?.split("/").pop();
    expect(file("/install/android/", "android")).toBe("Edunex-Plus-1.2.3-android.apk");
    expect(file("/install/iphone/", "iphone")).toBe("Edunex-Plus-1.2.3-iphone.ipa");
    expect(file("/install/windows/", "win-x64")).toBe("Edunex-Plus-Setup-1.2.3-windows-x64.zip");
    expect(file("/install/windows/", "win-arm")).toBe("Edunex-Plus-1.2.3-windows-arm64.zip");
    expect(file("/install/mac/", "mac-arm")).toBe("Edunex-Plus-1.2.3-arm64.dmg");
    expect(file("/install/mac/", "mac-intel")).toBe("Edunex-Plus-1.2.3-x64.dmg");
    expect(file("/en/install/linux/", "linux-deb")).toBe("edunex-plus_1.2.3_amd64.deb");
    expect(file("/en/install/linux/", "linux-appimage")).toBe("Edunex-Plus-1.2.3-x86_64.AppImage");
    expect(pageAt(built, "/install/android/")(".file-version").text()).toBe("Versi 1.2.3");
    // The line to paste names the real file.
    expect(pageAt(built, "/en/install/linux/")(".command code").first().text()).toBe("sudo apt install ./edunex-plus_1.2.3_amd64.deb");
  });

  it("says so when the newest release has no file for a device yet", () => {
    const release = releaseFrom(githubRelease(EVERY_FILE.filter((name) => !name.endsWith(".apk"))));
    const $ = pageAt(render({ release }), "/install/android/");
    expect($(".file-note").text()).toBe("Berkas untuk Android belum ada di rilis terbaru. Buka halaman rilis untuk melihat yang tersedia.");
    expect($('[data-file="android"]').attr("href")).toBe("https://github.com/pablonification/edunex-plus/releases/latest");
    expect(pageAt(render({ release }), "/install/mac/")(".file-note")).toHaveLength(0);
  });

  it("takes an answer from GitHub that isn't a release as no release", () => {
    expect(releaseFrom({ message: "Not Found" })).toBeNull();
    expect(releaseFrom(null)).toBeNull();
  });
});

describe("the website's look", () => {
  const css = fs.readFileSync(path.resolve("site/src/site.css"), "utf8");

  // What makes a page look machine-made, each one removed once already (site/README.md, "How it looks").
  it("stays flat: no gradients, blur, glow, looping motion or spaced-out capitals", () => {
    const found = [
      [/gradient\(/, "a gradient"],
      [/backdrop-filter|filter:\s*blur/, "a blur"],
      [/infinite/, "motion that loops"],
      [/text-transform:\s*uppercase/, "capitals"],
      [/letter-spacing:\s*0\.[1-9]/, "spaced-out letters"],
      [/transition:\s*all/, "transition: all"],
    ].flatMap(([pattern, what]) => ((pattern as RegExp).test(css) ? [what] : []));
    expect(found).toEqual([]);
  });

  it("shows the app in an iPhone and a MacBook, and puts no icon in a tinted square", () => {
    const $ = pageAt(site, "/");
    expect($(".hero .macbook img").attr("alt")).toBeTruthy();
    expect($(".hero .iphone .iphone-island")).toHaveLength(1);
    // Each screen beside the question it answers.
    expect($(".strip figure")).toHaveLength(id.home.screens.items.length);
    expect($(".strip figure .iphone img")).toHaveLength(id.home.screens.items.length);
    // An icon sits bare in a button, a row or a summary, never in a holder of its own.
    $("svg.icon").each((_, el) => {
      expect(["a", "button", "summary"], $.html(el)).toContain($(el).parent().prop("tagName")?.toLowerCase());
    });
  });

  it("says each page's name once, and the home page's one thing to do once per place", () => {
    for (const [file, html] of pages) {
      const $ = load(html);
      const headings = $("h1, h2, h3")
        .map((_, el) => $(el).text().trim())
        .get();
      expect(new Set(headings).size, `${file}: a heading said twice`).toBe(headings.length);
    }
    // One button at the top, one at the bottom, and the small one in the bar.
    expect(pageAt(site, "/")("main a.btn")).toHaveLength(2);
  });
});

describe("the website's words", () => {
  /** Every string in a words file, by its path. */
  const strings = (value: unknown, at = ""): [string, string][] =>
    typeof value === "string"
      ? [[at, value]]
      : Array.isArray(value)
        ? value.flatMap((item, i) => strings(item, `${at}[${i}]`))
        : value && typeof value === "object"
          ? Object.entries(value).flatMap(([key, item]) => strings(item, at ? `${at}.${key}` : key))
          : [];

  it("has the same words in both languages", () => {
    const keys = (words: unknown) => strings(words).map(([at]) => at);
    expect(keys(en)).toEqual(keys(id));
  });

  it("is written the way the app's words are", () => {
    const wrong: string[] = [];
    for (const [lang, words] of [
      ["id", id],
      ["en", en],
    ] as const) {
      for (const [at, text] of strings(words)) {
        // The drawings quote each system's own screens, which say what they say.
        const ours = !at.startsWith("pic.");
        if (/—/.test(text)) wrong.push(`${lang} ${at}: an em dash`);
        if (ours && /!/.test(text.replace(/<[^>]+>/g, ""))) wrong.push(`${lang} ${at}: an exclamation mark`);
        // Windows' own warning is named as Windows writes it.
        if (ours && lang === "id" && /\b(Anda|kami)\b/.test(text.replaceAll("Windows melindungi PC Anda", ""))) wrong.push(`${lang} ${at}: Anda or kami`);
        if (ours && lang === "en" && /\b(we|us|our|please)\b/i.test(text.replace(/<[^>]+>/g, ""))) wrong.push(`${lang} ${at}: we, us, our or please`);
      }
    }
    expect(wrong).toEqual([]);
  });
});
