// Signing in (in a window the app owns) and out (#71; SIX: #76). Both
// sign-ins run on one throwaway sign-in session, kept only while the other
// system still needs a sign-in, so one Microsoft sign-in covers both: right
// after the Student signs in to one, the other is tried by itself (signin-both.ts).
import { translate } from "../../core/strings";
import { EngineError } from "../../engine/errors";
import { demo } from "../demo";
import { signInToEdunex, stopQuietEdunexSignIn } from "../signin";
import { type SignInWindows, signInToBoth } from "../signin-both";
import { forgetSignInSession } from "../signin-session";
import { signInToSix, stopQuietSixSignIn } from "../six-signin";
import { closeSixWindow } from "../six-window";
import { removeEveryTrace } from "../traces";
import type { HandlerGroup } from "./context";

export const authHandlers: HandlerGroup<"auth.signIn" | "auth.signOut"> = (context) => {
  const pretend = demo;
  const windows: SignInWindows = pretend
    ? { open: (source, how) => pretend.signIn(source, how), stopQuiet: () => undefined, forget: forgetSignInSession }
    : {
        open: (source, how) =>
          (source === "edunex" ? signInToEdunex : signInToSix)({
            parent: context.window(),
            title: translate(context.lang(), source === "edunex" ? "signIn.edunexTitle" : "signIn.sixTitle"),
            devTools: !context.packaged,
            ...how,
          }),
        stopQuiet: (source) => (source === "edunex" ? stopQuietEdunexSignIn : stopQuietSixSignIn)(),
        forget: forgetSignInSession,
      };
  const both = signInToBoth({ engine: context.engine, send: context.send, windows });

  return {
    "auth.signIn": async ({ source }) => {
      if (source === "edunex" || source === "six") return { signedIn: await both.signIn(source) };
      throw new EngineError("Rejected", `${source} has no sign-in`);
    },
    "auth.signOut": async ({ source }) => {
      both.stopQuiet();
      if (!source) await context.chatgpt.disconnect();
      await context.engine.signOut(source);
      // Edunex's files go with the account they came from, even one still on its way in, and so does the
      // record of where its downloads went. Signing out of everything carries on if this fails:
      // removeEveryTrace removes the folders too.
      if (!source || source === "edunex")
        await Promise.all([context.fileCache.clear().catch(() => undefined), context.downloadedFiles.clear().catch(() => undefined)]);
      // SIX's window holds SIX's cookie: it goes with the session.
      if (!source || source === "six") closeSixWindow();
      if (!source) await Promise.all([removeEveryTrace({ userData: context.userData, engineSession: context.engineSession }), forgetSignInSession()]);
      return {};
    },
  };
};
