// Reading Edunex and SIX while the app is closed: Android's WorkManager wakes the app every 15
// minutes or so (expo-background-task), the engine reads what's due, and its alerts go out as
// notifications, as the desktop's tray does all day. With the app open it's a plain refresh.
// The demo never runs it: its world is make-believe.
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { AppState } from "react-native";
import { GROUP_WINDOW } from "../../../src/engine/alerts/center";
import { host } from "./host";
import { DEMO } from "./version";
import { updateWidgets } from "./widget";

export const SYNC_TASK = "edunex-plus.sync";
/** Android won't wake an app sooner than every 15 minutes. */
const EVERY_MINUTES = 15;

if (!DEMO)
  TaskManager.defineTask(SYNC_TASK, async () => {
    try {
      console.info("[background] sync starts");
      const current = await host();
      if (current.running()) {
        await current.engine.refresh();
        await current.reminders.settled();
        console.info("[background] synced, the app open");
        return BackgroundTask.BackgroundTaskResult.Success;
      }
      // Woken with the app closed: one round of every feed that's due (a feed already running isn't run twice),
      // then long enough for alerts that wait to be grouped to go out, then quiet again.
      // Each step in the system log ("[background] …"), so a sync that stops says where.
      console.info("[background] woken, the app closed");
      current.start();
      await current.engine.refresh();
      console.info("[background] read");
      await new Promise((resolve) => setTimeout(resolve, GROUP_WINDOW + 5_000));
      // What this round planned is booked with Android before the app goes quiet (./reminders.ts).
      await current.reminders.settled();
      console.info("[background] reminders booked");
      // The home-screen widget shows what this round read.
      await updateWidgets(current).catch(() => undefined);
      // The Student opened the app meanwhile: its screens keep the feeds going.
      if (AppState.currentState !== "active") current.stop();
      console.info("[background] synced, the app closed");
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (error) {
      console.error("[background] sync failed:", error);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });

/** Asks Android to wake the app for syncing; once is enough, it survives restarts. */
export async function scheduleBackgroundSync(): Promise<void> {
  if (DEMO) return;
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
  if (await TaskManager.isTaskRegisteredAsync(SYNC_TASK)) return;
  await BackgroundTask.registerTaskAsync(SYNC_TASK, { minimumInterval: EVERY_MINUTES });
}
