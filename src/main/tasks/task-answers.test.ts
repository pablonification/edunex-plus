import { describe, expect, it, vi } from "vitest";
import { extractAnswerId, saveDraftAnswer, submitAnswer } from "./task-answers";

function apiMock() {
  return {
    createDraftAnswer: vi.fn(async () => ({ status: 201, ok: true, body: { data: { id: "2644208" } } })),
    updateDraftAnswer: vi.fn(async () => ({ status: 200, ok: true, body: { data: { id: "2644208" } } })),
  };
}

describe("draft-save routing (fake-API fixtures)", () => {
  it("creates via POST when no answer id is known", async () => {
    const api = apiMock();

    const result = await saveDraftAnswer(api, { taskId: "113986", answer: "<p>draft</p>" });

    expect(api.createDraftAnswer).toHaveBeenCalledWith("113986", "<p>draft</p>");
    expect(api.updateDraftAnswer).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, status: 201, created: true, answerId: "2644208" });
  });

  it("updates via PATCH when the feed already carries an answer id", async () => {
    const api = apiMock();

    const result = await saveDraftAnswer(api, {
      taskId: "113986",
      answer: "<p>edit</p>",
      answerId: "2644208",
    });

    expect(api.updateDraftAnswer).toHaveBeenCalledWith("2644208", "113986", "<p>edit</p>");
    expect(api.createDraftAnswer).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, status: 200, created: false, answerId: "2644208" });
  });

  it("keeps the input answer id when the response body carries none", async () => {
    const api = {
      createDraftAnswer: vi.fn(async () => ({ status: 201, ok: true, body: null })),
      updateDraftAnswer: vi.fn(async () => ({ status: 200, ok: true, body: null })),
    };

    const updated = await saveDraftAnswer(api, {
      taskId: "113986",
      answer: "x",
      answerId: "2644208",
    });
    expect(updated.answerId).toBe("2644208");
  });

  it("rejects an empty task id without touching the API", async () => {
    const api = apiMock();

    const result = await saveDraftAnswer(api, { taskId: "  ", answer: "x" });

    expect(result.ok).toBe(false);
    expect(api.createDraftAnswer).not.toHaveBeenCalled();
    expect(api.updateDraftAnswer).not.toHaveBeenCalled();
  });
});

describe("draft answer id extraction", () => {
  it("reads plain and JSON-API id shapes", () => {
    expect(extractAnswerId({ id: 2644208 })).toBe("2644208");
    expect(extractAnswerId({ data: { id: "2644208" } })).toBe("2644208");
    expect(extractAnswerId({ data: { attributes: { id: "2644208" } } })).toBe("2644208");
    expect(extractAnswerId(null)).toBeNull();
    expect(extractAnswerId({})).toBeNull();
  });
});

describe("final-submit routing (captured API contract)", () => {
  it("submits a saved answer by its id", async () => {
    const api = {
      submitAnswer: vi.fn(async () => ({ status: 200, ok: true, body: null })),
    };

    const result = await submitAnswer(api, { answerId: " 2644208 " });

    expect(api.submitAnswer).toHaveBeenCalledWith("2644208");
    expect(result).toEqual({ ok: true, status: 200 });
  });

  it("rejects a missing answer id without touching the API", async () => {
    const api = {
      submitAnswer: vi.fn(async () => ({ status: 200, ok: true, body: null })),
    };

    const result = await submitAnswer(api, { answerId: "  " });

    expect(result).toEqual({ ok: false, status: 400 });
    expect(api.submitAnswer).not.toHaveBeenCalled();
  });

  it("returns failed final-submit responses to the IPC layer", async () => {
    const api = {
      submitAnswer: vi.fn(async () => ({ status: 500, ok: false, body: null })),
    };

    await expect(submitAnswer(api, { answerId: "2644208" })).resolves.toEqual({
      ok: false,
      status: 500,
    });
  });
});
