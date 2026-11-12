// Every word on the website, in English. id.mjs is the default and has the same keys.
export default {
  code: "en",
  locale: "en_US",
  name: "English",
  switchTo: "Indonesia",

  nav: {
    home: "Edunex Plus home",
    features: "Features",
    install: "How to install",
    faq: "Questions",
    get: "Install",
    menu: "Menu",
    skip: "Skip to content",
    language: "Language",
    crumbs: "Breadcrumb",
  },

  devices: {
    android: "Android",
    iphone: "iPhone",
    windows: "Windows",
    mac: "Mac",
    linux: "Linux",
  },

  cta: {
    install: "Install on {device}",
    installGeneric: "Get it free",
    others: "other devices",
    free: "Free for Android, iPhone, Windows, Mac and Linux",
    version: "Version {version}",
  },

  home: {
    title: "Edunex Plus: Edunex and SIX in one app for ITB students",
    description:
      "A free app for ITB students. Your tasks, timetable, attendance and grades from Edunex and SIX in one place. For Android, iPhone, Windows, Mac and Linux.",
    ogTitle: "Edunex Plus: Edunex and SIX, finally in one place",
    ogDescription: "A free app made by ITB students. Your tasks, timetable, attendance and grades in one app, on your phone and laptop.",
    ogAlt: "Edunex Plus: Edunex and SIX, finally in one place. The app's Home and Schedule screens on an iPhone.",
    card: "Free for ITB students · phone and laptop",

    hero: {
      title: ["Edunex and SIX,", "finally in one place."],
      sub: "Your tasks, timetable, attendance and grades in one app. Free, made by ITB students, not an official campus app.",
      laptopAlt: "Home on a laptop: the class on now with its room, today's classes, and what changed",
      phoneAlt: "Home on a phone: the class on now, the Isi Presensi button, the nearest deadline, and the SIX and Edunex services",
    },

    what: {
      title: "One app that reads Edunex and SIX for you.",
      body: "You usually go back and forth. Edunex for tasks and materials, SIX for your timetable, attendance and grades. Edunex Plus signs in with your own ITB account, reads both, and tells you what needs you today.",
      sourcesTitle: "What the app reads",
      sources: [
        { name: "Edunex", body: "Tasks, materials, exams and Presence" },
        { name: "SIX", body: "Timetable and rooms, attendance, grades, KRS and UKT" },
        { name: "Academic calendar", body: "UTS and UAS weeks, KRS dates, holidays" },
        { name: "Course catalog", body: "Your curriculum and the SKS you have left" },
      ],
    },

    screens: {
      title: "Each screen answers one question.",
      items: [
        {
          q: "What do I do now?",
          a: "The class on now, its room, and your nearest deadline.",
          alt: "Home: Ekonomi dan Inovasi dalam Perencanaan is on now in R.SG PWK LT.6, with the Isi Presensi button",
        },
        {
          q: "What's due?",
          a: "Every task and exam with its real status. Hand in from the app.",
          alt: "Tasks: next week's UTS with its day and room, then Tugas 02 Bab II with its deadline",
        },
        {
          q: "How many can I still miss?",
          a: "The absences each course has left, before it's too late.",
          alt: "Courses: each course with the absences it has left, from none left to two left",
        },
        {
          q: "Which room?",
          a: "Your week with rooms, make-up classes and clashes.",
          alt: "This week's schedule: three classes on Thursday, two of them clashing",
        },
        {
          q: "Where will my IPK land?",
          a: "Your IPK now, and what it'd be after this semester.",
          alt: "Grades: IPK 3.26, an expected 3.29 after this semester, and 125 of 144 SKS passed",
        },
      ],
    },

    alerts: {
      title: "Hear about it while there's still time.",
      body: "A new task, a deadline coming up, attendance opening, a class that moved. What can wait holds until morning.",
      alt: "Three Edunex Plus alerts on an iPhone's lock screen: Presence open for II4091, PL3002 due in 3 hours, and a new task for DK4073",
      day: "Thursday, 8 October",
      notes: [
        { title: "Presence open · II4091", body: "Hand in Tugas 02 Bab II · closes 23:59", time: "now" },
        { title: "Due in 3 hours · PL3002", body: "Tugas 03 · still a draft, not submitted yet", time: "12:00" },
        { title: "New Task · DK4073", body: "Kuis Kilat Bab 5", time: "09:12" },
      ],
    },

    laptop: {
      title: "On a laptop, it all fits in one window.",
      alt: "Tasks & Exams on a laptop: exams in the UTS weeks and next week's tasks, each with its course and deadline",
      alsoTitle: "Also inside",
      also: [
        "Course files (Word, PowerPoint, PDF) open in the app and can be saved for offline",
        "KRS, UKT bills and ITB's academic calendar",
        "Widgets on your phone's home screen",
        "Light and dark, Indonesian and English",
      ],
    },

    privacy: {
      title: "Your password never reaches the app.",
      points: [
        { title: "You sign in on Microsoft's real page", body: "ITB's usual sign-in page. Only Microsoft receives your password." },
        {
          title: "Your data stays on your device",
          body: "What the app reads is saved only on your phone or laptop, and your sign-in is locked by your device's own system. No Edunex Plus server holds it.",
        },
        {
          title: "No ads, no tracking",
          body: "No analytics. The app only talks to Edunex, SIX, ITB's public pages, and GitHub for updates. Phone alerts and problem reports only run if you turn them on or send them.",
        },
        {
          title: "Delete it any time",
          body: "“Sign out & remove data” in Settings signs you out and deletes your courses, grades, plans and notes from the device.",
        },
      ],
      never: "Edunex Plus never marks attendance for you and never changes your KRS.",
      link: "Read the details",
    },

    install: {
      title: "Pick your device, follow the pictures.",
      yours: "your device",
      cards: {
        android: { time: "About 2 minutes", body: "Download one file on your phone, tap it, install." },
        iphone: { time: "About 10 minutes", body: "Through a laptop and a cable, since it isn't on the App Store." },
        windows: { time: "About 2 minutes", body: "Download, open, then click “Run anyway”." },
        mac: { time: "About 3 minutes", body: "Drag it to Applications, then paste one line in Terminal." },
        linux: { time: "About 2 minutes", body: "One command on Ubuntu and Debian, or an AppImage." },
      },
      warnTitle: "Why does my phone or laptop warn me?",
      warnBody:
        "Because Edunex Plus isn't registered with the Play Store, the App Store or Microsoft yet. Registering costs money, and the app is still an alpha. That warning shows for every app that isn't registered, not because something was found. The guide shows how to get past it.",
    },

    faq: {
      title: "What people ask",
      items: [
        {
          q: "Is this ITB's official app?",
          a: "No. Edunex Plus is made by ITB students. It isn't made by, endorsed by or connected to ITB or Cognisia, the company behind Edunex. It uses your own Edunex and SIX account, so your account stays your responsibility.",
        },
        { q: "Is it free?", a: "Free, with no ads. The code is open on GitHub under the MIT licence, so anyone can check it." },
        {
          q: "How is it different from opening Edunex and SIX?",
          a: "The data is the same. Edunex Plus puts it together, works out how many classes you can still miss, and reminds you before a deadline. You can still open Edunex and SIX as usual.",
        },
        {
          q: "Does it mark attendance for me?",
          a: "No. The app tells you when attendance opens and takes you to the button. You press it.",
        },
        {
          q: "Does it work on iPhone?",
          a: "Yes, but through a laptop since it isn't on the App Store, and it has to be repeated every 7 days. The iPhone guide has the steps.",
        },
        {
          q: "What does “still an alpha” mean?",
          a: "It's in early testing, so it can read something wrong. For anything important, like a hand-in or an attendance count, check Edunex or SIX too. If something breaks, report it with “Report a problem” in the app or on GitHub.",
        },
        {
          q: "How do I update it?",
          a: "The app checks for a new version once a day. On Windows and Mac it downloads and installs by itself. On Android, open Settings, then About. On iPhone, install the new file again with Sideloadly.",
        },
      ],
    },

    closing: {
      title: "Stop checking two sites.",
    },
  },

  install: {
    title: "How to install Edunex Plus on your phone and laptop",
    description: "Picture guides for installing Edunex Plus on Android, iPhone, Windows, Mac and Linux. Pick your device and follow the steps.",
    h1: "How to install Edunex Plus",
    lead: "Pick your device. Each guide shows the screen you'll see and which button to press.",
    crumb: "How to install",
    before: {
      title: "Before you start",
      items: [
        "You need the ITB account you use for Edunex and SIX.",
        "Your phone or laptop will warn you, because the app isn't registered with an app store yet. That's expected, and the guide shows how to get past it.",
        "The app is still an alpha. For anything important, check Edunex or SIX too.",
      ],
    },
    guide: {
      notYet: "The newest release has no file for {device} yet. Open the release page to see what's there.",
      copy: "Copy",
      copied: "Copied",
      troubleTitle: "If something goes wrong",
      updateTitle: "Updating",
      removeTitle: "Removing",
      othersTitle: "Other devices",
      full: "The full guide on GitHub",
      report: "Still stuck? Ask on GitHub",
      picNote: "Pictures are drawings. Your device may look a little different.",
      signIn: {
        title: "Sign in with your ITB account",
        phone:
          "Open <strong>Edunex Plus</strong> and tap <strong>Sign in with your ITB account</strong>. ITB's Microsoft page opens, the same one you see when you sign in to Edunex.",
        computer:
          "Open <strong>Edunex Plus</strong>, click <strong>Get started</strong>, then connect Edunex. ITB's Microsoft page opens, the same one you see when you sign in to Edunex.",
        once: "Just once. Edunex and SIX both connect from that one sign-in, and your password never reaches Edunex Plus.",
        phoneAlt: "Edunex Plus's first screen on a phone, with the Sign in with your ITB account button",
        computerAlt: "Edunex Plus's first screen on a laptop, with the Get started button",
      },
    },
  },

  guides: {
    android: {
      title: "How to install Edunex Plus on Android",
      description: "Install Edunex Plus on an Android phone in 2 minutes: download the APK, allow the install, sign in. With a picture for every step.",
      h1: "Install on Android",
      lead: "Edunex Plus isn't on the Play Store yet, so it comes as one APK file. You download it, tap it, and install.",
      time: "About 2 minutes",
      needs: ["An Android phone on Android 8 or newer"],
      steps: [
        {
          title: "Download the file on your phone",
          body: [
            "Open this page on your phone and tap the button below.",
            "If the browser asks whether to keep the file, choose <strong>Download anyway</strong>.",
          ],
          download: ["android"],
          pic: "androidDownload",
        },
        {
          title: "Open the file you downloaded",
          body: ["Tap <strong>Open</strong> on the download notice. If it's gone, open the <strong>Files</strong> app, then <strong>Downloads</strong>."],
          pic: "androidOpen",
        },
        {
          title: "Let your browser install apps",
          body: [
            "Android asks first, because the file isn't from the Play Store. Tap <strong>Settings</strong>, turn on <strong>Allow from this source</strong>, then go back.",
            "This only covers the browser you're using, and you can turn it off again afterwards.",
          ],
          pic: "androidAllow",
        },
        {
          title: "Tap Install",
          body: [
            "Tap <strong>Install</strong>.",
            "If Play Protect says it doesn't know the app, tap <strong>More details</strong>, then <strong>Install anyway</strong>. It warns because the app isn't from the Play Store, not because it found something.",
          ],
          pic: "androidInstall",
        },
      ],
      trouble: [
        {
          q: "It says “App not installed”",
          a: "Usually an old test copy is still on your phone. Uninstall the old Edunex Plus first, then install again.",
        },
        { q: "I can't find the file", a: "Open the Files or My Files app, then Downloads. Its name starts with Edunex-Plus and ends in .apk." },
        {
          q: "The Install button won't press",
          a: "Close any app that draws over the screen, such as a blue-light filter or chat bubbles, then try again.",
        },
      ],
      update:
        "Open <strong>Settings</strong>, then <strong>About</strong>. If there's a new version, tap <strong>Download &amp; install</strong>. Your data and sign-in stay.",
      remove: "Hold the Edunex Plus icon on your home screen, choose <strong>App info</strong>, then <strong>Uninstall</strong>.",
    },

    iphone: {
      title: "How to install Edunex Plus on iPhone",
      description: "Install Edunex Plus on an iPhone from a laptop, with Sideloadly and your own Apple ID. A picture guide, about 10 minutes.",
      h1: "Install on iPhone",
      lead: "Apple only allows apps from the App Store, unless you sign the app with your own Apple ID. Edunex Plus isn't on the App Store yet, so you install it from a laptop with a free tool called Sideloadly.",
      time: "About 10 minutes the first time",
      needs: ["An iPhone on iOS 16.4 or newer", "A Mac or Windows laptop", "Your iPhone's cable", "An Apple ID (free, a spare one works)"],
      callout: {
        title: "Repeat it every 7 days",
        body: "An app signed with a free Apple ID stops opening after a week. Before then, plug the iPhone into the laptop and click Start in Sideloadly again. Your data and sign-in stay.",
      },
      steps: [
        {
          title: "On the laptop, get the app and Sideloadly",
          body: [
            'Download the <strong>.ipa</strong> file with the button below, then install <a href="https://sideloadly.io" target="_blank" rel="noopener noreferrer">Sideloadly</a>.',
            "On Windows, also install <strong>iTunes</strong> and <strong>iCloud</strong> from Apple's website, not the Microsoft Store versions, so Sideloadly can see your iPhone.",
          ],
          download: ["iphone"],
          pic: "ipaAndSideloadly",
        },
        {
          title: "Plug the iPhone into the laptop",
          body: ["Plug the iPhone in with its cable and unlock it. If it asks <strong>Trust This Computer?</strong>, tap <strong>Trust</strong>."],
          pic: "iosTrust",
        },
        {
          title: "Install it with Sideloadly",
          body: [
            "Open Sideloadly. Pick your iPhone, type your Apple ID, drag the <strong>.ipa</strong> file onto the window and click <strong>Start</strong>.",
            "Type your Apple ID password when it asks, then the code Apple sends if there is one. Your password goes only to Apple.",
          ],
          pic: "sideloadly",
        },
        {
          title: "Turn on Developer Mode on the iPhone",
          body: [
            "Open <strong>Settings</strong> › <strong>Privacy &amp; Security</strong> › <strong>Developer Mode</strong> and turn it on.",
            "The iPhone restarts, then asks you to confirm. Tap <strong>Turn On</strong>.",
          ],
          pic: "iosDevMode",
        },
        {
          title: "Trust your Apple ID",
          body: [
            "Open <strong>Settings</strong> › <strong>General</strong> › <strong>VPN &amp; Device Management</strong>. Tap your Apple ID, then <strong>Trust</strong>.",
          ],
          pic: "iosTrustDev",
        },
      ],
      trouble: [
        {
          q: "Sideloadly can't see my iPhone",
          a: "Make sure the iPhone is unlocked and you tapped Trust. On Windows, install iTunes and iCloud from Apple's website, then open Sideloadly again.",
        },
        {
          q: "Developer Mode isn't in Settings",
          a: "It only shows after Sideloadly has finished installing the app. Do step 3 again, then look once more.",
        },
        {
          q: "The app won't open after a week",
          a: "A free Apple ID's signature lasts 7 days. Plug the iPhone in and click Start in Sideloadly again, with the same .ipa file or a newer one.",
        },
      ],
      update:
        "<strong>Settings</strong> › <strong>About</strong> shows a new version. Download the new <strong>.ipa</strong> on the laptop and click <strong>Start</strong> in Sideloadly again. Your data and sign-in stay.",
      remove: "Hold the Edunex Plus icon on your home screen, choose <strong>Remove App</strong>, then <strong>Delete App</strong>.",
    },

    windows: {
      title: "How to install Edunex Plus on Windows",
      description: "Install Edunex Plus on Windows 10 or 11 in 2 minutes, with how to get past “Windows protected your PC”. With a picture for every step.",
      h1: "Install on Windows",
      lead: "Download, open, and get past one warning from Windows. No administrator password needed.",
      time: "About 2 minutes",
      needs: ["Windows 10 or 11"],
      steps: [
        {
          title: "Download the file",
          body: [
            "Nearly every laptop uses the first one. Pick ARM only if yours runs on Snapdragon.",
            "Your browser may hold the download back, because few people have downloaded this version yet. In Edge, point at the file, click <strong>⋯</strong>, <strong>Keep</strong>, <strong>Show more</strong>, then <strong>Keep anyway</strong>.",
          ],
          download: ["win-x64", "win-arm"],
          pic: "edgeKeep",
        },
        {
          title: "Open the installer inside the zip",
          body: [
            "Open the zip you downloaded, then double-click the installer (the <strong>.exe</strong>) inside it.",
            "The installer comes in a zip so browsers hold it back less often.",
          ],
          pic: "winZip",
        },
        {
          title: "Get past the Windows warning",
          body: [
            "If a blue <strong>Windows protected your PC</strong> window appears, click <strong>More info</strong>, then <strong>Run anyway</strong>.",
            "Windows warns because this version is new and few people have installed it. After that, the app installs and opens by itself.",
          ],
          pic: "smartscreen",
        },
      ],
      trouble: [
        {
          q: "It says “Smart App Control blocked this app”",
          a: "Smart App Control only runs apps it recognises, and has no “Run anyway”. Turning it off (Windows Security › App & browser control) removes that protection for every app, so the safer choice is to wait until the installer is signed.",
        },
        {
          q: "Chrome says “Suspicious download blocked”",
          a: "Open Downloads (the arrow at the top right), choose the file, then Download suspicious file.",
        },
        {
          q: "Notifications don't show",
          a: "Install with the installer, don't copy the folder. Windows shows an app's notifications only once it has a Start menu shortcut.",
        },
      ],
      update: "Automatic. The app downloads a new version by itself and installs it when you quit the app.",
      remove: "<strong>Settings</strong> › <strong>Apps</strong> › <strong>Installed apps</strong> › Edunex Plus › <strong>Uninstall</strong>.",
    },

    mac: {
      title: "How to install Edunex Plus on Mac",
      description:
        "Install Edunex Plus on a Mac in 3 minutes: drag it to Applications, then one line in Terminal so macOS opens it. With a picture for every step.",
      h1: "Install on Mac",
      lead: "Drag the app to Applications, then paste one line in Terminal. The line is needed because the app isn't signed by Apple yet.",
      time: "About 3 minutes",
      needs: ["macOS 12 Monterey or newer"],
      steps: [
        {
          title: "Download the file for your Mac",
          body: [
            "Not sure which Mac you have? Open the <strong>Apple menu</strong> › <strong>About This Mac</strong>. “Chip Apple M…” means Apple silicon, “Processor … Intel” means Intel.",
          ],
          download: ["mac-arm", "mac-intel"],
          pic: "macAbout",
        },
        {
          title: "Drag Edunex Plus to Applications",
          body: [
            "Open the <strong>.dmg</strong> you downloaded. In the window that opens, drag <strong>Edunex Plus</strong> onto the <strong>Applications</strong> folder.",
          ],
          pic: "dmg",
        },
        {
          title: "Paste one line in Terminal",
          body: [
            "In the same window, double-click <strong>Terminal</strong>. Paste this line and press <strong>Return</strong>. Nothing is printed when it works.",
            "The line removes the “downloaded from the internet” mark that makes macOS block the app, for Edunex Plus only.",
          ],
          command: 'xattr -cr "/Applications/Edunex Plus.app"',
          pic: "terminal",
          alt: {
            title: "Rather not use Terminal?",
            body: "Open Edunex Plus once and click <strong>Done</strong> when macOS says it can't check it. Open <strong>System Settings</strong> › <strong>Privacy &amp; Security</strong>, scroll down, and click <strong>Open Anyway</strong>. The button only shows for a while after you try to open the app.",
            pic: "macOpenAnyway",
          },
        },
      ],
      trouble: [
        {
          q: "macOS says the app is “damaged” or can't be opened",
          a: "The Terminal line in step 3 hasn't run yet, or the app isn't in Applications. Move it there first, then run the line again.",
        },
        {
          q: "There's no “Open Anyway” button",
          a: "It only shows for a while after you try to open the app. Open Edunex Plus once more, then look in System Settings.",
        },
      ],
      update: "Automatic while the app is in Applications. After an update from inside the app, the Terminal line isn't needed again.",
      remove: "Drag Edunex Plus from Applications to the Trash.",
    },

    linux: {
      title: "How to install Edunex Plus on Linux",
      description: "Install Edunex Plus on Ubuntu, Debian and Linux Mint with one apt command, or use the AppImage on any other distribution.",
      h1: "Install on Linux",
      lead: "There's a .deb for Ubuntu, Debian and Mint, and an AppImage for everything else.",
      time: "About 2 minutes",
      needs: ["Ubuntu, Debian, Mint or another distribution", "A keyring (GNOME Keyring or KWallet) so your sign-in is saved"],
      steps: [
        {
          title: "Download the file for your system",
          body: ["Pick the <strong>.deb</strong> for Ubuntu, Debian and Mint. Pick the <strong>AppImage</strong> for anything else."],
          download: ["linux-deb", "linux-appimage"],
          pic: null,
        },
        {
          title: "Install the .deb",
          body: [
            "Open a terminal in the folder you downloaded to and run this line. Then open <strong>Edunex Plus</strong> from your apps menu.",
            "The <strong>./</strong> before the file name matters: it tells apt to use the file.",
          ],
          command: "sudo apt install ./edunex-plus_<version>_amd64.deb",
          commandKey: "deb",
          pic: null,
        },
        {
          title: "Or run the AppImage",
          body: ["Make it runnable, then open it.", "On Ubuntu 24.04 and newer, an AppImage runs without Chromium's sandbox. Use the .deb there if you can."],
          command: "chmod +x Edunex-Plus-<version>-x86_64.AppImage && ./Edunex-Plus-<version>-x86_64.AppImage",
          commandKey: "appimage",
          pic: null,
        },
      ],
      trouble: [
        {
          q: "The app asks me to sign in every time",
          a: "Your system has no keyring yet. Install GNOME Keyring or KWallet, then sign in once more.",
        },
        { q: "My laptop is ARM", a: "The ARM files are on the release page: their names end in _arm64.deb and -arm64.AppImage." },
      ],
      update: "The AppImage updates itself. For the .deb, the app opens the release page, and you install the new file with the same command.",
      remove: "Run <strong>sudo apt remove edunex-plus</strong>, or delete the AppImage.",
    },
  },

  downloads: {
    android: "Download for Android (.apk)",
    iphone: "Download for iPhone (.ipa)",
    "win-x64": "Windows, Intel or AMD",
    "win-arm": "Windows, ARM (Snapdragon)",
    "mac-arm": "Mac with Apple silicon (M1 or newer)",
    "mac-intel": "Mac with Intel",
    "linux-deb": "Ubuntu, Debian, Mint (.deb)",
    "linux-appimage": "Other Linux (AppImage)",
  },

  // The words inside the drawn screens: what each system itself shows, in English.
  pic: {
    android: {
      file: "Edunex-Plus-android.apk",
      done: "Download complete",
      open: "Open",
      keep: "Download anyway",
      harmful: "File might be harmful",
      unknownTitle: "Chrome",
      unknownBody: "For your security, your phone currently isn't allowed to install unknown apps from this source. You can change this in Settings.",
      cancel: "Cancel",
      settings: "Settings",
      allowTitle: "Install unknown apps",
      allow: "Allow from this source",
      installAsk: "Do you want to install this app?",
      install: "Install",
      protectTitle: "Play Protect doesn't recognise this app",
      more: "More details",
      anyway: "Install anyway",
      ok: "Got it",
    },
    ios: {
      trustTitle: "Trust This Computer?",
      trustBody: "Your settings and data will be accessible from this computer when connected.",
      trust: "Trust",
      dontTrust: "Don't Trust",
      settings: "Settings",
      privacy: "Privacy & Security",
      devMode: "Developer Mode",
      general: "General",
      vpn: "VPN & Device Management",
      devApp: "DEVELOPER APP",
      appleId: "Your Apple ID",
      trustApp: "Trust “Your Apple ID”",
    },
    sideloadly: {
      device: "iDevice",
      phone: "Your iPhone",
      appleId: "Apple ID",
      mail: "name@example.com",
      drop: "Drag the .ipa file here",
      start: "Start",
    },
    windows: {
      edgeTitle: "Downloads",
      edgeWarn: "isn't commonly downloaded. Make sure you trust it before you open it.",
      keep: "Keep",
      more: "Show more",
      keepAnyway: "Keep anyway",
      remove: "Delete",
      zip: "Edunex-Plus-Setup-windows-x64.zip",
      setup: "Edunex-Plus-Setup.exe",
      colName: "Name",
      colType: "Type",
      type: "Application",
      ssTitle: "Windows protected your PC",
      ssBody: "Microsoft Defender SmartScreen prevented an unrecognized app from starting. Running this app might put your PC at risk.",
      ssMore: "More info",
      ssApp: "App: Edunex-Plus-Setup.exe",
      ssRun: "Run anyway",
      ssDont: "Don't run",
    },
    mac: {
      about: "About This Mac",
      chip: "Chip",
      chipValue: "Apple M2",
      macos: "macOS",
      silicon: "Apple silicon",
      applications: "Applications",
      terminal: "Terminal",
      settings: "Privacy & Security",
      blocked: "“Edunex Plus” was blocked to protect your Mac.",
      openAnyway: "Open Anyway",
    },
  },

  footer: {
    made: "Made by ITB students, supported by",
    links: {
      install: "How to install",
      privacy: "Privacy",
      signing: "Code signing policy",
      report: "Report a problem",
      github: "GitHub",
    },
    disclaimer:
      "Unofficial. Built by students, not made by, endorsed by or connected to ITB or Cognisia (the company behind Edunex). It uses your own Edunex and SIX account, so your account stays your responsibility. Still an alpha: for anything important, check Edunex or SIX too. Pictures show the demo's made-up student.",
  },

  notFound: {
    title: "Page not found · Edunex Plus",
    h1: "This page isn't here.",
    body: "The link may be old. Everything about Edunex Plus is on the home page.",
    home: "Go to the home page",
  },
};
