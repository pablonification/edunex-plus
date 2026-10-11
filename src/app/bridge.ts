// The window's only way to talk to the engine: actions (ask, get an answer or
// a typed error) and events (the engine tells). Both directions are checked
// against the shared contract.
import { Actions, Event, type ActionInput, type ActionName, type ActionOutput, type ActionResult, type ErrorKind } from "../core/contract";

/** What the preload exposes on window.edunexPlus. */
export interface BridgeApi {
  invoke(name: string, input: unknown): Promise<unknown>;
  onEvent(listener: (event: unknown) => void): () => void;
  /** How far the development demo's clock is ahead of real time (ms); 0 in the real app. */
  clockOffset?: number;
}

declare global {
  interface Window {
    edunexPlus?: BridgeApi;
  }
}

export class ActionError extends Error {
  constructor(
    readonly kind: ErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "ActionError";
  }
}

export interface Bridge {
  invoke<N extends ActionName>(name: N, input: ActionInput<N>): Promise<ActionOutput<N>>;
  onEvent(listener: (event: Event) => void): () => void;
}

export function createBridge(api: BridgeApi): Bridge {
  return {
    async invoke(name, input) {
      const result = (await api.invoke(name, input)) as ActionResult<unknown> | undefined;
      if (!result || typeof result !== "object") throw new ActionError("Failed", `No answer for ${name}`);
      if (!result.ok) throw new ActionError(result.error.kind, result.error.message);
      const parsed = Actions[name].output.safeParse(result.value);
      if (!parsed.success) throw new ActionError("Failed", `Unexpected answer for ${name}`);
      return parsed.data as ActionOutput<typeof name>;
    },
    onEvent(listener) {
      return api.onEvent((raw) => {
        const parsed = Event.safeParse(raw);
        if (parsed.success) listener(parsed.data);
        else console.warn("[bridge] ignored an event that doesn't match the contract");
      });
    },
  };
}
