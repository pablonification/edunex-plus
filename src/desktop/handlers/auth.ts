// Signing in (in a window the app owns) and out (#71; SIX: #76). Both
// sign-ins run on one throwaway sign-in session, kept only while the other
// system still needs a sign-in, so one Microsoft sign-in covers both.
import type { SourceId } from "../../core/models";
import { translate } from "../../core/strings";
import { EngineError } from "../../engine/errors";
import { demo } from "../demo";
import { signInToEdunex } from "../signin";
import { forgetSignInSession } from "../signin-session";
import { signInToSix } from "../six-signin";
import { removeEveryTrace } from "../traces";
import type { HandlerGroup } from "./context";

export const authHandlers: HandlerGroup<"auth.signIn" | "auth.signOut"> = (context) => {
  /** After one system is signed in: Microsoft's session stays only if the other one still needs it. */
  const afterSignIn = (other: SourceId) => {
    const state = context.engine.snapshot().statuses.find((status) => status.source === other)?.state;
    if (state !== "signed-out" && state !== "expired") void forgetSignInSession();
  };
  const windowOptions = (title: "signIn.edunexTitle" | "signIn.sixTitle") => ({
    parent: context.window(),
    title: translate(context.lang(), title),
    devTools: !context.packaged,
  });

  let edunex: Promise<boolean> | null = null;
  const signInToEdunexOnce = () =>
    (edunex ??= (async () => {
      try {
        const token = demo ? await demo.signIn("edunex") : await signInToEdunex(windowOptions("signIn.edunexTitle"));
        if (!token) return false;
        await context.engine.signIn("edunex", { token });
        afterSignIn("six");
        return true;
      } finally {
        edunex = null;
      }
    })());

  let six: Promise<boolean> | null = null;
  const signInToSixOnce = () =>
    (six ??= (async () => {
      try {
        const cookie = demo ? await demo.signIn("six") : await signInToSix(windowOptions("signIn.sixTitle"));
        if (!cookie) return false;
        await context.engine.signIn("six", { cookie });
        afterSignIn("edunex");
        return true;
      } finally {
        six = null;
      }
    })());

  return {
    "auth.signIn": async ({ source }) => {
      if (source === "edunex") return { signedIn: await signInToEdunexOnce() };
      if (source === "six") return { signedIn: await signInToSixOnce() };
      throw new EngineError("Rejected", `${source} has no sign-in`);
    },
    "auth.signOut": async ({ source }) => {
      await context.engine.signOut(source);
      if (!source) await Promise.all([removeEveryTrace({ userData: context.userData, engineSession: context.engineSession }), forgetSignInSession()]);
      return {};
    },
  };
};
