// A course's meetings, merged as the approved prototype does it (#74): SIX's
// timetable gives the official time and room, Edunex Presence the window and
// what Edunex recorded, and meetings announced only in Edunex text ("Pertemuan
// 03: Jumat, 09 Oktober 2026 Pkl. 15:00 - 17:00 WIB") join in, marked when
// SIX's timetable for that month, read from its own page, doesn't list them.
// Nothing here ever calls a meeting an absence: SIX may count what Edunex
// didn't record.
import { htmlText, materialKind, type OutlineEntry } from "./course-materials";
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
  januari: 1,
  jan: 1,
  january: 1,
  februari: 2,
  feb: 2,
  february: 2,
  maret: 3,
  mar: 3,
  march: 3,
  april: 4,
  apr: 4,
  mei: 5,
  may: 5,
  juni: 6,
  jun: 6,
  june: 6,
  juli: 7,
  jul: 7,
  july: 7,
  agustus: 8,
  agu: 8,
  agt: 8,
  ags: 8,
  aug: 8,
  august: 8,
  september: 9,
  sep: 9,
  sept: 9,
  oktober: 10,
  okt: 10,
  oct: 10,
  october: 10,
  november: 11,
  nov: 11,
  desember: 12,
  des: 12,
  dec: 12,
  december: 12,
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

/**
 * Meetings the lecturer announced in a text material or an announcement,
 * with the link posted for each: one per meeting number ("Pertemuan 03"),
 * which is what identifies a meeting when the lecturer moves it.
 */
export function announcedMeetings(materials: readonly Material[], announcements: readonly Announcement[]): AnnouncedMeeting[] {
  const texts = [
    ...materials
      .filter((m) => materialKind(m.type) === "note" && m.content)
      .map((m) => ({ text: htmlText(m.content ?? ""), at: m.updatedAt ?? m.postedAt ?? 0 })),
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
      // The latest text about a meeting wins: lecturers correct the schedule in place, or post the new time again.
      const previous = found.get(Number(number));
      if (previous && previous.at > at) continue;
      const cleanNote = note?.trim() || null;
      found.set(Number(number), {
        number: Number(number),
        start,
        end,
        note: cleanNote,
        online: /online|daring|teams|zoom|meet|webex/i.test(cleanNote ?? ""),
        link: null,
        at,
      });
    }
  }
  const vicons = materials.filter((m) => materialKind(m.type) === "vicon" && m.content).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  const classLink = classMeetingLink(announcements);
  return [...found.values()]
    .map(({ at: _at, ...meeting }) => {
      // The meeting's own online-class link, else the class's standing one ("Link teams untuk kuliah online").
      const own = vicons.find((m) => new RegExp(`\\bPertemuan\\s*0*${meeting.number}\\b`, "i").test(m.title))?.content ?? null;
      const link = own ?? (meeting.online ? classLink : null);
      return { ...meeting, link, online: meeting.online || link !== null };
    })
    .sort((a, b) => a.start - b.start);
}

// Online-class services whose links a lecturer posts for a meeting.
const MEETING_LINK = /https:\/\/(?:teams\.microsoft\.com|teams\.live\.com|[\w-]+\.zoom\.us|zoom\.us|meet\.google\.com|[\w-]+\.webex\.com)\/[^\s<>"')\]]+/gi;

/** The online-meeting links (Teams, Zoom, Meet, Webex) in a text, in order. */
export function meetingLinks(text: string): string[] {
  return [...text.matchAll(MEETING_LINK)].map((hit) => hit[0].replace(/[.,;:]+$/, ""));
}

/** The class's standing online-meeting link: the newest announcement that posts one. */
export function classMeetingLink(announcements: readonly Announcement[]): string | null {
  const newest = [...announcements].sort((a, b) => (b.postedAt ?? 0) - (a.postedAt ?? 0));
  for (const item of newest) {
    const [link] = meetingLinks(item.text);
    if (link) return link;
  }
  return null;
}

// ---------------------------------------------------------------- merged meetings

export interface Meeting {
  key: string;
  /** SIX's time when SIX lists it, else Edunex's (ms). */
  start: number;
  end: number;
  /** SIX's session: the official time and room. */
  six: ClassSession | null;
  presence: PresenceSession | null;
  announced: AnnouncedMeeting | null;
  /** SIX's timetable for that month was read (from its own page) and doesn't list this meeting. */
  notInSix: boolean;
}

/**
 * present / recorded: what Edunex recorded. open: the Presence window is open
 * now. upcoming: not happened yet. unmarked: the window closed with nothing
 * recorded in Edunex (SIX may still count it). held: past, with no Edunex
 * Presence to tell.
 */
export type MeetingState = "present" | "recorded" | "open" | "upcoming" | "unmarked" | "held";

const WEEK = 7 * 24 * HOUR;

/**
 * The Edunex module that goes with a meeting, for a meeting nothing else names.
 * Edunex's modules carry no date or week, only when the lecturer posted them, so
 * a module goes with a meeting only when it is the one module posted in the week
 * before it (after the meeting before it ended). A whole outline posted at once,
 * or two modules in one week, say nothing about which meeting is which: no guess.
 * Numbered placeholders ("Module 06") say nothing either.
 */
export function meetingModules(meetings: readonly Meeting[], entries: readonly OutlineEntry[]): Map<string, OutlineEntry> {
  const named = entries.filter((e) => e.module.postedAt !== null && !/^(modul|module|pertemuan|minggu|week|sesi|session)\s*\d+$/i.test(e.module.title.trim()));
  const out = new Map<string, OutlineEntry>();
  meetings.forEach((meeting, index) => {
    const from = Math.max(meeting.start - WEEK, index > 0 ? meetings[index - 1].end : -Infinity);
    const posted = named.filter((e) => e.module.postedAt! > from && e.module.postedAt! <= meeting.end);
    if (posted.length === 1) out.set(meeting.key, posted[0]);
  });
  return out;
}

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
 * One course's meetings in time order. SIX's sessions join Edunex's Presence
 * sessions of the same day (the most overlapping one); `sixSessions` is SIX's
 * whole timetable (every course), or null while SIX isn't connected.
 * `sixMonths` are the months whose own timetable page was read ("2026-10"):
 * only there can a meeting be missing from SIX.
 */
export function courseMeetings(
  code: string,
  presence: readonly PresenceSession[],
  sixSessions: readonly ClassSession[] | null,
  announced: readonly AnnouncedMeeting[],
  sixMonths: readonly string[] = [],
): Meeting[] {
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
  const read = new Set(sixSessions ? sixMonths : []);
  for (const meeting of meetings) meeting.notInSix = !meeting.six && read.has(wibMonth(meeting.start));
  return meetings.sort((a, b) => a.start - b.start || a.key.localeCompare(b.key));
}

/** The meeting going on now, else the next one. */
export function pinnedMeeting(meetings: readonly Meeting[], now: number): { meeting: Meeting; current: boolean } | null {
  const current = meetings.find((m) => m.start <= now && now < m.end);
  if (current) return { meeting: current, current: true };
  const next = meetings.find((m) => m.start > now);
  return next ? { meeting: next, current: false } : null;
}

/** An Edunex Presence window of the course that is open now and hasn't recorded the Student yet. */
export function openPresence(presence: readonly PresenceSession[], now: number): PresenceSession | null {
  return openPresences(presence, now)[0] ?? null;
}

/** Every such window, the one closing first first: one can stay open for days after its class, into the next. */
export function openPresences(presence: readonly PresenceSession[], now: number): PresenceSession[] {
  return presence.filter((p) => p.opensAt <= now && now < p.closesAt && !p.recorded?.present).sort((a, b) => a.closesAt - b.closesAt);
}

/** The next meeting still to start (its index), for the "Berikutnya" mark. */
export function nextMeetingIndex(meetings: readonly Meeting[], now: number): number {
  return meetings.findIndex((m) => m.start > now);
}

/** Other courses' SIX sessions that overlap a meeting: a clash the Student has to choose in. */
export function clashes(meeting: Pick<Meeting, "start" | "end">, code: string, schedule: readonly ClassSession[]): ClassSession[] {
  return schedule.filter((s) => s.courseCode !== code && s.start < meeting.end && meeting.start < s.end).sort((a, b) => a.start - b.start);
}
