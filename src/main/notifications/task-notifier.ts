import { buildTaskNotification, type NewTaskInfo, type TaskNotification } from "../../shared/notifications";
import { diffNewTasks, extractTodoTasks } from "./task-detector";
import { createSeenLedger, type SeenLedger } from "./seen-ledger";
import { createFanoutSink } from "./sinks";
import type { NotificationSink } from "./sinks";
import { systemClock } from "../platform/node";
import type { ClockService } from "../platform/services";

export interface TaskNotifierOptions {
  ledgerRoot: string;
  sinks: NotificationSink[];
  now?: () => number;
  clock?: ClockService;
  persistence?: import("./seen-ledger").SeenLedgerServices;
  ledgerFor?: (accountId: string) => SeenLedger;
}

export interface TaskNotifier {
  /**
   * Handles one synced `/todo` payload pair. Returns the dispatched
   * notification (single or digest) or null when nothing was emitted —
   * silent first-sync baseline, no new ids, or no signed-in account.
   */
  handleSync(
    accountId: string | null,
    prevData: unknown,
    nextData: unknown,
  ): TaskNotification | null;
}

/**
 * New-Task detection owner (#23). The sync tick calls handleSync with the
 * pre-write cache snapshot and the freshly fetched payload; this module
 * owns the silent-baseline rule, the tick-burst digest rule, the ledger
 * write, and the fan-out to both sinks.
 */
export function createTaskNotifier(options: TaskNotifierOptions): TaskNotifier {
  const now = options.now ?? (() => options.clock?.now() ?? systemClock.now());
  const ledgers = new Map<string, SeenLedger>();

  function ledgerFor(accountId: string): SeenLedger {
    if (options.ledgerFor) return options.ledgerFor(accountId);
    let ledger = ledgers.get(accountId);
    if (!ledger) {
      ledger = createSeenLedger(options.ledgerRoot, accountId, options.persistence);
      ledgers.set(accountId, ledger);
    }
    return ledger;
  }

  return {
    handleSync(accountId, prevData, nextData) {
      if (!accountId) return null;
      let ledger: SeenLedger;
      try {
        ledger = ledgerFor(accountId);
      } catch (error) {
        console.error("[notifications] ledger load failed:", error);
        return null;
      }

      const current = extractTodoTasks(nextData);
      // The ledger is the cross-restart truth; the cache diff is the
      // per-tick truth. Union them so a cache wipe can't replay history.
      const seenIds = new Set<string>();
      for (const task of extractTodoTasks(prevData)) seenIds.add(task.id);
      for (const task of current) {
        if (ledger.has(task.id)) seenIds.add(task.id);
      }

      if (!ledger.initialized) {
        // Silent first-sync baseline: learn every current id, emit nothing.
        try {
          ledger.add(current.map((task) => task.id));
          ledger.save();
        } catch (error) {
          console.error("[notifications] baseline save failed:", error);
        }
        return null;
      }

      let fresh: NewTaskInfo[];
      try {
        fresh = diffNewTasks(prevData, nextData, seenIds);
      } catch (error) {
        console.error("[notifications] diff failed:", error);
        return null;
      }
      if (fresh.length === 0) return null;

      const notification = buildTaskNotification(fresh, new Date(now()).toISOString());
      if (!notification) return null;

      createFanoutSink(options.sinks).show(notification);

      try {
        // Persist every id now on disk, not just the fresh ones, so a task
        // that arrived during a failed sink write still can't replay.
        ledger.add(current.map((task) => task.id));
        ledger.save();
      } catch (error) {
        console.error("[notifications] ledger save failed:", error);
      }

      return notification;
    },
  };
}
