// Bridge handlers for alerts on the Student's phone (ntfy). The window only
// says what to do: the topic is made here, and only the engine sends.
import { clipboard } from "electron";
import type { HandlerGroup } from "./context";

export const phoneHandlers: HandlerGroup<"phone.link" | "phone.connect" | "phone.test" | "phone.copy" | "phone.disconnect"> = (context) => ({
  "phone.link": async () => context.engine.phone.link(),
  "phone.connect": () => context.engine.phone.connect(),
  "phone.test": () => context.engine.phone.test(),
  // The page may not use the clipboard itself (every permission is refused).
  "phone.copy": async () => {
    const link = context.engine.phone.link();
    if (link.connected) clipboard.writeText(link.topic);
    return {};
  },
  "phone.disconnect": () => context.engine.phone.disconnect(),
});
