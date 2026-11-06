// Lets async work already under way finish before the pretend clock moves on, on the phone: a
// timer runs after every promise callback queued so far, where React Native's setImmediate (a
// microtask) wouldn't. The desktop's tests use ./settle.ts.
export const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
