# 8. An update downloads only what changed, cut into chunks by the app itself

Status: accepted (2026-10-24).

## Context

Every update downloaded the whole new file: the Mac zip (118 MB for Apple silicon, 125 MB for
Intel), the Windows installer (95 MB, 89 MB for ARM PCs), the AppImage (126 MB). Between two releases
almost all of it is the same: Electron itself, about 85 MB packed, changes only when Electron does.
Many Students update over a phone's data plan, and releases come every day or two.

## Decision

- **Chunk maps, cut by the app, not electron-builder's blockmaps.** At release time
  `scripts/chunk-maps.mjs` cuts each file the app updates from into chunks where its content says
  (a rolling "gear" hash, as FastCDC cuts: 16 to 256 kB, about 75 kB on average), and publishes a
  map of them beside the file: each chunk's size and sha256, and the whole file's size and sha512.
  The app cuts the files it already has with the very same code (`src/desktop/chunks.ts`, which the
  script loads as it is), downloads only the chunks they don't hold, and puts the new file together
  (`src/desktop/partial-update.ts`). It needs only the *new* map, so it works from any installed
  version, even one whose release has no map. Blockmaps need the installed version's own blockmap,
  come with electron-updater (this app has its own updater, [self-update.ts](../../src/desktop/self-update.ts)),
  and describe the Windows installer as electron-builder made it, before SignPath signs it
  ([ADR 0004](0004-windows-installers-signed-by-signpath.md)).
- **The map is trusted as the file is.** Each map is listed in the same `latest*.yml` as its file,
  with its sha512, and the app refuses a map that isn't that one. The script runs last in each
  packaging job, once the files are final (signed, their sha512 written by `scripts/update-info.mjs`),
  refuses a file the update info doesn't list as it is, and reads back each map it writes as the app
  reads it.
- **Where the bytes the computer already has come from:**
  - *Windows*: the installer that put the running version in place. electron-builder's one-click
    installer copies itself to `%LOCALAPPDATA%\edunex-plus-updater\installer.exe` each time it runs.
    The missing chunks are read straight from the new installer on the release.
  - *Linux*: the AppImage running now (`APPIMAGE`), and the new AppImage on the release.
  - *macOS*: the app's own files, so it works right after a first install from the disk image. The
    map lists every folder, file (with its mode and sha512) and link of the new app, and the release
    has a chunk pack beside it: each chunk of the new app once, packed on its own (brotli), so any
    of them can be downloaded alone. The new app is put together in a fresh folder, file by file.
- **Windows: the app inside the installer is packed file by file** (`nsis.differentialPackage`),
  not as one solid stream. In a solid stream one changed file changes everything packed after it;
  file by file, only that file's part does. The installers are about 10 MB bigger for it (105.3 MB
  instead of 95.0 MB, 99.0 MB instead of 88.8 MB for ARM PCs).
- **Downloads are HTTP ranges** through the same door as before: only GitHub's download hosts, the
  same user agent, redirects only to them. Missing chunks next to each other (or 64 kB apart at most)
  are one range, up to 8 MB; four ranges download at once; each chunk is checked by its sha256 as it
  comes. GitHub sends each download on to a signed link; it's used again for five minutes, and asked
  for again when it's refused. A range that fails is tried once more.
- **What's put together is checked as strictly as a full download.** The installer or AppImage must
  have the sha512 its `latest*.yml` lists. The Mac app must match its map file by file (sha512), then
  passes the checks an unpacked app passes (one app, this bundle id, this version, no quarantine).
- **The whole file is the fallback, always.** No map listed for the file (an older release), the
  file the app had isn't there, more than 70% of the file would be downloaded anyway, or anything
  that doesn't line up (a map, a chunk, an answer from GitHub, a check on the result): the app
  downloads the whole file, as before. Only a lost connection ends the update as "offline", since
  the whole file couldn't come either. For the Mac the whole file is whatever the full download is.
- **The main process stays free.** Files are read and cut a megabyte at a time (about 330 MB/s with
  their sha256), written and read back a chunk at a time, so Electron's main process is never busy
  for long at once, without a worker thread.
- **The chunker never changes in place.** A map names how it was cut (`CHUNKER`); the app uses only
  maps cut the way it cuts. Another way of cutting needs another name, and until both sides have it
  the app downloads whole files.

## Consequences

- Measured on real files (the bytes downloaded include the map):

  | Update | Downloads | Instead of |
  |---|---|---|
  | Mac, Apple silicon, 0.1.0-alpha.15 to alpha.16 | 2.3 MB | 117.9 MB |
  | AppImage x86_64, 0.1.0-alpha.15 to alpha.16 | 4.6 MB | 126.2 MB |
  | Windows x64, two builds a version and a small change apart | 5.3 MB | 105.3 MB |
  | Windows ARM, the same two builds | 4.8 MB | 99.0 MB |

- The first Windows update after this still downloads the whole installer: the one the PC has is
  packed solid, and 99% of the new one differs from it. From then on, only what changed.
- Each release carries more files: a map per installer and AppImage (about 80 kB each) and per Mac
  (about 250 kB), and a chunk pack per Mac (114 MB and 121 MB). Writing them takes about 20 seconds
  in the Mac packaging job, a second in the others.
- An update needs room for the new version and the missing chunks, in the same temporary folder,
  about what the full download needed.
- A computer whose old installer or app is missing, changed or someone else's simply downloads the
  whole file; nothing here can install anything the release doesn't list.
