// Addresses of official pages the app opens in the browser.

export const EDUNEX_WEB = "https://edunex.itb.ac.id";

export const edunexCourseUrl = (courseId: number) => `${EDUNEX_WEB}/courses/${courseId}`;

export const SIX_WEB = "https://six.itb.ac.id";

/** SIX's student status page: this term's courses with SKS and attendance. */
export const sixStatusUrl = (nim: string) => `${SIX_WEB}/app/mahasiswa:${nim}/statusmhs`;
