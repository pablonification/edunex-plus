# The website

[edunex-plus.arqilasp.com](https://edunex-plus.arqilasp.com): what Edunex Plus is, and a picture guide for
installing it on each device. Written for an ITB student who doesn't study computing, in English (the
default, at `/`) and Indonesian (`/id/`). English once lived under `/en/`: those addresses still lead to
today's pages.

```sh
npm run site         # the site at http://localhost:4321, rebuilt on every page load
npm run site:build   # the site into site/dist
```

It is plain HTML, CSS and a little JavaScript, built by `site/build.mjs` with no packages.

| Where | What |
| --- | --- |
| `src/words/id.mjs`, `en.mjs` | Every word, with the same keys in both. Written like the app's own words (the `copywriting` skill). |
| `src/home.mjs`, `install.mjs` | The pages. A guide is a list of steps in the words files. |
| `src/pictures.mjs` | The drawing beside each install step: the screen the student is about to see, with the button to press marked. |
| `src/layout.mjs` | What every page shares: the head (search engines, link previews), the top bar with its language switch, the footer. |
| `src/site.css`, `site.js` | The look, and the script that names the visitor's device and brings each part in as it's scrolled to. The pages work without the script. |
| `public/` | Copied as it is: pictures, fonts, the icon. |

**How it looks.** Flat pages in the app's own blue, its own heading face (Plus Jakarta Sans, as on the
phone) and the system's font for reading. The pictures of the app do the showing, in an iPhone and a
MacBook drawn in CSS (`iphone()`, `macbook()` in `src/home.mjs`). What is left out on purpose, and
`test/site/site.test.ts` keeps out: boxes and tints around text, icons in tinted squares, labels above
headings, pills and badges, gradients, blur, glow, shadows on anything that doesn't float, motion that
loops, and a sentence under a heading that only repeats it. One button per place; everything else that
leads somewhere is a link or a row. The page ends on its own colour: the app's icon, one sentence, the
button.

**How it moves.** Once, as things arrive: the top of a page when it opens, each part as it's scrolled to
(`data-reveal` in the templates; `each` brings a part's children in one after another), the alerts landing
on the lock screen, two pulses on the button to press, an answer opening. All of it lives in one block at
the end of `site.css`, which a device asking for less motion never enters, and only the parts still below
the screen are held back, by the script, so a page without it shows everything.

**Publishing.** `.github/workflows/pages.yml` builds and publishes the site when `site/` changes on `main`,
and again whenever a release is published, so the download buttons point at the newest files.

**Changing an install step.** Edit the step in both words files, and its drawing in `src/pictures.mjs` if
the screen changed. Keep `docs/install.md` saying the same: it is the long version, for every case. A
name on a system's own screen comes with its English in brackets in the Indonesian text, since a phone or
laptop may be set to either language.

**Pictures of the app** come from the demo's made-up student, never a real account: the desktop's from
`node scripts/demo/capture.mjs`, the phone's from the Mobile workflow's `e2e-results-app` artifact (an
Android emulator's, with Android's own status bar and gesture bar painted out in the screen's colour, since
the frame draws an iPhone's).

**The link-preview pictures** (`public/assets/social-card-id.jpg`, `-en.jpg`, 1200 by 630) are photographs of
two pages the build makes with `--cards`:

```sh
node site/serve.mjs --cards
# then photograph http://localhost:4321/social-card-id.html (and -en) at 1200 by 630, for example:
# "Google Chrome" --headless --window-size=1200,630 --screenshot=card.png http://localhost:4321/social-card-id.html
```

`test/site/site.test.ts` builds the site and checks that every link and picture exists, that both
languages have the same pages and words, and what search engines read.
