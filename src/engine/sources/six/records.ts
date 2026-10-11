// SIX records as feeds (#78, #79, #80): the transcript with graduation
// progress, the curriculum with the Student's registrations, the study plan
// and UKT bills, each read when SIX's session starts and then once a day.
// They stay on this computer like every dataset.
import type { Curriculum, Syllabus } from "../../../core/models";
import { EngineError } from "../../errors";
import type { SourceContext } from "../source";
import type { SixIdentity, SixPages } from "./pages";
import { readBills } from "./readers/bills";
import { readCurriculumList } from "./readers/curriculum-list";
import { readCurriculumStructure } from "./readers/curriculum-structure";
import { readKrs } from "./readers/krs";
import { readProgress } from "./readers/progress";
import { changed } from "./readers/records-common";
import { readSchemes } from "./readers/schemes";
import { readSyllabus } from "./readers/syllabus";
import { readTranscript } from "./readers/transcript";

const HOUR = 3_600_000;
const DAILY = { every: 24 * HOUR, jitter: HOUR };

/** Where each record is, for the signed-in Student. */
export const recordPaths = {
  transcript: ({ nim, studentId }: SixIdentity) => `/app/mahasiswa:${nim}/statusmhs/transkrip/historis/${studentId}`,
  progress: ({ nim, studentId }: SixIdentity) => `/app/mahasiswa:${nim}/statusmhs/transkrip/kurikulum/${studentId}`,
  curricula: ({ nim }: SixIdentity) => `/app/mahasiswa:${nim}/kurikulum/kurikulum/list`,
  schemes: ({ nim, studentId }: SixIdentity) => `/app/mahasiswa:${nim}/statusmhs/program-integrasi/riwayat/${studentId}`,
  krs: ({ nim, studentId, term }: SixIdentity) => `/app/mahasiswa:${nim}+${term}/registrasi/rencanastudi/${studentId}`,
  bills: ({ nim }: SixIdentity) => `/app/mahasiswa:${nim}/keuangan`,
  syllabus: ({ nim }: SixIdentity, courseId: string) => `/app/mahasiswa:${nim}/kurikulum/silabus/${courseId}/view`,
};

export function registerSixRecordFeeds(context: SourceContext, pages: SixPages): void {
  context.feed({
    name: "six.transcript",
    ...DAILY,
    async run() {
      const who = await pages.who();
      const history = await pages.page(recordPaths.transcript(who));
      // SIX shows the IPK on the curriculum-position page; the transcript's rows are checked against it.
      const { progress, ipk } = readProgress(await pages.page(recordPaths.progress(who)));
      const transcript = readTranscript(history, ipk);
      await context.set("six.transcript", transcript);
      await context.set("six.progress", progress);
    },
  });
  context.feed({
    name: "six.curriculum",
    ...DAILY,
    async run() {
      await context.set("six.curriculum", await fetchCurriculum(pages));
    },
  });
  context.feed({
    name: "six.krs",
    ...DAILY,
    async run() {
      await context.set("six.krs", readKrs(await pages.page(recordPaths.krs(await pages.who()))));
    },
  });
  context.feed({
    name: "six.bills",
    ...DAILY,
    async run() {
      await context.set("six.bills", readBills(await pages.page(recordPaths.bills(await pages.who()))));
    },
  });
}

/** The curriculum in force for the Student's program, its structure, and what the Student registered for. */
export async function fetchCurriculum(pages: SixPages): Promise<Curriculum> {
  const who = await pages.who();
  const list = readCurriculumList(await pages.page(recordPaths.curricula(who)));
  const current = list.filter((entry) => entry.active).sort((a, b) => b.year - a.year)[0];
  if (!current) changed("curriculum list", "no curriculum is in force");
  const structure = readCurriculumStructure(await pages.page(current.structurePath));
  const registrations = readSchemes(await pages.page(recordPaths.schemes(who)));
  return {
    name: structure.name,
    year: current.year,
    program: current.program,
    graduationSks: current.graduationSks,
    semesters: current.semesters,
    required: structure.required,
    specializations: structure.specializations,
    minors: structure.minors,
    catalog: structure.catalog,
    registrations,
  };
}

/** A course's syllabus, on demand (the Planner, a course page): one page, so it isn't fetched by a feed. */
export async function fetchSyllabus(pages: SixPages, courseId: string): Promise<Syllabus> {
  if (!/^\d+$/.test(courseId)) throw new EngineError("Rejected", `"${courseId}" isn't a SIX course id`);
  return readSyllabus(await pages.page(recordPaths.syllabus(await pages.who(), courseId)), courseId);
}
