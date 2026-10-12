// Edunex course pages (#74): each course's outline (modules, lecturer, the
// published grade) and materials, its Presence sessions, announcements and
// exams. A class's parent and child Edunex courses are read together and kept
// under the course code. Calls go one after another, except a course's
// module contents, a few at a time.
import { z } from "zod";
import type { Announcement, Course, CourseModule, CourseOutline, EdunexExam, GradebookGrade, Material, PresenceSession } from "../../../core/models";
import { EngineError } from "../../errors";
import type { SourceContext } from "../source";
import type { EdunexClient } from "./client";
import { fetchCourses } from "./feeds";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const WIB_OFFSET = 7 * HOUR;
/** The page size Edunex's own website asks for. */
const PRESENCE_PAGE = 10;

// ---------------------------------------------------------------- vendor shapes

const Stamp = z.string().nullable().optional();

const ModuleRecord = z.object({
  type: z.literal("modules"),
  id: z.string(),
  attributes: z.object({ course_id: z.number(), index: z.number(), name: z.string(), is_active: z.union([z.boolean(), z.number()]), created_at: Stamp }),
});

/** GET /course/courses/{id}?include=modules,… */
export const CourseDetail = z.object({
  data: z.object({
    id: z.string(),
    attributes: z.object({
      lecturer: z.string().nullable().optional(),
      credit: z.union([z.string(), z.number()]).nullable().optional(),
      major: z.string().nullable().optional(),
      gradebook_publish: z.boolean().nullable().optional(),
    }),
  }),
  included: z.array(z.object({ type: z.string() }).passthrough()).optional(),
});

/** GET /course/contents/?filter[contentable_id][is]=…&filter[contentable_type][is]=… */
export const Contents = z.object({
  meta: z.object({ total: z.number() }).optional(),
  data: z.array(
    z.object({
      id: z.union([z.string(), z.number()]),
      attributes: z.object({
        contentable_type: z.string(),
        contentable_id: z.number(),
        name: z.string(),
        type: z.string(),
        content: z.string().nullable(),
        size: z.union([z.string(), z.number()]).nullable().optional(),
        created_at: Stamp,
        updated_at: Stamp,
      }),
    }),
  ),
});

/** GET /course/presences?filter[course_id][is]=&filter[class_id][is]=&sort=start_at&page[limit]=&page[offset]= */
export const Presences = z.object({
  meta: z.object({ total: z.number() }),
  data: z.array(
    z.object({
      id: z.union([z.string(), z.number()]),
      attributes: z.object({
        course_id: z.number(),
        class_id: z.number(),
        start_at: z.string(),
        end_at: z.string(),
        presence_start: z.string().nullable(),
        presence_end: z.string().nullable(),
        topic: z.string().nullable(),
        note: z.string().nullable().optional(),
        presentable: z
          .array(z.object({ presentable: z.string(), presentable_id: z.union([z.string(), z.number()]) }))
          .nullable()
          .optional(),
        url: z.string().nullable().optional(),
        attandance: z.object({ status: z.number().nullable(), presence_at: z.string().nullable() }).nullable(),
      }),
    }),
  ),
});

/** GET /course/announcements/course/{id} */
export const Announcements = z.array(
  z.object({
    id: z.number(),
    announcement: z.string(),
    created_at: Stamp,
    creator: z.object({ name: z.string() }).nullable().optional(),
  }),
);

/**
 * GET /exam/exams?filter[course_id][is]=. No exam was ever recorded (none on
 * the account), so only the envelope and an id are required.
 */
export const Exams = z.object({
  data: z.array(z.object({ id: z.union([z.string(), z.number()]), attributes: z.record(z.string(), z.unknown()).optional() })),
});

/** GET /gradebook?course_id=&class_id= */
export const Gradebook = z.object({
  students: z.array(z.object({ code: z.string(), total: z.number().nullable(), index: z.string().nullable() })),
});

// ---------------------------------------------------------------- feeds

export function registerCoursePageFeeds(context: SourceContext, client: EdunexClient): void {
  const courses = async () => context.get("edunex.courses") ?? (await fetchCourses(client));
  const perCourse = <T>(name: string, every: number, read: (course: Course) => Promise<T>, store: (value: Record<string, T>) => Promise<unknown>) =>
    context.feed({
      name,
      every,
      jitter: every / 10,
      async run(current) {
        const value: Record<string, T> = {};
        for (const course of await courses()) {
          if (!current()) return;
          value[course.code] = await read(course);
        }
        if (current()) await store(value);
      },
    });

  // The outline and the materials together: a module's materials are read by its id.
  context.feed({
    name: "edunex.materials",
    every: HOUR,
    jitter: 6 * MINUTE,
    async run(current) {
      const nim = context.get("edunex.account")?.nim ?? null;
      const outlines: Record<string, CourseOutline> = {};
      const materials: Record<string, Material[]> = {};
      for (const course of await courses()) {
        if (!current()) return;
        outlines[course.code] = await fetchOutline(client, course, nim);
        materials[course.code] = await fetchMaterials(client, course, outlines[course.code].modules);
      }
      if (!current()) return;
      await context.set("edunex.outline", outlines);
      await context.set("edunex.materials", materials);
    },
  });
  perCourse(
    "edunex.presence",
    30 * MINUTE,
    (course) => fetchPresence(client, course),
    (value) => context.set("edunex.presence", value),
  );
  perCourse(
    "edunex.announcements",
    HOUR,
    (course) => fetchAnnouncements(client, course),
    (value) => context.set("edunex.announcements", value),
  );
  perCourse(
    "edunex.exams",
    3 * HOUR,
    (course) => fetchExams(client, course),
    (value) => context.set("edunex.exams", value),
  );
}

/** The class's own Edunex course first, then its parent's. */
const courseIds = (course: Course) => [course.edunex.courseId, ...course.edunex.relatedCourseIds];

export async function fetchOutline(client: EdunexClient, course: Course, nim: string | null): Promise<CourseOutline> {
  const outline: CourseOutline = { lecturer: null, credits: null, program: null, modules: [], grade: null };
  for (const id of courseIds(course)) {
    const detail = await client.get(`/course/courses/${id}`, { include: "modules,modules.activities,lecturer,lecturer.user,assistant,class" }, CourseDetail);
    const { attributes } = detail.data;
    outline.lecturer ??= attributes.lecturer?.trim() || null;
    const credits = Number(attributes.credit);
    outline.credits ??= attributes.credit != null && Number.isFinite(credits) ? credits : null;
    outline.program ??= attributes.major?.trim() || null;
    const modules: (CourseModule & { index: number })[] = [];
    for (const item of detail.included ?? []) {
      if (item.type !== "modules") continue;
      const parsed = ModuleRecord.safeParse(item);
      if (!parsed.success) throw vendorChanged(`/course/courses/${id}: a module`);
      const m = parsed.data.attributes;
      // Modules the lecturer switched off are hidden from Students on Edunex too.
      if (!m.is_active) continue;
      modules.push({ id: Number(parsed.data.id), courseId: m.course_id, title: m.name.trim(), postedAt: edunexTime(m.created_at), index: m.index });
    }
    outline.modules.push(...modules.sort((a, b) => a.index - b.index).map(({ index: _index, ...m }) => m));
    // Before the lecturer publishes, Edunex's gradebook says 0 · E for everyone: never a grade.
    if (!outline.grade && attributes.gradebook_publish) outline.grade = await fetchGrade(client, id, course.edunex.classId, nim);
  }
  return outline;
}

async function fetchGrade(client: EdunexClient, courseId: number, classId: number, nim: string | null): Promise<GradebookGrade | null> {
  const book = await client.get("/gradebook", { course_id: courseId, class_id: classId }, Gradebook);
  const me = book.students.find((s) => s.code === nim) ?? (book.students.length === 1 ? book.students[0] : undefined);
  if (!me || me.total === null || !me.index) return null;
  if (me.total === 0 && me.index.trim().toUpperCase() === "E") return null;
  return { total: me.total, letter: me.index.trim() };
}

export async function fetchMaterials(client: EdunexClient, course: Course, modules: readonly CourseModule[]): Promise<Material[]> {
  const owners = [
    ...courseIds(course).map((id) => ({ type: "App\\Models\\Courses", id, courseId: id })),
    ...modules.map((m) => ({ type: "App\\Models\\Modules", id: m.id, courseId: m.courseId })),
  ];
  // A few at a time, as Edunex's website loads a course's modules: a course can have 20 of them.
  const docs = await inGroups(owners, 4, (owner) =>
    client.get(
      "/course/contents/",
      { "filter[contentable_id][is]": owner.id, "filter[contentable_type][is]": owner.type, sort: "index", "page[limit]": 0 },
      Contents,
    ),
  );
  const out: Material[] = [];
  owners.forEach((owner, at) => {
    for (const item of docs[at].data) {
      const a = item.attributes;
      const size = Number(a.size);
      out.push({
        id: Number(item.id),
        courseId: owner.courseId,
        moduleId: owner.type === "App\\Models\\Modules" ? owner.id : null,
        title: a.name.trim(),
        type: a.type,
        content: a.content,
        sizeBytes: a.size != null && Number.isFinite(size) && size > 0 ? size : null,
        postedAt: edunexTime(a.created_at),
        updatedAt: edunexTime(a.updated_at),
      });
    }
  });
  return out;
}

/** Every Presence session of the class, page by page (Edunex's "next" link never ends on its own). */
export async function fetchPresence(client: EdunexClient, course: Course): Promise<PresenceSession[]> {
  const out: PresenceSession[] = [];
  for (const courseId of courseIds(course)) {
    for (let offset = 0; ; ) {
      const page = await client.get(
        "/course/presences",
        {
          "filter[course_id][is]": courseId,
          "filter[class_id][is]": course.edunex.classId,
          sort: "start_at",
          "page[limit]": PRESENCE_PAGE,
          "page[offset]": offset,
        },
        Presences,
      );
      for (const item of page.data) out.push(presenceSession(item));
      offset += page.data.length;
      if (page.data.length === 0 || offset >= page.meta.total) break;
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

function presenceSession(item: z.infer<typeof Presences>["data"][number]): PresenceSession {
  const a = item.attributes;
  const start = required(a.start_at);
  const end = required(a.end_at);
  const recorded = a.attandance?.status != null ? { present: a.attandance.status === 1, at: edunexTime(a.attandance.presence_at) } : null;
  return {
    id: Number(item.id),
    courseId: a.course_id,
    classId: a.class_id,
    start,
    end,
    opensAt: edunexTime(a.presence_start) ?? start,
    closesAt: edunexTime(a.presence_end) ?? end,
    topic: a.topic?.trim() || null,
    note: a.note?.trim() || null,
    countsBy: (a.presentable ?? []).map((p) => ({ kind: p.presentable, id: String(p.presentable_id) })),
    // The lecturer's form joins one link per chosen topic with ";": the first is the page to open.
    url:
      a.url
        ?.split(";")
        .map((link) => link.trim())
        .find(Boolean) ?? null,
    recorded,
  };
}

export async function fetchAnnouncements(client: EdunexClient, course: Course): Promise<Announcement[]> {
  const out: Announcement[] = [];
  for (const courseId of courseIds(course)) {
    for (const item of await client.get(`/course/announcements/course/${courseId}`, {}, Announcements)) {
      out.push({ id: item.id, courseId, text: item.announcement.trim(), author: item.creator?.name.trim() || null, postedAt: edunexTime(item.created_at) });
    }
  }
  return out.sort((a, b) => (b.postedAt ?? 0) - (a.postedAt ?? 0));
}

export async function fetchExams(client: EdunexClient, course: Course): Promise<EdunexExam[]> {
  const out: EdunexExam[] = [];
  for (const courseId of courseIds(course)) {
    const doc = await client.get("/exam/exams", { "filter[course_id][is]": courseId, "page[limit]": 0 }, Exams);
    for (const item of doc.data) {
      const a = item.attributes ?? {};
      const text = (key: string) => (typeof a[key] === "string" ? (a[key] as string).trim() || null : null);
      out.push({ id: String(item.id), courseId, title: text("name") ?? text("title"), start: edunexTime(text("start_at")), end: edunexTime(text("end_at")) });
    }
  }
  return out;
}

async function inGroups<T, R>(items: readonly T[], size: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let at = 0; at < items.length; at += size) out.push(...(await Promise.all(items.slice(at, at + size).map(run))));
  return out;
}

// ---------------------------------------------------------------- time

/**
 * Edunex's times in ms. With an offset or Z they are taken as written (the
 * course records are right); without one ("2026-08-27 08:00:00") they are WIB.
 */
export function edunexTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const text = value.trim();
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    const ms = Date.parse(text);
    return Number.isNaN(ms) ? null : ms;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(text);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0)) - WIB_OFFSET;
}

function required(value: string): number {
  const ms = edunexTime(value);
  if (ms === null) throw vendorChanged(`/course/presences: a time "${value.slice(0, 30)}"`);
  return ms;
}

const vendorChanged = (what: string) => new EngineError("VendorChanged", `${what} isn't what Edunex used to send`);
