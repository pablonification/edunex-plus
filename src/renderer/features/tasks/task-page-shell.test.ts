/* @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskPageShell } from "./task-page-shell";
import type { TaskItem } from "../feeds/feed-data";

let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.restoreAllMocks();
});

function draftTask(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: "113986",
    kind: "Task",
    title: "Answer Tugas 01",
    courseCode: "II4091",
    courseName: "Final Project Proposal",
    dueAt: "2100-09-14T23:59:00.000Z",
    isSent: false,
    answerId: null,
    answer: null,
    ...overrides,
  };
}

type SaveDraftMock = ReturnType<
  typeof vi.fn<
    () => Promise<{ ok: boolean; status: number; created: boolean; answerId: string | null }>
  >
>;

function mount(
  task: TaskItem,
  saveDraft: SaveDraftMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    created: true,
    answerId: "2644208",
  })),
) {
  (window as unknown as { edunex: unknown }).edunex = { saveDraft };
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanup = () => {
    root.unmount();
    container.remove();
  };
  return { container, root, saveDraft: saveDraft as ReturnType<typeof vi.fn> };
}

async function renderShell(task: TaskItem, saveDraft?: Parameters<typeof mount>[1]) {
  const { container, root } = mount(task, saveDraft);
  await act(async () => {
    root.render(createElement(TaskPageShell, { task, onBack: vi.fn() }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return container;
}

describe("task page shell", () => {
  it("renders the draft status card with a quiet save action", () => {
    const markup = renderToStaticMarkup(
      createElement(TaskPageShell, { task: draftTask(), onBack: vi.fn() }),
    );

    expect(markup).toContain('aria-labelledby="task-page-title"');
    expect(markup).toContain("Answer Tugas 01");
    expect(markup).toContain("DRAFT — NOT SUBMITTED");
    expect(markup).toContain("border-yellow-400");
    expect(markup).toContain("bg-status-dot-yellow-halo");
    expect(markup).toContain("Save draft");
    // Submit lives in #26 — the draft card must not promise a submit action.
    expect(markup).not.toContain("Submit answer");
    expect(markup).toContain('dateTime="2100-09-14T23:59:00.000Z"');
  });

  it("renders the submitted status card read-only with no resubmit affordance", () => {
    const markup = renderToStaticMarkup(
      createElement(TaskPageShell, {
        task: draftTask({ isSent: true, answer: "Final answer text", dueAt: "2000-09-14T23:59:00.000Z" }),
        onBack: vi.fn(),
      }),
    );

    expect(markup).toContain("SUBMITTED");
    expect(markup).toContain("border-green-500");
    expect(markup).toContain("bg-status-dot-green-halo");
    expect(markup).toContain("Final answer text");
    expect(markup).not.toContain("Save draft");
    // No resubmit affordance (#12 verified absent): no submit action and no
    // editor. "Submitted" chip/status word themselves are expected.
    expect(markup).not.toContain("Submit answer");
    expect(markup).not.toContain("Resubmit");
    expect(markup).not.toContain("task-answer-editor");
  });

  it("renders the overdue status card past the deadline", () => {
    const markup = renderToStaticMarkup(
      createElement(TaskPageShell, {
        task: draftTask({ dueAt: "2000-09-01T23:59:00.000Z" }),
        onBack: vi.fn(),
      }),
    );

    expect(markup).toContain("OVERDUE — NOT SUBMITTED");
    expect(markup).toContain("border-rose-400");
    expect(markup).toContain("bg-status-dot-rose-halo");
    expect(markup).toContain("Save draft");
  });

  it("never surfaces sent_at in the answer page", () => {
    const markup = renderToStaticMarkup(
      createElement(TaskPageShell, { task: draftTask(), onBack: vi.fn() }),
    );

    expect(markup).not.toContain("sent_at");
    expect(markup).not.toContain("sentAt");
  });

  it("saves a first draft via create (no answer id)", async () => {
    const saveDraft = vi.fn(async () => ({ ok: true, status: 201, created: true, answerId: "2644208" }));
    const container = await renderShell(
      draftTask({ answer: "My draft answer" }),
      saveDraft,
    );

    const button = [...container.querySelectorAll("button")].find((el) =>
      el.textContent?.includes("Save draft"),
    );
    expect(button).toBeDefined();

    await act(async () => {
      button!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(saveDraft).toHaveBeenCalledWith({
      taskId: "113986",
      answer: "My draft answer",
      answerId: null,
    });
    expect(container.textContent).toContain("Draft saved — only you can see it.");
  });

  it("saves an existing draft via update (answer id present)", async () => {
    const saveDraft = vi.fn(async () => ({ ok: true, status: 200, created: false, answerId: "2644208" }));
    const container = await renderShell(
      draftTask({ answerId: "2644208", answer: "Edited draft" }),
      saveDraft,
    );

    const button = [...container.querySelectorAll("button")].find((el) =>
      el.textContent?.includes("Save draft"),
    );

    await act(async () => {
      button!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(saveDraft).toHaveBeenCalledWith({
      taskId: "113986",
      answer: "Edited draft",
      answerId: "2644208",
    });
  });

  it("shows a quiet error when the draft save fails", async () => {
    const saveDraft = vi.fn(async () => ({ ok: false, status: 0, created: true, answerId: null }));
    const container = await renderShell(draftTask(), saveDraft);

    const button = [...container.querySelectorAll("button")].find((el) =>
      el.textContent?.includes("Save draft"),
    );

    await act(async () => {
      button!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain("Couldn't save the draft.");
  });
});
