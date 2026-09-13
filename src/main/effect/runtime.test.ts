import { expect, it } from "@effect/vitest";
import { Cause, Context, Effect, Exit, Layer, Schema } from "effect";
import {
  ApplicationRuntimeInfo,
  EFFECT_RUNTIME_VERSION,
  composeApplicationLayer,
  createApplicationRuntime,
} from "./runtime";
import {
  BoundaryValidationError,
  SensitiveStringSchema,
  decodeBoundary,
  formatSafeCause,
  safeCause,
  sensitiveString,
} from "../../shared/effect";

const SmokeResource = Context.Service<{ readonly value: string }>(
  "EdunexPlus/RuntimeSmokeResource",
);

it("provides the foundation service through the managed layer", async () => {
  const runtime = createApplicationRuntime();
  const info = await runtime.runPromise(
    Effect.gen(function* () {
      return yield* ApplicationRuntimeInfo;
    }),
  );
  await runtime.shutdown();

  expect(info.applicationName).toBe("Edunex Plus");
  expect(info.effectVersion).toBe(EFFECT_RUNTIME_VERSION);
});

it("releases resources and interrupts runtime-owned fibers on shutdown", async () => {
  const events: string[] = [];
  const resourceLayer = Layer.effect(
    SmokeResource,
    Effect.acquireRelease(
      Effect.sync(() => {
        events.push("acquire");
        return { value: "ready" };
      }),
      () => Effect.sync(() => events.push("release")),
    ),
  );
  const runtime = createApplicationRuntime(composeApplicationLayer(resourceLayer));

  const fiber = await runtime.fork(Effect.never);
  expect(fiber.pollUnsafe()).toBeUndefined();
  await runtime.runPromise(
    Effect.gen(function* () {
      const resource = yield* SmokeResource;
      expect(resource.value).toBe("ready");
    }),
  );

  await runtime.shutdown();
  await runtime.shutdown();

  const exit = fiber.pollUnsafe();
  expect(exit).toBeDefined();
  expect(Exit.isFailure(exit!)).toBe(true);
  if (Exit.isFailure(exit!)) expect(Cause.hasInterrupts(exit!.cause)).toBe(true);
  expect(events).toEqual(["acquire", "release"]);
  expect(runtime.isShutdown()).toBe(true);
});

it.effect("keeps boundary errors and causes safe", () =>
  Effect.gen(function* () {
    const valid = yield* decodeBoundary(
      Schema.Struct({ id: Schema.String }),
      { id: "task-1" },
      "ipc",
      "task.read",
    );
    expect(valid.id).toBe("task-1");

    const invalid = yield* Effect.exit(
      decodeBoundary(Schema.Struct({ id: Schema.String }), { id: 42 }, "ipc", "task.read"),
    );
    expect(Exit.isFailure(invalid)).toBe(true);
    if (Exit.isFailure(invalid)) {
      expect(invalid.cause.reasons[0]).toMatchObject({
        _tag: "Fail",
        error: expect.any(BoundaryValidationError),
      });
      expect(formatSafeCause(invalid.cause)).toBe("Failure(BoundaryValidationError)");
      expect(JSON.stringify(safeCause(invalid.cause))).not.toContain("bearer-secret");
    }

    const secret = sensitiveString("bearer-secret");
    expect(String(secret)).toBe("<redacted>");
    expect(JSON.stringify(secret)).not.toContain("bearer-secret");
    expect(() => Schema.encodeSync(SensitiveStringSchema)(secret)).toThrow();
  }),
);
