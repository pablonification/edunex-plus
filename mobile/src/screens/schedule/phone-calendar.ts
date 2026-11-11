// "Tambahkan ke kalender HP" on the phone itself (scope S8): instead of the desktop's .ics file to
// carry over, the same events (src/core/phone-calendar.ts, which also feeds the .ics) go straight
// into a calendar of their own on the phone, "Edunex Plus", created the first time. Doing it again
// updates them instead of adding copies, as importing the desktop's file again does: a record kept
// in the app's files ties each event's UID to the phone's event, so a class that moved is moved,
// and one SIX no longer lists is taken out. Same events as the file, no alarms (the file has none).
// The other way is the file itself, shared through the share sheet.
//
// Everything the app puts on the phone goes through here, into that one calendar: Jadwal's "Kalender HP" switch (the
// whole term, kept in step: ./calendar-sync.tsx), one date from Kalender akademik and one exam's sittings (each added
// or taken out on its own). The record says which is which, and every screen reads it (`placedNow`, `subscribePlaced`):
// a date Jadwal's switch keeps shows as in the calendar on Kalender akademik too, and turning the switch off, which
// takes the whole calendar off the phone, empties it for all of them.
import * as Calendar from "expo-calendar";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Linking, Platform } from "react-native";
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
  /** Jadwal's switch wrote it and keeps it in step; without, the Student added it on its own (a date, an exam). */
  kept?: true;
}

/** How an event got into the phone's calendar: on its own ("added"), or with Jadwal's switch, which keeps it ("kept"). */
export type PlacedHow = "added" | "kept";

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
  publish(record);
}

// What's in the phone's calendar as the app last knew it, for the screens: read from the record once, then kept as it changes.
let placed: ReadonlyMap<string, PlacedHow> | null = null;
const listeners = new Set<() => void>();

function savedRecord(): Record | null {
  try {
    const file = new File(Paths.document, RECORD);
    const record = file.exists ? (JSON.parse(file.textSync()) as Record) : null;
    return record?.calendarId && record.events ? record : null;
  } catch {
    return null;
  }
}

function publish(record: Record | null): void {
  placed = new Map(Object.entries(record?.events ?? {}).map(([uid, event]) => [uid, event.kept ? "kept" : "added"]));
  for (const listener of listeners) listener();
}

/** Each event the app has in the phone's calendar, by its item's UID, and how it got there. */
export function placedNow(): ReadonlyMap<string, PlacedHow> {
  if (!placed) publish(savedRecord());
  return placed as ReadonlyMap<string, PlacedHow>;
}

export function subscribePlaced(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Calendar access, asked for once if it can still be asked (`ask`: the Student just asked for it; a sync in the background never asks). */
async function allowed(ask = true): Promise<boolean> {
  const now = await Calendar.getCalendarPermissions();
  if (now.granted) return true;
  if (!ask || !now.canAskAgain) return false;
  return (await Calendar.requestCalendarPermissions()).granted;
}

/** The phone's calendars. iOS asks for its events' ones only: all of them would need Reminders' permission too. */
const eventCalendars = () => (Platform.OS === "ios" ? Calendar.getCalendars(Calendar.EntityTypes.EVENT) : Calendar.getCalendars());

/** The app's own calendar on the phone, made the first time (a local one: nothing syncs it to an account). */
async function ownCalendar(): Promise<Calendar.ExpoCalendar> {
  const calendars = await eventCalendars();
  const found = calendars.find((c) => c.title === CALENDAR_NAME && c.allowsModifications && c.source?.isLocalAccount !== false);
  if (found) return found;
  // iOS makes a calendar inside an account it already has (the default calendar's: iCloud, or the phone's own).
  if (Platform.OS === "ios")
    return Calendar.createCalendar({
      title: CALENDAR_NAME,
      color: COLOR,
      entityType: Calendar.EntityTypes.EVENT,
      sourceId: Calendar.getDefaultCalendarSync().source.id,
    });
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

/** Noon in WIB on a day: the same date wherever the iPhone's calendar reads it. */
const wibNoon = (day: string) => Date.parse(`${day}T12:00:00+07:00`);

/**
 * A whole-day item's first and last moment as each phone wants them. Android: UTC midnights, the end the day after
 * the last (exclusive). iOS: any moment on the first day and any on the last (its end day is part of the event, so
 * Android's end would add a day), in the phone's own zone.
 */
function wholeDays(item: PhoneItem): { startDate: Date; endDate: Date; timeZone: string } {
  const end = Math.max(item.end, item.start + DAY);
  if (Platform.OS === "ios") return { startDate: new Date(wibNoon(wibDay(item.start))), endDate: new Date(wibNoon(wibDay(end - 1))), timeZone: ICS_ZONE };
  return { startDate: new Date(utcMidnight(item.start)), endDate: new Date(utcMidnight(end)), timeZone: "UTC" };
}

/** An item as the phone's event: the .ics file's times (ics.ts), its link in the notes (Android events have no link field). */
function eventOf(item: PhoneItem) {
  const allDay = item.allDay === true;
  const days = allDay ? wholeDays(item) : null;
  return {
    title: item.summary,
    startDate: days?.startDate ?? new Date(item.start),
    endDate: days?.endDate ?? new Date(item.end > item.start ? item.end : item.start + SHORTEST),
    allDay,
    timeZone: days?.timeZone ?? ICS_ZONE,
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
export async function addToPhoneCalendar(
  items: readonly PhoneItem[],
  current: ReadonlySet<string>,
  span: { from: number; until: number },
  { ask = true, kept = false }: { ask?: boolean /** Jadwal's switch is writing: it keeps these in step from now on. */; kept?: boolean } = {},
): Promise<AddResult> {
  if (!(await allowed(ask))) return { kind: "denied" };
  const calendar = await ownCalendar();
  const record = readRecord(calendar.id);
  const unknown = await unrecorded(calendar, record, items);
  try {
    for (const item of items) {
      const details = eventOf(item);
      const event = (await existing(record.events[item.uid], calendar.id)) ?? claim(unknown, details);
      if (event) await event.update(details);
      const id = event?.id ?? (await calendar.createEvent(details)).id;
      const keeps = kept || record.events[item.uid]?.kept === true;
      record.events[item.uid] = { id, start: item.start, end: item.end, ...(keeps ? { kept: true as const } : {}) };
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

/**
 * Takes these events out of the phone's calendar again (a date or an exam the Student added on its own). One already
 * deleted on the phone is simply forgotten.
 */
export async function removeFromPhoneCalendar(uids: Iterable<string>): Promise<"removed" | "denied"> {
  const record = savedRecord();
  if (!record) return "removed";
  if (!(await allowed(false))) return "denied";
  try {
    for (const uid of uids) {
      await (await existing(record.events[uid], record.calendarId))?.delete();
      delete record.events[uid];
    }
  } finally {
    writeRecord(record);
  }
  return "removed";
}

/**
 * Makes what the screens say true again: an event the Student deleted in the phone's own calendar app is no longer
 * "in the calendar" here. Only looks (never asks for access; without it, what the record says stands).
 */
export async function checkPlaced(uids: Iterable<string>): Promise<void> {
  const record = savedRecord();
  if (!record || !(await Calendar.getCalendarPermissions().catch(() => null))?.granted) return;
  let gone = false;
  for (const uid of uids) {
    if (!record.events[uid] || (await existing(record.events[uid], record.calendarId))) continue;
    delete record.events[uid];
    gone = true;
  }
  if (gone) writeRecord(record);
}

/**
 * Takes the app's own calendar off the phone, with every event in it: Jadwal's, and each date or exam added on its
 * own (the Student turned Jadwal's ⋮ "Kalender HP" off).
 */
export async function removePhoneCalendar(): Promise<void> {
  if (!(await Calendar.getCalendarPermissions()).granted) return;
  const calendars = await eventCalendars();
  for (const calendar of calendars.filter((c) => c.title === CALENDAR_NAME && c.allowsModifications && c.source?.isLocalAccount !== false))
    await calendar.delete();
  const record = new File(Paths.document, RECORD);
  if (record.exists) record.delete();
  publish(null);
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

/** The phone's calendar app, opened on a moment (Android's calendar link: content://com.android.calendar/time/<ms>). */
export const openPhoneCalendar = (at: number): Promise<void> => Linking.openURL(`content://com.android.calendar/time/${at}`);
