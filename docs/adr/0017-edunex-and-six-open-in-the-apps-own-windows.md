# 17. Edunex and SIX open in the app's own windows, signed in

Status: accepted (2026-11-04). Widens the SIX window for "Tandai Hadir" (`SIX.md`) to every SIX
page, and adds one for Edunex. Leaves [0002](0002-lecturer-content-in-the-app.md)'s lecturers' links
alone: they still open in the browser.

## Context

Every "Buka di Edunex" and "Buka di SIX" opened the system browser. The Student was often signed out
there, so they signed in to Microsoft (2FA included) again just to see the page the app pointed at.
"Tandai Hadir" didn't: it opens SIX in a window of the app, signed in with the session the app keeps,
and it's the quicker one.

## Decision

- **Every Edunex and SIX page the app opens (`shell.openExternal`, the tray menu) opens in the app's
  window for that site, signed in** (`src/desktop/open-page.ts`). One window per site; another page
  loads in it, brought forward. ITB's other pages, online classes and a problem report still open in
  the browser.
- **Each window is the SIX window's kind** (`src/desktop/site-window.ts`): its own in-memory session,
  sandboxed, no access to the app, every permission refused, wiped when it closes or the Student signs
  out of that site. It stays on its site and Microsoft's sign-in.
- **SIX** is signed in with the engine's `khongguan` cookie, as before. Any SIX page now opens there;
  "Tandai Hadir" also opens the class's popup.
- **Edunex** keeps its session in `localStorage.auth`. Before Edunex's code runs on the window's first
  Edunex page, the window puts the engine's access token there as `{ accessToken, expirationDate,
  verified: true }`, which is what Edunex's public JavaScript checks (`initialize`, `isLoggedIn`). The
  end date is the token's own `exp`, or 12 hours when it has none. A token Edunex refuses sends the
  Student to Edunex's own sign-in in the window. Once only per window, so a sign-in there stays. The
  script goes in through Chromium's DevTools protocol (`Page.addScriptToEvaluateOnNewDocument`) on a
  blank page first, since Chromium answers only once the window has a page, so
  the token is never in an address, a file or a preload.
- **A link leaving Edunex's window** goes to the browser, as Edunex opens a lecturer's link; one leaving
  SIX's still goes only when it's official.
- **Closing a window reads that site's attendance again**, as coming back from the browser did.
- **The demo still opens the browser**: its sessions are pretend.

## Consequences

- The access token now sits in a page's storage while the Edunex window is open. That page is Edunex's
  own website, which holds the same token after any sign-in.
- If Edunex changes how it keeps its session, its window shows Edunex's sign-in instead. Nothing else
  breaks, and `src/desktop/edunex-window.ts` is the one place to follow it.
