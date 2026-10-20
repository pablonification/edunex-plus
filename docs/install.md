# Installing Edunex Plus

How to install, update and remove the app on each system. Back to the [README](../README.md).

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

Not sure which Mac you have? Apple menu → **About This Mac**: "Chip Apple M…" means Apple
silicon, "Processor … Intel" means an Intel Mac. The app needs macOS 12 Monterey or newer.
Not sure which Windows PC? Settings → System → About: "ARM-based processor" means ARM; anything
else (x64) means Intel or AMD. On Windows 11 the Intel and AMD installer runs on ARM too, just slower.

The installers aren't signed with paid certificates yet, so macOS and Windows warn you the first
time you open each new version. That's expected for this alpha; the steps below get past it, and
the app then opens normally until the next update.

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

From then on it opens like any other app. After each update, run the line again once.

<details>
<summary>Rather not use Terminal?</summary>

Open the app once and click **Done** when macOS says it can't check it (not "Move to Trash").
Then go to **System Settings → Privacy & Security**, scroll down to the line about Edunex Plus and
click **Open Anyway**, confirm with your password or Touch ID, then **Open**. The button only shows
for a while after you try to open the app: if it's gone, open the app again first.

</details>

A `.zip` (`…-arm64-mac.zip`, on Intel `…-x64-mac.zip`) is there too, if you prefer it to the disk image: unzip it and move
the app to Applications, then the same steps.

## Windows

1. Run `Edunex-Plus-Setup-<version>.exe` (on an ARM PC: `Edunex-Plus-<version>-arm64.exe`).
2. If a blue **"Windows protected your PC"** window appears, click **More info**, then **Run
   anyway**.

There's nothing to choose: it installs for your Windows account only (no administrator
password), adds **Edunex Plus** to the Start menu and the desktop, and opens it.

- If the browser holds the download back ("isn't commonly downloaded"), choose **Keep** (in
  Edge: **⋯ → Keep → Show more → Keep anyway**).
- If Windows says **Smart App Control blocked** it, there's no "Run anyway": Smart App Control
  allows only signed apps. You'd have to turn it off in Windows Security → App & browser control,
  and Windows can't turn it back on without a reset, so wait for a signed release instead.
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

On Ubuntu 24.04 and newer an AppImage can't set up Chromium's sandbox, so the app closes right
away: use the `.deb` there (it sets the sandbox up), or start the AppImage with `--no-sandbox`.

Saving your sign-in between launches needs a keyring (GNOME Keyring or KWallet). Without one,
the app still works but asks you to sign in again after each restart, and Settings says so.

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
  release page instead. No Terminal line is needed after an update from inside the app.
- **Windows:** the new installer runs by itself, without any window, and opens the app when you restarted for it.
- **Linux AppImage:** the new AppImage replaces the one you started.
- **Linux `.deb`:** the release page opens; install the new `.deb` with apt as below.

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
