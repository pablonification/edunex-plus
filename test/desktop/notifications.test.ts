// The desktop's OS notifications (src/desktop/notifications.ts) with "Sembunyikan nilai" on: a new grade names its
// course only, never the grade or the IPK, as on the phone. Off, it says both.
import { describe, expect, it, vi } from "vitest";
import type { AlertNotice } from "../../src/engine/alerts/center";

const shown = vi.hoisted(() => [] as { title: string; body?: string }[]);
vi.mock("electron", () => ({
  Notification: class {
    static isSupported = () => true;
    constructor(private readonly options: { title: string; body?: string }) {}
    on() {}
    show() {
      shown.push({ title: this.options.title, body: this.options.body });
    }
  },
}));

const { createNotifier } = await import("../../src/desktop/notifications");

const grade: Pick<AlertNotice, "id" | "kind" | "title" | "body" | "target"> = {
  id: "grade:2026-1:IF2110:A",
  kind: "grade",
  title: { key: "alert.grade.new", vars: { course: "IF2110", grade: "A" } },
  body: { key: "alert.grade.body", vars: { name: "Algoritma dan Struktur Data", ipk: "3.42" } },
  target: { screen: "grades" },
};

describe("a new grade's OS notification", () => {
  it("names the course only while grades are hidden, and says the grade and IPK when they aren't", () => {
    let hidden = true;
    const notifier = createNotifier({ lang: () => "id", hideGrades: () => hidden, open: () => {}, openCheckIn: () => {} });
    notifier.show(grade);
    expect(shown.at(-1)).toEqual({ title: "Nilai baru · IF2110", body: "Algoritma dan Struktur Data" });
    expect(JSON.stringify(shown.at(-1))).not.toMatch(/3[,.]42|\bA\b/);
    hidden = false;
    notifier.show(grade);
    expect(shown.at(-1)?.title).toContain("A");
    expect(shown.at(-1)?.body).toMatch(/3[,.]42/);
  });
});
