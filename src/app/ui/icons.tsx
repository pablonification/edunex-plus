// The app's icon set: Microsoft's Fluent UI System Icons (MIT,
// github.com/microsoft/fluentui-system-icons), drawn for a desktop app.
// Each comes drawn at 16 and 20 px, regular and filled: an icon draws the
// one made for the size it shows at (16 for 16 px and under, 20 above), so
// its lines stay crisp. Regular by default; "bold" and "fill" draw the filled
// form, as Fluent itself marks emphasis and the place the Student is in.
// The headless build: plain SVG, no styling runtime. Each icon is imported on
// its own, so only these end up in the app. Icons are decorative: give the
// control around them an accessible name. The two arrows are the app's own,
// in Fluent's style (see `strokes`).

import { Add16Filled, Add16Regular, Add20Filled, Add20Regular } from "@fluentui/react-icons/headless/svg/add";
import { Alert16Filled, Alert16Regular, Alert20Filled, Alert20Regular } from "@fluentui/react-icons/headless/svg/alert";
import { ArrowAutofitWidth20Filled, ArrowAutofitWidth20Regular } from "@fluentui/react-icons/headless/svg/arrow-autofit-width";
import {
  ArrowCounterclockwise16Filled,
  ArrowCounterclockwise16Regular,
  ArrowCounterclockwise20Filled,
  ArrowCounterclockwise20Regular,
} from "@fluentui/react-icons/headless/svg/arrow-counterclockwise";
import {
  ArrowDownload16Filled,
  ArrowDownload16Regular,
  ArrowDownload20Filled,
  ArrowDownload20Regular,
} from "@fluentui/react-icons/headless/svg/arrow-download";
import { ArrowReply16Filled, ArrowReply16Regular, ArrowReply20Filled, ArrowReply20Regular } from "@fluentui/react-icons/headless/svg/arrow-reply";
import { ArrowSync16Filled, ArrowSync16Regular, ArrowSync20Filled, ArrowSync20Regular } from "@fluentui/react-icons/headless/svg/arrow-sync";
import { ArrowUpload16Filled, ArrowUpload16Regular, ArrowUpload20Filled, ArrowUpload20Regular } from "@fluentui/react-icons/headless/svg/arrow-upload";
import { Attach16Filled, Attach16Regular, Attach20Filled, Attach20Regular } from "@fluentui/react-icons/headless/svg/attach";
import { BookOpen16Filled, BookOpen16Regular, BookOpen20Filled, BookOpen20Regular } from "@fluentui/react-icons/headless/svg/book-open";
import {
  CalendarClock16Filled,
  CalendarClock16Regular,
  CalendarClock20Filled,
  CalendarClock20Regular,
} from "@fluentui/react-icons/headless/svg/calendar-clock";
import { CalendarLtr16Filled, CalendarLtr16Regular, CalendarLtr20Filled, CalendarLtr20Regular } from "@fluentui/react-icons/headless/svg/calendar-ltr";
import { Chat16Filled, Chat16Regular, Chat20Filled, Chat20Regular } from "@fluentui/react-icons/headless/svg/chat";
import { Checkmark16Filled, Checkmark16Regular, Checkmark20Filled, Checkmark20Regular } from "@fluentui/react-icons/headless/svg/checkmark";
import {
  CheckmarkCircle16Filled,
  CheckmarkCircle16Regular,
  CheckmarkCircle20Filled,
  CheckmarkCircle20Regular,
} from "@fluentui/react-icons/headless/svg/checkmark-circle";
import { ChevronDown16Filled, ChevronDown16Regular, ChevronDown20Filled, ChevronDown20Regular } from "@fluentui/react-icons/headless/svg/chevron-down";
import { ChevronLeft16Filled, ChevronLeft16Regular, ChevronLeft20Filled, ChevronLeft20Regular } from "@fluentui/react-icons/headless/svg/chevron-left";
import { ChevronRight16Filled, ChevronRight16Regular, ChevronRight20Filled, ChevronRight20Regular } from "@fluentui/react-icons/headless/svg/chevron-right";
import { Circle16Filled, Circle16Regular, Circle20Filled, Circle20Regular } from "@fluentui/react-icons/headless/svg/circle";
import {
  ClipboardTask16Filled,
  ClipboardTask16Regular,
  ClipboardTask20Filled,
  ClipboardTask20Regular,
} from "@fluentui/react-icons/headless/svg/clipboard-task";
import { Clock16Filled, Clock16Regular, Clock20Filled, Clock20Regular } from "@fluentui/react-icons/headless/svg/clock";
import { ClockAlarm16Filled, ClockAlarm16Regular, ClockAlarm20Filled, ClockAlarm20Regular } from "@fluentui/react-icons/headless/svg/clock-alarm";
import { Color16Filled, Color16Regular, Color20Filled, Color20Regular } from "@fluentui/react-icons/headless/svg/color";
import { Directions16Filled, Directions16Regular, Directions20Filled, Directions20Regular } from "@fluentui/react-icons/headless/svg/directions";
import { Dismiss16Filled, Dismiss16Regular, Dismiss20Filled, Dismiss20Regular } from "@fluentui/react-icons/headless/svg/dismiss";
import { DocumentText16Filled, DocumentText16Regular, DocumentText20Filled, DocumentText20Regular } from "@fluentui/react-icons/headless/svg/document-text";
import { Edit16Filled, Edit16Regular, Edit20Filled, Edit20Regular } from "@fluentui/react-icons/headless/svg/edit";
import { Eye16Filled, Eye16Regular, Eye20Filled, Eye20Regular } from "@fluentui/react-icons/headless/svg/eye";
import { EyeOff16Filled, EyeOff16Regular, EyeOff20Filled, EyeOff20Regular } from "@fluentui/react-icons/headless/svg/eye-off";
import { Flag16Filled, Flag16Regular, Flag20Filled, Flag20Regular } from "@fluentui/react-icons/headless/svg/flag";
import { Flash16Filled, Flash16Regular, Flash20Filled, Flash20Regular } from "@fluentui/react-icons/headless/svg/flash";
import { FolderOpen16Filled, FolderOpen16Regular, FolderOpen20Filled, FolderOpen20Regular } from "@fluentui/react-icons/headless/svg/folder-open";
import { Globe16Filled, Globe16Regular, Globe20Filled, Globe20Regular } from "@fluentui/react-icons/headless/svg/globe";
import { Grid16Filled, Grid16Regular, Grid20Filled, Grid20Regular } from "@fluentui/react-icons/headless/svg/grid";
import { HandRight16Filled, HandRight16Regular, HandRight20Filled, HandRight20Regular } from "@fluentui/react-icons/headless/svg/hand-right";
import {
  HatGraduation16Filled,
  HatGraduation16Regular,
  HatGraduation20Filled,
  HatGraduation20Regular,
} from "@fluentui/react-icons/headless/svg/hat-graduation";
import { History16Filled, History16Regular, History20Filled, History20Regular } from "@fluentui/react-icons/headless/svg/history";
import { Home16Filled, Home16Regular, Home20Filled, Home20Regular } from "@fluentui/react-icons/headless/svg/home";
import { Image16Filled, Image16Regular, Image20Filled, Image20Regular } from "@fluentui/react-icons/headless/svg/image";
import { ImageOff20Filled, ImageOff20Regular } from "@fluentui/react-icons/headless/svg/image-off";
import { Info16Filled, Info16Regular, Info20Filled, Info20Regular } from "@fluentui/react-icons/headless/svg/info";
import { Layer20Filled, Layer20Regular } from "@fluentui/react-icons/headless/svg/layer";
import { Link16Filled, Link16Regular, Link20Filled, Link20Regular } from "@fluentui/react-icons/headless/svg/link";
import { Location16Filled, Location16Regular, Location20Filled, Location20Regular } from "@fluentui/react-icons/headless/svg/location";
import { LockClosed16Filled, LockClosed16Regular, LockClosed20Filled, LockClosed20Regular } from "@fluentui/react-icons/headless/svg/lock-closed";
import { MailInbox16Filled, MailInbox16Regular, MailInbox20Filled, MailInbox20Regular } from "@fluentui/react-icons/headless/svg/mail-inbox";
import { Megaphone16Filled, Megaphone16Regular, Megaphone20Filled, Megaphone20Regular } from "@fluentui/react-icons/headless/svg/megaphone";
import {
  MoreHorizontal16Filled,
  MoreHorizontal16Regular,
  MoreHorizontal20Filled,
  MoreHorizontal20Regular,
} from "@fluentui/react-icons/headless/svg/more-horizontal";
import { Note16Filled, Note16Regular, Note20Filled, Note20Regular } from "@fluentui/react-icons/headless/svg/note";
import { PageFit16Filled, PageFit16Regular, PageFit20Filled, PageFit20Regular } from "@fluentui/react-icons/headless/svg/page-fit";
import { Person16Filled, Person16Regular, Person20Filled, Person20Regular } from "@fluentui/react-icons/headless/svg/person";
import { Phone16Filled, Phone16Regular, Phone20Filled, Phone20Regular } from "@fluentui/react-icons/headless/svg/phone";
import { Search16Filled, Search16Regular, Search20Filled, Search20Regular } from "@fluentui/react-icons/headless/svg/search";
import { Send16Filled, Send16Regular, Send20Filled, Send20Regular } from "@fluentui/react-icons/headless/svg/send";
import { Settings16Filled, Settings16Regular, Settings20Filled, Settings20Regular } from "@fluentui/react-icons/headless/svg/settings";
import {
  ShapeIntersect16Filled,
  ShapeIntersect16Regular,
  ShapeIntersect20Filled,
  ShapeIntersect20Regular,
} from "@fluentui/react-icons/headless/svg/shape-intersect";
import {
  ShieldCheckmark16Filled,
  ShieldCheckmark16Regular,
  ShieldCheckmark20Filled,
  ShieldCheckmark20Regular,
} from "@fluentui/react-icons/headless/svg/shield-checkmark";
import { Speaker216Filled, Speaker216Regular, Speaker220Filled, Speaker220Regular } from "@fluentui/react-icons/headless/svg/speaker";
import { SpeakerMute16Filled, SpeakerMute16Regular, SpeakerMute20Filled, SpeakerMute20Regular } from "@fluentui/react-icons/headless/svg/speaker-mute";
import { SpinnerIos16Filled, SpinnerIos16Regular, SpinnerIos20Filled, SpinnerIos20Regular } from "@fluentui/react-icons/headless/svg/spinner-ios";
import { Star16Filled, Star16Regular, Star20Filled, Star20Regular } from "@fluentui/react-icons/headless/svg/star";
import { Subtract16Filled, Subtract16Regular, Subtract20Filled, Subtract20Regular } from "@fluentui/react-icons/headless/svg/subtract";
import { Target16Filled, Target16Regular, Target20Filled, Target20Regular } from "@fluentui/react-icons/headless/svg/target";
import { TaskListLtr20Filled, TaskListLtr20Regular } from "@fluentui/react-icons/headless/svg/task-list-ltr";
import { Video16Filled, Video16Regular, Video20Filled, Video20Regular } from "@fluentui/react-icons/headless/svg/video";
import { Wallet16Filled, Wallet16Regular, Wallet20Filled, Wallet20Regular } from "@fluentui/react-icons/headless/svg/wallet";
import { Warning16Filled, Warning16Regular, Warning20Filled, Warning20Regular } from "@fluentui/react-icons/headless/svg/warning";
import { WeatherMoon16Filled, WeatherMoon16Regular, WeatherMoon20Filled, WeatherMoon20Regular } from "@fluentui/react-icons/headless/svg/weather-moon";
import { WifiOff20Filled, WifiOff20Regular } from "@fluentui/react-icons/headless/svg/wifi-off";
import { Window16Filled, Window16Regular, Window20Filled, Window20Regular } from "@fluentui/react-icons/headless/svg/window";
import type { ComponentType } from "react";

export type IconWeight = "light" | "regular" | "bold" | "fill";

export interface IconProps {
  className?: string;
  weight?: IconWeight;
}

/** A drawn icon: Fluent's, or one of the app's own below. */
type Glyph = ComponentType<{ className?: string; "aria-hidden"?: boolean; focusable?: "false" }>;
/** An icon's regular and filled forms, at one size. */
type Forms = readonly [regular: Glyph, filled: Glyph];

/**
 * The app's own arrows, in Fluent's style (round ends and joins; its line, 1 px at the size drawn, 1.5 filled): Fluent's
 * own run corner to corner with a small head, too long beside a button's or a link's words. These sit in the middle
 * of the box with a bigger head, as an arrow beside words does. Drawn on a 16 grid; at 20 px the line is thinner on
 * it, so it stays 1 px on screen.
 */
function strokes(d: string, width: number): Glyph {
  return function Strokes({ className }) {
    return (
      <svg viewBox="0 0 16 16" className={className} aria-hidden focusable="false">
        <path d={d} fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };
}
function arrow(d: string): [Forms, Forms] {
  return [
    [strokes(d, 1), strokes(d, 1.5)],
    [strokes(d, 0.8), strokes(d, 1.2)],
  ];
}
/** Out of the app (to Edunex, SIX, a website): up and to the right. */
const UP_RIGHT = arrow("M4 12 12 4M6.5 4H12v5.5");
/** On to the next thing. */
const RIGHT = arrow("M3.25 8h9.5M9 4l4 4-4 4");

/** The size a class draws an icon at, in px (Tailwind's `size-4` is 16), 16 when it doesn't say. */
function drawnAt(className: string): number {
  const step = /(?:^|\s)size-(\d+(?:\.\d+)?)(?=\s|$)/.exec(className);
  if (step) return Number(step[1]) * 4;
  const px = /(?:^|\s)size-\[(\d+(?:\.\d+)?)px\](?=\s|$)/.exec(className);
  return px ? Number(px[1]) : 16;
}

/**
 * One Fluent icon the app's way, from its forms drawn at 16 and 20 px (the 20 px ones twice where Fluent draws no
 * 16). A lazily loaded screen makes its own rare icons with it, so they load with it.
 */
export function icon(at16: Forms, at20: Forms) {
  return function Icon({ className = "size-4", weight = "regular" }: IconProps) {
    const [regular, filled] = drawnAt(className) <= 16 ? at16 : at20;
    const Glyph = weight === "bold" || weight === "fill" ? filled : regular;
    return <Glyph className={className} aria-hidden focusable="false" />;
  };
}

export const Icons = {
  Home: icon([Home16Regular, Home16Filled], [Home20Regular, Home20Filled]),
  Moon: icon([WeatherMoon16Regular, WeatherMoon16Filled], [WeatherMoon20Regular, WeatherMoon20Filled]),
  Calendar: icon([CalendarLtr16Regular, CalendarLtr16Filled], [CalendarLtr20Regular, CalendarLtr20Filled]),
  ListChecks: icon([TaskListLtr20Regular, TaskListLtr20Filled], [TaskListLtr20Regular, TaskListLtr20Filled]),
  BookOpen: icon([BookOpen16Regular, BookOpen16Filled], [BookOpen20Regular, BookOpen20Filled]),
  GraduationCap: icon([HatGraduation16Regular, HatGraduation16Filled], [HatGraduation20Regular, HatGraduation20Filled]),
  Inbox: icon([MailInbox16Regular, MailInbox16Filled], [MailInbox20Regular, MailInbox20Filled]),
  Search: icon([Search16Regular, Search16Filled], [Search20Regular, Search20Filled]),
  Bell: icon([Alert16Regular, Alert16Filled], [Alert20Regular, Alert20Filled]),
  Settings: icon([Settings16Regular, Settings16Filled], [Settings20Regular, Settings20Filled]),
  Clock: icon([Clock16Regular, Clock16Filled], [Clock20Regular, Clock20Filled]),
  MapPin: icon([Location16Regular, Location16Filled], [Location20Regular, Location20Filled]),
  Video: icon([Video16Regular, Video16Filled], [Video20Regular, Video20Filled]),
  FileText: icon([DocumentText16Regular, DocumentText16Filled], [DocumentText20Regular, DocumentText20Filled]),
  StickyNote: icon([Note16Regular, Note16Filled], [Note20Regular, Note20Filled]),
  Paperclip: icon([Attach16Regular, Attach16Filled], [Attach20Regular, Attach20Filled]),
  Upload: icon([ArrowUpload16Regular, ArrowUpload16Filled], [ArrowUpload20Regular, ArrowUpload20Filled]),
  Download: icon([ArrowDownload16Regular, ArrowDownload16Filled], [ArrowDownload20Regular, ArrowDownload20Filled]),
  Link: icon([Link16Regular, Link16Filled], [Link20Regular, Link20Filled]),
  ArrowUpRight: icon(...UP_RIGHT),
  ChevronLeft: icon([ChevronLeft16Regular, ChevronLeft16Filled], [ChevronLeft20Regular, ChevronLeft20Filled]),
  ChevronRight: icon([ChevronRight16Regular, ChevronRight16Filled], [ChevronRight20Regular, ChevronRight20Filled]),
  ChevronDown: icon([ChevronDown16Regular, ChevronDown16Filled], [ChevronDown20Regular, ChevronDown20Filled]),
  Check: icon([Checkmark16Regular, Checkmark16Filled], [Checkmark20Regular, Checkmark20Filled]),
  CheckCircle: icon([CheckmarkCircle16Regular, CheckmarkCircle16Filled], [CheckmarkCircle20Regular, CheckmarkCircle20Filled]),
  Circle: icon([Circle16Regular, Circle16Filled], [Circle20Regular, Circle20Filled]),
  X: icon([Dismiss16Regular, Dismiss16Filled], [Dismiss20Regular, Dismiss20Filled]),
  AlertTriangle: icon([Warning16Regular, Warning16Filled], [Warning20Regular, Warning20Filled]),
  Lock: icon([LockClosed16Regular, LockClosed16Filled], [LockClosed20Regular, LockClosed20Filled]),
  ShieldCheck: icon([ShieldCheckmark16Regular, ShieldCheckmark16Filled], [ShieldCheckmark20Regular, ShieldCheckmark20Filled]),
  Speaker: icon([Speaker216Regular, Speaker216Filled], [Speaker220Regular, Speaker220Filled]),
  SpeakerOff: icon([SpeakerMute16Regular, SpeakerMute16Filled], [SpeakerMute20Regular, SpeakerMute20Filled]),
  WifiOff: icon([WifiOff20Regular, WifiOff20Filled], [WifiOff20Regular, WifiOff20Filled]),
  RefreshCw: icon([ArrowSync16Regular, ArrowSync16Filled], [ArrowSync20Regular, ArrowSync20Filled]),
  Megaphone: icon([Megaphone16Regular, Megaphone16Filled], [Megaphone20Regular, Megaphone20Filled]),
  User: icon([Person16Regular, Person16Filled], [Person20Regular, Person20Filled]),
  Globe: icon([Globe16Regular, Globe16Filled], [Globe20Regular, Globe20Filled]),
  LayoutGrid: icon([Grid16Regular, Grid16Filled], [Grid20Regular, Grid20Filled]),
  Star: icon([Star16Regular, Star16Filled], [Star20Regular, Star20Filled]),
  Overlap: icon([ShapeIntersect16Regular, ShapeIntersect16Filled], [ShapeIntersect20Regular, ShapeIntersect20Filled]),
  History: icon([History16Regular, History16Filled], [History20Regular, History20Filled]),
  FolderDown: icon([FolderOpen16Regular, FolderOpen16Filled], [FolderOpen20Regular, FolderOpen20Filled]),
  AppWindow: icon([Window16Regular, Window16Filled], [Window20Regular, Window20Filled]),
  Target: icon([Target16Regular, Target16Filled], [Target20Regular, Target20Filled]),
  Flag: icon([Flag16Regular, Flag16Filled], [Flag20Regular, Flag20Filled]),
  Chat: icon([Chat16Regular, Chat16Filled], [Chat20Regular, Chat20Filled]),
  PenLine: icon([Edit16Regular, Edit16Filled], [Edit20Regular, Edit20Filled]),
  Zap: icon([Flash16Regular, Flash16Filled], [Flash20Regular, Flash20Filled]),
  Layers: icon([Layer20Regular, Layer20Filled], [Layer20Regular, Layer20Filled]),
  CalendarClock: icon([CalendarClock16Regular, CalendarClock16Filled], [CalendarClock20Regular, CalendarClock20Filled]),
  Wallet: icon([Wallet16Regular, Wallet16Filled], [Wallet20Regular, Wallet20Filled]),
  ClipboardCheck: icon([ClipboardTask16Regular, ClipboardTask16Filled], [ClipboardTask20Regular, ClipboardTask20Filled]),
  Smartphone: icon([Phone16Regular, Phone16Filled], [Phone20Regular, Phone20Filled]),
  Eye: icon([Eye16Regular, Eye16Filled], [Eye20Regular, Eye20Filled]),
  EyeOff: icon([EyeOff16Regular, EyeOff16Filled], [EyeOff20Regular, EyeOff20Filled]),
  Route: icon([Directions16Regular, Directions16Filled], [Directions20Regular, Directions20Filled]),
  Loader: icon([SpinnerIos16Regular, SpinnerIos16Filled], [SpinnerIos20Regular, SpinnerIos20Filled]),
  Info: icon([Info16Regular, Info16Filled], [Info20Regular, Info20Filled]),
  Palette: icon([Color16Regular, Color16Filled], [Color20Regular, Color20Filled]),
  ArrowRight: icon(...RIGHT),
  Undo: icon([ArrowCounterclockwise16Regular, ArrowCounterclockwise16Filled], [ArrowCounterclockwise20Regular, ArrowCounterclockwise20Filled]),
  /** A Task the lecturer handed back to work on again (never the editor's Undo arrow, which sits beside it). */
  HandedBack: icon([ArrowReply16Regular, ArrowReply16Filled], [ArrowReply20Regular, ArrowReply20Filled]),
  Send: icon([Send16Regular, Send16Filled], [Send20Regular, Send20Filled]),
  Plus: icon([Add16Regular, Add16Filled], [Add20Regular, Add20Filled]),
  Minus: icon([Subtract16Regular, Subtract16Filled], [Subtract20Regular, Subtract20Filled]),
  MoreHorizontal: icon([MoreHorizontal16Regular, MoreHorizontal16Filled], [MoreHorizontal20Regular, MoreHorizontal20Filled]),
  Hand: icon([HandRight16Regular, HandRight16Filled], [HandRight20Regular, HandRight20Filled]),
  /** "Ingatkan nanti": an alarm clock, not a bell, since the bell and notifications aren't affected. */
  Snooze: icon([ClockAlarm16Regular, ClockAlarm16Filled], [ClockAlarm20Regular, ClockAlarm20Filled]),
  Image: icon([Image16Regular, Image16Filled], [Image20Regular, Image20Filled]),
  ImageBroken: icon([ImageOff20Regular, ImageOff20Filled], [ImageOff20Regular, ImageOff20Filled]),
  FitWidth: icon([ArrowAutofitWidth20Regular, ArrowAutofitWidth20Filled], [ArrowAutofitWidth20Regular, ArrowAutofitWidth20Filled]),
  FitPage: icon([PageFit16Regular, PageFit16Filled], [PageFit20Regular, PageFit20Filled]),
};

export type IconName = keyof typeof Icons;
