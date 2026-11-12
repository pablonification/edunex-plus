# Code signing policy

How Edunex Plus's installers and phone apps are signed, by whom, and how to check one. Back to the
[README](../README.md); what each system shows while installing is in the [install guide](install.md).

Free code signing provided by [SignPath.io](https://about.signpath.io), certificate by
[SignPath Foundation](https://signpath.org).

**Status:** the Windows installers are signed through SignPath Foundation's free programme for
open-source projects once it has accepted Edunex Plus. Until then they aren't signed. The Mac app
is signed with the project's own certificate, which Apple doesn't know
([ADR 0003](adr/0003-mac-keychain-helper.md)).

## What is signed

On Windows, for each kind of PC (Intel or AMD, and ARM):

- the installer, `Edunex-Plus-Setup-<version>.exe` or `Edunex-Plus-<version>-arm64.exe`;
- the app's own program, `Edunex Plus.exe`, inside it;
- the uninstaller, `Uninstall Edunex Plus.exe`, which every update also runs.

Each installer also comes in a zip, `Edunex-Plus-Setup-<version>-windows-x64.zip` or
`Edunex-Plus-<version>-windows-arm64.zip`, holding that same signed installer. A zip itself can't
carry a signature.

Files Edunex Plus didn't build stay as their makers ship them: Electron's own DLLs (some carry
Microsoft's signature, some none) and the installer's NSIS plugins. SignPath Foundation signs only a
project's own files. Smart App Control, on Windows 11 PCs where it's on, checks those too, so it may
still stop part of the installer or the app; a certificate of the project's own could sign them
later ([why](research/windows-download-warnings.md)).

## How

- Every Windows installer is built from this repository's source by GitHub Actions on GitHub's own
  machines ([release.yml](../.github/workflows/release.yml)), never on anyone's computer.
- SignPath checks that what it signs came from that build of this repository, then signs it on its
  own servers. The keys never leave SignPath; nobody on the project holds them.
- Each release is signed only after an approver has approved it in SignPath, twice: once for the
  app's programs, once for the installers made from them
  ([scripts/package-sign-win.mjs](../scripts/package-sign-win.mjs)).
- The release workflow's check builds (of `main` without a new version, or started by hand) take
  the same steps with a stand-in signature that only that build's machine trusts, all but the trip
  to SignPath. They're for testing and are never published.

## Android and iPhone

- **Android:** every release's APK is signed with Edunex Plus's own key, by the same GitHub Actions
  build ([mobile-release.yml](../.github/workflows/mobile-release.yml)), which stops rather than sign
  with anything else and checks the result. The key lives in the repository's secrets
  (`ANDROID_SIGNING_KEYSTORE`, `ANDROID_SIGNING_PASSWORD`) and, as a backup, with the maintainer
  only. Android installs a new version over the old one only when both carry this key, so an APK
  signed by anyone else can't replace the app or read what it saved. Its certificate's SHA-256
  fingerprint:

  ```text
  896d9ed2982d532bdb693ec2c72e92af1c22d1ece9247a240df98f855e1b8d9e
  ```

  Other APKs (the lab's demo builds, the read-only QA builds) use the Android template's public
  debug key and are never published.
- **iPhone:** the `.ipa` on a release is unsigned. Each student signs it with their own Apple ID
  when installing it ([install guide](install.md#iphone)), because a free Apple ID can only sign
  for its own devices.

To check an APK on a computer with Android's build tools: `apksigner verify --print-certs
Edunex-Plus-<version>-android.apk`. The `certificate SHA-256 digest` it prints should be the
fingerprint above.

## Team roles

- **Committers and reviewers:** [@pablonification](https://github.com/pablonification), the only
  account that can change the repository. Changes from anyone else come as pull requests, which
  they review before merging ([CONTRIBUTING.md](../CONTRIBUTING.md)). The one exception: Dependabot's
  patch and minor updates to build and test tools (never Electron or electron-builder) merge on
  their own once CI passes ([dependabot-auto-merge.yml](../.github/workflows/dependabot-auto-merge.yml)).
- **Approvers:** [@pablonification](https://github.com/pablonification).

Everyone in these roles uses two-factor authentication on GitHub, and on SignPath once the project
has an account there.

## Privacy

Edunex Plus talks only to the systems it's for (Edunex, SIX and ITB's public pages), to GitHub to
check for and download updates, to ntfy only if you turn on phone notifications, and to the
maintainer's report relay only with a problem report you send, or one you said may go by itself.
No analytics, no tracking. Every server it contacts, and what it sends, is in [Signing in and privacy](privacy.md).
The services it uses have their own: [GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement)
and [ntfy's privacy policy](https://ntfy.sh/docs/privacy/).

## Checking a signature

On Windows, right-click the installer → **Properties** → **Digital Signatures**: the signer is
**SignPath Foundation**, and **Details** says the signature is OK. Or in PowerShell:

```powershell
Get-AuthenticodeSignature .\Edunex-Plus-Setup-<version>.exe | Format-List Status, SignerCertificate
```

`Status` should be `Valid`, and the certificate's subject should start with
`CN=SignPath Foundation`. The publisher Windows shows is SignPath Foundation, not Edunex Plus: the
certificate is issued to the Foundation, which signs for the projects it accepts.

An installer that claims to be Edunex Plus but isn't signed by SignPath Foundation (from a release
after signing began), or that comes from anywhere other than this repository's
[releases](https://github.com/pablonification/edunex-plus/releases): don't run it, and tell us
privately as [SECURITY.md](../SECURITY.md) explains.
