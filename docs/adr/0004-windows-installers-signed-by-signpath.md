# 4. The Windows installers, signed by SignPath Foundation in two passes

Status: proposed (2026-10-23). Turns on by itself once SignPath has accepted the project and its
settings are in the repository; until then releases are unsigned, as before.

## Context

Edge, Chrome and Windows SmartScreen warn about every Windows installer ("isn't commonly
downloaded", "Windows protected your PC"), and Smart App Control won't run it. They go by
reputation: an unsigned file earns it only by its own hash, so every release starts from nothing,
and by Microsoft's measure it "can take several weeks and hundreds of clean installs". With a
release every day or two and a handful of downloads each, the warnings never go. Only a signature
lets reputation carry from one release to the next. The evidence and every option are in
[research/windows-download-warnings.md](../research/windows-download-warnings.md).

The maintainer is one student in Indonesia. Microsoft's Artifact Signing takes individuals only in
the USA and Canada; a certificate in the maintainer's own name costs EUR 49 to about US$370 a year
and either has no official way to sign from CI (Certum) or charges per signature (SSL.com). SignPath
Foundation signs open-source projects for free, under its own name, from GitHub Actions, if it
accepts the project.

## Decision

- **SignPath Foundation signs the Windows releases**, once it accepts Edunex Plus. Students see
  "SignPath Foundation" as the publisher ([code-signing.md](../code-signing.md)).
- **Two passes, two approvals.** SignPath signs on its own servers and can't open an NSIS installer,
  so the build keeps aside each app's `Edunex Plus.exe` and the uninstaller electron-builder makes,
  SignPath signs those, electron-builder makes the installers again from them (`--prepackaged`,
  with a sign hook that puts the signed uninstaller in), and SignPath signs the installers
  (`scripts/package-win.mjs`, `scripts/package-sign-win.mjs`, `.github/workflows/release.yml`). The
  maintainer approves each round in SignPath.
- **The uninstaller is signed too**: every update runs the installed version's uninstaller, and Smart
  App Control stops one that isn't signed.
- **`latest*.yml` gets the signed installers' sha512** (`scripts/update-info.mjs`): the app's own
  updater checks downloads against it. The updater never checks a publisher, so going from unsigned
  to signed, or later to another signer, needs no change there.
- **Only version tags are signed, and only with the settings present.** Forks, local builds and
  releases before SignPath are unsigned, as now. The release workflow's other builds (of `main`,
  or started by hand) take both passes with a stand-in certificate made for the run, so all of the
  signed path but the trip to SignPath is tried before a release depends on it.
- **No `elevate.exe`** (`nsis.packElevateHelper: false`): it serves only electron-updater's
  per-machine installs, and it would land unsigned in the signed app folder.

## Consequences

- Each release waits for two approvals, sends SignPath about 400 MB, and counts against a yearly
  quota SignPath doesn't publish. Fewer, steadier releases keep that in reach, and help reputation
  too.
- Electron's DLLs and the installer's NSIS plugins stay unsigned: SignPath signs only a project's own
  files. Smart App Control will likely still stop part of the installer on PCs where it's on. Fully
  covering those PCs takes a certificate of our own (signing those files too, with our own copies of
  the NSIS bundles as Signal does) or the Microsoft Store.
- The warnings fade only as SignPath Foundation's publisher record builds for our files; the first
  signed releases will likely still warn.
- With a certificate of our own later, electron-builder would sign inside one pass through a sign
  hook, and the two-pass steps would go.
