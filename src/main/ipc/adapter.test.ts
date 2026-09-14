import { expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { composeApplicationLayer, createApplicationRuntime } from "../effect/runtime";
import type { IpcEventService, IpcHandlerService, IpcMainService } from "../platform/services";
import { IpcMain } from "../platform/services";
import { registerIpcOperations } from "./adapter";

it("decodes requests, passes sender context, encodes responses, and unregisters", async () => {
  const handlers = new Map<string, IpcHandlerService>();
  const removed: string[] = [];
  const ipcMain: IpcMainService = {
    handle(channel, handler) {
      handlers.set(channel, handler);
    },
    removeHandler(channel) {
      removed.push(channel);
      handlers.delete(channel);
    },
  };
  const runtime = createApplicationRuntime();
  const senders: unknown[] = [];
  const adapter = registerIpcOperations(
    [
      {
        channel: "test:echo",
        operation: "test.echo",
        inputSchema: Schema.Struct({ value: Schema.String }),
        outputSchema: Schema.Struct({ value: Schema.String }),
        handle: (input, context) => {
          senders.push(context.sender);
          return input;
        },
        onInvalidInput: () => ({ value: "invalid" }),
        onFailure: () => ({ value: "failed" }),
      },
      {
        channel: "test:failure",
        operation: "test.failure",
        inputSchema: Schema.String,
        outputSchema: Schema.Struct({ value: Schema.String }),
        handle: () => {
          throw new Error("private failure details");
        },
        onInvalidInput: () => ({ value: "invalid" }),
        onFailure: () => ({ value: "safe" }),
      },
    ],
    { ipcMain, runtime },
  );

  const event: IpcEventService = { sender: "renderer-1", channel: "test:echo" };
  await expect(handlers.get("test:echo")!(event, { value: "ok" })).resolves.toEqual({
    value: "ok",
  });
  await expect(handlers.get("test:echo")!(event, { value: 42 })).resolves.toEqual({
    value: "invalid",
  });
  await expect(handlers.get("test:failure")!(event, "ok")).resolves.toEqual({ value: "safe" });
  expect(senders).toEqual(["renderer-1"]);

  adapter.unregister();
  await runtime.shutdown();
  expect(removed).toEqual(["test:echo", "test:failure"]);
});

it("converts decoder failures into the operation fallback", async () => {
  const handlers = new Map<string, IpcHandlerService>();
  const ipcMain: IpcMainService = {
    handle: (channel, handler) => handlers.set(channel, handler),
  };
  const runtime = createApplicationRuntime();
  const adapter = registerIpcOperations(
    [
      {
        channel: "test:decode-failure",
        operation: "test.decode-failure",
        inputSchema: Schema.String,
        outputSchema: Schema.Struct({ ok: Schema.Boolean }),
        decodeArgs: () => {
          throw new Error("private decoder details");
        },
        handle: () => ({ ok: true }),
        onInvalidInput: () => ({ ok: false }),
        onFailure: () => ({ ok: false }),
      },
    ],
    { ipcMain, runtime },
  );

  await expect(handlers.get("test:decode-failure")!({ sender: "renderer" }, "input")).resolves.toEqual({
    ok: false,
  });

  adapter.unregister();
  await runtime.shutdown();
});

it("can resolve the IPC implementation from an Effect service Layer", async () => {
  const handlers = new Map<string, IpcHandlerService>();
  const service: IpcMainService = {
    handle: (channel, handler) => handlers.set(channel, handler),
  };
  const runtime = createApplicationRuntime(
    composeApplicationLayer(Layer.succeed(IpcMain, service)),
  );
  const ipcMain = await runtime.runPromise(
    Effect.gen(function* () {
      return yield* IpcMain;
    }),
  );
  const adapter = registerIpcOperations(
    [
      {
        channel: "test:layered",
        operation: "test.layered",
        inputSchema: Schema.String,
        outputSchema: Schema.String,
        handle: (input) => input,
        onInvalidInput: () => "invalid",
        onFailure: () => "failed",
      },
    ],
    { ipcMain, runtime },
  );

  await expect(handlers.get("test:layered")!({ sender: "renderer" }, "ok")).resolves.toBe("ok");

  adapter.unregister();
  await runtime.shutdown();
});
