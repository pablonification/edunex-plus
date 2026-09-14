import { describe, expect, it, vi } from "vitest";
import { abortableOperation } from "./abortable";

describe("abortable host operations", () => {
  it("cancels and settles when a host operation never resolves", async () => {
    const controller = new AbortController();
    const cancel = vi.fn();
    let rejectHost: (error: Error) => void = () => undefined;
    const hostOperation = new Promise<never>((_resolve, reject) => {
      rejectHost = reject;
    });
    const operation = abortableOperation(
      () => hostOperation,
      () => {
        cancel();
        rejectHost(new Error("host operation cancelled"));
      },
      controller.signal,
    );

    controller.abort();

    await expect(operation).rejects.toThrow("host operation aborted");
    await expect(hostOperation).rejects.toThrow("host operation cancelled");
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("does not start an already-aborted host operation", async () => {
    const controller = new AbortController();
    controller.abort();
    const start = vi.fn(() => Promise.resolve("ignored"));
    const cancel = vi.fn();

    const operation = abortableOperation(start, cancel, controller.signal);

    await expect(operation).rejects.toThrow("host operation aborted");
    expect(start).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
