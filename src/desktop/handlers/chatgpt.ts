import { EngineError } from "../../engine/errors";
import type { HandlerGroup } from "./context";

export const chatgptHandlers: HandlerGroup<"chatgpt.status" | "chatgpt.connect" | "chatgpt.disconnect"> = (context) => {
  // Provider errors may contain tokens or callback URLs. Only a fixed error crosses or gets logged by IPC.
  const safely = async (work: () => ReturnType<typeof context.chatgpt.status>) => {
    try {
      return await work();
    } catch {
      throw new EngineError("Failed", "ChatGPT connection could not be completed");
    }
  };
  return {
    "chatgpt.status": () => safely(context.chatgpt.status),
    "chatgpt.connect": () => safely(context.chatgpt.connect),
    "chatgpt.disconnect": () => safely(context.chatgpt.disconnect),
  };
};
