// What the window receives at start: everything the engine has saved, plus
// facts about this computer. Never waits on the network.
import { z } from "zod";
import { Settings, SourceStatus } from "./models";

export const DatasetPayload = z.object({ name: z.string(), value: z.unknown(), fetchedAt: z.number(), hash: z.string() });
export type DatasetPayload = z.infer<typeof DatasetPayload>;

export const Snapshot = z.object({
  version: z.string(),
  datasets: z.array(DatasetPayload),
  statuses: z.array(SourceStatus),
  settings: Settings,
});
export type Snapshot = z.infer<typeof Snapshot>;

export const AppSnapshot = Snapshot.extend({
  platform: z.enum(["darwin", "win32", "linux"]),
  /** "memory" when the OS offers no secure storage: sessions last until the app quits. */
  vault: z.enum(["encrypted", "memory"]),
});
export type AppSnapshot = z.infer<typeof AppSnapshot>;
