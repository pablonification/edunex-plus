// Bridge handlers for SIX (#76).
import { forgetSignInSession } from "../signin-session";
import type { HandlerGroup } from "./context";

export const sixHandlers: HandlerGroup<"auth.signInDone"> = () => ({
  "auth.signInDone": async () => {
    await forgetSignInSession();
    return {};
  },
});
