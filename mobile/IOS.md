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
| Bottom tabs | iOS's own tab bar with Apple's symbols; Liquid Glass on iOS 26, which iOS draws itself. |
| Liquid Glass | On iOS 26: a top bar's back button and actions, and the snackbar (`src/ui/glass.tsx`). Older iPhones and Android keep the Material look. |
| App icon | Its own, edge to edge and opaque (`assets/ios-icon.png`, `scripts/make-icons.mjs`): iOS rounds it and fills see-through parts with white. |
| Edunex's pages | Get a stand-in service worker (`src/host/page-fixes.ts`): an app's web view has none, and Edunex's site stopped on its spinner without one. |
| "Turn on notifications" button | Opens the app's page in iOS Settings. |
| Typeface | Plus Jakarta Sans is in the iOS bundle too. |
| Widgets | Their own, through Expo's `expo-widgets` (WidgetKit, SwiftUI): "Edunex Plus" and "Hari ini" on the Home Screen (small, medium, large) and the Lock Screen, fed by the same model as Android's (`qa/superapp-ios-widgets.md`). A Live Activity for the class on now. Never seen running yet. |
| Back gesture, navigation bar colour, 120 Hz plugin | Android-only, skipped on iOS (iOS does these itself). |
| The first minute (`src/shell/first-minute/`) | Same code: the stage, the doors, the ring at each door's foot (a bordered view turning, no native part), the greeting, the curtain. Its haptics are the Taptic Engine's nearest (`ui/haptics.ts`: a medium tap per system in and as the lift starts, the selection tick as the doors meet the mark). The curtain is no longer rasterised while it lifts (the doors move on it), on either platform. The button dims under the finger (no ripple on iOS). |
| Exact alarms | Android-only permission; iOS fires a booked notification on time anyway. |
| Push notifications | Off: the app never uses them, and a free Apple ID can't sign them. |

## Not yet checked on a real iPhone

Everything above is untested on iOS: the build itself, the SIX cookie read, whole-day calendar events,
how the screens look (they're drawn for Android's Material style), the keyboard over the report form,
the background sync, and the widgets (below).

## The widgets and the Live Activity: what to look at on the iPhone

Nobody has seen these run. `qa/superapp-ios-widgets.md` says how they work; CI's iPhone build uploads a sketch of
each one from the demo's data (artifact `ios-widget-sketches`), to hold the phone against. In order, each
step only worth doing if the one before it worked:

1. **It installs with the widget inside.** Re-signing the `.ipa` (Sideloadly or AltServer) must keep the widget
   extension (`ExpoWidgetsTarget`) and give both the app and it the App Group `group.<the app's id>`. If you
   changed the bundle id to your own, the group changes with it: prebuild again with that id rather than renaming
   it in Xcode. A free Apple ID may refuse the App Group: say so, it decides what we do next.
2. **The gallery has them.** Long-press the Home Screen › Edit › Add Widget › "Edunex Plus": two widgets ("Edunex
   Plus" and "Hari ini"), each in small, medium and large, shown greyed like a widget still loading.
3. **They fill in.** Open the app (the demo is easiest), sign in or let the demo load, go back to the Home Screen.
   Within a few seconds of leaving the app, both show the class on now or next and today's classes, the same as
   Android's widgets and Beranda.
4. **Each size fits.** Small, medium, large, at the normal text size and at a larger one (Settings › Display ›
   Text Size): nothing cut that matters (the course code, the time, "Tandai Hadir"); compare with the sketch.
5. **Light and dark.** Switch the phone's look; then pick light or dark in the app: the widgets follow the app's
   pick, as on Android.
6. **Taps.** Small: anywhere opens the class (or SIX's check-in while "Tandai Hadir" is open). Medium and large:
   the class opens its course, each need its screen, each of today's classes its sheet on Jadwal, the deadline
   its task.
7. **It turns over by itself.** With the app closed, watch a class start or end, or wait past midnight: the
   widget moves on without opening the app.
8. **Lock Screen.** Customise the Lock Screen › add "Edunex Plus" (rectangular, round, and the line above the
   clock) and "Hari ini": readable in iOS's tint, and a tap opens the app at the class.
9. **Signed out.** Sign out of SIX in the app: "Hari ini" says what's wrong in the warning colour; signed out of
   everything, both say "Hubungkan Edunex atau SIX dulu".
10. **The Live Activity.** Open the app during a class (the demo's morning has one): a Live Activity appears on
    the Lock Screen and in the Dynamic Island with the course, a bar through the class, and, while its Presence
    is open, "Isi Presensi …" with the time left counting down. It goes when the class is over and the app (or
    the background sync) runs. Check it can be turned off (Settings › Edunex Plus › Live Activities) and that
    the app is fine without it. Decide whether it should start for every class or only when there's something
    to do.
11. **Memory.** A widget gets little memory, and these run a small JavaScript engine: if a widget stays blank
    or greyed after step 3, that's the first suspect (Console.app on the Mac, the `ExpoWidgetsTarget` process).
and the background sync.

The first minute, to check on an iPhone: the status bar's icons stay white over the stage and turn to Beranda's as
the strip of the stage's blue over them fades (it holds the status bar, notch or Dynamic Island until the curtain's edge is under it, then fades in place; `expo-status-bar`, set by the stage and the scene; `seam.ts` says which Beranda wants); the
headline, button and note clear the home indicator (the stage pads by the safe area's bottom) and the language chip
clears the notch or Dynamic Island (by its top); the curtain's rounded lower edge shows no gap at the screen's own
rounded corners as it starts to lift; the three haptics are felt once each and not doubled; and the sign-in page
stepping aside after Microsoft hands back (`shell/sign-in.tsx`: unseen, still read every 400 ms) still finishes the
sign-in, since an unseen web view is throttled differently by iOS than by Android.
