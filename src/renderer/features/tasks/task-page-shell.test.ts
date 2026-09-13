import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TaskPageShell } from "./task-page-shell";

describe("task page shell", () => {
  it("gives a selected Task a page shell ready for the answer flow", () => {
    const task = {
      id: "113986",
      kind: "Task" as const,
      title: "Answer Tugas 01",
      courseCode: "II4091",
      courseName: "Final Project Proposal",
      dueAt: "2026-09-14T23:59:00.000Z",
    };
    const markup = renderToStaticMarkup(
      createElement(TaskPageShell, { task, onBack: vi.fn() }),
    );

    expect(markup).toContain('aria-labelledby="task-page-title"');
    expect(markup).toContain("Answer Tugas 01");
    expect(markup).toContain("Final Project Proposal");
    expect(markup).toContain("Answer");
    expect(markup).toContain("Submission details will appear here in #25.");
    expect(markup).toContain('dateTime="2026-09-14T23:59:00.000Z"');
  });
});
