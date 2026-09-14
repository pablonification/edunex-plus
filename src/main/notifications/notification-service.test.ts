import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import {
  buildSingleTaskNotification,
  toInAppNotification,
  type InAppNotification,
  type OutboundNotification,
} from "../../shared/notifications";
import {
  createNotificationDeliveryLayer,
  createNotificationDeliveryService,
  createRecordingSink,
  NotificationDeliveryService,
  type NotificationSink,
} from "./sinks";
import {
  NotificationPersistenceService,
  createNotificationPersistenceService,
  type NotificationPersistenceServiceShape,
} from "./persistence";
import {
  createNotificationLayer,
  createNotificationService,
  NotificationService,
  type NotificationServiceShape,
} from "./notification-service";
import { ledgerFileFor } from "./seen-ledger";
import { presenceLedgerFileFor } from "./presence-ledger";
import { createApplicationRuntime } from "../effect/runtime";
import {
  Clock,
  ElectronPlatform,
  FileSystem,
  Path,
  Random,
} from "../platform/services";
import type {
  ClockService,
  ElectronPlatformService,
  FileSystemService,
  NotificationService as PlatformNotificationService,
  PathService,
  RandomService,
} from "../platform/services";

const ACCOUNT = "190136";
const T0 = Date.parse("2026-09-16T07:00:00.000Z");

function todoWith(ids: number[]) {
  return {
    tasks: ids.map((id) => ({
      id,
      name: `Task ${id}`,
      code: "II4091",
      course: "Final Project Proposal",
      time: "2026-09-14T23:59:00.000Z",
    })),
    exams: [],
  };
}

function meeting(id: number, startMs: number, endMs: number) {
  return {
    id,
    course_code: "II4091",
    course_name: "Final Project Proposal",
    name: `Week ${id}`,
    start_at: new Date(startMs).toISOString(),
    end_at: new Date(endMs).toISOString(),
  };
}

function harness(now = T0) {
  const files = new Map<string, string>();
  const writes: string[] = [];
  const fileSystem: FileSystemService = {
    readText: (filePath) => {
      const contents = files.get(filePath);
      if (contents === undefined) throw new Error("missing file");
      return contents;
    },
    readBytes: (filePath) => new TextEncoder().encode(fileSystem.readText(filePath)),
    writeText: (filePath, contents) => files.set(filePath, contents),
    writeBytes: (filePath, contents) =>
      files.set(filePath, new TextDecoder().decode(contents)),
    exists: (filePath) => files.has(filePath),
    remove: (filePath) => {
      files.delete(filePath);
    },
    atomicWrite: (filePath, contents) => {
      writes.push(filePath);
      files.set(filePath, contents);
    },
  };
  const path: PathService = {
    join: (...parts) => parts.join("/"),
    dirname: (filePath) => filePath.split("/").slice(0, -1).join("/"),
  };
  const clock: ClockService = {
    now: () => now,
    setTimeout: () => 0,
    clearTimeout: () => undefined,
  };
  const random: RandomService = { next: () => 0.5 };
  const persistence = createNotificationPersistenceService({
    ledgerRoot: "ledgers",
    feedRoot: "feed",
    services: { fileSystem, path, clock, random },
  });
  return { files, writes, fileSystem, path, clock, random, persistence };
}

function serviceWith(
  persistence: NotificationPersistenceServiceShape,
  sinks: readonly NotificationSink[],
  clock: ClockService,
): NotificationServiceShape {
  return createNotificationService({
    persistence,
    delivery: createNotificationDeliveryService(sinks),
    clock,
  });
}

function run<A>(effect: import("effect").Effect.Effect<A, never, never>): Promise<A> {
  return Effect.runPromise(effect);
}

describe("Effect notification service", () => {
  it("handles task events through the seam with silent baseline and digest behavior", async () => {
    const h = harness();
    const os = createRecordingSink();
    const inApp = createRecordingSink();
    const service = serviceWith(h.persistence, [os, inApp], h.clock);

    await expect(run(service.handle({
      kind: "task-sync",
      accountId: ACCOUNT,
      previous: null,
      current: todoWith([1]),
    }))).resolves.toBeNull();
    await expect(run(service.handle({
      kind: "task-sync",
      accountId: ACCOUNT,
      previous: todoWith([1]),
      current: todoWith([1, 2, 3, 4]),
    }))).resolves.toMatchObject({ kind: "digest", taskIds: ["2", "3", "4"] });

    expect(os.shown).toHaveLength(1);
    expect(inApp.shown).toHaveLength(1);
    expect(os.shown[0]).toBe(inApp.shown[0]);
  });

  it("restores Task duplicate suppression from the persisted ledger", async () => {
    const h = harness();
    const firstSink = createRecordingSink();
    const first = serviceWith(h.persistence, [firstSink], h.clock);

    await run(first.handleTaskSync(ACCOUNT, null, todoWith([1])));
    await run(first.handleTaskSync(ACCOUNT, todoWith([1]), todoWith([1, 2])));

    const restartedPersistence = createNotificationPersistenceService({
      ledgerRoot: "ledgers",
      feedRoot: "feed",
      services: { fileSystem: h.fileSystem, path: h.path, clock: h.clock, random: h.random },
    });
    const restartedSink = createRecordingSink();
    const restarted = serviceWith(restartedPersistence, [restartedSink], h.clock);

    await expect(
      run(restarted.handleTaskSync(ACCOUNT, null, todoWith([1, 2]))),
    ).resolves.toBeNull();
    await expect(
      run(restarted.handleTaskSync(ACCOUNT, todoWith([1, 2]), todoWith([1, 2, 3]))),
    ).resolves.toMatchObject({ taskIds: ["3"] });
    expect(restartedSink.shown).toHaveLength(1);
  });

  it("keeps delivery ahead of the Task ledger write", async () => {
    const h = harness();
    const observedLedgerContents: string[] = [];
    const observer: NotificationSink = {
      show: (notification) => {
        if (notification.kind !== "presence") {
          observedLedgerContents.push(
            h.files.get(ledgerFileFor("ledgers", ACCOUNT, h.path)) ?? "<missing>",
          );
        }
      },
    };
    const service = serviceWith(h.persistence, [observer], h.clock);

    await run(service.handleTaskSync(ACCOUNT, null, todoWith([1])));
    await run(service.handleTaskSync(ACCOUNT, todoWith([1]), todoWith([1, 2])));

    expect(JSON.parse(observedLedgerContents[0])).toMatchObject({
      version: 1,
      accountId: ACCOUNT,
      seenIds: ["1"],
    });
    expect(JSON.parse(h.files.get(ledgerFileFor("ledgers", ACCOUNT, h.path))!)).toMatchObject({
      seenIds: ["1", "2"],
    });
  });

  it("makes the existing delivery-before-save crash window observable across restart", async () => {
    const h = harness();
    const firstSink = createRecordingSink();
    const first = serviceWith(h.persistence, [firstSink], h.clock);

    await run(first.handleTaskSync(ACCOUNT, null, todoWith([1])));

    const ledgerPath = ledgerFileFor("ledgers", ACCOUNT, h.path);
    const atomicWrite = h.fileSystem.atomicWrite;
    h.fileSystem.atomicWrite = (filePath, contents, nonce) => {
      if (filePath === ledgerPath) throw new Error("simulated ledger crash");
      atomicWrite(filePath, contents, nonce);
    };

    await expect(
      run(first.handleTaskSync(ACCOUNT, todoWith([1]), todoWith([1, 2]))),
    ).resolves.toMatchObject({ taskIds: ["2"] });
    expect(firstSink.shown).toHaveLength(1);

    const restartedPersistence = createNotificationPersistenceService({
      ledgerRoot: "ledgers",
      feedRoot: "feed",
      services: { fileSystem: h.fileSystem, path: h.path, clock: h.clock, random: h.random },
    });
    const restartedSink = createRecordingSink();
    const restarted = serviceWith(restartedPersistence, [restartedSink], h.clock);

    // The write failed after delivery, so restart still sees the old ledger
    // and may deliver the same event once. This pins the documented window.
    await expect(
      run(restarted.handleTaskSync(ACCOUNT, null, todoWith([1, 2]))),
    ).resolves.toMatchObject({ taskIds: ["2"] });
    expect(restartedSink.shown).toHaveLength(1);
  });

  it("preserves the Presence delivery-before-save crash window across restart", async () => {
    const h = harness();
    const firstSink = createRecordingSink();
    const first = serviceWith(h.persistence, [firstSink], h.clock);
    const firstWindow = [meeting(501, T0 - 1_000, T0 + 1_000)];

    await run(first.handlePresenceSync(ACCOUNT, firstWindow));

    const presencePath = presenceLedgerFileFor("ledgers", ACCOUNT, h.path);
    const atomicWrite = h.fileSystem.atomicWrite;
    h.fileSystem.atomicWrite = (filePath, contents, nonce) => {
      if (filePath === presencePath) throw new Error("simulated Presence ledger crash");
      atomicWrite(filePath, contents, nonce);
    };

    const secondWindow = [
      ...firstWindow,
      meeting(502, T0 - 1_000, T0 + 1_000),
    ];
    await expect(run(first.handlePresenceSync(ACCOUNT, secondWindow))).resolves.toHaveLength(1);
    expect(firstSink.shown).toHaveLength(2);

    const restartedPersistence = createNotificationPersistenceService({
      ledgerRoot: "ledgers",
      feedRoot: "feed",
      services: { fileSystem: h.fileSystem, path: h.path, clock: h.clock, random: h.random },
    });
    const restartedSink = createRecordingSink();
    const restarted = serviceWith(restartedPersistence, [restartedSink], h.clock);

    await expect(
      run(restarted.handlePresenceSync(ACCOUNT, secondWindow)),
    ).resolves.toHaveLength(1);
    expect(restartedSink.shown).toHaveLength(1);
  });

  it("isolates a failing sink and still records the event and ledger", async () => {
    const h = harness();
    const received: OutboundNotification[] = [];
    const throwing: NotificationSink = { show: () => { throw new Error("sink failed"); } };
    const recording: NotificationSink = { show: (notification) => received.push(notification) };
    const service = serviceWith(h.persistence, [throwing, recording], h.clock);

    await run(service.handleTaskSync(ACCOUNT, null, todoWith([1])));
    const emitted = await run(service.handleTaskSync(ACCOUNT, todoWith([1]), todoWith([1, 2])));

    expect(emitted?.taskIds).toEqual(["2"]);
    expect(received).toHaveLength(1);
    expect(JSON.parse(h.files.get(ledgerFileFor("ledgers", ACCOUNT, h.path))!)).toMatchObject({
      seenIds: ["1", "2"],
    });
  });

  it("preserves Presence immediacy and duplicate suppression across a new service instance", async () => {
    const h = harness();
    const firstSink = createRecordingSink();
    const first = serviceWith(h.persistence, [firstSink], h.clock);
    const agenda = [
      meeting(501, T0 - 60_000, T0 + 3_600_000),
      meeting(502, T0 - 30_000, T0 + 3_600_000),
    ];

    const firstEvents = await run(first.handlePresenceSync(ACCOUNT, agenda));
    expect(firstEvents).toHaveLength(2);
    expect(firstEvents.map((event) => event.kind)).toEqual(["presence", "presence"]);
    expect(firstSink.shown).toHaveLength(2);

    const secondSink = createRecordingSink();
    const secondPersistence = createNotificationPersistenceService({
      ledgerRoot: "ledgers",
      feedRoot: "feed",
      services: { fileSystem: h.fileSystem, path: h.path, clock: h.clock, random: h.random },
    });
    const second = serviceWith(secondPersistence, [secondSink], h.clock);
    await expect(run(second.handlePresenceSync(ACCOUNT, agenda))).resolves.toEqual([]);
    expect(secondSink.shown).toHaveLength(0);
  });

  it("uses corrupt ledgers as safe empty state and rewrites them in the existing format", async () => {
    const h = harness();
    h.files.set(
      ledgerFileFor("ledgers", ACCOUNT, h.path),
      JSON.stringify({ version: 99, accountId: ACCOUNT, seenIds: ["old"] }),
    );
    h.files.set(
      presenceLedgerFileFor("ledgers", ACCOUNT, h.path),
      JSON.stringify({ version: 99, accountId: ACCOUNT, seenIds: ["old-window"] }),
    );
    const taskSink = createRecordingSink();
    const presenceSink = createRecordingSink();
    const taskService = serviceWith(h.persistence, [taskSink], h.clock);
    const presenceService = serviceWith(h.persistence, [presenceSink], h.clock);

    await expect(run(taskService.handleTaskSync(ACCOUNT, null, todoWith([1])))).resolves.toBeNull();
    await expect(
      run(presenceService.handlePresenceSync(ACCOUNT, [meeting(501, T0 - 1_000, T0 + 1_000)])),
    ).resolves.toHaveLength(1);

    expect(JSON.parse(h.files.get(ledgerFileFor("ledgers", ACCOUNT, h.path))!)).toMatchObject({
      version: 1,
      accountId: ACCOUNT,
      seenIds: ["1"],
    });
    expect(JSON.parse(h.files.get(presenceLedgerFileFor("ledgers", ACCOUNT, h.path))!)).toMatchObject({
      version: 1,
      accountId: ACCOUNT,
      seenIds: ["501"],
    });
  });

  it("persists notification history and read state through the same service seam", async () => {
    const h = harness();
    const historySink: NotificationSink = {
      show: (notification, accountId) => {
        if (accountId) {
          Effect.runSync(
            h.persistence.append(accountId, toInAppNotification(notification, "entry-1")),
          );
        }
      },
    };
    const service = serviceWith(h.persistence, [historySink], h.clock);

    await run(service.handleTaskSync(ACCOUNT, null, todoWith([1])));
    await run(service.handleTaskSync(ACCOUNT, todoWith([1]), todoWith([1, 2])));
    await expect(run(service.list(ACCOUNT))).resolves.toHaveLength(1);

    const marked = await run(service.markRead(ACCOUNT, ["entry-1"]));
    expect(marked[0]?.read).toBe(true);
    await expect(run(service.get(ACCOUNT))).resolves.toMatchObject([{ read: true }]);

    const restartedPersistence = createNotificationPersistenceService({
      ledgerRoot: "ledgers",
      feedRoot: "feed",
      services: { fileSystem: h.fileSystem, path: h.path, clock: h.clock, random: h.random },
    });
    const restarted = serviceWith(restartedPersistence, [], h.clock);
    await expect(run(restarted.markAllRead(ACCOUNT))).resolves.toMatchObject([{ read: true }]);
  });

  it("falls back safely when the persisted notification feed is corrupt", async () => {
    const h = harness();
    const feedPath = h.path.join("feed", ACCOUNT, "notifications.json");
    h.files.set(feedPath, "not-json");
    const service = serviceWith(h.persistence, [], h.clock);

    await expect(run(service.list(ACCOUNT))).resolves.toEqual([]);
    await expect(run(service.markAllRead(ACCOUNT))).resolves.toEqual([]);
  });

  it("rejects malformed history entries before they reach the persisted feed", async () => {
    const h = harness();
    const malformed = {
      id: "entry-1",
      title: "New task",
      body: "Task 1",
      taskIds: [1],
      createdAt: new Date(T0).toISOString(),
      read: false,
    } as unknown as InAppNotification;

    await expect(run(h.persistence.append(ACCOUNT, malformed))).resolves.toEqual([]);
    expect(h.files.has(h.path.join("feed", ACCOUNT, "notifications.json"))).toBe(false);
  });

  it("composes the full no-Electron service layer for event-driven tests", async () => {
    const h = harness();
    const sink = createRecordingSink();
    const layer = createNotificationLayer({
      ledgerRoot: "ledgers",
      feedRoot: "feed",
      sinks: [sink],
    }).pipe(
      Layer.provide(
        Layer.mergeAll(
          Layer.succeed(FileSystem, h.fileSystem),
          Layer.succeed(Path, h.path),
          Layer.succeed(Clock, h.clock),
          Layer.succeed(Random, h.random),
        ),
      ),
    );
    const runtime = createApplicationRuntime(layer);
    try {
      const service = runtime.runSync(Effect.service(NotificationService));
      await expect(
        runtime.runPromise(service.handleTaskSync(ACCOUNT, null, todoWith([1]))),
      ).resolves.toBeNull();
      await expect(
        runtime.runPromise(service.handleTaskSync(ACCOUNT, todoWith([1]), todoWith([1, 2]))),
      ).resolves.toMatchObject({ taskIds: ["2"] });
      expect(sink.shown).toHaveLength(1);
    } finally {
      await runtime.shutdown();
    }
  });

  it("delivers one domain notification through the platform OS port and persisted feed", async () => {
    const h = harness();
    const osOptions: Array<{ title: string; body: string }> = [];
    const broadcasts: InAppNotification[][] = [];
    let clicked: (() => void) | null = null;
    let clickedNotification: OutboundNotification | null = null;
    const fakeElectron: ElectronPlatformService = {
      createNotification: (options: { title: string; body: string }): PlatformNotificationService => {
        osOptions.push(options);
        return {
          on: (_event: "click", listener: () => void) => {
            clicked = listener;
          },
          show: () => undefined,
        };
      },
    } as unknown as ElectronPlatformService;
    const layer = createNotificationDeliveryLayer({
      createId: () => "entry-1",
      broadcast: (_accountId, entries) => broadcasts.push(entries),
      onClicked: (notification) => { clickedNotification = notification; },
    }).pipe(
      Layer.provide(
        Layer.mergeAll(
          Layer.succeed(ElectronPlatform, fakeElectron),
          Layer.succeed(NotificationPersistenceService, h.persistence),
          Layer.succeed(Clock, h.clock),
        ),
      ),
    );
    const runtime = createApplicationRuntime(layer);
    try {
      const delivery = runtime.runSync(Effect.service(NotificationDeliveryService));
      const notification = buildSingleTaskNotification(
        {
          id: "1",
          title: "Answer Task",
          courseCode: "II4091",
          courseName: "Final Project Proposal",
          dueAt: null,
        },
        new Date(T0).toISOString(),
      );

      await runtime.runPromise(delivery.deliver(ACCOUNT, notification));

      expect(osOptions).toEqual([{ title: "New task", body: "Answer Task — II4091" }]);
      await expect(run(h.persistence.list(ACCOUNT))).resolves.toMatchObject([
        { id: "entry-1", taskIds: ["1"], read: false },
      ]);
      expect(broadcasts).toHaveLength(1);
      const clickHandler = clicked;
      if (typeof clickHandler === "function") clickHandler();
      expect(clickedNotification).toBe(notification);
    } finally {
      await runtime.shutdown();
    }
  });

  it("isolates concrete OS and renderer sink failures", async () => {
    const h = harness();
    const fakeElectron: ElectronPlatformService = {
      createNotification: () => {
        throw new Error("OS unavailable");
      },
    } as unknown as ElectronPlatformService;
    const layer = createNotificationDeliveryLayer({
      createId: () => "entry-1",
      broadcast: () => {
        throw new Error("renderer unavailable");
      },
    }).pipe(
      Layer.provide(
        Layer.mergeAll(
          Layer.succeed(ElectronPlatform, fakeElectron),
          Layer.succeed(NotificationPersistenceService, h.persistence),
          Layer.succeed(Clock, h.clock),
        ),
      ),
    );
    const runtime = createApplicationRuntime(layer);
    try {
      const delivery = runtime.runSync(Effect.service(NotificationDeliveryService));
      const notification = buildSingleTaskNotification(
        {
          id: "1",
          title: "Answer Task",
          courseCode: "II4091",
          courseName: "Final Project Proposal",
          dueAt: null,
        },
        new Date(T0).toISOString(),
      );

      await expect(runtime.runPromise(delivery.deliver(ACCOUNT, notification))).resolves.toBeUndefined();
      await expect(run(h.persistence.list(ACCOUNT))).resolves.toMatchObject([
        { id: "entry-1", taskIds: ["1"], read: false },
      ]);
    } finally {
      await runtime.shutdown();
    }
  });

  it("composes the production notification graph against replaceable platform ports", async () => {
    const h = harness();
    const osOptions: Array<{ title: string; body: string }> = [];
    const fakeElectron: ElectronPlatformService = {
      createNotification: (options: { title: string; body: string }): PlatformNotificationService => {
        osOptions.push(options);
        return {
          on: (_event: "click", _listener: () => void) => undefined,
          show: () => undefined,
        };
      },
    } as unknown as ElectronPlatformService;
    const layer = createNotificationLayer({
      ledgerRoot: "ledgers",
      feedRoot: "feed",
    }).pipe(
      Layer.provide(
        Layer.mergeAll(
          Layer.succeed(FileSystem, h.fileSystem),
          Layer.succeed(Path, h.path),
          Layer.succeed(Clock, h.clock),
          Layer.succeed(Random, h.random),
          Layer.succeed(ElectronPlatform, fakeElectron),
        ),
      ),
    );
    const runtime = createApplicationRuntime(layer);
    try {
      const service = runtime.runSync(Effect.service(NotificationService));
      await runtime.runPromise(service.handleTaskSync(ACCOUNT, null, todoWith([1])));
      await runtime.runPromise(
        service.handleTaskSync(ACCOUNT, todoWith([1]), todoWith([1, 2])),
      );

      expect(osOptions).toEqual([{ title: "New task", body: "Task 2 — II4091" }]);
      await expect(runtime.runPromise(service.list(ACCOUNT))).resolves.toMatchObject([
        { taskIds: ["2"], read: false },
      ]);
    } finally {
      await runtime.shutdown();
    }
  });

  it("does not emit for an accountless event", async () => {
    const h = harness();
    const sink = createRecordingSink();
    const service = serviceWith(h.persistence, [sink], h.clock);

    await expect(run(service.handleTaskSync(null, null, todoWith([1])))).resolves.toBeNull();
    await expect(run(service.handlePresenceSync(null, [meeting(501, T0 - 1_000, T0 + 1_000)]))).resolves.toEqual([]);
    expect(sink.shown).toHaveLength(0);
  });
});
