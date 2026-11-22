// Usage data (ADR 0016): the window says which screen it shows, by the screen's name only. What
// the window asks the engine to do is counted where the bridge answers it, by the action's name.
import { z } from "zod";
import { USAGE_NAME } from "../usage";

export const usageActions = {
  /** A screen showed ("home", "course"): counted for today, when usage data is on. Nothing else about it. */
  "usage.screen": { input: z.object({ screen: z.string().regex(USAGE_NAME) }), output: z.object({}) },
} as const;
