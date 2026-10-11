// The screens the window can show, as data: the window navigates with them and
// the engine names them as the target of an alert, so a click on an OS
// notification opens the right screen.
import { z } from "zod";

export const Route = z.discriminatedUnion("screen", [
  z.object({ screen: z.literal("home") }),
  z.object({ screen: z.literal("tasks") }),
  z.object({ screen: z.literal("task"), taskId: z.number() }),
  z.object({ screen: z.literal("exam"), examId: z.string() }),
  z.object({ screen: z.literal("course"), code: z.string(), tab: z.string().optional() }),
  z.object({ screen: z.literal("schedule") }),
  z.object({ screen: z.literal("presence") }),
  z.object({ screen: z.literal("grades") }),
  z.object({ screen: z.literal("plan"), tab: z.string().optional() }),
]);
export type Route = z.infer<typeof Route>;
