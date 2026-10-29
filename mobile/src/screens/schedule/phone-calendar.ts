// "Tambahkan ke kalender HP" on the phone itself (scope S8): instead of the desktop's .ics file to
// carry over, the same events (src/core/phone-calendar.ts, which also feeds the .ics) go straight
// into a calendar of their own on the phone, "Edunex Plus", created the first time. Doing it again
// updates them instead of adding copies, as importing the desktop's file again does: a record kept
// in the app's files ties each event's UID to the phone's event, so a class that moved is moved,
// and one SIX no longer lists is taken out. Same events as the file, no alarms (the file has none).
// The other way is the file itself, shared through the share sheet.
import * as Calendar from "expo-calendar";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { wibDay } from "../../../../src/core/course-meetings";
import { ICS_ZONE, writeIcs } from "../../../../src/core/ics";
import type { PhoneItem } from "../../../../src/core/phone-calendar";

/** The phone calendar the app writes to, and only to. */
export const CALENDAR_NAME = "Edunex Plus";
const RECORD = "phone-calendar.json";
const DAY = 24 * 3_600_000;
/** As the .ics file: an item that would end when it starts lasts this long instead. */
const SHORTEST = 30 * 60_000;
/** The app's own calendar color: the accent. */
const COLOR = "#2f6feb";

interface Placed {
  /** The phone's event id. */
  id: string;
  start: number;
  end: number;
}

/** What the app put in the phone's calendar: its calendar, and each event by the item's UID. */
interface Record {
  calendarId: string;
  events: { [uid: string]: Placed };
}

export type AddResult = { kind: "added"; events: number } | { kind: "denied" };

function readRecord(calendarId: string): Record {
  const file = new File(Paths.document, RECORD);
  try {
    const record = file.exists ? (JSON.parse(file.textSync()) as Record) : null;
    if (record?.calendarId === calendarId && record.events) return record;
  } catch {
    // An unreadable record: start again, the events it named are found by nothing and stay as they are.
  }
  return { calendarId, events: {} };
}

function writeRecord(record: Record): void {
  new File(Paths.document, RECORD).writeSync(JSON.stringify(record));
}

/** Calendar access, asked for once if it can still be asked. */
async function allowed(): Promise<boolean> {
  const now = await Calendar.getCalendarPermissions();
  if (now.granted) return true;
  if (!now.canAskAgain) return false;
  return (await Calendar.requestCalendarPermissions()).granted;
}

/** The app's own calendar on the phone, made the first time (a local one: nothing syncs it to an account). */
async function ownCalendar(): Promise<Calendar.ExpoCalendar> {
  const calendars = await Calendar.getCalendars();
  const found = calendars.find((c) => c.title === CALENDAR_NAME && c.allowsModifications && c.source?.isLocalAccount !== false);
  if (found) return found;
  return Calendar.createCalendar({
    title: CALENDAR_NAME,
    name: CALENDAR_NAME,
    color: COLOR,
    source: { isLocalAccount: true, name: CALENDAR_NAME, type: "LOCAL" },
    ownerAccount: CALENDAR_NAME,
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
    timeZone: ICS_ZONE,
  });
}

/** UTC midnight of the WIB day `ms` falls on: Android keeps whole-day events in UTC. */
const utcMidnight = (ms: number) => Date.parse(`${wibDay(ms)}T00:00:00Z`);

/** An item as the phone's event: the .ics file's times (ics.ts), its link in the notes (Android events have no link field). */
function eventOf(item: PhoneItem) {
  const allDay = item.allDay === true;
  return {
    title: item.summary,
    startDate: new Date(allDay ? utcMidnight(item.start) : item.start),
    endDate: new Date(allDay ? utcMidnight(Math.max(item.end, item.start + DAY)) : item.end > item.start ? item.end : item.start + SHORTEST),
    allDay,
    timeZone: allDay ? "UTC" : ICS_ZONE,
    location: item.location ?? "",
    notes: [item.description, item.url].filter(Boolean).join("\n"),
    availability: item.free ? Calendar.Availability.FREE : Calendar.Availability.BUSY,
    alarms: [],
  };
}

/** The app's event for `placed`, while it's still in its calendar. */
async function existing(placed: Placed | undefined, calendarId: string): Promise<Calendar.ExpoCalendarEvent | null> {
  if (!placed) return null;
  try {
    const event = await Calendar.ExpoCalendarEvent.get(placed.id);
    return event.calendarId === calendarId ? event : null;
  } catch {
    // Deleted on the phone since: it's added again.
    return null;
  }
}

/** An event as its title and start, which is what tells two of the app's events apart without its record. */
const keyOf = (event: { title?: string; startDate: Date | string }) => `${event.title ?? ""}|${new Date(event.startDate).getTime()}`;

/**
 * The app's calendar's events that its record doesn't name (the app reinstalled or its data cleared, the calendar
 * kept by the phone), by title and start: an item the record doesn't know takes the one already there instead of a copy.
 */
async function unrecorded(calendar: Calendar.ExpoCalendar, record: Record, items: readonly PhoneItem[]): Promise<Map<string, Calendar.ExpoCalendarEvent[]>> {
  const found = new Map<string, Calendar.ExpoCalendarEvent[]>();
  const strays = items.filter((item) => !record.events[item.uid]);
  if (!strays.length) return found;
  const known = new Set(Object.values(record.events).map((placed) => placed.id));
  const from = Math.min(...strays.map((item) => item.start)) - DAY;
  const until = Math.max(...strays.map((item) => Math.max(item.end, item.start))) + DAY;
  const events = await calendar.listEvents(new Date(from), new Date(until)).catch(() => []);
  for (const event of events) {
    if (known.has(event.id)) continue;
    const key = keyOf(event);
    found.set(key, [...(found.get(key) ?? []), event]);
  }
  return found;
}

/** One of `unknown`'s events with `details`' title and start, taken so a second item like it doesn't take it too. */
function claim(unknown: Map<string, Calendar.ExpoCalendarEvent[]>, details: { title: string; startDate: Date }): Calendar.ExpoCalendarEvent | null {
  return unknown.get(keyOf(details))?.shift() ?? null;
}

/**
 * Puts `items` in the phone's "Edunex Plus" calendar, updating the ones put there before.
 * `current`: the UIDs of everything the sources hold between `from` and `until` (ms), whatever the
 * Student picked: an event put there before in that span whose item is gone (a class SIX dropped)
 * comes out; one of a kind left out this time stays, as with the .ics file.
 */
export async function addToPhoneCalendar(items: readonly PhoneItem[], current: ReadonlySet<string>, span: { from: number; until: number }): Promise<AddResult> {
  if (!(await allowed())) return { kind: "denied" };
  const calendar = await ownCalendar();
  const record = readRecord(calendar.id);
  const unknown = await unrecorded(calendar, record, items);
  try {
    for (const item of items) {
      const details = eventOf(item);
      const event = (await existing(record.events[item.uid], calendar.id)) ?? claim(unknown, details);
      if (event) await event.update(details);
      const id = event?.id ?? (await calendar.createEvent(details)).id;
      record.events[item.uid] = { id, start: item.start, end: item.end };
    }
    for (const [uid, placed] of Object.entries(record.events)) {
      if (current.has(uid) || placed.end <= span.from || placed.start >= span.until) continue;
      await (await existing(placed, calendar.id))?.delete();
      delete record.events[uid];
    }
  } finally {
    // What went in stays known, even when one event failed halfway: the next try updates it.
    writeRecord(record);
  }
  return { kind: "added", events: items.length };
}

/** The same events as an .ics file, through the share sheet (Drive, email, another calendar app). */
export async function shareIcs(items: readonly PhoneItem[], now: number): Promise<void> {
  const text = writeIcs(
    items.map(({ kind: _kind, ...item }) => item),
    { name: CALENDAR_NAME, now },
  );
  const file = new File(Paths.cache, `${CALENDAR_NAME}.ics`);
  file.writeSync(text);
  if (!(await Sharing.isAvailableAsync())) throw new Error("This phone can't share files");
  await Sharing.shareAsync(file.uri, { mimeType: "text/calendar", UTI: "public.calendar-event", dialogTitle: `${CALENDAR_NAME}.ics` });
}
