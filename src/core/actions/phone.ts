// Actions for alerts on the Student's phone, through ntfy: link it, read the
// link, send a test, copy its code, unlink it. The window never names a
// server, a topic or a message: main makes the topic and knows where it goes.
import { z } from "zod";

/** Why the last message didn't get to ntfy: no connection, or ntfy is busy (too many messages, 429). */
export const PhoneProblem = z.enum(["offline", "busy"]);
export type PhoneProblem = z.infer<typeof PhoneProblem>;

export const PhoneLink = z.discriminatedUnion("connected", [
  z.object({ connected: z.literal(false) }),
  z.object({
    connected: z.literal(true),
    /** The ntfy topic: the only thing keeping the messages from anyone else. Shown to the Student, never logged. */
    topic: z.string(),
    /** The ntfy:// link the Android app subscribes from (the QR code). */
    link: z.string(),
    problem: PhoneProblem.nullable(),
  }),
]);
export type PhoneLink = z.infer<typeof PhoneLink>;

export const phoneActions = {
  "phone.link": { input: z.object({}), output: PhoneLink },
  /** Makes a new topic (or keeps the one there is) and starts sending to it. */
  "phone.connect": { input: z.object({}), output: PhoneLink },
  /** Sends a sample message now; `problem` says if it didn't get through. */
  "phone.test": { input: z.object({}), output: PhoneLink },
  /** Puts the topic on the clipboard, for the iPhone app. */
  "phone.copy": { input: z.object({}), output: z.object({}) },
  /** Cancels everything booked ahead and forgets the topic. `cancelled` is false when ntfy couldn't be reached. */
  "phone.disconnect": { input: z.object({}), output: z.object({ cancelled: z.boolean() }) },
} as const;
