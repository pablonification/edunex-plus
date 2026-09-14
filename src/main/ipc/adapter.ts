import type { ApplicationRuntime } from "../effect/runtime";
import { decodeBoundary, formatSafeCause } from "../effect/conventions";
import { effectRuntime } from "../effect/effect-runtime";
import type { IpcEventService, IpcMainService } from "../platform/services";

/** Context supplied to every IPC operation after the Electron event has been
 * reduced to the small data a service is allowed to observe. */
export interface IpcRequestContext {
  readonly channel: string;
  readonly sender: unknown;
  readonly event: IpcEventService;
}

export interface IpcOperation {
  readonly channel: string;
  readonly operation: string;
  /** Effect Schema value used for decoding the untrusted renderer input. */
  readonly inputSchema: unknown;
  /** Effect Schema value used for encoding the renderer response. */
  readonly outputSchema: unknown;
  /** Converts Electron's variadic invoke arguments to one schema input. */
  readonly decodeArgs?: (args: readonly unknown[]) => unknown;
  readonly handle: (
    input: unknown,
    context: IpcRequestContext,
  ) => unknown | Promise<unknown>;
  /** Safe contract-preserving result for malformed input. */
  readonly onInvalidInput: (context: IpcRequestContext) => unknown;
  /** Safe contract-preserving result for an unexpected service failure. */
  readonly onFailure: (context: IpcRequestContext, input?: unknown) => unknown;
}

export interface IpcAdapter {
  unregister(): void;
}

export interface IpcAdapterOptions {
  readonly ipcMain: IpcMainService;
  readonly runtime: ApplicationRuntime<never, never>;
}

/**
 * Registers the complete main-process request surface through one boundary.
 * Inputs are `unknown` until schema-decoded, outputs are schema-encoded, and
 * neither parse diagnostics nor internal Effect errors cross into the
 * renderer. The adapter also supplies the sender/channel context to handlers
 * so a future operation cannot accidentally rely on ambient globals.
 */
export function registerIpcOperations(
  operations: readonly IpcOperation[],
  options: IpcAdapterOptions,
): IpcAdapter {
  const channels = new Set<string>();
  for (const operation of operations) {
    if (channels.has(operation.channel)) {
      throw new Error(`Duplicate IPC channel: ${operation.channel}`);
    }
    channels.add(operation.channel);
  }

  const registered: IpcOperation[] = [];
  try {
    for (const operation of operations) {
      options.ipcMain.handle(operation.channel, (event, ...args) =>
        invokeOperation(operation, event, args, options),
      );
      registered.push(operation);
    }
  } catch (cause) {
    for (const operation of registered.reverse()) {
      try {
        options.ipcMain.removeHandler(operation.channel);
      } catch {
        // Preserve the registration failure while still attempting every
        // owned handler's cleanup.
      }
    }
    throw cause;
  }

  let unregistered = false;

  return {
    unregister() {
      if (unregistered) return;
      unregistered = true;
      for (const operation of operations) {
        try {
          options.ipcMain.removeHandler(operation.channel);
        } catch {
          // One stale handler must not prevent the remaining owned channels
          // from being released during process shutdown.
        }
      }
    },
  };
}

async function invokeOperation(
  operation: IpcOperation,
  event: IpcEventService,
  args: readonly unknown[],
  options: IpcAdapterOptions,
): Promise<unknown> {
  const context: IpcRequestContext = {
    channel: operation.channel,
    sender: event.sender,
    event,
  };

  let input: unknown;
  try {
    const rawInput = operation.decodeArgs ? operation.decodeArgs(args) : defaultInput(args);
    input = await options.runtime.runPromise(
      decodeBoundary(
        operation.inputSchema as never,
        rawInput,
        "ipc",
        operation.operation,
      ) as never,
    );
  } catch (cause) {
    // Decode errors are deliberately logged only as their safe operation name.
    // The renderer gets the established method-specific fallback instead.
    logIpcFailure(operation, cause);
    return encodeFallback(operation, safeFallback(operation, context, "invalid"), context, options);
  }

  let result: unknown;
  try {
    result = await operation.handle(input, context);
  } catch (cause) {
    logIpcFailure(operation, cause);
    result = safeFallback(operation, context, "failure", input);
  }

  try {
    return await options.runtime.runPromise(
      effectRuntime.Schema.encodeUnknownEffect(operation.outputSchema as never)(result) as never,
    );
  } catch (cause) {
    logIpcFailure(operation, cause);
    return encodeFallback(
      operation,
      safeFallback(operation, context, "failure", input),
      context,
      options,
    );
  }
}

async function encodeFallback(
  operation: IpcOperation,
  fallback: unknown,
  _context: IpcRequestContext,
  options: IpcAdapterOptions,
): Promise<unknown> {
  try {
    return await options.runtime.runPromise(
      effectRuntime.Schema.encodeUnknownEffect(operation.outputSchema as never)(fallback) as never,
    );
  } catch (cause) {
    logIpcFailure(operation, cause);
    // A schema-authoring mistake must still never expose an internal failure.
    return undefined;
  }
}

function defaultInput(args: readonly unknown[]): unknown {
  if (args.length === 0) return undefined;
  if (args.length === 1) return args[0];
  return [...args];
}

function safeFallback(
  operation: IpcOperation,
  context: IpcRequestContext,
  kind: "invalid" | "failure",
  input?: unknown,
): unknown {
  try {
    return kind === "invalid"
      ? operation.onInvalidInput(context)
      : operation.onFailure(context, input);
  } catch {
    return undefined;
  }
}

function logIpcFailure(operation: IpcOperation, cause: unknown): void {
  try {
    if (cause && typeof cause === "object" && "cause" in cause) {
      console.error(`[ipc] ${operation.operation} failed:`, formatSafeCause(cause.cause as never));
    } else {
      console.error(`[ipc] ${operation.operation} failed`);
    }
  } catch {
    console.error(`[ipc] ${operation.operation} failed`);
  }
}
