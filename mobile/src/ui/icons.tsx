// The phone's icons: Microsoft's Fluent UI System Icons (MIT, github.com/microsoft/fluentui-system-icons), the family
// the desktop draws (src/app/ui/icons.tsx), under the names the app has always used. Each icon is its path data as plain
// strings (./fluent/<name>.ts, written by scripts/make-ui-icons.mjs from the icons imported here, so the app carries only
// these), drawn with react-native-svg in the form Fluent made for the size it shows at: the nearest of the sizes it
// drew (12 to 48 px; between two, the bigger), so its lines stay as Fluent meant them. Regular by default; "bold" and
// "fill" draw the filled form, as Fluent marks emphasis and the place the Student is ("light" is regular).
//
// Each icon's data is named behind a function (`icon(() => home)`), so with Metro's inline requires (metro.config.js)
// its module loads when the icon is first drawn: one icon on Beranda's first frame loads that icon, not all of them.

import { Platform } from "react-native";
import Svg, { Path } from "react-native-svg";
import add from "./fluent/add";
import alert from "./fluent/alert";
import arrowAutofitWidth from "./fluent/arrow-autofit-width";
import arrowCounterclockwise from "./fluent/arrow-counterclockwise";
import arrowDownload from "./fluent/arrow-download";
import arrowLeft from "./fluent/arrow-left";
import arrowReply from "./fluent/arrow-reply";
import arrowRight from "./fluent/arrow-right";
import arrowSync from "./fluent/arrow-sync";
import arrowUpRight from "./fluent/arrow-up-right";
import arrowUpload from "./fluent/arrow-upload";
import attach from "./fluent/attach";
import book from "./fluent/book";
import bookOpen from "./fluent/book-open";
import buildingBank from "./fluent/building-bank";
import calendarCheckmark from "./fluent/calendar-checkmark";
import calendarClock from "./fluent/calendar-clock";
import calendarDate from "./fluent/calendar-date";
import calendarLtr from "./fluent/calendar-ltr";
import calendarStar from "./fluent/calendar-star";
import chat from "./fluent/chat";
import checkmark from "./fluent/checkmark";
import checkmarkCircle from "./fluent/checkmark-circle";
import chevronDown from "./fluent/chevron-down";
import chevronLeft from "./fluent/chevron-left";
import chevronRight from "./fluent/chevron-right";
import circle from "./fluent/circle";
import clipboardCheckmark from "./fluent/clipboard-checkmark";
import clipboardTaskListLtr from "./fluent/clipboard-task-list-ltr";
import clock from "./fluent/clock";
import clockAlarm from "./fluent/clock-alarm";
import code from "./fluent/code";
import palette from "./fluent/color";
import directions from "./fluent/directions";
import dismiss from "./fluent/dismiss";
import documentEdit from "./fluent/document-edit";
import documentPdf from "./fluent/document-pdf";
import documentRibbon from "./fluent/document-ribbon";
import documentText from "./fluent/document-text";
import edit from "./fluent/edit";
import eye from "./fluent/eye";
import eyeOff from "./fluent/eye-off";
import filter from "./fluent/filter";
import flag from "./fluent/flag";
import flash from "./fluent/flash";
import folder from "./fluent/folder";
import folderOpen from "./fluent/folder-open";
import form from "./fluent/form";
import globe from "./fluent/globe";
import grid from "./fluent/grid";
import handRight from "./fluent/hand-right";
import hatGraduation from "./fluent/hat-graduation";
import history from "./fluent/history";
import home from "./fluent/home";
import image from "./fluent/image";
import imageOff from "./fluent/image-off";
import info from "./fluent/info";
import layer from "./fluent/layer";
import learningApp from "./fluent/learning-app";
import library from "./fluent/library";
import link from "./fluent/link";
import location from "./fluent/location";
import lockClosed from "./fluent/lock-closed";
import mailInbox from "./fluent/mail-inbox";
import megaphone from "./fluent/megaphone";
import moreHorizontal from "./fluent/more-horizontal";
import moreVertical from "./fluent/more-vertical";
import musicNote2 from "./fluent/music-note-2";
import note from "./fluent/note";
import pageFit from "./fluent/page-fit";
import person from "./fluent/person";
import personFeedback from "./fluent/person-feedback";
import phone from "./fluent/phone";
import receipt from "./fluent/receipt";
import ribbon from "./fluent/ribbon";
import search from "./fluent/search";
import settings from "./fluent/settings";
import shapeIntersect from "./fluent/shape-intersect";
import shareAndroid from "./fluent/share-android";
import shieldCheckmark from "./fluent/shield-checkmark";
import signOut from "./fluent/sign-out";
import slideText from "./fluent/slide-text";
import speaker2 from "./fluent/speaker-2";
import speakerMute from "./fluent/speaker-mute";
import spinnerIos from "./fluent/spinner-ios";
import star from "./fluent/star";
import subtract from "./fluent/subtract";
import target from "./fluent/target";
import video from "./fluent/video";
import wallet from "./fluent/wallet";
import warning from "./fluent/warning";
import weatherMoon from "./fluent/weather-moon";
import weatherSunny from "./fluent/weather-sunny";
import wifiOff from "./fluent/wifi-off";
import windowFrame from "./fluent/window";
import { type Drawn, nearest } from "./icon-size";
import { useTheme } from "./theme";

export type IconWeight = "light" | "regular" | "bold" | "fill";

export interface IconProps {
  size?: number;
  /** A color from the theme; the text color around it by default. */
  color?: string;
  weight?: IconWeight;
}

interface Options {
  /** Filled unless a weight says otherwise (a service's tile). */
  filled?: boolean;
  /** Always the regular ring, whatever the weight. */
  ring?: boolean;
}

function icon(drawn: () => Drawn, { filled = false, ring = false }: Options = {}) {
  return function Icon({ size = 18, color, weight = filled ? "fill" : "regular" }: IconProps) {
    const theme = useTheme();
    const [at, regular, solid] = nearest(drawn(), size);
    const d = !ring && (weight === "bold" || weight === "fill") ? solid : regular;
    return (
      <Svg width={size} height={size} viewBox={`0 0 ${at} ${at}`}>
        <Path d={d} fill={color ?? theme.color.fg} />
      </Svg>
    );
  };
}

export const Icons = {
  Home: icon(() => home),
  Sun: icon(() => weatherSunny),
  Moon: icon(() => weatherMoon),
  Calendar: icon(() => calendarLtr),
  /** Tugas: the tab's clipboard of ticks. */
  ListChecks: icon(() => clipboardTaskListLtr),
  BookOpen: icon(() => bookOpen),
  /** Kuliah: the courses (the tab's cap). */
  GraduationCap: icon(() => hatGraduation),
  Inbox: icon(() => mailInbox),
  Search: icon(() => search),
  Bell: icon(() => alert),
  Settings: icon(() => settings),
  Clock: icon(() => clock),
  MapPin: icon(() => location),
  Video: icon(() => video),
  FileText: icon(() => documentText),
  StickyNote: icon(() => note),
  Paperclip: icon(() => attach),
  Upload: icon(() => arrowUpload),
  Download: icon(() => arrowDownload),
  Link: icon(() => link),
  ArrowUpRight: icon(() => arrowUpRight),
  ChevronLeft: icon(() => chevronLeft),
  ChevronRight: icon(() => chevronRight),
  ChevronDown: icon(() => chevronDown),
  Check: icon(() => checkmark),
  CheckCircle: icon(() => checkmarkCircle),
  /** An empty ring ("not started"): bold or filled it stays a ring, as a filled dot would read as done. */
  Circle: icon(() => circle, { ring: true }),
  X: icon(() => dismiss),
  AlertTriangle: icon(() => warning),
  Lock: icon(() => lockClosed),
  ShieldCheck: icon(() => shieldCheckmark),
  Speaker: icon(() => speaker2),
  SpeakerOff: icon(() => speakerMute),
  WifiOff: icon(() => wifiOff),
  RefreshCw: icon(() => arrowSync),
  Megaphone: icon(() => megaphone),
  User: icon(() => person),
  Globe: icon(() => globe),
  LayoutGrid: icon(() => grid),
  Star: icon(() => star),
  Overlap: icon(() => shapeIntersect),
  History: icon(() => history),
  FolderDown: icon(() => folderOpen),
  AppWindow: icon(() => windowFrame),
  Target: icon(() => target),
  Flag: icon(() => flag),
  /** Share a file or a link (Android's share mark). */
  Share: icon(() => shareAndroid),
  /** A file's kind: a PDF, slides, sound. */
  FilePdf: icon(() => documentPdf),
  FileSlides: icon(() => slideText),
  FileAudio: icon(() => musicNote2),
  /** SIX, the academic office: a building with columns. Never the Kuliah tab's cap. */
  Six: icon(() => buildingBank),
  /** Edunex, the LMS: a learning app's window. Never the Kuliah tab's cap, nor Materi's book. */
  Edunex: icon(() => learningApp),
  /** The source code (Fluent draws no brand logos). */
  GitHub: icon(() => code),
  Chat: icon(() => chat),
  /** A Task the lecturer handed back to work on again (never Undo's arrow, which can sit beside it). */
  HandedBack: icon(() => arrowReply),
  PenLine: icon(() => edit),
  Zap: icon(() => flash),
  Layers: icon(() => layer),
  CalendarClock: icon(() => calendarClock),
  Wallet: icon(() => wallet),
  /** KRS (the service tile's). */
  ClipboardCheck: icon(() => clipboardCheckmark),
  Smartphone: icon(() => phone),
  Eye: icon(() => eye),
  EyeOff: icon(() => eyeOff),
  Route: icon(() => directions),
  Receipt: icon(() => receipt),
  LogOut: icon(() => signOut),
  Loader: icon(() => spinnerIos),
  Info: icon(() => info),
  /** A list's filter (Tugas's course filter). */
  Filter: icon(() => filter),
  Palette: icon(() => palette),
  ArrowRight: icon(() => arrowRight),
  Undo: icon(() => arrowCounterclockwise),
  Plus: icon(() => add),
  Minus: icon(() => subtract),
  MoreHorizontal: icon(() => moreHorizontal),
  /** Android's overflow menu (⋮). */
  MoreVertical: icon(() => moreVertical),
  /** Back in a top bar: Android's arrow, an iPhone's chevron (each phone's own). */
  ArrowLeft: icon(() => (Platform.OS === "ios" ? chevronLeft : arrowLeft)),
  CalendarCheck: icon(() => calendarCheckmark),
  Hand: icon(() => handRight),
  /** "Ingatkan nanti": an alarm clock, not the bell. */
  Snooze: icon(() => clockAlarm),
  Image: icon(() => image),
  ImageBroken: icon(() => imageOff),
  FitWidth: icon(() => arrowAutofitWidth),
  FitPage: icon(() => pageFit),
};

export type IconName = keyof typeof Icons;

/**
 * The services' icons (Beranda's grid, Semua layanan): filled by default, as Fluent draws a place to go, each meant to
 * sit in its own colour. Their Fluent names are in mobile/DESIGN.md ("Icons"). `weight="regular"` draws the outline.
 */
export const ServiceIcons = {
  /** Jadwal */
  Schedule: icon(() => calendarLtr, { filled: true }),
  /** Tugas */
  Tasks: icon(() => clipboardTaskListLtr, { filled: true }),
  /** Kuliah */
  Courses: icon(() => hatGraduation, { filled: true }),
  /** Presensi */
  Attendance: icon(() => handRight, { filled: true }),
  /** Nilai */
  Grades: icon(() => ribbon, { filled: true }),
  /** Ujian */
  Exams: icon(() => documentEdit, { filled: true }),
  /** Materi */
  Materials: icon(() => book, { filled: true }),
  /** KRS */
  Krs: icon(() => form, { filled: true }),
  /** UKT */
  Bills: icon(() => wallet, { filled: true }),
  /** Kalender akademik */
  AcademicCalendar: icon(() => calendarStar, { filled: true }),
  /** Rencana studi */
  StudyPlan: icon(() => directions, { filled: true }),
  /** Transkrip */
  Transcript: icon(() => documentRibbon, { filled: true }),
  /** Notifikasi */
  Notifications: icon(() => alert, { filled: true }),
  /** Pengaturan */
  Settings: icon(() => settings, { filled: true }),
  /** Pencarian */
  Search: icon(() => search, { filled: true }),
  /** Lainnya */
  More: icon(() => grid, { filled: true }),
  /** Kurikulum */
  Curriculum: icon(() => library, { filled: true }),
  /** Berkas */
  Files: icon(() => folder, { filled: true }),
  /** Profil */
  Profile: icon(() => person, { filled: true }),
  /** Perlu diurus */
  Needs: icon(() => warning, { filled: true }),
  /** Ringkasan awal (what the first read found) */
  FirstSummary: icon(() => history, { filled: true }),
  /** Sebulan (the month view): a calendar page with its date, not the Jadwal tab's grid of days. */
  Month: icon(() => calendarDate, { filled: true }),
  /** Laporkan masalah: a person speaking up. */
  Report: icon(() => personFeedback, { filled: true }),
};

export type ServiceIconName = keyof typeof ServiceIcons;
