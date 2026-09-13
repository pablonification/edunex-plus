import { buildPresenceNotification, type PresenceNotification } from "../../shared/notifications";
import { extractPresenceWindows, openWindows } from "./presence-detector";
import { createPresenceLedger, type PresenceLedger } from "./presence-ledger";
import { createFanoutSink, type NotificationSink } from "./sinks";

export interface PresenceNotifierOptions {
  ledgerRoot: string;
  sinks: NotificationSink[];
  now?: () => number;
  ledgerFor?: (accountId: string) => PresenceLedger;
}

export interface PresenceNotifier {
  /**
   * Handles one synced agenda/presence payload. Returns one immediate
   * notification per newly opened window (never a digest) — empty when
   * nothing opened or no signed-in account. Each window alerts at most
   * once; the ledger persists that across restarts.
   */
  handleSync(
    accountId: string | null,
    data: unknown,
  ): PresenceNotification[];
}

/**
 * Presence-open alert owner (#24). The sync tick calls handleSync with the
 * freshly fetched agenda payload; this module owns the open-clock check,
 * the at-most-once ledger, and the immediate fan-out to both sinks.
 * OS Do-Not-Disturb governs quiet time — the app implements no quiet hours.
 */
export function createPresenceNotifier(options: PresenceNotifierOptions): PresenceNotifier {
  const now = options.now ?? Date.now;
  const ledgers = new Map<string, PresenceLedger>();

  function ledgerFor(accountId: string): PresenceLedger {
    if (options.ledgerFor) return options.ledgerFor(accountId);
    let ledger = ledgers.get(accountId);
    if (!ledger) {
      ledger = createPresenceLedger(options.ledgerRoot, accountId);
      ledgers.set(accountId, ledger);
    }
    return ledger;
  }

  return {
    handleSync(accountId, data) {
      if (!accountId) return [];
      let ledger: PresenceLedger;
      try {
        ledger = ledgerFor(accountId);
      } catch (error) {
        console.error("[notifications] presence ledger load failed:", error);
        return [];
      }

      let open: ReturnType<typeof openWindows>;
      try {
        open = openWindows(extractPresenceWindows(data), now());
      } catch (error) {
        console.error("[notifications] presence diff failed:", error);
        return [];
      }

      const fresh = open.filter((window) => !ledger.has(window.id));
      if (fresh.length === 0) return [];

      const createdAt = new Date(now()).toISOString();
      const emitted: PresenceNotification[] = [];
      const fanout = createFanoutSink(options.sinks);
      for (const window of fresh) {
        const notification = buildPresenceNotification(window, createdAt);
        fanout.show(notification);
        emitted.push(notification);
      }

      try {
        // Persist only notified ids: closed windows never notify and need
        // no ledger entry; notified windows must never replay.
        ledger.add(fresh.map((window) => window.id));
        ledger.save();
      } catch (error) {
        console.error("[notifications] presence ledger save failed:", error);
      }

      return emitted;
    },
  };
}
