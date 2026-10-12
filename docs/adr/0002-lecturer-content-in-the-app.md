# 2. What lecturers write and upload, shown in the app

Status: accepted (2026-10-12). Extends the security baseline of
[0001](0001-v2-engine-and-shell.md); nothing in it is loosened.

## Context

Lecturers' notes on Edunex are HTML with pictures and links to anywhere
(Google Sheets, Forms, Drive, bit.ly, YouTube). Edunex shows the HTML right
on the course page, its pictures from Edunex's storage on Azure, and opens
any link. The app showed a note only behind "Read", dropped its pictures, and
silently did nothing on a link outside its official list (Edunex, SIX, ITB,
online-class services), so a Student couldn't reach "Penawaran topik TA" at
all. The window itself must stay what 0001 says: the app's own page only,
never web content, a strict content policy.

## Decision

- **Lecturers' links open in the system browser, wherever they go.** A new
  bridge action, `shell.openLink`, opens any `http:` or `https:` address with
  a host and no name or password in it (a way to disguise where a link goes).
  Other schemes (`mailto:`, `file:`, `javascript:`…) are never made links.
  It is used only for what a lecturer wrote: notes, Task instructions,
  announcements and link materials; and for the Student's own answer as
  Edunex keeps it, which, written on Edunex's website, can hold links and
  storage pictures just like a lecturer's note. The app's own links keep
  `shell.openExternal`, official pages only, and the window's navigation
  guard is unchanged: a page trying to leave still opens only when official.
  The browser is the safe place for the web; the window never loads it.
  Each link shows where it goes on hover and focus, and a link that can't
  open says so (a toast) instead of a dead click.
- **Pictures come through the main process, as data.** The window's
  `img-src` stays `'self' data: blob:`. A new bridge action, `files.read`,
  fetches a file for the window (`src/desktop/remote-files.ts`): only from
  Edunex's storage (`*.blob.core.windows.net`, `api-edunex.cognisia.id`,
  https, no credentials in the address), through the engine's in-memory
  session with no cookies and no redirects, at most 20 MB, and only when the
  first bytes are a picture format that never runs anything (PNG, JPEG, GIF,
  WebP; never SVG), whatever the server says it is. The window shows the
  bytes from memory (`blob:` URLs, freed when no longer kept). An expired
  storage link, a missing file, a file that isn't a picture or a storage that
  can't be reached come back as a reason the screen explains in place.
  Pictures on other hosts show as a link to where they are.
- **The HTML stays rebuilt, never injected.** `src/app/ui/rich-text.tsx`
  parses it and rebuilds an allowlist of plain tags as React elements; no
  markup, style or handler from Edunex reaches the page. It now also keeps
  figures, captions, highlights and rules, turns an embedded video or page
  into its link, and drops CKEditor's empty spacer paragraphs, as Edunex does.
- **PDFs read in the app with pdf.js, never Chromium's PDF plugin.** The
  plugin would need `plugins: true`, frames or `object-src`, and a page that
  loads remote content; pdf.js (`pdfjs-dist`, Apache-2.0, the engine Edunex's
  own site uses) draws from bytes inside the app's page instead. The bytes
  come through `files.read` like pictures (Edunex's storage only, at most
  100 MB, starting with `%PDF-`); a PDF the Student just attached to an
  answer comes through `tasks.readPicked`, by the id main gave it when it was
  picked or dropped, with the same checks, so the window still never learns
  where a file is on the computer. It loads only when a PDF is first opened,
  as its own chunk. Two small, explained changes serve it from the app's own
  files: `app://` sends `.mjs` as JavaScript (its worker is a module, and
  `nosniff` refuses a script without the right type), and the content policy
  says `worker-src 'self'` outright (it already followed from `script-src
  'self'`). It runs with `useWasm: false`, using pdf.js's JavaScript image
  decoders, so `script-src` needs no `'wasm-unsafe-eval'`; v6 has no eval
  path, and a PDF's own scripts never run (`pdf.sandbox` isn't shipped). A
  link inside a PDF follows the lecturer-link rule above or goes to its page.
- **A small file cache, wiped at sign-out.** Files the window showed are kept
  in the app's data folder (`file-cache/`, named by a hash of their address,
  the least recently opened dropped past 300 MB) so opening one again is
  instant and works offline. The files belong to the Student who opened
  them: signing out of Edunex, or of everything, removes the folder, and a
  read still on its way at that moment isn't kept; another Student's
  account arriving (a sign-in after the last session ran out) empties it at
  once, and nothing is kept while nobody is signed in. A PDF the
  Student saved for offline reading opens from that copy first, only while
  its size still matches Edunex's, so a lecturer's corrected upload under the
  same title isn't hidden behind the old one.
- **Reading never tells Edunex.** Fetching a picture from Azure doesn't touch
  Edunex's API, so it never counts as "viewed" or presence (0001).

## Consequences

- A compromised window could ask main for any Azure blob, but only as a
  picture it can show; it could already download one with `files.download`.
- Lecturer links can lead anywhere on the web. That is Edunex's own
  behaviour, and they open in the Student's browser, never inside the app.
- Tests run main's real reader on the pretend storage (`world.fetch`), and the
  test bridge refuses links the way main does, so a dead link fails a test.
  pdf.js can't draw in jsdom: screen tests use a stand-in for it, and the
  demo's made-up PDFs show the real drawing.
- The app's files grow by pdf.js's worker (1.3 MB), its lazy chunk (437 KB)
  and its data files (3 MB of character maps, standard fonts and decoders);
  the window's start-up bundle doesn't.
