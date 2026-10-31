// The desktop's icons (src/app/ui/icons.tsx), the same Phosphor glyphs under the same names, drawn
// with react-native-svg. Each glyph is imported on its own so the app carries only these.

import { AlarmIcon } from "phosphor-react-native/src/icons/Alarm";
import { AppWindowIcon } from "phosphor-react-native/src/icons/AppWindow";
import { ArrowCounterClockwiseIcon } from "phosphor-react-native/src/icons/ArrowCounterClockwise";
import { ArrowLeftIcon } from "phosphor-react-native/src/icons/ArrowLeft";
import { ArrowRightIcon } from "phosphor-react-native/src/icons/ArrowRight";
import { ArrowsClockwiseIcon } from "phosphor-react-native/src/icons/ArrowsClockwise";
import { ArrowsInSimpleIcon } from "phosphor-react-native/src/icons/ArrowsInSimple";
import { ArrowsOutLineHorizontalIcon } from "phosphor-react-native/src/icons/ArrowsOutLineHorizontal";
import { ArrowUpRightIcon } from "phosphor-react-native/src/icons/ArrowUpRight";
import { BellIcon } from "phosphor-react-native/src/icons/Bell";
import { BookOpenIcon } from "phosphor-react-native/src/icons/BookOpen";
import { CalendarCheckIcon } from "phosphor-react-native/src/icons/CalendarCheck";
import { CalendarDotIcon } from "phosphor-react-native/src/icons/CalendarDot";
import { CalendarDotsIcon } from "phosphor-react-native/src/icons/CalendarDots";
import { CaretDownIcon } from "phosphor-react-native/src/icons/CaretDown";
import { CaretLeftIcon } from "phosphor-react-native/src/icons/CaretLeft";
import { CaretRightIcon } from "phosphor-react-native/src/icons/CaretRight";
import { ChatCircleTextIcon } from "phosphor-react-native/src/icons/ChatCircleText";
import { CheckIcon } from "phosphor-react-native/src/icons/Check";
import { CheckCircleIcon } from "phosphor-react-native/src/icons/CheckCircle";
import { CircleIcon } from "phosphor-react-native/src/icons/Circle";
import { CircleNotchIcon } from "phosphor-react-native/src/icons/CircleNotch";
import { ClipboardTextIcon } from "phosphor-react-native/src/icons/ClipboardText";
import { ClockIcon } from "phosphor-react-native/src/icons/Clock";
import { ClockCounterClockwiseIcon } from "phosphor-react-native/src/icons/ClockCounterClockwise";
import { DeviceMobileIcon } from "phosphor-react-native/src/icons/DeviceMobile";
import { DotsThreeIcon } from "phosphor-react-native/src/icons/DotsThree";
import { DotsThreeVerticalIcon } from "phosphor-react-native/src/icons/DotsThreeVertical";
import { DownloadSimpleIcon } from "phosphor-react-native/src/icons/DownloadSimple";
import { EyeIcon } from "phosphor-react-native/src/icons/Eye";
import { EyeSlashIcon } from "phosphor-react-native/src/icons/EyeSlash";
import { FileTextIcon } from "phosphor-react-native/src/icons/FileText";
import { FlagIcon } from "phosphor-react-native/src/icons/Flag";
import { FolderOpenIcon } from "phosphor-react-native/src/icons/FolderOpen";
import { GearSixIcon } from "phosphor-react-native/src/icons/GearSix";
import { GithubLogoIcon } from "phosphor-react-native/src/icons/GithubLogo";
import { GlobeIcon } from "phosphor-react-native/src/icons/Globe";
import { GraduationCapIcon } from "phosphor-react-native/src/icons/GraduationCap";
import { HandIcon } from "phosphor-react-native/src/icons/Hand";
import { HouseIcon } from "phosphor-react-native/src/icons/House";
import { ImageIcon } from "phosphor-react-native/src/icons/Image";
import { ImageBrokenIcon } from "phosphor-react-native/src/icons/ImageBroken";
import { InfoIcon } from "phosphor-react-native/src/icons/Info";
import { IntersectSquareIcon } from "phosphor-react-native/src/icons/IntersectSquare";
import { LightningIcon } from "phosphor-react-native/src/icons/Lightning";
import { LinkSimpleIcon } from "phosphor-react-native/src/icons/LinkSimple";
import { ListChecksIcon } from "phosphor-react-native/src/icons/ListChecks";
import { LockSimpleIcon } from "phosphor-react-native/src/icons/LockSimple";
import { MagnifyingGlassIcon } from "phosphor-react-native/src/icons/MagnifyingGlass";
import { MapPinIcon } from "phosphor-react-native/src/icons/MapPin";
import { MegaphoneIcon } from "phosphor-react-native/src/icons/Megaphone";
import { MinusIcon } from "phosphor-react-native/src/icons/Minus";
import { MoonIcon } from "phosphor-react-native/src/icons/Moon";
import { NoteIcon } from "phosphor-react-native/src/icons/Note";
import { PaletteIcon } from "phosphor-react-native/src/icons/Palette";
import { PaperclipIcon } from "phosphor-react-native/src/icons/Paperclip";
import { PathIcon } from "phosphor-react-native/src/icons/Path";
import { PencilSimpleLineIcon } from "phosphor-react-native/src/icons/PencilSimpleLine";
import { PlusIcon } from "phosphor-react-native/src/icons/Plus";
import { ReceiptIcon } from "phosphor-react-native/src/icons/Receipt";
import { ShieldCheckIcon } from "phosphor-react-native/src/icons/ShieldCheck";
import { SignOutIcon } from "phosphor-react-native/src/icons/SignOut";
import { SpeakerHighIcon } from "phosphor-react-native/src/icons/SpeakerHigh";
import { SpeakerSlashIcon } from "phosphor-react-native/src/icons/SpeakerSlash";
import { SquaresFourIcon } from "phosphor-react-native/src/icons/SquaresFour";
import { StackIcon } from "phosphor-react-native/src/icons/Stack";
import { StarIcon } from "phosphor-react-native/src/icons/Star";
import { SunIcon } from "phosphor-react-native/src/icons/Sun";
import { TargetIcon } from "phosphor-react-native/src/icons/Target";
import { TrayIcon } from "phosphor-react-native/src/icons/Tray";
import { UploadSimpleIcon } from "phosphor-react-native/src/icons/UploadSimple";
import { UserIcon } from "phosphor-react-native/src/icons/User";
import { VideoCameraIcon } from "phosphor-react-native/src/icons/VideoCamera";
import { WalletIcon } from "phosphor-react-native/src/icons/Wallet";
import { WarningIcon } from "phosphor-react-native/src/icons/Warning";
import { WifiSlashIcon } from "phosphor-react-native/src/icons/WifiSlash";
import { XIcon } from "phosphor-react-native/src/icons/X";
import type { ComponentType } from "react";
import { useTheme } from "./theme";

export type IconWeight = "light" | "regular" | "bold" | "fill";

export interface IconProps {
  size?: number;
  /** A color from the theme; the text color around it by default. */
  color?: string;
  weight?: IconWeight;
}

type Glyph = ComponentType<{ size?: number; color?: string; weight?: IconWeight }>;

function icon(Glyph: Glyph) {
  return function Icon({ size = 18, color, weight = "regular" }: IconProps) {
    const theme = useTheme();
    return <Glyph size={size} color={color ?? theme.color.fg} weight={weight} />;
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
  Speaker: icon(SpeakerHighIcon),
  SpeakerOff: icon(SpeakerSlashIcon),
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
  AppWindow: icon(AppWindowIcon),
  Target: icon(TargetIcon),
  Flag: icon(FlagIcon),
  GitHub: icon(GithubLogoIcon),
  Chat: icon(ChatCircleTextIcon),
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
  Palette: icon(PaletteIcon),
  ArrowRight: icon(ArrowRightIcon),
  Undo: icon(ArrowCounterClockwiseIcon),
  Plus: icon(PlusIcon),
  Minus: icon(MinusIcon),
  MoreHorizontal: icon(DotsThreeIcon),
  /** Android's overflow menu (⋮). */
  MoreVertical: icon(DotsThreeVerticalIcon),
  /** Android's Back in a top app bar (an arrow, not a chevron). */
  ArrowLeft: icon(ArrowLeftIcon),
  CalendarCheck: icon(CalendarCheckIcon),
  Hand: icon(HandIcon),
  Snooze: icon(AlarmIcon),
  Image: icon(ImageIcon),
  ImageBroken: icon(ImageBrokenIcon),
  FitWidth: icon(ArrowsOutLineHorizontalIcon),
  FitPage: icon(ArrowsInSimpleIcon),
};

export type IconName = keyof typeof Icons;
