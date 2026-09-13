import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createPresenceNotifier } from "./presence-notifier";
import { createInAppSink, createRecordingSink } from "./sinks";
import { createNotificationStore } from "./notification-store";
import { presenceDestinationFor } from "../../shared/notifications";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "edunex-presence-"));
  roots.push(root);
  return root;
}

const T0 = Date.parse("2026-09-16T07:00:00.000Z");

function meeting(id: number, startMs: number, endMs: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    type: "offline",
    course_code: "II4091",
    course_name: "Final Project Proposal",
    name: `Week ${id}`,
    start_at: new Date(startMs).toISOString(),
    end_at: new Date(endMs).toISOString(),
    ...extra,
  };
}

describe("presence notifier", () => {
  it("fires one immediate alert per newly opened window — never a digest", () => {
    const root = tempRoot();
    const osSink = createRecordingSink();
    const appSink = createRecordingSink();
    const notifier = createPresenceNotifier({
      ledgerRoot: root,
      sinks: [osSink, appSink],
      now: () => T0,
    });

    const emitted = notifier.handleSync("190136", [
      meeting(501, T0 - 60_000, T0 + 3_600_000),
      meeting(502, T0 - 30_000, T0 + 3_600_000),
    ]);

    expect(emitted).toHaveLength(2);
    expect(emitted.map((n) => n.kind)).toEqual(["presence", "presence"]);
    expect(emitted.map((n) => n.presenceIds)).toEqual([["501"], ["502"]]);
    // Immediate, uncoalesced: each sink shows one OS notification per window.
    expect(osSink.shown).toHaveLength(2);
    expect(appSink.shown).toHaveLength(2);
    expect(presenceDestinationFor(emitted[0])).toEqual({
      view: "agenda",
      taskId: null,
      presenceId: "501",
    });
  });

  it("alerts each window at most once, across ticks and restarts", () => {
    const root = tempRoot();
    const firstSink = createRecordingSink();
    const first = createPresenceNotifier({ ledgerRoot: root, sinks: [firstSink], now: () => T0 });
    const agenda = [meeting(501, T0 - 60_000, T0 + 3_600_000)];

    expect(first.handleSync("190136", agenda)).toHaveLength(1);
    // Same tick again, and a later tick while still open: silent.
    expect(first.handleSync("190136", agenda)).toHaveLength(0);
    expect(firstSink.shown).toHaveLength(1);

    // Restart with a fresh notifier on the same persisted ledger: silent.
    const secondSink = createRecordingSink();
    const second = createPresenceNotifier({ ledgerRoot: root, sinks: [secondSink], now: () => T0 + 60_000 });
    expect(second.handleSync("190136", agenda)).toHaveLength(0);
    expect(secondSink.shown).toHaveLength(0);
  });

  it("stays silent for future and closed windows, and without an account", () => {
    const root = tempRoot();
    const sink = createRecordingSink();
    const notifier = createPresenceNotifier({ ledgerRoot: root, sinks: [sink], now: () => T0 });

    expect(
      notifier.handleSync("190136", [meeting(501, T0 + 60_000, T0 + 3_660_000)]),
    ).toEqual([]);
    expect(
      notifier.handleSync("190136", [meeting(502, T0 - 7_200_000, T0 - 3_600_000)]),
    ).toEqual([]);
    expect(notifier.handleSync(null, [meeting(503, T0 - 60_000, T0 + 3_600_000)])).toEqual([]);
    expect(sink.shown).toHaveLength(0);
  });

  it("persists a presence-kind fallback entry through the in-app sink", () => {
    const root = tempRoot();
    const feedRoot = tempRoot();
    const broadcasts: unknown[] = [];
    const inApp = createInAppSink({
      storeFor: (accountId) => createNotificationStore(feedRoot, accountId),
      getAccountId: () => "190136",
      broadcast: (_accountId, entries) => void broadcasts.push(entries),
      createId: () => "presence-entry-1",
    });
    const notifier = createPresenceNotifier({
      ledgerRoot: root,
      sinks: [inApp],
      now: () => T0,
    });

    notifier.handleSync("190136", [meeting(501, T0 - 60_000, T0 + 3_600_000)]);

    const entries = createNotificationStore(feedRoot, "190136").list();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: "presence-entry-1",
      title: "Presence open",
      taskIds: [],
      presenceIds: ["501"],
      kind: "presence",
      read: false,
    });
    expect(entries[0].body).toContain("Week 501");
    expect(broadcasts).toHaveLength(1);
  });
});
