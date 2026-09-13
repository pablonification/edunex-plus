import { describe, expect, it, vi } from "vitest";
import { createEdunexApi } from "./client";

function okResponse(body: unknown = {}) {
  return new Response(JSON.stringify(body), { status: 200 });
}

function fetchOk() {
  return vi.fn(async () => okResponse({ id: 190136 }));
}

describe("edunex api client", () => {
  it("calls the endpoint with the captured bearer token and the app's User-Agent", async () => {
    const fetchImpl = fetchOk();
    const api = createEdunexApi({
      baseUrl: "https://api-edunex.cognisia.id",
      getToken: () => "tok-123",
      userAgent: "EdunexPlus/0.0.1",
      fetchImpl,
    });

    const result = await api.get("/login/me");

    expect(result.ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api-edunex.cognisia.id/login/me");
    expect(init.headers.get("Authorization")).toBe("Bearer tok-123");
    expect(init.headers.get("User-Agent")).toBe("EdunexPlus/0.0.1");
  });

  it("reports 401s and signals the session is gone", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 401 }));
    const onUnauthorized = vi.fn();
    const api = createEdunexApi({
      baseUrl: "https://api-edunex.cognisia.id",
      getToken: () => "stale",
      onUnauthorized,
      fetchImpl,
    });

    const result = await api.get("/login/me");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("treats a missing token as unauthorized without hitting the network", async () => {
    const fetchImpl = fetchOk();
    const onUnauthorized = vi.fn();
    const api = createEdunexApi({
      baseUrl: "https://api-edunex.cognisia.id",
      getToken: () => null,
      onUnauthorized,
      fetchImpl,
    });

    const result = await api.get("/login/me");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("survives network failures as a non-auth error (offline ≠ signed out)", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const onUnauthorized = vi.fn();
    const api = createEdunexApi({
      baseUrl: "https://api-edunex.cognisia.id",
      getToken: () => "tok",
      onUnauthorized,
      fetchImpl,
    });

    const result = await api.get("/todo");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("does not fire onUnauthorized for other 4xx/5xx responses", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 500 }));
    const onUnauthorized = vi.fn();
    const api = createEdunexApi({
      baseUrl: "https://api-edunex.cognisia.id",
      getToken: () => "tok",
      onUnauthorized,
      fetchImpl,
    });

    const result = await api.get("/todo");

    expect(result.status).toBe(500);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("normalizes the JSON-API course-task envelope at the API boundary", async () => {
    const resource = {
      type: "task",
      id: "113986",
      attributes: {
        title: "Tugas 01",
        course_code: "II4091",
        due_at: "2026-09-14T23:59:00.000Z",
      },
      links: { self: "/course/tasks/113986" },
    };
    const fetchImpl = vi.fn(async () =>
      okResponse({ meta: { count: 1 }, data: [resource], links: { self: "/course/tasks" } }),
    );
    const api = createEdunexApi({
      baseUrl: "https://api-edunex.cognisia.id",
      getToken: () => "tok",
      userAgent: "EdunexPlus/0.0.1",
      fetchImpl,
    });

    const result = await api.getCourseTasks();

    expect(result.body).toEqual([resource]);
  });

  it("normalizes the course collection while leaving /todo's plain categories intact", async () => {
    const course = { type: "course", id: "401", attributes: { code: "II4091" } };
    const todo = { tasks: [{ id: 113986 }], exams: [], questions: [], modules: [] };
    const fetchImpl = vi.fn(async (url: string) =>
      url.endsWith("/course/courses")
        ? okResponse({ data: [course] })
        : okResponse(todo),
    );
    const api = createEdunexApi({
      baseUrl: "https://api-edunex.cognisia.id",
      getToken: () => "tok",
      userAgent: "EdunexPlus/0.0.1",
      fetchImpl,
    });

    const [courses, pending] = await Promise.all([api.getCourses(), api.getTodo()]);

    expect(courses.body).toEqual([course]);
    expect(pending.body).toEqual(todo);
  });

  it("passes the plain-array /course/agenda response through at the API boundary", async () => {
    const meetings = [
      {
        type: "vicon",
        course_name: "Final Project Proposal",
        name: "Week 05 — Online guidance",
        start_at: "2026-09-16T07:00:00.000Z",
        end_at: "2026-09-16T09:00:00.000Z",
      },
      {
        type: "offline",
        course_name: "Final Project Proposal",
        name: "Week 06 — Studio review",
        start_at: "2026-09-23T07:00:00.000Z",
        end_at: "2026-09-23T09:00:00.000Z",
      },
    ];
    const fetchImpl = vi.fn(async () => okResponse(meetings));
    const api = createEdunexApi({
      baseUrl: "https://api-edunex.cognisia.id",
      getToken: () => "tok",
      userAgent: "EdunexPlus/0.0.1",
      fetchImpl,
    });

    const result = await api.getAgenda();

    expect(fetchImpl.mock.calls[0][0]).toBe("https://api-edunex.cognisia.id/course/agenda");
    expect(result.body).toEqual(meetings);
  });

  it("unwraps a nested /course/agenda payload without dropping meetings", async () => {
    const meetings = [
      {
        type: "vicon",
        course_name: "Climate Change",
        name: "Week 02 — Guest lecture",
        start_at: "2026-09-10T02:00:00.000Z",
        end_at: "2026-09-10T04:00:00.000Z",
      },
    ];
    const fetchImpl = vi.fn(async () => okResponse({ data: meetings }));
    const api = createEdunexApi({
      baseUrl: "https://api-edunex.cognisia.id",
      getToken: () => "tok",
      userAgent: "EdunexPlus/0.0.1",
      fetchImpl,
    });

    const result = await api.getAgenda();

    expect(result.body).toEqual(meetings);
  });
});
