// Bridge handlers for alerts and the tray (#75): reading the history, and a
// sample notification to check that they reach the Student.
import type { HandlerGroup } from "./context";

export const alertsHandlers: HandlerGroup<"alerts.markRead" | "alerts.test"> = (context) => ({
  "alerts.markRead": async () => {
    await context.engine.markAlertsRead();
    return {};
  },
  "alerts.test": async () => ({
    shown: context.notifier.show({ id: "test", kind: "newTask", title: { key: "alert.test" }, body: { key: "alert.test.body" }, target: { screen: "tasks" } }),
  }),
});
