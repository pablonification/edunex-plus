import type { ChatGptStatus } from "../../core/actions/chatgpt";
import type { Vault } from "../../engine/store/storage";
import { type ChatGptConfig, ChatGptIdentity } from "./signin";

const KEY = "chatgpt.identity";

/** Owns one local identity; serialized writes make sign-out win over an in-flight sign-in. */
export function createChatGptConnection(options: {
  config: ChatGptConfig | null;
  vault: Vault;
  signIn(signal: AbortSignal): Promise<ChatGptIdentity>;
  changed?(status: ChatGptStatus): void;
}) {
  let pending: AbortController | null = null;
  let writes: Promise<void> = Promise.resolve();
  const write = (operation: () => Promise<void>) => {
    const result = writes.then(operation);
    writes = result.catch(() => undefined);
    return result;
  };
  const status = async (): Promise<ChatGptStatus> => {
    await writes;
    const saved = await options.vault.get(KEY);
    let name: string | null = null;
    try {
      const identity = ChatGptIdentity.parse(JSON.parse(saved ?? "null"));
      if (identity.clientId === options.config?.clientId) name = identity.name;
    } catch {
      /* No identity, or saved by an incompatible version. */
    }
    return { available: options.config !== null, connecting: pending !== null, name };
  };
  const publish = async () => {
    const next = await status();
    options.changed?.(next);
    return next;
  };
  return {
    status,
    async connect(): Promise<ChatGptStatus> {
      if (!options.config || pending) throw new Error("ChatGPT sign-in unavailable");
      const attempt = new AbortController();
      pending = attempt;
      const timeout = setTimeout(() => attempt.abort(), 10 * 60_000);
      try {
        const identity = await options.signIn(attempt.signal);
        await write(async () => {
          attempt.signal.throwIfAborted();
          await options.vault.set(KEY, JSON.stringify(ChatGptIdentity.parse(identity)));
        });
      } finally {
        clearTimeout(timeout);
        if (pending === attempt) pending = null;
        await publish();
      }
      return status();
    },
    async disconnect(): Promise<ChatGptStatus> {
      pending?.abort();
      pending = null;
      await write(() => options.vault.delete(KEY));
      return publish();
    },
  };
}
