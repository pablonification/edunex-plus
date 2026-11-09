# Try it on your iPhone

The app is built for Android. It also builds for iOS, so you can try it on your own iPhone. Nobody has
built it on a Mac yet (the machine this was set up on has no Xcode), so expect a first-run snag or two.

## What you need

- A Mac with **Xcode 26 or newer** from the App Store (Expo SDK 58's release notes give the exact
  minimum), opened once so it installs its extra parts.
- CocoaPods: `brew install cocoapods`.
- Your iPhone on iOS 16.4 or newer, a cable, and a free Apple ID.
- On the iPhone: Settings › Privacy & Security › **Developer Mode** on (it restarts).

## Build and open it

From `mobile/`, with the packages installed (`npm ci` at the root and in `mobile/`):

```sh
npx expo prebuild -p ios          # writes ios/ (not committed; run again after changing app.config.ts)
npx expo run:ios --device         # builds, installs and opens it on the plugged-in iPhone
```

The first time it stops at signing. Open `ios/EdunexPlus.xcworkspace` in Xcode, then:

1. Xcode › Settings › Accounts: add your Apple ID.
2. Target **EdunexPlus** › Signing & Capabilities: Team = your name (Personal Team).
3. If Xcode says the bundle id is taken, change it there to something of your own
   (`io.github.<you>.edunexplus`).
4. Run `npx expo run:ios --device` again.
5. On the iPhone: Settings › General › VPN & Device Management › trust your Apple ID.

With a free Apple ID the app stops opening after 7 days; build it again to renew it.

For the demo (made-up student, no account needed): `EXPO_PUBLIC_DEMO=1 npx expo prebuild -p ios --clean`,
then `npm run start:demo` and `EXPO_PUBLIC_DEMO=1 npx expo run:ios --device`. It's a separate app
(`…edunexplus.demo`).

## What works, and what doesn't

| Part | On iPhone |
| --- | --- |
| Screens, sync, saved data | Same code as Android. |
| Sign-in to Edunex | Same as Android (the page hands over its token). |
| Sign-in to SIX | Reads SIX's session cookie from iOS's web view store (`modules/web-cookies/ios`). |
| Notifications | Local ones work, booked ahead too. No channels on iOS (that's Android's idea); iOS keeps only the next 64 booked. |
| Background sync | iOS decides when, and much less often than Android. |
| Phone calendar | Made inside the account your default calendar uses (often iCloud). |
| Switches | iOS's own switch instead of Android's Material one. |
| "Turn on notifications" button | Opens the app's page in iOS Settings. |
| Typeface | Plus Jakarta Sans is in the iOS bundle too. |
| **Home-screen widget** | **Not there.** It's Android's (`react-native-android-widget`); an iPhone widget needs its own Swift (WidgetKit) code. |
| Back gesture, navigation bar colour, 120 Hz plugin | Android-only, skipped on iOS (iOS does these itself). |
| Exact alarms | Android-only permission; iOS fires a booked notification on time anyway. |
| Push notifications | Off: the app never uses them, and a free Apple ID can't sign them. |

## Not yet checked on a real iPhone

Everything above is untested on iOS: the build itself, the SIX cookie read, whole-day calendar events,
how the screens look (they're drawn for Android's Material style), the keyboard over the report form,
and the background sync.
