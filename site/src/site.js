// The page works without this script. With it: the buttons name this visitor's device and lead to its
// guide, the guide's download buttons put this computer's file first, a line can be copied, and the parts
// of a page arrive as they are scrolled to.
const data = JSON.parse(document.getElementById("site-data").textContent);
const ua = navigator.userAgent;

// Android's own browser says "Linux" too, and an iPad says "Macintosh": the phones first.
const os = /Android/.test(ua)
  ? "android"
  : /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
    ? "iphone"
    : /Windows/.test(ua)
      ? "windows"
      : /Linux|X11|CrOS/.test(ua)
        ? "linux"
        : "mac";

// The buttons that start an install: this device's guide, said by name.
const mine = data.install[os];
if (mine) {
  for (const link of document.querySelectorAll("[data-install], [data-install-link]")) link.href = mine.href;
  for (const label of document.querySelectorAll("[data-install-label]")) label.textContent = mine.label;
}
// This visitor's device comes first in the list, and says so.
for (const row of document.querySelectorAll(`.row[data-device="${os}"]`)) {
  row.classList.add("is-yours");
  row.querySelector(".row-yours").hidden = false;
}

// ARM or not: Apple silicon or Intel, a Snapdragon Windows PC or not. Chrome and Edge say it outright,
// otherwise the graphics chip gives it away (an Intel Mac's isn't Apple's, an ARM PC's is Qualcomm's).
// Unsure means the common case: Apple silicon, and Intel or AMD on Windows.
async function arm() {
  try {
    const hints = await navigator.userAgentData?.getHighEntropyValues(["architecture"]);
    if (hints?.architecture) return hints.architecture === "arm";
  } catch {}
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    const gpu = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "";
    return os === "windows" ? /Qualcomm|Adreno/i.test(gpu) : !/Intel|AMD|Radeon|NVIDIA/i.test(gpu);
  } catch {
    return os === "mac";
  }
}

// A guide with two files for one system (Apple silicon and Intel, x64 and ARM): this computer's comes first.
const second = { mac: "mac-intel", windows: "win-arm" }[os];
const other = second && document.querySelector(`.files [data-file="${second}"]`);
if (other) {
  arm().then((isArm) => {
    if ((os === "mac") === isArm) return;
    other.parentElement.prepend(other);
  });
}

// The newest release, from GitHub.
async function latest() {
  // Site data can be blocked, and then even reading it throws: ask GitHub instead.
  try {
    const saved = sessionStorage.getItem("latest-release");
    if (saved) return JSON.parse(saved);
  } catch {}
  const response = await fetch(`https://api.github.com/repos/${data.repo}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) throw new Error(`GitHub said ${response.status}`);
  const { tag_name, assets } = await response.json();
  const release = { version: tag_name.replace(/^v/, ""), assets: assets.map(({ name, browser_download_url }) => ({ name, url: browser_download_url })) };
  try {
    sessionStorage.setItem("latest-release", JSON.stringify(release));
  } catch {}
  return release;
}

// A site built without the newest release asks GitHub for it, to fill in each file's address and name.
const fileLinks = document.querySelectorAll("[data-file]");
if (fileLinks.length > 0 && !data.release) {
  latest()
    .then((release) => {
      for (const link of fileLinks) {
        const file = release.assets.find((asset) => new RegExp(data.files[link.dataset.file]).test(asset.name));
        if (!file) continue;
        // The file itself now, not the release page: it downloads here, without a new tab.
        link.href = file.url;
        link.removeAttribute("target");
        link.removeAttribute("rel");
        link.setAttribute("download", "");
      }
      for (const copy of document.querySelectorAll("[data-copy]")) {
        const line = copy.dataset.copy.replace(/<vers(i|ion)>/g, release.version);
        copy.dataset.copy = line;
        copy.previousElementSibling.textContent = line;
      }
    })
    .catch(() => {});
}

// Copy buttons: the line goes to the clipboard, and the button says so for a moment.
for (const copy of document.querySelectorAll("[data-copy]")) {
  const label = copy.querySelector("span");
  const idle = label.textContent;
  copy.hidden = false;
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(copy.dataset.copy);
      label.textContent = copy.dataset.copied;
    } catch {
      getSelection().selectAllChildren(copy.previousElementSibling);
      label.textContent = os === "mac" ? "⌘C" : "Ctrl+C";
    }
    setTimeout(() => {
      label.textContent = idle;
    }, 2000);
  });
}

// The bar at the top takes a background once the page has scrolled under it.
const nav = document.getElementById("nav");
const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
addEventListener("scroll", onScroll, { passive: true });
onScroll();

// The parts of a page arrive as they are scrolled to, once each (the look is site.css's, under "Motion").
// Only the parts still below the screen when the page opens are held back, so nothing a visitor is already
// reading goes away, and nothing is held back for a visitor whose device asks for less motion.
const parts = document.querySelectorAll("[data-reveal]");
// "each" brings a part's children in one after another: the screens, the rows, the alerts.
const pieces = (part) => (part.dataset.reveal === "each" ? [...part.children] : [part]);
const arrive = (part) => {
  part.classList.add("is-in");
  const held = pieces(part).filter((piece) => piece.classList.contains("reveal"));
  for (const piece of held) piece.classList.add("is-in");
  // Once they have arrived they are ordinary parts of the page again, with their own transitions.
  setTimeout(() => {
    for (const piece of held) {
      piece.classList.remove("reveal");
      if (piece !== part) piece.classList.remove("is-in");
      piece.style.removeProperty("--i");
    }
  }, 2600);
};
if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
  for (const part of parts) part.classList.add("is-in");
} else {
  const seen = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        seen.unobserve(entry.target);
        arrive(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px" },
  );
  for (const part of parts) {
    if (part.getBoundingClientRect().top < innerHeight) {
      part.classList.add("is-in");
      continue;
    }
    pieces(part).forEach((piece, i) => {
      piece.style.setProperty("--i", String(i));
      piece.classList.add("reveal");
    });
    seen.observe(part);
  }
}
