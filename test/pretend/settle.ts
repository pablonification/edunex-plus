// Lets async work already under way finish before the pretend clock moves on: Node's setImmediate
// runs after every promise callback queued so far. React Native's setImmediate is a microtask
// (Libraries/Core/setUpTimers.js), which wouldn't wait for them, so the phone gets ./settle.native.ts.
export const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
