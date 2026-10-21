# 3. The Mac sign-in key, kept by a helper that never changes

Status: accepted (2026-10-21). Changes how [0001](0001-v2-engine-and-shell.md) stores sessions on
macOS; they're still locked only with a key the system keychain keeps, never plain.

## Context

On a Mac, Electron's safeStorage keeps its key in the login keychain ("Edunex Plus Safe Storage").
After every update macOS asked the Student for their Mac password before the new version could
open it. Signing every release with the project's own certificate (#172) didn't stop that. The
keychain entry's access list showed why: besides "this app, signed with this certificate" (which
the certificate fixed), the keychain lets an app in only while it's one of the exact builds
already allowed. For an app whose certificate Apple issued, that check goes by the developer's team
instead; for any other, it's the build's fingerprint (its cdhash). Every release is another build,
so it asked again, and there was one more fingerprint on the list each time the Student chose
Always Allow. Electron's own Chromium opens the same entry by itself only when it clears its saved
storage (a sign-out).

An Apple Developer ID ($99 a year) would end it, and the first-install warning too. Keeping the
key in a plain file would end it for free, but then any program the Student runs could read their
sessions without asking.

## Decision

- **A small helper keeps the key, and it's the same build in every release.**
  `native/mac-keychain/keychain.c`, built once for both kinds of Mac and signed with the project's
  certificate (`scripts/build-keychain-helper.mjs`), is committed as a file. Releases ship it as
  it is, in `Edunex Plus.app/Contents/Helpers`: electron-builder doesn't sign it (`signIgnore`),
  nor does the certificate step (`scripts/package-sign.mjs`), and every Mac build fails unless it
  carries that exact build (`native/mac-keychain/helper.json`). The keychain sees the build it
  already allowed, so it never asks.
- **It answers only the app.** The helper hands over the key only when the process that started
  it is `id.edunexplus.desktop` signed with the project's certificate, the same thing the keychain
  checked before. An ad-hoc build (a local one, a fork) and Terminal get nothing, and such a
  build's vault uses safeStorage as before.
- **Its own entry, "Edunex Plus Vault":** a random 32-byte key the helper makes the first time.
  The vault seals each value with it (AES-256-GCM, bound to the value's name).
- **The old entry is read one last time.** On the first start with the helper, every sign-in
  safeStorage locked is read with it and sealed again, all at once: macOS asks then, the last
  time. One it can't read (the Student chose Deny) is dropped, as a session that won't open
  always was.
- **Chromium is kept away from the keychain.** Before Chromium starts, the app reads the key. If
  it has the key and nothing safeStorage locked is left, it starts Chromium with
  `use-mock-keychain`, so Chromium (and safeStorage) never open the real keychain. It stores no
  cookies on disk (every saved session's requests leave them out) and nothing it encrypts is
  kept, so nothing is lost.

## Consequences

- After the update that brings the helper, macOS asks once more; after that, never, as long as
  the helper doesn't change. Building it again, even from the same source with another Xcode, is
  another build: every Student is asked once more after that update. So it's rebuilt only when it
  must change, and the release notes say so.
- A new certificate means a new helper too (it names the certificate), and so does a change to
  the app's identifier.
- Anyone who has the certificate's private key could sign a program the helper answers. That's
  the trust the keychain already gave the certificate: whoever holds it can sign an app macOS
  takes for Edunex Plus (CONTRIBUTING.md).
- "Edunex Plus Safe Storage" stays in the keychain, unused. Windows and Linux are unchanged.
- Tests check the source and the file against the manifest, the vault's sealing and the move from
  safeStorage, and what gets signed. Whether macOS asks was checked by hand on a Mac (2026-10-21):
  a stand-in app signed with the certificate, built twice, got the key both times without a
  question, while an ad-hoc copy and Terminal were refused.
