// A course's meetings, merged as the approved prototype does it (#74): SIX's
// timetable gives the official time and room, EduNex Presence the window and
// what EduNex recorded, and meetings announced only in EduNex text ("Pertemuan
// 03: Jumat, 09 Oktober 2026 Pkl. 15:00 - 17:00 WIB") join in, marked when
// SIX's timetable for that month doesn't list them. Nothing here ever calls a
// meeting an absence: SIX may count what EduNex didn't record.
import { htmlText, materialKind } from "./course-materials";
import type { Announcement, ClassSession, Material, PresenceSession } from "./models";

const HOUR = 3_600_000;

export interface AnnouncedMeeting {
  /** "Pertemuan 03" → 3. */
  number: number;
  start: number;
  end: number;
  /** What the text adds in brackets: "Online - Link meeting teams". */
  note: string | null;
  online: boolean;
  /** The online-class link posted for that meeting, when there is one. */
  link: string | null;
}

const MONTHS: Readonly<Record<string, number>> = {
  januari: 1, jan: 1, january: 1,
  februari: 2, feb: 2, february: 2,
  maret: 3, mar: 3, march: 3,
  april: 4, apr: 4,
  mei: 5, may: 5,
  juni: 6, jun: 6, june: 6,
  juli: 7, jul: 7, july: 7,
  agustus: 8, agu: 8, agt: 8, ags: 8, aug: 8, august: 8,
  september: 9, sep: 9, sept: 9,
  oktober: 10, okt: 10, oct: 10, october: 10,
  november: 11, nov: 11,
  desember: 12, des: 12, dec: 12, december: 12,
};

// "Pertemuan 03: Jumat, 09 Oktober 2026 Pkl. 15:00 - 17:00 WIB (Online - Link meeting teams)"
const ANNOUNCED =
  /Pertemuan\s+(?:ke[-\s]?)?(\d{1,2})\s*[:,.–-]?\s*(?:[A-Za-z']+\s*,\s*)?(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})\s*,?\s*(?:(?:Pkl|Pukul|Jam)\.?\s*)?(\d{1,2})[.:](\d{2})\s*(?:-|–|—|s\.?\s?d\.?|sampai)\s*(\d{1,2})[.:](\d{2})(?:\s*WIB)?(?:\s*\(([^)]*)\))?/gi;

/** A wall-clock time in WIB (UTC+7), ITB's time. */
function wib(year: number, month: number, day: number, hour: number, minute: number): number | null {
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const ms = Date.UTC(year, month - 1, day, hour - 7, minute);
  return new Date(ms + 7 * HOUR).getUTCDate() === day ? ms : null;
}

/** "2026-10-09": the day in WIB, so meetings line up the same on any computer. */
export const wibDay = (ms: number) => new Date(ms + 7 * HOUR).toISOString().slice(0, 10);
const wibMonth = (ms: number) => wibDay(ms).slice(0, 7);

/** Meetings the lecturer announced in a text material or an announcement, with the link posted for each. */
export function announcedMeetings(materials: readonly Material[], announcements: readonly Announcement[]): AnnouncedMeeting[] {
  const texts = [
    ...materials.filter((m) => materialKind(m.type) === "note" && m.content).map((m) => ({ text: htmlText(m.content ?? ""), at: m.updatedAt ?? m.postedAt ?? 0 })),
    ...announcements.map((a) => ({ text: a.text, at: a.postedAt ?? 0 })),
  ];
  const found = new Map<number, AnnouncedMeeting & { at: number }>();
  for (const { text, at } of texts) {
    for (const hit of text.matchAll(ANNOUNCED)) {
      const [, number, day, monthName, year, h1, m1, h2, m2, note] = hit;
      const month = MONTHS[monthName.toLowerCase()];
      if (!month) continue;
      const start = wib(Number(year), month, Number(day), Number(h1), Number(m1));
      const end = wib(Number(year), month, Number(day), Number(h2), Number(m2));
      if (start === null || end === null || end <= start) continue;
      // The latest text about a meeting wins: lecturers correct the schedule in place.
      const previous = found.get(start);
      if (previous && previous.at > at) continue;
      const cleanNote = note?.trim() || null;
      found.set(start, { number: Number(number), start, end, note: cleanNote, online: /online|daring|teams|zoom|meet|webex/i.test(cleanNote ?? ""), link: null, at });
    }
  }
  const vicons = materials.filter((m) => materialKind(m.type) === "vicon" && m.content).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  return [...found.values()]
    .map(({ at: _at, ...meeting }) => {
      const link = vicons.find((m) => new RegExp(`\\bPertemuan\\s*0*${meeting.number}\\b`, "i").test(m.title))?.content ?? null;
      return { ...meeting, link, online: meeting.online || link !== null };
    })
    .sort((a, b) => a.start - b.start);
}

// ---------------------------------------------------------------- merged meetings

export interface Meeting {
  key: string;
  /** SIX's time when SIX lists it, else EduNex's (ms). */
  start: number;
  end: number;
  /** SIX's session: the official time and room. */
  six: ClassSession | null;
  presence: PresenceSession | null;
  announced: AnnouncedMeeting | null;
  /** SIX's timetable covers that month and doesn't list this meeting. */
  notInSix: boolean;
}

/**
 * present / recorded: what EduNex recorded. open: the Presence window is open
 * now. upcoming: not happened yet. unmarked: the window closed with nothing
 * recorded in EduNex (SIX may still count it). held: past, with no EduNex
 * Presence to tell.
 */
export type MeetingState = "present" | "recorded" | "open" | "upcoming" | "unmarked" | "held";

export function meetingState(meeting: Meeting, now: number): MeetingState {
  const presence = meeting.presence;
  if (presence?.recorded) return presence.recorded.present ? "present" : "recorded";
  if (presence) {
    if (now < presence.opensAt) return "upcoming";
    return now < presence.closesAt ? "open" : "unmarked";
  }
  return meeting.start > now ? "upcoming" : "held";
}

/**
 * One course's meetings in time order. SIX's sessions join EduNex's Presence
 * sessions of the same day (the most overlapping one); `sixSessions` is SIX's
 * whole timetable (every course), or null while SIX isn't connected.
 */
export function courseMeetings(code: string, presence: readonly PresenceSession[], sixSessions: readonly ClassSession[] | null, announced: readonly AnnouncedMeeting[]): Meeting[] {
  const meetings: Meeting[] = presence.map((p) => ({ key: `p${p.id}`, start: p.start, end: p.end, six: null, presence: p, announced: null, notInSix: false }));
  const overlap = (m: Meeting, start: number, end: number) => Math.min(m.end, end) - Math.max(m.start, start);
  for (const session of (sixSessions ?? []).filter((s) => s.courseCode === code)) {
    const sameDay = meetings.filter((m) => !m.six && m.presence && wibDay(m.start) === wibDay(session.start));
    const match = sameDay.sort((a, b) => overlap(b, session.start, session.end) - overlap(a, session.start, session.end))[0];
    if (match) Object.assign(match, { six: session, start: session.start, end: session.end });
    else meetings.push({ key: `s${session.id}`, start: session.start, end: session.end, six: session, presence: null, announced: null, notInSix: false });
  }
  for (const item of announced) {
    const match = meetings.find((m) => !m.announced && wibDay(m.start) === wibDay(item.start));
    if (match) match.announced = item;
    else meetings.push({ key: `a${item.start}`, start: item.start, end: item.end, six: null, presence: null, announced: item, notInSix: false });
  }
  const covered = new Set((sixSessions ?? []).map((s) => wibMonth(s.start)));
  for (const meeting of meetings) meeting.notInSix = !meeting.six && covered.has(wibMonth(meeting.start));
  return meetings.sort((a, b) => a.start - b.start || a.key.localeCompare(b.key));
}

/** The meeting going on now, else the next one. */
export function pinnedMeeting(meetings: readonly Meeting[], now: number): { meeting: Meeting; current: boolean } | null {
  const current = meetings.find((m) => m.start <= now && now < m.end);
  if (current) return { meeting: current, current: true };
  const next = meetings.find((m) => m.start > now);
  return next ? { meeting: next, current: false } : null;
}

/** An EduNex Presence window of the course that is open now and hasn't recorded the Student yet. */
export function openPresence(presence: readonly PresenceSession[], now: number): PresenceSession | null {
  return presence.find((p) => p.opensAt <= now && now < p.closesAt && !p.recorded?.present) ?? null;
}
