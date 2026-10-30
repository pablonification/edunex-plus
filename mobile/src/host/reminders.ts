// Timed alerts booked with Android ahead of time, so they arrive with the app closed (./booking.ts
// says what to book, cancel and skip). The engine hands over its plan at every replan (a sync, a
// setting, a snooze, a Task handed in, the 5-minute check, a background wake), and every alert it
// raises live comes through here first: one Android showed already isn't shown twice. One thing
// at a time, in order; what's booked is kept on disk ("reminders.json") for the next app run.
import * as Notifications from "expo-notifications";
import type { Lang } from "../../../src/core/models";
import type { AlertNotice } from "../../../src/engine/alerts/center";
import type { PlannedAlert } from "../../../src/engine/alerts/detector";
import { type AreaLog, errorLine } from "../../../src/engine/app-log";
import type { Clock } from "../../../src/engine/clock";
import type { Storage } from "../../../src/engine/store/storage";
import { type Booked, liveCheck, readBooked, rebook, writeBooked } from "./booking";
import { channelsReady } from "./notifier";

const FILE = "reminders.json";

export interface PhoneReminders {
  /** The engine's plan, still to come: booked again. */
  upcoming(planned: readonly PlannedAlert[]): void;
  /** An alert the engine raised live: shown, unless Android showed it already. */
  deliver(notice: AlertNotice): void;
  /** Done with what's being booked or shown now (a background wake waits for it). */
  settled(): Promise<void>;
  /** Signing out of everything: Android's bookings went with it (host.ts cancels them all). */
  forget(): void;
}

export function phoneReminders(deps: {
  storage: Storage;
  clock: Clock;
  lang(): Lang;
  show(notice: AlertNotice): Promise<boolean>;
  log?: AreaLog;
}): PhoneReminders {
  let booked: Booked | null = null;
  let latest: readonly PlannedAlert[] | null = null;
  let queued = false;
  let work: Promise<unknown> = Promise.resolve();

  const inOrder = (job: () => Promise<unknown>) => {
    work = work.then(job).catch((error: unknown) => {
      // Booking that fails must never stop the alerts in the app: the next replan tries again.
      console.error("[reminders] failed:", error);
      deps.log?.("error", `booking ahead failed: ${errorLine(error)}`);
    });
  };
  const load = async () => {
    booked ??= readBooked(await deps.storage.read(FILE).catch(() => null));
    return booked;
  };
  const waiting = async () => new Set((await Notifications.getAllScheduledNotificationsAsync()).map((request) => request.identifier));

  /** Cancels what left the plan and books what's new or changed, with the latest plan. */
  const round = async () => {
    queued = false;
    const planned = latest;
    if (!planned) return;
    // Notifications off: nothing is booked (Android would drop it), so nothing live is skipped either.
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    const lang = deps.lang();
    const now = deps.clock.now();
    const plan = rebook({ planned, booked: await load(), waiting: await waiting(), now, lang });
    // Android books on its own clock: the same time ahead of now. They're one clock but in the demo, whose day is its own.
    const ahead = Date.now() - now;
    for (const id of plan.cancel) await Notifications.cancelScheduledNotificationAsync(id);
    const kept: Booked = { ...plan.kept };
    try {
      if (plan.book.length) await channelsReady(lang);
      for (const { id, at, content, booking } of plan.book) {
        await Notifications.scheduleNotificationAsync({
          identifier: id,
          content: { title: content.title, body: content.body, data: content.data as unknown as Record<string, unknown> },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at + ahead, channelId: content.channelId },
        });
        kept[id] = booking;
      }
    } finally {
      booked = kept;
      await deps.storage.write(FILE, writeBooked(kept));
    }
  };

  return {
    upcoming(planned) {
      latest = planned;
      if (queued) return;
      queued = true;
      inOrder(round);
    },

    deliver(notice) {
      inOrder(async () => {
        const current = await load();
        const check = notice.ids.some((id) => Object.hasOwn(current, id)) ? liveCheck(notice, current, await waiting()) : { show: true, cancel: [] };
        for (const id of check.cancel) await Notifications.cancelScheduledNotificationAsync(id);
        if (check.show) await deps.show(notice);
      });
    },

    async settled() {
      let seen: Promise<unknown>;
      do {
        seen = work;
        await seen;
      } while (seen !== work);
    },

    forget() {
      booked = {};
      latest = null;
    },
  };
}
