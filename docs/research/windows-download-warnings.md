# Why browsers and Windows warn about the installers, and what fixes it

Researched 2026-10-22 and 23 for the problem in the maintainer's words: "When I'm trying to download
the packages, from website or from the GitHub release pages, it is got flagged by chrome. Making it
untrustworthy." Every claim below comes from a primary source (the vendor's, Google's, Microsoft's,
Apple's, the CA/Browser Forum's, electron-builder's or this repository's own), listed with its date
at the end as [n]. A claim that rests on anything weaker says so. Back to [docs/install.md](../install.md).

## In short

- **The warning in the photo is very likely Microsoft Edge's, not Chrome's.** The sentence
  "Edunex-Plus-Setup-0.1.0-alpha.10.exe isn't commonly downloaded. Make sure you trust … before you
  open it." is not among Chrome's strings [31]; Chrome says "Suspicious download blocked" and "This
  file isn't commonly downloaded and it may be dangerous" [31]. The panel in the photo (a
  "Downloads" flyout with folder, search and ⋯ buttons, "Open file", "See more") is Edge's. Edge's
  download check is Microsoft Defender SmartScreen [6]. Either way the cause and the fix are the
  same, and both browsers are covered below.
- **The cause is reputation, not anything wrong with the files.** SmartScreen trusts a file that
  many people have run, or a file signed by a publisher with a good record. An unsigned file starts
  from zero and can only build reputation by its own hash, so every release starts again [1].
  Microsoft's figure for building it is "several weeks and hundreds of clean installs" [1]. Edunex
  Plus ships a new installer every day or two (11 alphas, 13 to 22 October 2026), downloaded 0 to 4
  times each (alpha.1's count is mostly CI): an unsigned installer will never get there.
- **Signing is the only thing that lets reputation carry from one release to the next** [1][2].
  It does not make the warning vanish on day one: a newly signed program can still be "unrecognized"
  until its publisher has a record [1], EV certificates stopped skipping that in 2024 [2][4], and a
  user reports Edge's same sentence for a file signed through Microsoft's own signing service
  (forum report, not verified). Signing also replaces "Unknown publisher" with a name at once, and
  it's what Smart App Control requires: without it, Windows 11 PCs with Smart App Control on can't
  run the app at all [7][11]. Smart App Control wants every file signed, down to the installer's
  helper DLLs [10]; the free route below can't sign those, so it helps those PCs only in part.
- **Now (free):** apply for SignPath Foundation's free code signing for open-source projects [40],
  publish the code signing policy it asks for, and turn on the release workflow's SignPath steps
  once it says yes (they're ready in `.github/workflows/release.yml`).
  Meanwhile tell students exactly what Edge, Chrome and Windows show, and publish fewer releases to
  students: each new file is unknown again.
- **Later:** if SignPath declines or its limits bite, a certificate in the maintainer's own name
  (Certum's open-source certificate, about EUR 49 a year [52]) or, if Microsoft opens it to
  individuals outside the USA and Canada, Azure Artifact Signing (US$9.99 a month [15][17]). For
  1.0, the Microsoft Store (free for individuals [20]) is the one way to make every warning go away,
  with real work to do first. On the Mac, an Apple Developer ID (US$99 a year [72]) ends the
  Terminal line.
- **How long:** the publisher name changes with the first signed release. The warnings fade only as
  reputation builds, and nobody publishes how fast: Microsoft says weeks and hundreds of installs
  [1], Google says "eventually" [33]. Plan on the first signed releases still warning, and on fewer,
  steadier releases helping.

## 1. What a student goes through on Windows

Three checks, by three different parts, one after another:

1. **The browser, while downloading.** Edge asks SmartScreen; Chrome asks Google Safe Browsing.
   - **Edge:** "… isn't commonly downloaded. Make sure you trust … before you open it." To keep it:
     ⋯ → **Keep** → **Show more** → **Keep anyway** [6].
   - **Chrome:** "Suspicious download blocked", and on its page "This file isn't commonly downloaded
     and it may be dangerous", with **Download suspicious file** to keep it [31]. Chrome sends Google
     the file's address and redirects, its SHA-256 and size, and its Authenticode signature with the
     certificate chain [30][31], and Google answers SAFE, UNCOMMON, DANGEROUS and so on. UNCOMMON is
     what gives the warning above [31].
2. **Windows SmartScreen, when the file is opened.** The browser marks a download as coming from the
   internet (the Mark of the Web), and SmartScreen checks marked files when they run [1][5]:
   "Windows protected your PC" → **More info** → **Run anyway**. For an unsigned file the publisher
   shows as "Unknown publisher".
3. **Smart App Control, on Windows 11 PCs where it's on.** It checks every program and DLL as it
   loads, downloaded or not, and lets it run only if Microsoft's cloud service vouches for it or it's
   signed with a certificate from a CA in Microsoft's Trusted Root Program; there's no "run anyway"
   [7][8][11]. Self-signed certificates don't count [8]. It came with Windows 11 22H2 for clean
   installs and starts in evaluation mode [28]. Since the March 2026 update it can be turned back on
   without reinstalling Windows [11][12], but the October 2026 update can grey that switch out [13].

Signing the installer isn't enough for step 3. The installer unpacks NSIS's helper DLLs to a temporary
folder and loads them, and the only Smart App Control log found shows it blocking exactly those
(`nsExec.dll`, `WinShell.dll`) and an unsigned uninstaller, from an installer its publisher had
signed (Mullvad, 2023; a user's report [63]). NSIS ships its plugins unsigned and tells projects to
sign them with their own certificate [64]; electron-builder doesn't [65]. Signal Desktop does it by
giving electron-builder its own copies of the NSIS bundles, every DLL signed (`nsis.customNsisBinary`,
`nsis.customNsisResources`) [66].

The app's own updates skip steps 1 and 2: the app downloads the installer itself, so it carries no
Mark of the Web, and runs it silently (`src/desktop/updater.ts`). Step 3 still applies to every
program the update runs, including the uninstaller of the version it replaces (section 3).

### What doesn't help

- **Zipping.** Chrome opens zips up to 50 MB and reports the program inside; it doesn't open larger
  ones (the installers are 90 to 95 MB), and a password-protected archive is itself treated as
  suspicious [30][34]. Windows passes the Mark of the Web to files unzipped with Explorer (Microsoft
  blogs only; no current Learn page says it). Smart App Control doesn't care where a file came from.
- **Renaming.** The hash stays the same, and Chrome checks unknown extensions too [30].
- **A new domain of our own.** Chrome and Edge send the download's address, but neither Google nor
  Microsoft says a host earns a file reputation. A brand-new domain has none, and GitHub's is not
  ours to improve. Google's review for "Uncommon downloads" happens in Search Console [33], which shows
  issues only for sites you've verified as yours; whether it would list files hosted on GitHub isn't
  documented.
- **Submitting the file to Microsoft.** Microsoft's developer page says there is "no need (or
  mechanism)" to submit a file for SmartScreen reputation for consumers [1]; its overview and the
  Artifact Signing FAQ still point at the Security Intelligence portal for wrong warnings [5][16].
  It's free to try for a release that matters, with no promise.
- **An EV certificate.** Since 2024 Windows treats EV like any other code signing certificate [2][4],
  and an individual can't get one anyway [50]. Google documents nothing about EV, and Chrome's own
  download-check code has no EV handling [37].

## 2. What the sources say about each check

**SmartScreen (Windows and Edge).** Two signals: publisher reputation ("Is the file signed? Is the
signing certificate from a known, trusted publisher?") and file hash reputation [1]. "When a file is
not signed, SmartScreen reputation must build for each new version of your files, starting with zero
reputation. Reputation cannot transfer from previous versions unless both were signed using the same
publisher identity" [1]. Even signed, a new program "could still show a SmartScreen warning until its
hash or publisher certificate accumulates sufficient evidence of positive reputation. There is no
exact threshold, but it can take several weeks and hundreds of clean installs from a wide audience"
[1]. EV "no longer bypass[es] SmartScreen" since 2024 [1][2][3]; Microsoft's root program stopped
recognising EV code signing in February 2024 and removed its OIDs in August 2024 [4]. Microsoft
doesn't say whether "publisher identity" means one certificate or one name, nor whether reputation
survives renewing a certificate, which now happens at least every 460 days [50][51]; it does say
changing the certificate affects the publisher signal (verifier's note on [1]).

**Chrome Safe Browsing.** `.exe` is a "full ping" type: Chrome always asks Google and uses the verdict
[30]. Google: an uncommon download is one "Google Safe Browsing hasn't seen before"; the warnings "are
lifted automatically if Google Safe Browsing verifies that the files are safe" [33]; Google keeps "a
list of trusted software publishers" [34]; and "We recommend that you sign your code" [35]. Google
documents no more than that: not whether reputation is per file, per signer or per site, not how a
publisher gets on that list, and not how long it takes. Chrome itself has no list of trusted signers
any more; any trust in a signer happens on Google's servers [37]. Since July 2024 Chrome has two
levels of warning, "suspicious" and "dangerous" [36]. Deep scans and file uploads are only for files
under 50 MB [37], so they never reach the installers.

**Smart App Control.** Lets code run that the cloud predicts is safe, or that is signed by a Trusted
Root Program CA; "unknown, unsigned code" is blocked [7]. Its checks "apply to all executable files,
not just those downloaded from the Internet" [1]; it "evaluates binaries as it loads them", including
"install and uninstall binaries" [9]; developers should sign "all binaries, such as exe, dll, temp
installer files, scripts, and uninstallers" [10]; a signed app that loads an unsigned DLL gets "Smart
App Control has blocked part of this app" [14]. Microsoft names Artifact Signing "the preferred way to
sign your app" for it [8], and says cloud reputation can't be relied on for new programs [9].

## 3. What this project brings to it (read from the repository)

- **The Windows installers aren't signed at all.** Two one-click, per-user NSIS installers from
  electron-builder 26.15.3 [60] (`electron-builder.config.mjs`, `scripts/package-win.mjs`). With no
  certificate and no sign hook, electron-builder logs "signing with signtool.exe" for each file and
  signs nothing, saying why only in its debug log (`app-builder-lib/out/codeSign/windowsSignToolManager.js`,
  `signFile`). The Mac app is signed
  with the project's own certificate, which Apple doesn't know ([ADR 0003](../adr/0003-mac-keychain-helper.md)).
- **Updating doesn't use electron-updater.** The app's own updater (`src/desktop/self-update.ts`)
  checks a download's size against GitHub's API and its sha512 against `latest.yml` /
  `latest-win-arm64.yml`, then runs it with `--updated /S`. It never looks at a signature or a
  publisher; electron-updater has never been a dependency. So going from unsigned to signed, or later
  from one publisher to another, can't break updating by itself. (electron-updater would have been
  fine too: it skips its publisher check when the installed app has no `publisherName` [61].)
- **But `latest*.yml` must list the signed file's sha512.** electron-builder hashes the installer
  after signing it inside the build (`NsisTarget.js`: `signIf`, then `emitArtifactBuildCompleted`).
  Anything that signs after electron-builder finishes changes the bytes, and the updater would refuse
  the update as "not the file the release lists". The Windows files list only a sha512, twice per
  file, and no size (`differentialPackage: false`). `scripts/update-info.mjs` rewrites them.
- **Every update runs the old uninstaller.** The new installer copies the installed version's
  uninstaller to a temporary folder and runs it (`templates/nsis/include/installUtil.nsh`,
  `uninstallOldVersion`). Under Smart App Control an unsigned uninstaller would stop both updates and
  Settings → Uninstall. electron-builder makes that uninstaller mid-build and hands it to the same
  sign hook as everything else.
- **What else runs that isn't ours.** Electron 44.7.0 [62] ships `electron.exe` (renamed "Edunex Plus.exe",
  246 MB), `ffmpeg.dll`, `dxcompiler.dll`, `vk_swiftshader.dll` and `vulkan-1.dll` unsigned;
  `d3dcompiler_47.dll` and `dxil.dll` carry Microsoft's signature (read from the alpha.11 installer).
  The installer extracts NSIS plugin DLLs to a temporary folder and loads them (System, StdUtils,
  nsExec, SpiderBanner, WinShell, nsis7z), all unsigned in electron-builder's NSIS 3.0.4.1 and
  nsis-resources 3.4.1 bundles (checked on the files).
- **Downloads are tiny and every release is a new file.** Windows installer downloads per release on
  22 October: 0 to 4. alpha.1's 59 is mostly CI: every release run downloads it to test installing
  over it. The website takes every file from GitHub (`github.com` → `release-assets.githubusercontent.com`).

## 4. The options

| | Can a student in Indonesia get it? | Cost | Publisher students see | Fits the CI? | Smart App Control |
|---|---|---|---|---|---|
| Nothing (today) | – | free | Unknown publisher | – | blocked |
| **SignPath Foundation** [40] | if accepted (project review, no ID) | free | SignPath Foundation | yes, two rounds per release, each approved by hand | in part: Electron's DLLs and the NSIS plugins may not be signed under its terms |
| Azure Artifact Signing [15] | **no**: individuals only in the USA and Canada | US$9.99/month | legal name | yes, inside electron-builder | yes, with the NSIS plugins signed too [66] |
| Certum Open Source, cloud [52] | yes (photos with ID, utility bill; no shipping needed) | ~EUR 49/year | "Open Source Developer, <legal name>" | only with unofficial tools (below) | yes, with the NSIS plugins signed too |
| SSL.com IV + eSigner [56][57] | yes | US$129/year + US$20/month for 20 signings | legal name | yes, official action | yes, with the NSIS plugins signed too |
| DigiCert, GlobalSign | no: organizations only | ~US$1,000/year | – | – | – |
| Microsoft Store, MSIX [20][22] | yes, free account | free | the developer name on the listing | Store review per release, up to 3 business days | yes (Microsoft signs the package) |
| winget [26] | yes | free | as the installer | yes (winget-releaser) | as the installer |

**SignPath Foundation** signs open-source projects for free with a certificate issued to "SignPath
Foundation", which is legally the publisher [40]; Microsoft lists it as a free "OV-level" option
[2]. Signed releases of four Foundation projects each carried a different GlobalSign-issued, non-EV
certificate (SignPath doesn't name the CA), so it seems each project gets its own. Its conditions
[40]: an OSI licence
(MIT), already released, maintained, no proprietary parts, a "Code signing policy" section or link on
the home page and download pages with the exact line "Free code signing provided by SignPath.io,
certificate by SignPath Foundation", the team's roles, a privacy policy, MFA on SignPath and GitHub
for everyone, builds on GitHub-hosted runners that SignPath can trace back to the source [42], and a
manual approval for every release. SignPath's own docs say a new standard (OV) certificate still
gets Windows warnings [45]. The risks for Edunex Plus:
- Downloadable programs need "a certain verifiable reputation", with no number given, and the
  Foundation decides with no appeal [40]. A young alpha with single-digit downloads may be refused.
- SignPath's older application form warned against names "usually associated with other software"
  or trademarks the applicant doesn't own (form from 2024, replaced in April 2026). "Edunex" is the
  name of ITB's system.
- Only the project's own files may be signed: "upstream" files "must not be signed using your
  subscription, but may be included in signed packages and installers" [40]. Electron's DLLs and the
  NSIS plugins stay unsigned, so Smart App Control may still stop part of the app unless Microsoft's
  cloud knows those files (common to many apps, but not documented). Electron apps listed by the
  Foundation (Heroic Games Launcher, Sync-in) do sign their renamed `electron.exe` [48][49].
- Quotas: "fair use" with a yearly size quota since November 2025 [46]; one open-source Electron
  project ran out at about 140 GB a year (its own report [47]). A signed Edunex Plus release sends
  about 400 MB (two 107 MB zipped programs, two 90 MB installers): 20 to 35 GB a year at one release
  a week, over 150 GB at today's pace.
- No published review time; public reports mention a form that didn't load and slow replies in
  August 2026 (leads, not policy).

SignPath can't open an NSIS installer [43], so the installer has to be made from programs already
signed: sign the app's program and the uninstaller, build the installers from them, then sign the
installers. Sync-in Desktop does exactly this, uninstaller included [49]; Heroic does it without the
uninstaller [48]. That's what the release workflow now does (section 6).

**Azure Artifact Signing** (renamed from Trusted Signing, generally available since January 2026
[18]) is what Microsoft recommends [2][8]: US$9.99 a month [17], built into electron-builder
(`win.azureSignOptions`), reputation tied to the verified identity rather than one certificate [18].
But "Individual developers must be located in the United States or Canada", and Indonesia isn't among
the twelve regions open to organizations [15] (quickstart updated 8 October 2026). Microsoft has
announced no change. A September 2026 note says its CAs are no longer in the Trusted Root Program,
though Windows keeps trusting them [19]; how that squares with Smart App Control isn't explained.

**Certum Open Source Code Signing** is for individuals with a public open-source project, not for
software sold commercially; the certificate says "Open Source Developer" before the person's name
[53]. In the cloud (SimplySign) it costs from EUR 49 a year with no per-signature fee [52]; the
card-and-reader set can't be shipped to Indonesia [55]. Identity: photos holding an ID (or a notary)
plus a utility bill in your name [53]. The catch is CI: Certum documents only an interactive login
with a one-time code from its phone app [54]; signing on GitHub Actions needs unofficial tools that
keep the one-time-code seed as a secret, which Certum neither documents nor forbids. Since the key
would then sign every file inside electron-builder, it can cover Smart App Control fully: Electron's
four unsigned DLLs by name in `win.signExts` (a `.dll` pattern would also re-sign Microsoft's two),
and the NSIS plugins in our own copies of electron-builder's NSIS bundles, as Signal does [66].

**SSL.com IV + eSigner** is the officially automatable certificate for an individual in Indonesia
[56][58]: US$129 a year, eSigner from US$20 a month for 20 signings [57], an official GitHub action.
A release signs about 14 files (two programs, their DLLs, two uninstallers, two installers), so about
one release a month fits the cheapest tier. **DigiCert** and **GlobalSign** sell only to
organizations; **Sectigo** publishes no individual offer.

**The Microsoft Store.** Individual developer accounts are free with ID and selfie verification
[20][21]. MSIX packages are re-signed by Microsoft, so "Store-distributed apps … are never subject to
SmartScreen download warnings" [1], and the web install button downloads a small installer signed by
Microsoft [25]. For Edunex Plus it means work before it can pass:
- Certification takes up to three business days per submission [23], too slow for daily alphas.
- Reviewers need a working sign-in (policy 10.3.1 [22]), and the services the app needs must answer
  during certification (10.3.2 [22]): an ITB account that ITB's servers accept from Microsoft's
  testers. The app signs in only with ITB accounts.
- Policies 10.1.1 and 11.2 on names and permission [22] bear on "Edunex" and "SIX".
- electron-builder 26 turns `0.1.0-alpha.N` into `0.1.0.0` for every alpha, and the Store doesn't
  accept a version starting with 0.
- A packaged app keeps new files under %APPDATA% in a private folder [24], separate from today's
  installs, and updates come from the Store, not from the app.
- Uploading from CI needs an Entra tenant tied to the Partner Center account; a Microsoft docs commit
  suggests individual accounts can't link one, so each release might be uploaded by hand (a hint,
  not a stated rule).

The Store's EXE route keeps self-updating but requires the installer and every program in it to carry
a Trusted Root Program signature [22], so it needs a certificate of our own first.

**winget** is free and needs no signature; each version goes through automated checks and a
moderator, and an installer address SmartScreen rates as low-reputation can fail validation [26].
winget marks its download as from the internet, then, for its own source and a matching hash, as
trusted, which Microsoft's winget product manager says stops Windows' "Open File - Security Warning"
[27]; whether SmartScreen's own check is skipped too isn't documented.
Smart App Control still applies. winget has no pre-release channel, so alphas would go under their
own identifier. It reaches students comfortable with a terminal; worth it once releases settle.

## 5. Recommendation for Edunex Plus

**Now, free:**

1. **Tell students what they'll see** (done in this change): the exact Edge and Chrome steps, why
   it happens, and what's changing. `docs/install.md` and the website's install steps.
2. **Publish fewer releases to students.** Each new file is unknown to Edge, Chrome and SmartScreen
   until people use it. Batch alphas (say, weekly) and keep in-between builds for testers. This also
   keeps SignPath's approvals and quota in reach.
3. **Apply to SignPath Foundation**, after merging the code signing policy (`docs/code-signing.md`,
   linked from the README, the website and the release notes) and turning on MFA. The wizard
   `scripts/setup-windows-signing.sh` walks through it.
4. **The CI is ready** (`.github/workflows/release.yml`): signing turns on by itself once the
   SignPath settings exist; until then releases stay unsigned, as now. The workflow's other builds
   (of `main`, or started by hand) take the same path with a stand-in certificate, all but the trip
   to SignPath, so it's tried before the first real one.

**Later:**

- If SignPath says no, or its approvals and quota don't fit: Certum's open-source certificate
  (~EUR 49 a year) in the maintainer's name if a fragile CI login is acceptable, or SSL.com IV with
  eSigner (~US$370 a year at one release a month) if it must be officially automated. Either signs
  every file, so Smart App Control is fully covered. The CI's two passes would then shrink to one:
  electron-builder signs through a hook.
- If Microsoft opens Artifact Signing to individuals in Indonesia: switch to it (US$9.99 a month,
  signs everything inside electron-builder, reputation follows the person's verified identity).
- For 1.0: the Microsoft Store (MSIX), once the app can show a reviewer a demo sign-in, its version
  numbers fit, and the names are settled. It's the only route where students see no warning at all.
- winget, once releases are steady.
- Mac: an Apple Developer ID (section 7).

**What to expect.** The first signed release replaces "Unknown publisher" with "SignPath
Foundation", and Smart App Control lets the app's own program, its installer and its uninstaller
run, though it will likely still stop the installer's NSIS helpers [63] and may stop Electron's
DLLs, which SignPath's terms keep us from signing [40]. Students with Smart App Control on are only
fully served by a certificate of our own (signing those too) or by the Store. The "isn't commonly
downloaded" and "Windows protected your PC" warnings fade only as the publisher builds a record,
which "can take several weeks and hundreds of clean installs" by Microsoft's measure [1] and an
unstated time by Google's [33]. ITB-sized download numbers make that slow, which is why fewer,
steadier releases matter as much as the signature. It seems each Foundation project gets its own
certificate, so whether the Foundation's name brings earned trust with it isn't known.

## 6. The plan

**Only the maintainer can do these** (`scripts/setup-windows-signing.sh` walks through them):

1. Turn on two-factor authentication on GitHub (and later SignPath) for everyone with commit or
   release rights.
2. Make sure `docs/code-signing.md` is live on `main` (it comes with the change that adds this note)
   and that the website's footer and install section link to it.
3. Apply at https://signpath.org/apply [41]. Name the project, its licence, the repository, the website
   and the code signing policy; say plainly it's an unofficial student project. Wait for the reply.
4. Once accepted, in SignPath: note the organization ID, check the project slug (`edunex-plus`) and
   the release-signing policy, link the predefined "GitHub.com" trusted build system, and add the two
   artifact configurations from `.signpath/` (slugs `windows-programs`, `windows-installers`). Check
   each with "Upload an artifact sample" from a CI build: the product-version fields must match what
   SignPath reads.
5. Make an API token for a CI user with the Submitter role, and add it as the repository secret
   `SIGNPATH_API_TOKEN`; add the variable `SIGNPATH_ORGANIZATION_ID` (and `SIGNPATH_PROJECT_SLUG` /
   `SIGNPATH_SIGNING_POLICY_SLUG` if SignPath named them differently).
6. Tag the next release and approve both signing requests when SignPath emails you (the job waits up
   to 45 minutes for each; the official action submits them [44]).
7. Install the signed release on a Windows PC, ideally one with Smart App Control on, tell students
   in the release notes, and check that `docs/install.md`, the README and the website still match
   what Windows shows.

**What the code needed** (the change that added this note; the decision is
[ADR 0004](../adr/0004-windows-installers-signed-by-signpath.md)):

- `scripts/package-win.mjs` builds in two passes when asked: `--to-sign` keeps the app's two programs
  and the two uninstallers aside, `--signed` makes the installers again from the signed ones.
- `scripts/package-sign-win.mjs`: electron-builder's sign hook keeps each uninstaller aside, then puts
  its signed copy in.
- `scripts/update-info.mjs` writes the signed installers' sha512 into `latest*.yml`.
- `.github/workflows/release.yml`: the two SignPath rounds on tags once the settings exist; a stand-in
  certificate on every other build; checks that every program of ours is validly signed, the fuses
  are still set, and the installed app and uninstaller are signed.
- `nsis.packElevateHelper: false`: electron-updater's `elevate.exe` isn't needed by this app and
  would otherwise be copied unsigned into the signed folder.
- `.signpath/*.xml`, the artifact configurations to copy into SignPath; `docs/code-signing.md`, the
  policy page; `docs/install.md` and the website's install steps.

## 7. The Mac, briefly

Chrome checks `.dmg` and `.zip` downloads on the Mac the same way [30]; ours are over the 50 MB it
inspects, so it sends no signature [30]. Gatekeeper wants software from the App Store or signed with
an Apple-issued Developer ID and notarized; since macOS 15 a Control-click no longer gets past it
[70], so students go to System Settings → Privacy & Security → Open Anyway [75], or use the Terminal
line in the install guide. An Apple Developer Program membership costs US$99 a year (the local price
shows at enrolment), and fee waivers exist only for nonprofits, accredited institutions and
government bodies, "not … an individual" [72][73]. It brings a Developer ID certificate in the
maintainer's legal name and notarization, which electron-builder 26 does with an App Store Connect
team API key or an Apple ID with an app-specific password [74]; students would then get only the
usual "are you sure" the first time [71]. Enrolment wants the legal age of majority (otherwise a
parent enrols) and a first and last legal name, and enrolling in Apple's app makes it a renewing
subscription [72]; an Indonesian with a single legal name reports being blocked (forum report).
For this repository it also means: hardened runtime, re-signing and re-notarizing the keychain helper,
and, because the keychain goes by the developer team for Apple-signed apps but by exact build for
ours, every student typing their Mac password once more on the update that switches ([ADR
0003](../adr/0003-mac-keychain-helper.md)). The app's own Mac updater checks only the bundle id,
version and sha512, so it keeps working. Worth doing with 1.0, or as soon as the money is there.

## 8. Open questions and what couldn't be verified

- Was the warning in the photo from Edge? The wording and the panel say so; ask the student.
- **Not about signing, but found on the way:** electron-builder 26.15.3, which this repository locks,
  packs the ARM installer's app archive with a filter (`ARM64`) the installer's extractor can't read,
  so it likely installs without the app's program and DLLs (not tried on an ARM PC); fixed in
  26.15.6 [67]. The alpha.11 ARM installer's archive does use that filter (checked with 7-Zip). CI
  only test-installs the x64 installer. Worth its own pull request soon: electron-builder ≥ 26.15.6
  and an ARM install check. Until then, telling ARM students to use the x64 installer (it runs on
  Windows 11 on ARM) would be the safe advice.
- Does SignPath accept the renamed `electron.exe` as the project's own file? Its terms say a team may
  sign only "software artifacts built from their own source code" [40]; listed Electron apps do sign
  it [48][49]. Ask when applying.
- Will SignPath Foundation accept a young alpha, and the name "Edunex"? How long does it take? How big
  is the open-source quota, and is it counted on the zip or what's inside?
- Which version field does SignPath compare for `product-version`? Every file carries a fixed
  version `0.1.0.0`; the ProductVersion string is `0.1.0.0` in the app's program and `0.1.0-alpha.N`
  in the installers and uninstallers. The configurations expect the strings (parameters `version`
  and `windowsVersion`); if a sample shows SignPath reads the fixed one, the installer and
  uninstaller sets need `${windowsVersion}`, and the second request that parameter too.
- Will electron-builder make the uninstaller byte for byte the same in the second pass? It hands the
  uninstaller's build the app archive's size and hash, which change once the program is signed;
  Sync-in sees it differ and puts the signed one in anyway [49]. The hook does the same and says
  which in the log; the stand-in builds will show it.
- Does Smart App Control let Electron's unsigned DLLs and the NSIS plugins through because they're
  common? Microsoft doesn't say, says not to count on the cloud [9], and the one log found shows the
  plugins blocked [63]. Test the first signed release on a PC with Smart App Control on (Code
  Integrity event log, events 3076/3077 [9]).
- Is SmartScreen's "publisher identity" one certificate or one name? Microsoft warns that changing
  the certificate affects the publisher signal and speaks of "the same trusted certificate" [1]; how
  much a renewal (every 460 days at most now) resets isn't documented.
- How Google's server decides UNCOMMON, and whether a signature helps it: undocumented [33][34][37].
- Store: can an individual account automate submissions, would a demo mode satisfy policy 10.3.1, do
  notifications and the tray work in an electron-builder MSIX? Untested.

## Sources

Fetched 2026-10-22 and 23. Dates are the page's own (ms.date, "last updated", file history) where it
shows one.

Microsoft
1. SmartScreen reputation for Windows app developers, ms.date 2026-05-04, updated 2026-08-17. https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation
2. Code signing options for Windows app developers, ms.date 2026-08-29. https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options
3. Current status of Windows app distribution features, ms.date 2026-08-24. https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/distribution-feature-status
4. Microsoft Trusted Root Program requirements, ms.date 2026-04-28 (EV change dated February and August 2024). https://learn.microsoft.com/en-us/security/trusted-root/program-requirements
5. Microsoft Defender SmartScreen overview, ms.date 2026-04-23. https://learn.microsoft.com/en-us/windows/security/operating-system-security/virus-and-threat-protection/microsoft-defender-smartscreen/
6. Microsoft Edge support for Microsoft Defender SmartScreen, ms.date 2026-07-08. https://learn.microsoft.com/en-us/deployedge/microsoft-edge-security-smartscreen
7. Smart App Control overview (for developers), ms.date 2026-09-30. https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/overview
8. Code signing for Smart App Control, ms.date 2026-09-25. https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/code-signing-for-smart-app-control
9. Test your app with Smart App Control, ms.date 2025-10-28, updated 2026-09-21. https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/test-your-app-with-smart-app-control
10. Windows security book: application and driver control, ms.date 2026-02-09. https://learn.microsoft.com/en-us/windows/security/book/application-security-application-and-driver-control
11. What is Smart App Control? (support FAQ), undated, read 2026-10-22. https://support.microsoft.com/en-us/topic/what-is-smart-app-control-285ea03d-fa88-4d56-882e-6698afdb7003
12. KB5079391, 2026-03-26 ("turn Smart App Control on or off without needing a clean install"). https://support.microsoft.com/en-us/servicing/os/windows-11/2026/03/march-26-2026-kb5079391-os-builds-26200-8116-and-26100-8116-preview
13. KB5127648, 2026-10-13 (known issue: turning Smart App Control on may be greyed out). https://support.microsoft.com/en-us/servicing/os/windows-11/2026/10/kb5127648-windows-11-24h2-25h2-26h2-security-update
14. Smart App Control has blocked part of this app, undated. https://support.microsoft.com/en-us/windows/security/threat-malware-protection/smart-app-control-has-blocked-part-of-this-app
15. Artifact Signing quickstart, ms.date 2026-05-21, updated 2026-10-08. https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart
16. Artifact Signing FAQ, ms.date 2026-05-14, updated 2026-10-20. https://learn.microsoft.com/en-us/azure/artifact-signing/faq
17. Artifact Signing product and pricing page, undated. https://azure.microsoft.com/en-us/products/artifact-signing
18. "Simplifying code signing for Windows apps: Artifact Signing GA", 2026-01-12. https://techcommunity.microsoft.com/blog/microsoft-security-blog/simplifying-code-signing-for-windows-apps-artifact-signing-ga/4482789
19. Artifact Signing certificate management, ms.date 2026-09-30. https://learn.microsoft.com/en-us/azure/artifact-signing/concept-certificate-management
20. Free developer registration for individual developers on Microsoft Store, 2025-09-10. https://blogs.windows.com/windowsdeveloper/2025/09/10/free-developer-registration-for-individual-developers-on-microsoft-store/
21. Sign up as a Windows app developer, ms.date 2025-09-17, updated 2026-07-17. https://learn.microsoft.com/en-us/windows/apps/get-started/sign-up
22. Microsoft Store Policies, version 7.20, published 2026-09-15, effective 2026-10-22 (10.1.1, 10.2.9, 10.3.1, 11.2). https://learn.microsoft.com/en-us/windows/apps/publish/store-policies
23. MSIX app certification process, updated 2026-08-24. https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-certification-process
24. Understanding how packaged desktop apps run on Windows, ms.date 2026-09-30. https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-behind-the-scenes
25. Store Web Installer, ms.date 2026-09-14. https://learn.microsoft.com/en-us/windows/apps/distribute-through-store/how-to-use-store-web-installer-for-distribution
26. winget-pkgs policies and validation, last changed 2026-08-12. https://github.com/microsoft/winget-pkgs/blob/master/doc/Policies.md, https://github.com/microsoft/winget-pkgs/blob/master/doc/Validation.md
27. winget-cli: DownloadFlow.cpp (main, 2026-10-22), and Microsoft's winget product manager on issue 4176 (2024-02-16). https://github.com/microsoft/winget-cli/blob/main/src/AppInstallerCLICore/Workflows/DownloadFlow.cpp, https://github.com/microsoft/winget-cli/issues/4176
28. App Control for Business overview (Smart App Control since Windows 11 22H2, evaluation mode), ms.date 2026-08-18. https://learn.microsoft.com/en-us/windows/security/application-security/application-control/app-control-for-business/appcontrol

Google and Chromium (Chromium main as of 2026-10-22)
30. Download file types policy, version_id 69. https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/safe_browsing/content/resources/download_file_types.asciipb
31. csd.proto (what Chrome sends; the verdicts) and Chrome's download strings (generated_resources.grd). https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/safe_browsing/core/common/proto/csd.proto, https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/app/generated_resources.grd
33. Search Console Help: Security issues report ("Uncommon downloads"), undated. https://support.google.com/webmasters/answer/9044101
34. Chrome Help: download warnings, undated. https://support.google.com/chrome/answer/6261569
35. Google Search Central: malware and unwanted software, updated 2025-12-10. https://developers.google.com/search/docs/monitor-debug/security/malware
36. Google Security Blog: redesigned download warnings, 2024-07-24. https://security.googleblog.com/2024/07/building-security-into-redesigned.html
37. Chromium download protection (allowlist, deep scan limits). https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/browser/safe_browsing/download_protection/

SignPath
40. SignPath Foundation terms (marked draft; source last changed 2025-02-14). https://signpath.org/terms
41. Apply (web form since 2026-04-10). https://signpath.org/apply
42. Trusted build systems: GitHub, last changed 2026-09-18. https://docs.signpath.io/trusted-build-systems/github
43. Artifact configuration syntax and reference, last changed 2026-08-27 and 2026-10-06. https://docs.signpath.io/artifact-configuration/syntax, https://docs.signpath.io/artifact-configuration/reference
44. github-action-submit-signing-request v3.0 (commit f6d04783), 2026-09-10. https://github.com/SignPath/github-action-submit-signing-request
45. Editions explained, last changed 2026-09-14. https://docs.signpath.io/editions-explained
46. Changelog: quotas counted per year, 2025-11-18. https://docs.signpath.io/changelog
47. Issue 15, an Electron project out of quota, 2026-08-31 (user report). https://github.com/SignPath/github-action-submit-signing-request/issues/15
48. Heroic Games Launcher, Windows release workflow, changed 2026-09-12. https://github.com/Heroic-Games-Launcher/HeroicGamesLauncher/blob/HEAD/.github/workflows/draft-release-win.yml
49. Sync-in Desktop, release workflow and uninstaller hook, changed 2026-07-11. https://github.com/Sync-in/desktop/blob/HEAD/.github/workflows/release.yml, https://github.com/Sync-in/desktop/blob/HEAD/build/nsis-uninstaller-signing.cjs

CA/Browser Forum and CAs
50. Code Signing Baseline Requirements v3.11.0, 2026-06-16. https://cabforum.org/working-groups/code-signing/requirements/
51. Ballot CSC-31 (460-day maximum from 2026-03-01), 2025-11-17. https://cabforum.org/2025/11/17/ballot-csc-31-maximum-validity-reduction
52. Certum Open Source Code Signing on SimplySign, undated. https://shop.certum.eu/open-source-code-signing-on-simplysign.html
53. Certum: required documents for code signing, modified 2026-06-18. https://support.certum.eu/en/code-signing-required-documents/
54. Certum: Code Signing in the Cloud with signtool (manual v1.1, 2024-11-19). https://files.certum.eu/documents/manual_en/CS-Code_Signing_in_the_Cloud_Signtool_jarsigner_signing.pdf
55. Certum shop: payment and shipping, undated. https://shop.certum.eu/payment-shipping
56. SSL.com IV code signing, modified 2026-10-19. https://www.ssl.com/products/software-integrity/code-signing/iv/
57. SSL.com eSigner pricing, updated 2026-03-25. https://www.ssl.com/guide/esigner-pricing-for-code-signing/
58. SSL.com country codes, modified 2026-05-10. https://www.ssl.com/country-codes/

electron-builder and Electron
60. app-builder-lib 26.15.3 as installed (`out/winPackager.js`, `out/codeSign/windowsSignToolManager.js`, `out/targets/nsis/NsisTarget.js`, `out/platformPackager.js`, `templates/nsis/include/installUtil.nsh`).
61. electron-updater 6.8.11, NsisUpdater.ts (publisher check skipped without publisherName). https://github.com/electron-userland/electron-builder/blob/electron-updater@6.8.11/packages/electron-updater/src/NsisUpdater.ts
62. Electron v44.7.0 Windows zip manifest. https://github.com/electron/electron/blob/v44.7.0/script/zip_manifests/dist_zip.win.x64.manifest

Smart App Control and NSIS plugins
63. Mullvad VPN issue 4306: a Smart App Control log blocking a signed installer's NSIS plugins and old uninstaller, 2023-01-27 (user report). https://github.com/mullvad/mullvadvpn-app/issues/4306
64. NSIS bug 1285, unsigned plugins and Smart App Control, maintainer's reply 2022-05-19 (open). https://sourceforge.net/p/nsis/bugs/1285/
65. electron-builder issue 7820, unsigned System.dll in the temp folder, closed as stale 2025-05-10; no plugin signing through 26.18.0 (2026-10-20). https://github.com/electron-userland/electron-builder/issues/7820
66. Signal Desktop: its own signed NSIS bundles through customNsisBinary/customNsisResources, 2025-04-15. https://github.com/signalapp/Signal-Desktop/commit/fa2108ea3dde555712d1fbcb61fb0e330d0d7c69
67. electron-builder pull request 9988, "reliably install the main executable and native binaries on x64 and arm64", merged 2026-06-26, released in 26.15.6. https://github.com/electron-userland/electron-builder/pull/9988

Apple
70. Apple Developer News: Gatekeeper changes in macOS Sequoia, 2024-08-06. https://developer.apple.com/news/?id=saqachfa
71. Safely open apps on your Mac, 2026-05-27. https://support.apple.com/en-us/102445
72. Apple Developer Program enrollment, undated. https://developer.apple.com/programs/enroll/
73. Fee waivers, undated. https://developer.apple.com/help/account/membership/fee-waivers/
74. Notarizing macOS software before distribution; App Store Connect API keys, undated. https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution
75. Mac User Guide: open an app from an unknown developer (macOS 26), undated. https://support.apple.com/guide/mac-help/mh40616/26.0/mac/26.0
