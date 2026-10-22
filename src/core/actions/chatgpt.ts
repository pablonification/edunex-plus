import { z } from "zod";

/** Only display information crosses the bridge; the stable identity stays in main's vault. */
export const ChatGptStatus = z.object({ available: z.boolean(), connecting: z.boolean(), name: z.string().nullable() });
export type ChatGptStatus = z.infer<typeof ChatGptStatus>;

export const chatgptActions = {
  "chatgpt.status": { input: z.object({}), output: ChatGptStatus },
  "chatgpt.connect": { input: z.object({}), output: ChatGptStatus },
  /** Also cancels an unfinished sign-in. */
  "chatgpt.disconnect": { input: z.object({}), output: ChatGptStatus },
} as const;
