// A pretend Edunex for tests. It starts from the recorded responses
// (test/fixtures/edunex) and answers the same calls the same way, with
// pagination and real error statuses. A test can act as the lecturer or the
// admin, which nobody can do on the real system, by cloning recorded records
// and changing only what the scenario is about.
import type { HttpRequest, HttpResponse } from "../../src/engine/http/transport";
import { withFields } from "../kit/builder";
import { edunexJson, exchanges } from "../kit/fixtures";
import type { FakeClock } from "./clock";

export const EDUNEX_API = "https://api-edunex.cognisia.id";
export const PRETEND_TOKEN = "pretend-edunex-token";

/* eslint-disable @typescript-eslint/no-explicit-any -- vendor JSON is untyped on purpose: tests see exactly what Edunex sends */
type Json = any;

export type Breakage =
  | { kind: "missing-field"; field: string }
  | { kind: "wrong-type"; field: string }
  | { kind: "unknown-field"; field: string }
  | { kind: "empty-body" }
  | { kind: "html" };

interface Fault {
  path: RegExp;
  status?: number;
  breakage?: Breakage;
  times: number;
}

const MAINTENANCE_HTML = "<!DOCTYPE html><html><head><title>Maintenance</title></head><body><h1>Edunex sedang dalam pemeliharaan</h1></body></html>";
const WEEK = 7 * 86_400_000;

/** Edunex writes WIB times with an offset on most records: "2026-10-16T23:59:00+07:00". */
export function wib(ms: number): string {
  const d = new Date(ms + 7 * 3_600_000);
  return `${d.toISOString().slice(0, 19)}+07:00`;
}

export class PretendEdunex {
  // ------------------------------------------------ state, seeded from the recordings
  me: Json = edunexJson("/login/me");
  pairs: Json[] = edunexJson("/course/presences/list");
  myCourses: Json = edunexJson("/course/courses");
  readonly courseDetail = new Map<number, Json>();
  readonly coursePlain = new Map<number, Json>();
  readonly classes = new Map<number, Json>();
  readonly modules = new Map<number, Json>();
  readonly tasks = new Map<number, Json[]>();
  readonly presences = new Map<string, Json[]>();
  readonly contents = new Map<string, Json[]>();
  vicon: Json[] = [];
  notifications: Json = edunexJson(/^\/notifications\/\d+$/);
  readonly announcements = new Map<number, Json[]>();
  activeAnnouncements: Json[] = edunexJson("/course/announcements");
  readonly exams = new Map<number, Json[]>();
  readonly gradebooks = new Map<string, Json>();
  todo: Json = edunexJson("/todo");
  agenda: Json[] = edunexJson(/^\/course\/agenda$/);
  lptk: Json = edunexJson(/^\/course\/lptks\/\d+$/);
  version: Json = edunexJson("/public/version");
  unread: Json = edunexJson("/message/unread");
  /** The recorded single-Task response, the template for the others. */
  private readonly singleTaskTemplate: Json;

  // ------------------------------------------------ the outside world
  sessionValid = true;
  /** Every change request the app sent, in order, with the fields Edunex reads from it. */
  readonly writes: { method: string; path: string; body: Json }[] = [];
  private faults: Fault[] = [];
  private nextId = 9_000_000;

  constructor(private readonly clock: FakeClock) {
    for (const ex of exchanges("edunex")) {
      const q = ex.query;
      const courseId = Number(/^\/course\/courses\/(\d+)$/.exec(ex.path)?.[1] ?? NaN);
      if (courseId) {
        (q.include ? this.courseDetail : this.coursePlain).set(courseId, edunexJson(ex.path, q));
        continue;
      }
      const classOf = /^\/course\/courses\/(\d+)\/classes$/.exec(ex.path);
      if (classOf) this.classes.set(Number(classOf[1]), edunexJson(ex.path, q));
      const moduleOf = /^\/course\/modules\/(\d+)$/.exec(ex.path);
      if (moduleOf) this.modules.set(Number(moduleOf[1]), edunexJson(ex.path, q));
      if (ex.path === "/course/tasks" && q["filter[course_id][is]"]) this.tasks.set(Number(q["filter[course_id][is]"]), edunexJson<Json>(ex.path, q).data);
      if (ex.path === "/course/presences") {
        const doc = edunexJson<Json>(ex.path, q);
        const key = `${q["filter[course_id][is]"]}:${q["filter[class_id][is]"]}`;
        this.presences.set(key, completeSessions(doc.data, doc.meta?.total ?? doc.data.length));
      }
      if (/^\/course\/contents\/?$/.test(ex.path) && q["filter[contentable_id][is]"]) {
        this.contents.set(`${q["filter[contentable_type][is]"]}:${q["filter[contentable_id][is]"]}`, edunexJson<Json>(ex.path, q).data);
      }
      if (/^\/course\/contents\/?$/.test(ex.path) && q["filter[type][in]"]) this.vicon = edunexJson<Json>(ex.path, q).data;
      const annOf = /^\/course\/announcements\/course\/(\d+)$/.exec(ex.path);
      if (annOf) this.announcements.set(Number(annOf[1]), edunexJson(ex.path, q));
      if (ex.path === "/exam/exams") this.exams.set(Number(q["filter[course_id][is]"]), edunexJson<Json>(ex.path, q).data);
      if (ex.path === "/gradebook") this.gradebooks.set(`${q.course_id}:${q.class_id ?? ""}`, edunexJson(ex.path, q));
    }
    this.singleTaskTemplate = edunexJson(/^\/course\/tasks\/\d+$/);
  }

  get userId(): number {
    return this.me.id;
  }

  // ------------------------------------------------ acting as the lecturer or admin

  /** Posts a Task to a course: a clone of one of its recorded Tasks, with a new id and fresh dates. */
  postTask(courseId: number, patch: Json = {}, options: { announce?: boolean } = {}): number {
    const list = this.tasks.get(courseId) ?? [];
    const template = list[list.length - 1] ?? [...this.tasks.values()].flat()[0];
    const id = this.nextId++;
    const now = this.clock.now();
    const task = withFields(template, {
      id,
      attributes: {
        name: `Tugas ${id}`,
        course_id: courseId,
        start_at: wib(now),
        end_at: wib(now + WEEK),
        created_at: wib(now),
        updated_at: wib(now),
        open_status: "open",
        show_score: 0,
        answers: [],
        files: [],
      },
    });
    task.attributes = { ...task.attributes, ...patch };
    this.tasks.set(courseId, [...list, task]);
    const course = this.courseName(courseId);
    // Edunex's notification feed misses many Tasks: `announce: false` posts one it never mentions.
    if (options.announce !== false) {
      this.notify({ type: "ASSIGNMENT", title: task.attributes.name, objectId: String(id), callbackUrl: `/assignment/take/${id}`, message: `${task.attributes.created_by ?? "Lecturer"} has been added new Assignment in ${course}` });
    }
    return id;
  }

  /** Changes fields of a Task the way an edit on the website does: `updated_at` moves, nothing is announced. */
  editTask(taskId: number, attributes: Json): void {
    const task = this.task(taskId);
    task.attributes = { ...task.attributes, ...attributes, updated_at: wib(this.clock.now()) };
  }

  moveDeadline(taskId: number, endAt: string): void {
    this.editTask(taskId, { end_at: endAt });
  }

  closeTask(taskId: number): void {
    this.editTask(taskId, { open_status: "closed", end_at: wib(this.clock.now() - 60_000), is_lateable: false });
  }

  publishScore(taskId: number, score: number): void {
    const task = this.task(taskId);
    task.attributes.show_score = 1;
    task.attributes.answers = task.attributes.answers.map((a: Json) => ({ ...a, score }));
  }

  /**
   * The lecturer takes the handed-in answer up for grading. Needs a recording:
   * modelled on the answer's `verified_at` / `verified_by`, the only review
   * fields Edunex sends.
   */
  reviewAnswer(taskId: number): void {
    const task = this.task(taskId);
    const now = wib(this.clock.now()).replace("T", " ").slice(0, 19);
    task.attributes.answers = task.attributes.answers.map((a: Json) => (a.is_sent ? { ...a, verified_at: now, verified_by: 900002 } : a));
  }

  /** The Student saves a draft on the Edunex website (outside the app): an answer that isn't sent. */
  draftOnWebsite(taskId: number, fileName = "draf.pdf"): void {
    const task = this.task(taskId);
    const answer = this.newAnswer(taskId, { is_sent: 0 });
    answer.files = this.storedFiles(answer.id, task, [{ name: fileName, file: `https://edunexfixture.blob.core.windows.net/edunex/website-${answer.id}` }]);
    task.attributes.answers = [...task.attributes.answers, answer];
  }

  /** The Student hands the Task in on the Edunex website (outside the app). */
  submitOnWebsite(taskId: number): void {
    const task = this.task(taskId);
    const now = wib(this.clock.now()).replace("T", " ").slice(0, 19);
    const answers = task.attributes.answers;
    if (answers.length) task.attributes.answers = answers.map((a: Json) => ({ ...a, is_sent: 1, sent_at: now, updated_at: now }));
    else task.attributes.answers = [this.newAnswer(taskId, { is_sent: 1, sent_at: now })];
  }

  /** Posts a material: a clone of a recorded content of the same type when one exists. */
  postMaterial(courseId: number, patch: { name: string; type?: string; content?: string; moduleId?: number }): number {
    const all = [...this.contents.values()].flat();
    const template = all.find((c) => c.attributes.type === (patch.type ?? "pdf")) ?? all[0];
    const id = this.nextId++;
    const type = patch.moduleId ? "App\\Models\\Modules" : "App\\Models\\Courses";
    const owner = patch.moduleId ?? courseId;
    const item = withFields(template, {
      id,
      attributes: {
        name: patch.name,
        type: patch.type ?? template.attributes.type,
        content: patch.content ?? template.attributes.content,
        contentable_id: owner,
        contentable_type: type,
        course_id: courseId,
        created_at: wib(this.clock.now()),
        updated_at: wib(this.clock.now()),
      },
    });
    const key = `${type}:${owner}`;
    this.contents.set(key, [...(this.contents.get(key) ?? []), item]);
    this.notify({ type: "CONTENT", title: patch.name, objectId: String(courseId), callbackUrl: `/courses/${courseId}`, message: `Lecturer has been added new Content in ${this.courseName(courseId)}` });
    return id;
  }

  deleteMaterial(id: number): void {
    for (const [key, list] of this.contents) this.contents.set(key, list.filter((c) => Number(c.id) !== id));
  }

  /** Opens a Presence session: a clone of a recorded one for that class, with a new window. */
  schedulePresence(courseId: number, classId: number, window: { start: string; end: string; presenceStart?: string; presenceEnd?: string; patch?: Json }): number {
    const key = `${courseId}:${classId}`;
    const list = this.presences.get(key) ?? [];
    const template = list[0] ?? [...this.presences.values()].flat()[0];
    const id = this.nextId++;
    const session = withFields(template, {
      id,
      attributes: {
        course_id: courseId,
        class_id: classId,
        start_at: window.start,
        end_at: window.end,
        presence_start: window.presenceStart ?? window.start,
        presence_end: window.presenceEnd ?? window.end,
        attandance: { ...template.attributes.attandance, presence_detail_id: null, status: null, presence_at: null, type: null },
        ...window.patch,
      },
    });
    this.presences.set(key, [...list, session].sort((a, b) => a.attributes.start_at.localeCompare(b.attributes.start_at)));
    return id;
  }

  /** The Student did the activity that counts as presence (opened the material, handed in the Task…). */
  markPresent(presenceId: number): void {
    for (const list of this.presences.values()) {
      const session = list.find((s) => Number(s.id) === presenceId);
      if (session) session.attributes.attandance = { ...session.attributes.attandance, status: 1, type: "attend", presence_at: wib(this.clock.now()).replace("T", " ").slice(0, 19) };
    }
  }

  postAnnouncement(courseId: number, patch: Json): void {
    const all = [...this.announcements.values()].flat();
    const template = all[0];
    if (!template) throw new Error("No recorded announcement to clone");
    const item = { ...structuredClone(template), id: this.nextId++, course_id: courseId, ...patch };
    this.announcements.set(courseId, [...(this.announcements.get(courseId) ?? []), item]);
  }

  publishGradebook(courseId: number, total: number, index: string): void {
    for (const [key, doc] of this.gradebooks) {
      if (!key.startsWith(`${courseId}:`)) continue;
      doc.students = doc.students.map((s: Json) => ({ ...s, total, index }));
    }
    const detail = this.courseDetail.get(courseId);
    if (detail) detail.data.attributes.gradebook_publish = true;
  }

  // ------------------------------------------------ the outside world

  expireSession(): void {
    this.sessionValid = false;
  }

  /** Answer `status` for matching paths, `times` times (default: until cleared). */
  fail(path: RegExp, status: number, times = Number.POSITIVE_INFINITY): void {
    this.faults.push({ path, status, times });
  }

  /** Mangle the real response for matching paths: what a vendor change looks like. */
  mangle(path: RegExp, breakage: Breakage, times = Number.POSITIVE_INFINITY): void {
    this.faults.push({ path, breakage, times });
  }

  maintenance(on = true): void {
    this.faults = this.faults.filter((f) => f.status !== 503 || !f.path.test("/maintenance"));
    if (on) this.faults.push({ path: /.*/, status: 503, times: Number.POSITIVE_INFINITY });
  }

  clearFaults(): void {
    this.faults = [];
  }

  // ------------------------------------------------ answering requests

  handle(request: HttpRequest, url: URL): HttpResponse {
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const q = Object.fromEntries(url.searchParams);
    const fault = this.faults.find((f) => f.path.test(path) && f.times > 0);
    if (fault) fault.times -= 1;
    if (fault?.status) return fault.status === 503 ? html(503, MAINTENANCE_HTML, url) : json(fault.status, { message: "error" }, url);

    const auth = request.headers?.authorization ?? request.headers?.Authorization;
    if (!this.sessionValid || auth !== `Bearer ${PRETEND_TOKEN}`) return json(401, { message: "Unauthenticated." }, url);

    let body: Json;
    try {
      body = request.method === "GET" ? this.read(path, q) : this.write(request, path);
    } catch (error) {
      if (error instanceof NotFound) return json(404, { message: "Not Found" }, url);
      if (error instanceof Refused) return json(422, { message: "The given data was invalid." }, url);
      throw error;
    }
    if (fault?.breakage) return breakResponse(body, fault.breakage, url);
    return json(200, body, url);
  }

  private read(path: string, q: Record<string, string>): Json {
    let m: RegExpExecArray | null;
    if (path === "/login/me") return this.me;
    if (path === "/time") return { carbon_now: wib(this.clock.now()), server_time: wib(this.clock.now()), time_zone: "Asia/Jakarta" };
    if (path === "/public/version") return this.version;
    if (path === "/message/unread") return this.unread;
    if (path === "/todo") return this.todo;
    if (path === "/course/agenda") return this.agenda;
    if ((m = /^\/course\/lptks\/(\d+)$/.exec(path))) return this.lptk;
    if (path === "/course/presences/list") return this.pairs;
    if (path === "/course/courses") return this.myCourses;
    if ((m = /^\/course\/courses\/(\d+)$/.exec(path))) return found((q.include ? this.courseDetail : this.coursePlain).get(Number(m[1])) ?? this.courseDetail.get(Number(m[1])));
    if ((m = /^\/course\/courses\/(\d+)\/classes$/.exec(path))) return found(this.classes.get(Number(m[1])));
    if ((m = /^\/course\/modules\/(\d+)$/.exec(path))) return found(this.modules.get(Number(m[1])));
    if (path === "/course/tasks") return page(this.tasks.get(Number(q["filter[course_id][is]"])) ?? [], q, path);
    if ((m = /^\/course\/tasks\/(\d+)$/.exec(path))) {
      const item = this.task(Number(m[1]));
      return { data: { ...this.singleTaskTemplate.data, type: item.type, id: item.id, attributes: item.attributes, links: item.links } };
    }
    if (path === "/course/presences") return page(this.presences.get(`${q["filter[course_id][is]"]}:${q["filter[class_id][is]"]}`) ?? [], q, path);
    if (path === "/course/contents" && q["filter[contentable_id][is]"]) return page(this.contents.get(`${q["filter[contentable_type][is]"]}:${q["filter[contentable_id][is]"]}`) ?? [], q, path);
    if (path === "/course/contents" && q["filter[type][in]"]) return page(this.vicon, q, path);
    if ((m = /^\/notifications\/(\d+)$/.exec(path))) {
      if (Number(m[1]) !== this.userId) throw new NotFound();
      return this.notifications;
    }
    if ((m = /^\/course\/announcements\/course\/(\d+)$/.exec(path))) return this.announcements.get(Number(m[1])) ?? [];
    if (path === "/course/announcements") return this.activeAnnouncements;
    if (path === "/exam/exams") return page(this.exams.get(Number(q["filter[course_id][is]"])) ?? [], q, path);
    if (path === "/gradebook") return found(this.gradebooks.get(`${q.course_id}:${q.class_id ?? ""}`) ?? this.gradebooks.get(`${q.course_id}:`));
    throw new NotFound();
  }

  // Shapes of these replies were never recorded (no real hand-in yet); the app must re-read the Task to confirm.
  // The app sends Edunex's JSON:API envelope ({ data: { attributes } }); a bare body is read the same way.
  private write(request: HttpRequest, path: string): Json {
    const raw = typeof request.body === "string" && request.body ? JSON.parse(request.body) : {};
    const body = raw?.data?.attributes ?? raw;
    this.writes.push({ method: request.method, path, body });
    const now = wib(this.clock.now()).replace("T", " ").slice(0, 19);
    let m: RegExpExecArray | null;
    if (request.method === "POST" && path === "/course/task/answers") {
      const task = this.task(Number(body.task_id));
      if (!takesAnswers(task, this.clock.now())) throw new Refused();
      const answer = this.newAnswer(Number(body.task_id), { ...body, files: [] });
      answer.files = this.storedFiles(answer.id, task, body.files ?? []);
      task.attributes.answers = [...task.attributes.answers, answer];
      return { data: answer };
    }
    if (request.method === "PATCH" && (m = /^\/course\/task\/answers\/(\d+)$/.exec(path))) {
      const id = Number(m[1]);
      for (const list of this.tasks.values()) {
        for (const task of list) {
          const at = task.attributes.answers.findIndex((a: Json) => Number(a.id) === id);
          if (at < 0) continue;
          if (!takesAnswers(task, this.clock.now())) throw new Refused();
          const current = task.attributes.answers[at];
          const fields = { ...body };
          delete fields.task_id;
          delete fields.files;
          // Edunex stamps sent_at on drafts too (API.md): only is_sent says it was handed in.
          const next = { ...current, ...fields, sent_at: now, updated_at: now };
          if (body.files) next.files = this.storedFiles(id, task, body.files);
          task.attributes.answers[at] = next;
          return { data: next };
        }
      }
      throw new NotFound();
    }
    if (request.method === "POST" && path === "/blob-storage/sas") {
      return {
        data: (body.files ?? []).map((f: Json, i: number) => {
          const name = `${this.clock.now()}_${i}_${String(f.fileName).replace(/[^\w.-]+/g, "-")}`;
          return { fileName: f.fileName, uploadUrl: `https://edunexfixture.blob.core.windows.net/edunex/upload/${name}?sig=pretend`, readUrl: `https://edunexfixture.blob.core.windows.net/edunex/upload/${name}` };
        }),
      };
    }
    throw new NotFound();
  }

  // ------------------------------------------------ helpers

  task(taskId: number): Json {
    for (const list of this.tasks.values()) {
      const hit = list.find((t) => Number(t.id) === taskId);
      if (hit) return hit;
    }
    throw new NotFound();
  }

  /** Files as Edunex returns them on an answer: the recorded file record, with this file's name and link. */
  private storedFiles(answerId: number, task: Json, files: Json[]): Json[] {
    const template = [...this.tasks.values()].flat().flatMap((t) => t.attributes.answers).flatMap((a: Json) => a.files)[0];
    const now = wib(this.clock.now()).replace("T", " ").slice(0, 19);
    return files.map((f: Json) => ({
      ...structuredClone(template),
      id: this.nextId++,
      fileable_id: String(answerId),
      name: f.name,
      file: f.file,
      course_id: task.attributes.course_id,
      created_at: now,
      updated_at: now,
    }));
  }

  private newAnswer(taskId: number, fields: Json): Json {
    const template = [...this.tasks.values()].flat().flatMap((t) => t.attributes.answers)[0];
    const now = wib(this.clock.now()).replace("T", " ").slice(0, 19);
    return {
      ...structuredClone(template),
      id: this.nextId++,
      task_id: taskId,
      student_id: this.me.student_id,
      answer: fields.answer ?? null,
      files: fields.files ?? [],
      is_sent: fields.is_sent ?? 0,
      // Edunex stamps sent_at on drafts too (API.md).
      sent_at: fields.sent_at ?? now,
      verified_at: null,
      verified_by: null,
      score: 0,
      created_at: now,
      updated_at: now,
    };
  }

  private courseName(courseId: number): string {
    return this.courseDetail.get(courseId)?.data?.attributes?.name ?? this.pairs.find((p: Json) => p.course_id === courseId)?.courses_name ?? "Course";
  }

  private notify(fields: { type: string; title: string; objectId: string; callbackUrl: string; message: string }): void {
    this.notifications.data.notifications = [
      { isRead: 0, note: "", domain: "course", date: new Date(this.clock.now()).toISOString(), ...fields },
      ...this.notifications.data.notifications,
    ];
    this.notifications.data.count = this.notifications.data.notifications.length;
  }
}

// ---------------------------------------------------------------- responses

class NotFound extends Error {}
/** Edunex refusing a change (the Task stopped taking answers); the real reply was never recorded. */
class Refused extends Error {}

/** A Task takes answers while it's open, and past its deadline only when late submission is allowed. */
function takesAnswers(task: Json, now: number): boolean {
  const a = task.attributes;
  if (a.open_status !== "open") return false;
  return !(Date.parse(a.end_at) < now && !a.is_lateable);
}

function found<T>(value: T | undefined): T {
  if (value === undefined) throw new NotFound();
  return value;
}

function json(status: number, body: Json, url: URL): HttpResponse {
  return { status, headers: { "content-type": "application/json" }, body: JSON.stringify(body), url: url.toString() };
}

function html(status: number, body: string, url: URL): HttpResponse {
  return { status, headers: { "content-type": "text/html; charset=UTF-8" }, body, url: url.toString() };
}

/** Edunex's list envelope: { meta: { count, total }, data, links }. A limit of 0 means "everything". */
function page(items: Json[], q: Record<string, string>, path: string): Json {
  const limit = Number(q["page[limit]"] ?? 0);
  const offset = Number(q["page[offset]"] ?? 0);
  const data = limit > 0 ? items.slice(offset, offset + limit) : items.slice(offset);
  const link = (o: number) => `${EDUNEX_API}${path}?page[limit]=${limit}&page[offset]=${o}`;
  return {
    meta: { count: data.length, total: items.length },
    data,
    links: { first: link(0), last: link(limit > 0 ? Math.max(0, Math.floor((items.length - 1) / limit) * limit) : 0), next: link(offset + (limit || items.length)) },
  };
}

/** The recording holds the first page of each class's sessions; later pages follow the same weekly pattern. */
function completeSessions(recorded: Json[], total: number): Json[] {
  const out = [...recorded];
  while (out.length < total && out.length > 0) {
    const last = out[out.length - 1];
    const shift = (v: string | null) => (v ? wib(Date.parse(v) + WEEK) : v);
    out.push(
      withFields(last, {
        id: Number(last.id) + 1,
        attributes: {
          start_at: shift(last.attributes.start_at),
          end_at: shift(last.attributes.end_at),
          presence_start: shift(last.attributes.presence_start),
          presence_end: shift(last.attributes.presence_end),
          attandance: { ...last.attributes.attandance, presence_detail_id: null, status: null, presence_at: null, type: null },
        },
      }),
    );
  }
  return out;
}

function breakResponse(body: Json, breakage: Breakage, url: URL): HttpResponse {
  if (breakage.kind === "empty-body") return { status: 200, headers: { "content-type": "application/json" }, body: "", url: url.toString() };
  if (breakage.kind === "html") return html(200, MAINTENANCE_HTML, url);
  const copy = structuredClone(body);
  const targets: Json[] = Array.isArray(copy?.data) ? copy.data : copy?.data ? [copy.data] : Array.isArray(copy) ? copy : [copy];
  for (const item of targets) {
    const holder = item?.attributes ?? item;
    if (!holder || typeof holder !== "object") continue;
    if (breakage.kind === "missing-field") delete holder[breakage.field];
    if (breakage.kind === "wrong-type") holder[breakage.field] = typeof holder[breakage.field] === "string" ? 12345 : "not-a-number";
    if (breakage.kind === "unknown-field") holder[breakage.field] = { added: "by vendor" };
  }
  return json(200, copy, url);
}
