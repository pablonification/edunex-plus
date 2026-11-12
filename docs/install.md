# Installing Edunex Plus

How to install, update and remove the app on each system, phones included. Back to the [README](../README.md).

The website has the same steps with a picture for each, in Indonesian and English:
[edunex-plus.arqilasp.com/install](https://edunex-plus.arqilasp.com/install/). This page is the long version, for every case.

> **Alpha.** Edunex Plus is in early testing: expect rough edges, and check anything important
> (a hand-in, an attendance count) on Edunex or SIX itself. Tell us what breaks in
> [Issues](https://github.com/pablonification/edunex-plus/issues).

## Which file to download

Open the newest [release](https://github.com/pablonification/edunex-plus/releases) (alphas are
marked "Pre-release"), and under **Assets** download the one file for your computer:

| Your computer | Download |
| --- | --- |
| Mac with Apple silicon (M1 or newer) | `Edunex-Plus-<version>-arm64.dmg` |
| Mac with Intel | `Edunex-Plus-<version>-x64.dmg` |
| Windows 10 or 11 (Intel or AMD, most PCs) | `Edunex-Plus-Setup-<version>.exe` |
| Windows 10 or 11 on ARM (Snapdragon) | `Edunex-Plus-<version>-arm64.exe` |
| Ubuntu, Debian, Linux Mint (most PCs) | `edunex-plus_<version>_amd64.deb` |
| Ubuntu, Debian on ARM | `edunex-plus_<version>_arm64.deb` |
| Any other Linux | `Edunex-Plus-<version>-x86_64.AppImage` (ARM: `…-arm64.AppImage`) |
| Android phone (Android 8 or newer) | `Edunex-Plus-<version>-android.apk` |
| iPhone (iOS 16.4 or newer) | `Edunex-Plus-<version>-iphone.ipa` |

Not sure which Mac you have? Apple menu → **About This Mac**: "Chip Apple M…" means Apple
silicon, "Processor … Intel" means an Intel Mac. The app needs macOS 12 Monterey or newer.
Not sure which Windows PC? Settings → System → About: "ARM-based processor" means ARM; anything
else (x64) means Intel or AMD. On Windows 11 the Intel and AMD installer runs on ARM too, just slower.

Your browser and your system warn you the first time you open each new version: Windows and the
browser because few people have downloaded that version yet, macOS because the app isn't signed by
Apple ([code signing policy](code-signing.md)). That's expected for this alpha; the steps below get
past it, and the app then opens normally.

## macOS

1. Open the `.dmg`. In the window that opens, drag **Edunex Plus** onto **Applications**.
2. Open **Terminal**: double-click it in that same window (or press ⌘ Space, type `Terminal`,
   press Return). Paste this line and press Return:

   ```sh
   xattr -cr "/Applications/Edunex Plus.app"
   ```

   Nothing is printed when it works. It removes the "downloaded from the internet" mark that
   makes macOS block the app, for this app only.
3. Open **Edunex Plus** from Applications, and eject the disk (⏏ beside
   **Edunex Plus \<version\>** in Finder's sidebar).

From then on it opens like any other app. After an update you install by hand, run the line again once
(an update from inside the app doesn't need it).

<details>
<summary>Rather not use Terminal?</summary>

Open the app once and click **Done** when macOS says it can't check it (not "Move to Trash").
Then go to **System Settings → Privacy & Security**, scroll down to the line about Edunex Plus and
click **Open Anyway**, confirm with your password or Touch ID, then **Open**. The button only shows
for a while after you try to open the app: if it's gone, open the app again first.

</details>

A `.zip` (`…-arm64-mac.zip`, on Intel `…-x64-mac.zip`) is there too, if you prefer it to the disk image: unzip it and move
the app to Applications, then the same steps. The `…-mac.tar.xz` beside it is what the app downloads when it updates
itself: you don't need it.

## Windows

1. Download `Edunex-Plus-Setup-<version>.exe` (on an ARM PC: `Edunex-Plus-<version>-arm64.exe`).
   The browser may hold it back because few people have downloaded this version yet:
   - **Microsoft Edge** says "… isn't commonly downloaded. Make sure you trust … before you open
     it.": point at the file in Downloads, click **⋯**, then **Keep**, then **Show more** →
     **Keep anyway**.
   - **Chrome** says "Suspicious download blocked": open Downloads (the arrow at the top right),
     choose the file, then **Download suspicious file**.
2. Run it. If a blue **"Windows protected your PC"** window appears, click **More info**, then
   **Run anyway**. It names the publisher as "Unknown publisher" until the installers are signed;
   then it says **SignPath Foundation** ([code signing policy](code-signing.md)).

There's nothing to choose: it installs for your Windows account only (no administrator
password), adds **Edunex Plus** to the Start menu and the desktop, and opens it. Updates from
inside the app don't go through the browser.

- If Windows says **Smart App Control blocked** it, there's no "Run anyway": Smart App Control runs
  only apps it recognises or that are signed, and Edunex Plus's installers, or parts of them, aren't
  ([code signing policy](code-signing.md)). Turning it off (Windows Security → App & browser control
  → Smart App Control settings) removes that protection for every app, not just this one, so the
  safer choice is to wait. On Windows 11 24H2 or newer, kept up to date, you may be able to turn it
  back on there later (Microsoft began rolling that out in March 2026, and the October 2026 update
  can grey it out); on older Windows only a reset turns it back on.
- Install from the installer, not by copying the folder: Windows shows the app's notifications
  only once it has its Start menu shortcut.

## Linux

**Ubuntu, Debian, Mint (recommended):** in the folder you downloaded to, run

```sh
sudo apt install ./edunex-plus_<version>_amd64.deb
```

(on ARM: `./edunex-plus_<version>_arm64.deb`), then open **Edunex Plus** from your apps menu.
The `./` matters: it tells apt to use the file.

**AppImage (any distribution):**

```sh
chmod +x Edunex-Plus-<version>-x86_64.AppImage
./Edunex-Plus-<version>-x86_64.AppImage
```

On ARM the file is `Edunex-Plus-<version>-arm64.AppImage`.

Ubuntu 24.04 and newer don't let an AppImage set up Chromium's sandbox, so there the AppImage
opens the app without it. The `.deb` sets the sandbox up: use it there if you can.

Saving your sign-in between launches needs a keyring (GNOME Keyring or KWallet). Without one,
the app still works but asks you to sign in again after each restart, and Settings says so.

## Android

1. On your phone, open the newest [release](https://github.com/pablonification/edunex-plus/releases)
   and download `Edunex-Plus-<version>-android.apk`.
2. Open the downloaded file (from the notification, or **Files → Downloads**).
3. Android asks whether your browser may install apps: tap **Settings**, turn on **Allow from this
   source**, then go back and tap **Install**.
4. If Play Protect warns that it doesn't know the app, tap **More details → Install anyway**. It
   warns because the app isn't from the Play Store, not because it found something.
5. Open **Edunex Plus** and sign in.

Had a test copy from before the first release? If Android says the app wasn't installed because
it conflicts with one already there, uninstall the old copy first: it was signed with another key.

## iPhone

Apple only lets an iPhone install apps from the App Store, unless the app is signed with your own
Apple ID. Edunex Plus isn't on the App Store, so you sign it yourself with a free tool,
**Sideloadly**, on a computer. It takes about 10 minutes the first time.

You need a Mac or Windows PC, your iPhone's cable, and an Apple ID (a spare one works too: it only
signs the app).

1. On the computer, download `Edunex-Plus-<version>-iphone.ipa` from the newest
   [release](https://github.com/pablonification/edunex-plus/releases), and install
   [Sideloadly](https://sideloadly.io). On Windows, also install iTunes and iCloud from Apple's
   website (not the Microsoft Store versions), so Sideloadly can see your iPhone.
2. Plug in the iPhone and unlock it. If it asks **Trust This Computer?**, tap **Trust**.
3. Open Sideloadly. Pick your iPhone, type your Apple ID, drag the `.ipa` onto the window and click
   **Start**. Type your Apple ID password when it asks, and the code Apple sends if two-factor is on.
   Your password goes only to Apple.
4. On the iPhone, turn on **Settings → Privacy & Security → Developer Mode**. It restarts, then asks
   you to confirm with **Turn On**.
5. Open **Settings → General → VPN & Device Management**, tap your Apple ID, then **Trust**.
6. Open **Edunex Plus** and sign in.

**Every 7 days:** an app signed with a free Apple ID stops opening after a week. Before then, plug
the iPhone in and click **Start** in Sideloadly again with the same `.ipa` (or a newer one). Your
sign-in and saved data stay.

<details>
<summary>What's different on iPhone?</summary>

iOS decides when the app may update in the background, much less often than Android does (opening
the app always updates it). Everything else is the same app, home-screen widgets included.

</details>

## Check a download (optional)

Every release also lists `SHA256SUMS.txt`: one fingerprint per file, written by the same GitHub
workflow that built them. To check that the file you downloaded is that file, print its
fingerprint and find the same line in `SHA256SUMS.txt`:

- **Windows** (PowerShell, in your Downloads folder): `Get-FileHash .\Edunex-Plus-Setup-<version>.exe`.
  Windows prints it in capitals. It's the same fingerprint.
- **macOS** (Terminal): `shasum -a 256 ~/Downloads/Edunex-Plus-<version>-arm64.dmg`
- **Linux**: `sha256sum ~/Downloads/edunex-plus_<version>_amd64.deb`
- **Android or iPhone**: check the `.apk` or `.ipa` on a computer, with the line above for that
  computer.

If they don't match, don't open the file. Download it again from the release page.

## Updates

Once a day the app asks GitHub whether a newer release exists. To ask right away, open Settings:
**Updates** comes first, with **Check for updates** (Periksa pembaruan). If there is one, a dot
appears on the settings button and the new version shows at the top of Settings.

**Update automatically** (Perbarui otomatis) is on unless you turn it off, in the same place.
Then the app downloads the new version from GitHub by itself, shows how far it got, and checks
the file against the list the release publishes. When it's ready, it's put in place the next time
you quit the app, and the next start is the new version. To have it now, press **Restart to
update** (Mulai ulang untuk memperbarui): the app closes, puts the new version in place and opens
again.

With it off, nothing is downloaded or installed until you press **Download & install** (Unduh &
pasang), then **Restart to update**. **See what's new** (Lihat yang baru) opens the release page
in your browser.

- **macOS:** works when the app is in Applications (or another folder you can change). Opened
  from the disk image, or from Downloads before you moved it, the app says so and opens the
  release page instead. No Terminal line is needed after an update from inside the app. Updating
  from 0.1.0-alpha.9 or older, macOS asks one last time for your password so Edunex Plus can use
  "Edunex Plus Safe Storage" in your keychain (the lock on your sign-in): type your Mac's login
  password and choose **Always Allow**. From then on the key is kept in "Edunex Plus Vault", and
  updates don't ask.
- **Windows:** the new installer runs by itself, without any window, and opens the app when you restarted for it.
- **Linux AppImage:** the new AppImage replaces the one you started.
- **Linux `.deb`:** the release page opens; install the new `.deb` with apt as below.

- **Android:** Settings → **About** (Tentang) shows the new version on its version row. Tap
  **Download & install** (Unduh & pasang): it downloads with its progress on that row, then
  Android's own install screen opens. Tap **Install**. The first time, Android asks whether
  Edunex Plus may install apps: turn on **Allow from this source** and go back. Your sign-in and
  saved data stay. Android installs it only if it's signed with the same key as the app you have
  ([code signing policy](code-signing.md#android-and-iphone)).
- **iPhone:** Settings → **About** (Tentang) shows the new version, and **Download** (Unduh) opens
  its release page. Download the new `.ipa` on your computer and click **Start** in Sideloadly
  again. Your sign-in and saved data stay.

An alpha tells you about the newest release, whether that is the next alpha or the full release.
A full release only ever offers full releases.

You can always update by hand too: download the new file and install it the same way. On macOS
replace the app in Applications and run the Terminal line again, on Windows run the new installer,
on Linux `sudo apt install` the new `.deb`. Your sign-in and saved data stay.

Installed 0.1.0-alpha.1 on Windows for **Anyone who uses this computer**? The new installer can't
replace that copy without an administrator, so it asks you to uninstall it first (Settings → Apps
→ Installed apps); your data stays.

## Uninstall

- **macOS:** drag Edunex Plus from Applications to the Trash.
- **Windows:** Settings → Apps → Installed apps → Edunex Plus → **Uninstall**.
- **Linux:** `sudo apt remove edunex-plus`, or delete the AppImage.
- **Android:** hold Edunex Plus on the home screen → **App info** → **Uninstall**.
- **iPhone:** hold Edunex Plus on the home screen → **Remove App** → **Delete App**.

Removing the app keeps its saved data. To remove your data too, first choose **Settings → Sign
out & remove data** (Keluar & hapus data): it signs you out and deletes your courses, grades,
plans and notes. Your theme and language and ITB's public calendar and course catalog stay; to
remove absolutely everything, delete the app's folder after uninstalling:

- **macOS:** `~/Library/Application Support/Edunex Plus`
- **Windows:** `%APPDATA%\Edunex Plus`
- **Linux:** `~/.config/Edunex Plus`

Course files you saved for offline reading are your own copies and stay where you put them: in
**Documents → Edunex Plus** unless you picked another folder, and files you downloaded are in
**Downloads**. Delete those yourself if you want them gone too.
