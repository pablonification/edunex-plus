/**
 * Adapt a host operation that has no native AbortSignal support to the
 * application's cancellation boundary. The host promise may settle later,
 * but callers stop observing it as soon as the signal is aborted.
 */
export function abortableOperation<A>(
  start: () => Promise<A>,
  cancel: () => void,
  signal?: AbortSignal,
): Promise<A> {
  if (!signal) return start();

  return new Promise<A>((resolve, reject) => {
    let settled = false;
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const settle = (complete: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      complete();
    };
    const onAbort = () => {
      try {
        cancel();
      } catch {
        // The host object may already be destroyed during application exit.
      }
      settle(() => reject(new Error("host operation aborted")));
    };

    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });

    try {
      void start().then(
        (value) => settle(() => resolve(value)),
        (error: unknown) => settle(() => reject(error)),
      );
    } catch (error) {
      settle(() => reject(error));
    }
  });
}
