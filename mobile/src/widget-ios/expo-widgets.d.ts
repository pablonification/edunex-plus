// A stand-in for the types of expo-widgets and @expo/ui (both ~58.0.27, mobile/package.json) until they're installed
// here: only what ./now.tsx, ./today.tsx, ./live.tsx and ../host/widget-ios.ios.ts use, copied from the packages'
// own .d.ts files. Delete this file once `npm ci` in mobile/ has put the packages in node_modules: their real types
// then apply (an ambient module like these would hide them).
declare module "expo-widgets" {
  export type WidgetFamily =
    | "systemSmall"
    | "systemMedium"
    | "systemLarge"
    | "systemExtraLarge"
    | "accessoryCircular"
    | "accessoryRectangular"
    | "accessoryInline";
  export type WidgetRenderingMode = "fullColor" | "accented" | "vibrant";
  export type WidgetEnvironment<T extends object | undefined = undefined> = {
    date?: Date;
    widgetFamily?: WidgetFamily;
    colorScheme?: "light" | "dark";
    isLuminanceReduced?: boolean;
    widgetRenderingMode?: WidgetRenderingMode;
    showsWidgetLabel?: boolean;
    /** iOS 17 and later. */
    widgetContentMargins?: { top: number; bottom: number; leading: number; trailing: number };
    configuration: T;
  };
  export type WidgetTimelineEntry<T> = { date: Date; props: T };
  export class Widget<PropsType extends object = object> {
    reload(): void;
    updateTimeline(entries: WidgetTimelineEntry<PropsType>[]): void;
    updateSnapshot(props: PropsType): void;
    getTimeline(): Promise<WidgetTimelineEntry<PropsType>[]>;
  }
  export type LiveActivityEnvironment = { colorScheme: "light" | "dark"; isLuminanceReduced?: boolean };
  export type LiveActivityLayout = {
    banner: React.ReactNode;
    bannerSmall?: React.ReactNode;
    compactLeading?: React.ReactNode;
    compactTrailing?: React.ReactNode;
    minimal?: React.ReactNode;
    expandedCenter?: React.ReactNode;
    expandedLeading?: React.ReactNode;
    expandedTrailing?: React.ReactNode;
    expandedBottom?: React.ReactNode;
  };
  export type LiveActivityComponent<T extends object = object> = (props: T, environment: LiveActivityEnvironment) => LiveActivityLayout;
  export type LiveActivityDismissalPolicy = "default" | "immediate" | { after: Date };
  export class LiveActivity<T extends object = object> {
    getId(): string;
    update(props: T, staleDate?: Date): Promise<void>;
    end(dismissalPolicy?: LiveActivityDismissalPolicy, props?: T, contentDate?: Date): Promise<void>;
  }
  export class LiveActivityFactory<T extends object = object> {
    start(props: T, url?: string, staleDate?: Date): LiveActivity<T>;
    getInstances(): LiveActivity<T>[];
  }
  export function createWidget<PropsType extends object = object>(
    name: string,
    widget: (props: PropsType, context: WidgetEnvironment) => React.JSX.Element,
    initialProps?: PropsType,
  ): Widget<PropsType>;
  export function createLiveActivity<T extends object = object>(name: string, liveActivity: LiveActivityComponent<T>): LiveActivityFactory<T>;
}

declare module "@expo/ui/swift-ui" {
  import type { ReactNode } from "react";

  type ModifierConfig = { $type: string; [key: string]: unknown };
  type Common = { modifiers?: ModifierConfig[]; testID?: string };
  type Children = { children?: ReactNode };
  export function VStack(props: Common & Children & { alignment?: "leading" | "center" | "trailing"; spacing?: number }): React.JSX.Element;
  export function HStack(
    props: Common & Children & { alignment?: "top" | "center" | "bottom" | "firstTextBaseline" | "lastTextBaseline"; spacing?: number },
  ): React.JSX.Element;
  export function ZStack(props: Common & Children & { alignment?: "center" | "leading" | "trailing" | "top" | "bottom" | "topLeading" }): React.JSX.Element;
  export function Text(
    props: Common &
      Children & {
        date?: Date;
        dateStyle?: "timer" | "relative" | "offset" | "date" | "time";
        timerInterval?: { lower: Date; upper: Date };
        countsDown?: boolean;
      },
  ): React.JSX.Element | null;
  export function Spacer(props: Common & { minLength?: number }): React.JSX.Element;
  export function RoundedRectangle(props: Common & { cornerRadius?: number }): React.JSX.Element;
  export function Capsule(props: Common & { cornerStyle?: "continuous" | "circular" }): React.JSX.Element;
  export function Circle(props: Common): React.JSX.Element;
  export function Link(props: Common & { label?: string; destination: string; children?: React.ReactElement | React.ReactElement[] }): React.JSX.Element;
  export function ProgressView(
    props: Common & Children & { value?: number | null; timerInterval?: { lower: Date; upper: Date }; countsDown?: boolean },
  ): React.JSX.Element;
  export function AccessoryWidgetBackground(props: Common): React.JSX.Element;
}

declare module "@expo/ui/swift-ui/modifiers" {
  type ModifierConfig = { $type: string; [key: string]: unknown };
  type ShapeStyle = string | { type: "hierarchical"; style: "primary" | "secondary" | "tertiary" | "quaternary" | "quinary" };
  type Padding = number | "default";
  export function font(params: {
    size?: number;
    weight?: "ultraLight" | "thin" | "light" | "regular" | "medium" | "semibold" | "bold" | "heavy" | "black";
    design?: "default" | "rounded" | "serif" | "monospaced";
    textStyle?: "largeTitle" | "title" | "title2" | "title3" | "headline" | "subheadline" | "body" | "callout" | "footnote" | "caption" | "caption2";
  }): ModifierConfig;
  export function foregroundStyle(style: ShapeStyle): ModifierConfig;
  export function frame(params: {
    width?: number;
    height?: number;
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    alignment?: "center" | "leading" | "trailing" | "top" | "bottom" | "topLeading" | "topTrailing" | "bottomLeading" | "bottomTrailing";
  }): ModifierConfig;
  export function padding(params?: {
    top?: Padding;
    bottom?: Padding;
    leading?: Padding;
    trailing?: Padding;
    horizontal?: Padding;
    vertical?: Padding;
    all?: Padding;
  }): ModifierConfig;
  export function background(style: ShapeStyle): ModifierConfig;
  export function clipShape(
    shape: "rectangle" | "circle" | "capsule" | "ellipse" | "roundedRectangle" | "containerRelativeShape",
    cornerRadius?: number,
  ): ModifierConfig;
  export function lineLimit(limit?: number, options?: { reservesSpace?: boolean }): ModifierConfig;
  export function monospacedDigit(): ModifierConfig;
  export function minimumScaleFactor(factor: number): ModifierConfig;
  export function opacity(value: number): ModifierConfig;
  export function redacted(reasons?: "placeholder" | "privacy" | "invalidated"): ModifierConfig;
  export function widgetURL(url: string): ModifierConfig;
  export function containerBackground(style: ShapeStyle, container: "widget" | "navigation" | "navigationSplitView"): ModifierConfig;
  export function accessibilityLabel(label: string): ModifierConfig;
  export function accessibilityElement(children?: "ignore" | "combine" | "contain"): ModifierConfig;
  export function layoutPriority(priority: number): ModifierConfig;
  export function activityBackgroundTint(color: string | null): ModifierConfig;
}
