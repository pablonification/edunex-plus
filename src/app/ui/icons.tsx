// The app's icon set: Phosphor (MIT, phosphoricons.com). Regular weight by
// default; "bold" where a small icon has to read clearly or stand out; "fill"
// for the place the Student is in. Each icon is imported on its own, so only
// these end up in the app. Icons are decorative: give the control around them
// an accessible name.
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { AlarmIcon } from "@phosphor-icons/react/dist/csr/Alarm";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";
import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/csr/ArrowUpRight";
import { BellIcon } from "@phosphor-icons/react/dist/csr/Bell";
import { BookOpenIcon } from "@phosphor-icons/react/dist/csr/BookOpen";
import { CalendarCheckIcon } from "@phosphor-icons/react/dist/csr/CalendarCheck";
import { CalendarDotIcon } from "@phosphor-icons/react/dist/csr/CalendarDot";
import { CalendarDotsIcon } from "@phosphor-icons/react/dist/csr/CalendarDots";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CaretLeftIcon } from "@phosphor-icons/react/dist/csr/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { CircleIcon } from "@phosphor-icons/react/dist/csr/Circle";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { ClipboardTextIcon } from "@phosphor-icons/react/dist/csr/ClipboardText";
import { ClockIcon } from "@phosphor-icons/react/dist/csr/Clock";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react/dist/csr/ClockCounterClockwise";
import { DeviceMobileIcon } from "@phosphor-icons/react/dist/csr/DeviceMobile";
import { DotsThreeIcon } from "@phosphor-icons/react/dist/csr/DotsThree";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { EyeIcon } from "@phosphor-icons/react/dist/csr/Eye";
import { EyeSlashIcon } from "@phosphor-icons/react/dist/csr/EyeSlash";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { FlagIcon } from "@phosphor-icons/react/dist/csr/Flag";
import { FolderOpenIcon } from "@phosphor-icons/react/dist/csr/FolderOpen";
import { GearSixIcon } from "@phosphor-icons/react/dist/csr/GearSix";
import { GlobeIcon } from "@phosphor-icons/react/dist/csr/Globe";
import { GraduationCapIcon } from "@phosphor-icons/react/dist/csr/GraduationCap";
import { HandIcon } from "@phosphor-icons/react/dist/csr/Hand";
import { HouseIcon } from "@phosphor-icons/react/dist/csr/House";
import { InfoIcon } from "@phosphor-icons/react/dist/csr/Info";
import { IntersectSquareIcon } from "@phosphor-icons/react/dist/csr/IntersectSquare";
import { LightningIcon } from "@phosphor-icons/react/dist/csr/Lightning";
import { LinkSimpleIcon } from "@phosphor-icons/react/dist/csr/LinkSimple";
import { ListChecksIcon } from "@phosphor-icons/react/dist/csr/ListChecks";
import { LockSimpleIcon } from "@phosphor-icons/react/dist/csr/LockSimple";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { MapPinIcon } from "@phosphor-icons/react/dist/csr/MapPin";
import { MegaphoneIcon } from "@phosphor-icons/react/dist/csr/Megaphone";
import { MinusIcon } from "@phosphor-icons/react/dist/csr/Minus";
import { MoonIcon } from "@phosphor-icons/react/dist/csr/Moon";
import { NoteIcon } from "@phosphor-icons/react/dist/csr/Note";
import { PaperclipIcon } from "@phosphor-icons/react/dist/csr/Paperclip";
import { PathIcon } from "@phosphor-icons/react/dist/csr/Path";
import { PencilSimpleLineIcon } from "@phosphor-icons/react/dist/csr/PencilSimpleLine";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { ReceiptIcon } from "@phosphor-icons/react/dist/csr/Receipt";
import { ShieldCheckIcon } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { SignOutIcon } from "@phosphor-icons/react/dist/csr/SignOut";
import { SquaresFourIcon } from "@phosphor-icons/react/dist/csr/SquaresFour";
import { StackIcon } from "@phosphor-icons/react/dist/csr/Stack";
import { StarIcon } from "@phosphor-icons/react/dist/csr/Star";
import { SunIcon } from "@phosphor-icons/react/dist/csr/Sun";
import { TargetIcon } from "@phosphor-icons/react/dist/csr/Target";
import { TrayIcon } from "@phosphor-icons/react/dist/csr/Tray";
import { UploadSimpleIcon } from "@phosphor-icons/react/dist/csr/UploadSimple";
import { UserIcon } from "@phosphor-icons/react/dist/csr/User";
import { VideoCameraIcon } from "@phosphor-icons/react/dist/csr/VideoCamera";
import { WalletIcon } from "@phosphor-icons/react/dist/csr/Wallet";
import { WarningIcon } from "@phosphor-icons/react/dist/csr/Warning";
import { WifiSlashIcon } from "@phosphor-icons/react/dist/csr/WifiSlash";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";

export type IconWeight = "light" | "regular" | "bold" | "fill";

export interface IconProps {
  className?: string;
  weight?: IconWeight;
}

/** One of Phosphor's icons the app's way. A lazily loaded screen makes its own rare icons with it, so they load with it. */
export function icon(Glyph: PhosphorIcon) {
  return function Icon({ className = "size-4", weight = "regular" }: IconProps) {
    return <Glyph className={className} weight={weight} aria-hidden focusable="false" />;
  };
}

export const Icons = {
  Home: icon(HouseIcon),
  Sun: icon(SunIcon),
  Moon: icon(MoonIcon),
  Calendar: icon(CalendarDotsIcon),
  ListChecks: icon(ListChecksIcon),
  BookOpen: icon(BookOpenIcon),
  GraduationCap: icon(GraduationCapIcon),
  Inbox: icon(TrayIcon),
  Search: icon(MagnifyingGlassIcon),
  Bell: icon(BellIcon),
  Settings: icon(GearSixIcon),
  Clock: icon(ClockIcon),
  MapPin: icon(MapPinIcon),
  Video: icon(VideoCameraIcon),
  FileText: icon(FileTextIcon),
  StickyNote: icon(NoteIcon),
  Paperclip: icon(PaperclipIcon),
  Upload: icon(UploadSimpleIcon),
  Download: icon(DownloadSimpleIcon),
  Link: icon(LinkSimpleIcon),
  ArrowUpRight: icon(ArrowUpRightIcon),
  ChevronLeft: icon(CaretLeftIcon),
  ChevronRight: icon(CaretRightIcon),
  ChevronDown: icon(CaretDownIcon),
  Check: icon(CheckIcon),
  CheckCircle: icon(CheckCircleIcon),
  Circle: icon(CircleIcon),
  X: icon(XIcon),
  AlertTriangle: icon(WarningIcon),
  Lock: icon(LockSimpleIcon),
  ShieldCheck: icon(ShieldCheckIcon),
  WifiOff: icon(WifiSlashIcon),
  RefreshCw: icon(ArrowsClockwiseIcon),
  Megaphone: icon(MegaphoneIcon),
  User: icon(UserIcon),
  Globe: icon(GlobeIcon),
  LayoutGrid: icon(SquaresFourIcon),
  Star: icon(StarIcon),
  Overlap: icon(IntersectSquareIcon),
  History: icon(ClockCounterClockwiseIcon),
  FolderDown: icon(FolderOpenIcon),
  Target: icon(TargetIcon),
  Flag: icon(FlagIcon),
  PenLine: icon(PencilSimpleLineIcon),
  Zap: icon(LightningIcon),
  Layers: icon(StackIcon),
  CalendarClock: icon(CalendarDotIcon),
  Wallet: icon(WalletIcon),
  ClipboardCheck: icon(ClipboardTextIcon),
  Smartphone: icon(DeviceMobileIcon),
  Eye: icon(EyeIcon),
  EyeOff: icon(EyeSlashIcon),
  Route: icon(PathIcon),
  Receipt: icon(ReceiptIcon),
  LogOut: icon(SignOutIcon),
  Loader: icon(CircleNotchIcon),
  Info: icon(InfoIcon),
  ArrowRight: icon(ArrowRightIcon),
  Plus: icon(PlusIcon),
  Minus: icon(MinusIcon),
  MoreHorizontal: icon(DotsThreeIcon),
  CalendarCheck: icon(CalendarCheckIcon),
  Hand: icon(HandIcon),
  /** "Ingatkan nanti": an alarm clock, not a bell, since the bell and notifications aren't affected. */
  Snooze: icon(AlarmIcon),
};

export type IconName = keyof typeof Icons;
