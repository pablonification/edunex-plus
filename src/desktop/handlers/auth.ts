// Signing in (in a window the app owns) and out (#71; SIX: #76).
import { translate } from "../../core/strings";
import { EngineError } from "../../engine/errors";
import { signInToEdunex } from "../signin";
import { removeEveryTrace } from "../traces";
import type { HandlerGroup } from "./context";

export const authHandlers: HandlerGroup<"auth.signIn" | "auth.signOut"> = (context) => {
  let edunex: Promise<boolean> | null = null;
  const signInToEdunexOnce = () =>
    (edunex ??= (async () => {
      try {
        const token = await signInToEdunex({ parent: context.window(), title: translate(context.lang(), "signIn.edunexTitle"), devTools: !context.packaged });
        if (!token) return false;
        await context.engine.signIn("edunex", { token });
        return true;
      } finally {
        edunex = null;
      }
    })());

  return {
    "auth.signIn": async ({ source }) => {
      if (source === "edunex") return { signedIn: await signInToEdunexOnce() };
      throw new EngineError("Rejected", `${source} sign-in isn't available yet`);
    },
    "auth.signOut": async ({ source }) => {
      await context.engine.signOut(source);
      if (!source) await removeEveryTrace({ userData: context.userData, engineSession: context.engineSession });
      return {};
    },
  };
};
