import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createNotificationStore } from "./notification-store";
import type { InAppNotification } from "../../shared/notifications";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "edunex-inapp-"));
  roots.push(root);
  return root;
}

function entry(id: string): InAppNotification {
  return {
    id,
    title: "New task",
    body: `Task ${id}`,
    taskIds: [id],
    createdAt: "2026-09-13T12:00:00.000Z",
    read: false,
  };
}

describe("in-app notification store", () => {
  it("persists fallback entries newest-first across restarts", () => {
    const root = tempRoot();
    createNotificationStore(root, "190136").append(entry("113986"));
    createNotificationStore(root, "190136").append(entry("113987"));

    expect(createNotificationStore(root, "190136").list().map((e) => e.id)).toEqual([
      "113987",
      "113986",
    ]);
  });

  it("marks entries read without dropping them", () => {
    const root = tempRoot();
    const store = createNotificationStore(root, "190136");
    store.append(entry("113986"));
    const updated = store.markRead(["113986"]);

    expect(updated[0].read).toBe(true);
    expect(createNotificationStore(root, "190136").list()[0].read).toBe(true);
  });
});
