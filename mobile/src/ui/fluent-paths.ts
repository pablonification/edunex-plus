// Fluent UI System Icons (Microsoft, MIT) by Fluent's own names (the glyph, the size it was drawn for, filled or
// regular), for the service tiles and the few marks b.tsx draws. Each glyph's path is its own module
// (./fluent-named/<name>.ts) named behind a function, so with Metro's inline requires (metro.config.js) a glyph's
// module loads when it is first drawn, as ui/icons.tsx's do: Beranda's first frame loads the glyphs it draws, not all
// of them. A new glyph: its path from node_modules/@fluentui/react-icons/lib/atoms/headless-svg, as one file there.
import alert24Regular from "./fluent-named/alert-24-regular";
import alert28Filled from "./fluent-named/alert-28-filled";
import apps28Filled from "./fluent-named/apps-28-filled";
import arrowRight20Regular from "./fluent-named/arrow-right-20-regular";
import arrowUpRight20Regular from "./fluent-named/arrow-up-right-20-regular";
import bookOpen28Filled from "./fluent-named/book-open-28-filled";
import calendarAgenda28Filled from "./fluent-named/calendar-agenda-28-filled";
import calendarCheckmark24Filled from "./fluent-named/calendar-checkmark-24-filled";
import calendarCheckmark28Filled from "./fluent-named/calendar-checkmark-28-filled";
import calendarLtr24Filled from "./fluent-named/calendar-ltr-24-filled";
import calendarLtr28Filled from "./fluent-named/calendar-ltr-28-filled";
import calendarMonth28Filled from "./fluent-named/calendar-month-28-filled";
import checkmarkCircle20Filled from "./fluent-named/checkmark-circle-20-filled";
import checkmarkCircle28Filled from "./fluent-named/checkmark-circle-28-filled";
import chevronRight20Regular from "./fluent-named/chevron-right-20-regular";
import clock20Regular from "./fluent-named/clock-20-regular";
import dismiss20Regular from "./fluent-named/dismiss-20-regular";
import form24Filled from "./fluent-named/form-24-filled";
import form28Filled from "./fluent-named/form-28-filled";
import handRight20Filled from "./fluent-named/hand-right-20-filled";
import hatGraduation24Filled from "./fluent-named/hat-graduation-24-filled";
import hatGraduation28Filled from "./fluent-named/hat-graduation-28-filled";
import info20Regular from "./fluent-named/info-20-regular";
import library24Filled from "./fluent-named/library-24-filled";
import library28Filled from "./fluent-named/library-28-filled";
import location20Regular from "./fluent-named/location-20-regular";
import open20Regular from "./fluent-named/open-20-regular";
import person24Filled from "./fluent-named/person-24-filled";
import personFeedback24Filled from "./fluent-named/person-feedback-24-filled";
import personFeedback28Filled from "./fluent-named/person-feedback-28-filled";
import ribbon24Filled from "./fluent-named/ribbon-24-filled";
import ribbon28Filled from "./fluent-named/ribbon-28-filled";
import search20Regular from "./fluent-named/search-20-regular";
import search24Regular from "./fluent-named/search-24-regular";
import settings24Filled from "./fluent-named/settings-24-filled";
import settings24Regular from "./fluent-named/settings-24-regular";
import settings28Filled from "./fluent-named/settings-28-filled";
import sparkle28Filled from "./fluent-named/sparkle-28-filled";
import textBulletListSquare28Filled from "./fluent-named/text-bullet-list-square-28-filled";
import video20Filled from "./fluent-named/video-20-filled";
import wallet24Filled from "./fluent-named/wallet-24-filled";
import wallet28Filled from "./fluent-named/wallet-28-filled";
import warning20Filled from "./fluent-named/warning-20-filled";
import warning28Filled from "./fluent-named/warning-28-filled";

export const FLUENT = {
  Alert24Regular: () => alert24Regular,
  Alert28Filled: () => alert28Filled,
  Apps28Filled: () => apps28Filled,
  ArrowRight20Regular: () => arrowRight20Regular,
  ArrowUpRight20Regular: () => arrowUpRight20Regular,
  BookOpen28Filled: () => bookOpen28Filled,
  CalendarAgenda28Filled: () => calendarAgenda28Filled,
  CalendarCheckmark24Filled: () => calendarCheckmark24Filled,
  CalendarCheckmark28Filled: () => calendarCheckmark28Filled,
  CalendarLtr24Filled: () => calendarLtr24Filled,
  CalendarLtr28Filled: () => calendarLtr28Filled,
  CalendarMonth28Filled: () => calendarMonth28Filled,
  CheckmarkCircle20Filled: () => checkmarkCircle20Filled,
  CheckmarkCircle28Filled: () => checkmarkCircle28Filled,
  ChevronRight20Regular: () => chevronRight20Regular,
  Clock20Regular: () => clock20Regular,
  Dismiss20Regular: () => dismiss20Regular,
  Form24Filled: () => form24Filled,
  Form28Filled: () => form28Filled,
  HandRight20Filled: () => handRight20Filled,
  HatGraduation24Filled: () => hatGraduation24Filled,
  HatGraduation28Filled: () => hatGraduation28Filled,
  Info20Regular: () => info20Regular,
  Library24Filled: () => library24Filled,
  Library28Filled: () => library28Filled,
  Location20Regular: () => location20Regular,
  Open20Regular: () => open20Regular,
  Person24Filled: () => person24Filled,
  PersonFeedback24Filled: () => personFeedback24Filled,
  PersonFeedback28Filled: () => personFeedback28Filled,
  Ribbon24Filled: () => ribbon24Filled,
  Ribbon28Filled: () => ribbon28Filled,
  Search20Regular: () => search20Regular,
  Search24Regular: () => search24Regular,
  Settings24Filled: () => settings24Filled,
  Settings24Regular: () => settings24Regular,
  Settings28Filled: () => settings28Filled,
  Sparkle28Filled: () => sparkle28Filled,
  TextBulletListSquare28Filled: () => textBulletListSquare28Filled,
  Video20Filled: () => video20Filled,
  Wallet24Filled: () => wallet24Filled,
  Wallet28Filled: () => wallet28Filled,
  Warning20Filled: () => warning20Filled,
  Warning28Filled: () => warning28Filled,
} as const;

export type FluentName = keyof typeof FLUENT;
