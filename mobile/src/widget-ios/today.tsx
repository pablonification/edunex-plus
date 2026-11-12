// The iPhone's "Hari ini" widget: today's classes (the one on now in the live green, the ones over quiet) and the
// next deadline, as Android's Today widget (../widget/view.tsx) says them, from the same model (./doc.ts). Like
// ./now.tsx, the function runs on its own in the widget: everything it needs is in the document or declared inside.
import { HStack, Link, RoundedRectangle, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  padding,
  redacted,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";
import { type IosWidgetDoc, setupDoc, storable } from "./doc";

/** The widget's name in app.config.ts (expo-widgets' `widgets[].name`) and to WidgetKit. */
export const TODAY_WIDGET = "EdunexToday";

export function TodayWidget(doc: IosWidgetDoc, env: WidgetEnvironment) {
  "widget";
  const family = env.widgetFamily ?? "systemSmall";
  const ready = doc?.v === 1;
  const scheme = ready && doc.scheme !== "system" ? doc.scheme : env.colorScheme === "dark" ? "dark" : "light";
  const c = ready ? doc.colors[scheme] : null;
  const lock = family === "accessoryRectangular" || family === "accessoryCircular" || family === "accessoryInline";
  const fg = lock || !c ? "primary" : c.fg;
  const muted = lock || !c ? "secondary" : c.muted;
  const margins = env.widgetContentMargins || lock ? [] : [padding({ all: 16 })];
  const root = (url: string | undefined, children: React.ReactNode) => (
    <VStack
      alignment="leading"
      spacing={0}
      modifiers={[
        ...margins,
        frame({ maxWidth: 10000, maxHeight: 10000, alignment: "topLeading" }),
        containerBackground(lock ? "clear" : (c?.surface ?? (scheme === "dark" ? "#161618" : "#ffffff")), "widget"),
        ...(url ? [widgetURL(url)] : []),
      ]}
    >
      {children}
    </VStack>
  );
  const line = (
    text: string,
    style: "caption2" | "caption" | "footnote" | "subheadline" | "headline",
    color: string,
    weight: "regular" | "medium" | "semibold" | "bold" = "regular",
    lines = 1,
  ) => <Text modifiers={[font({ textStyle: style, weight }), foregroundStyle(color), lineLimit(lines)]}>{text}</Text>;
  /** The Lock Screen's one line beside the date (every widget's root takes the container background, as Expo's docs say). */
  const inline = (text: string, url?: string) => <Text modifiers={[containerBackground("clear", "widget"), ...(url ? [widgetURL(url)] : [])]}>{text}</Text>;

  if (!ready || doc.state === "setup") {
    const title = ready ? doc.title : "Edunex Plus";
    const hint = ready ? doc.hint : null;
    if (family === "accessoryInline") return inline(title, ready ? doc.url : undefined);
    return root(
      ready ? doc.url : undefined,
      <VStack alignment="leading" spacing={6}>
        {line(title, "headline", fg, "semibold")}
        {hint ? (
          line(hint, "footnote", muted, "regular", 3)
        ) : (
          <VStack alignment="leading" spacing={4} modifiers={[redacted("placeholder")]}>
            {line("XXXXXXXXXX", "caption", muted)}
            {line("00:00 XXXXXX", "footnote", fg)}
            {line("00:00 XXXXXX", "footnote", fg)}
          </VStack>
        )}
      </VStack>,
    );
  }

  const today = doc.today;
  // Without SIX there's no timetable: the app's name and what's wrong, which the app fixes.
  if (!today) {
    if (family === "accessoryInline") return inline(doc.status.text || doc.title, doc.url);
    return root(
      doc.url,
      <VStack alignment="leading" spacing={4}>
        {line(doc.title, "headline", fg, "semibold")}
        {doc.status.text
          ? line(doc.status.text, "footnote", doc.status.problem && !lock ? (c?.warn ?? fg) : muted, doc.status.problem ? "semibold" : "regular", 3)
          : null}
      </VStack>,
    );
  }

  // What's still ahead comes first; the ones over fill what room is left, latest first, then go back in order.
  const ahead = today.classes.filter((one) => !one.past);
  const room = family === "systemLarge" || family === "systemExtraLarge" ? 9 : family === "systemMedium" ? 3 : family === "systemSmall" ? 3 : 2;
  const keep = [...ahead, ...today.classes.filter((one) => one.past).reverse()].slice(0, room);
  const shown = today.classes.filter((one) => keep.includes(one));

  if (family === "accessoryInline") {
    const next = ahead[0];
    return inline(
      next ? [next.time.split(/[–-]/)[0], next.code, next.room].filter(Boolean).join(" · ") : (today.none?.label ?? today.heading),
      next?.url ?? today.none?.url ?? doc.url,
    );
  }

  const row = (one: (typeof today.classes)[number], wide: boolean) => {
    const color = one.color[scheme];
    const body = (
      <HStack spacing={6} alignment="center" modifiers={[accessibilityLabel([one.time, one.code, one.room].filter(Boolean).join(", "))]}>
        {lock ? null : <RoundedRectangle cornerRadius={2} modifiers={[frame({ width: 4, height: 16 }), foregroundStyle(color)]} />}
        <Text
          modifiers={[
            font({ textStyle: "footnote", weight: one.live ? "semibold" : "regular" }),
            monospacedDigit(),
            foregroundStyle(one.live && !lock ? (c?.live ?? fg) : one.past ? muted : fg),
            lineLimit(1),
          ]}
        >
          {wide ? one.time : one.time.split(/[–-]/)[0]}
        </Text>
        {line([one.code, wide ? one.room : null].filter(Boolean).join(" · "), "footnote", one.past ? muted : fg, one.past ? "regular" : "semibold")}
      </HStack>
    );
    // A small widget and the Lock Screen take one tap for the whole: each class opens its sheet only where rows can.
    return family === "systemMedium" || family === "systemLarge" || family === "systemExtraLarge" ? (
      <Link key={`${one.code}${one.time}`} destination={one.url}>
        {body}
      </Link>
    ) : (
      <VStack key={`${one.code}${one.time}`}>{body}</VStack>
    );
  };

  if (family === "accessoryRectangular" || family === "accessoryCircular") {
    return root(
      ahead[0]?.url ?? today.none?.url ?? doc.url,
      <VStack alignment="leading" spacing={1}>
        {line(today.heading, "caption2", "secondary", "semibold")}
        {today.none ? line(today.none.label, "caption", "secondary", "regular", 2) : shown.map((one) => row(one, false))}
      </VStack>,
    );
  }

  const wide = family !== "systemSmall";
  const deadline = today.deadline;
  return root(
    family === "systemSmall" ? (ahead[0]?.url ?? today.none?.url ?? doc.url) : (today.none?.url ?? doc.url),
    <VStack alignment="leading" spacing={wide ? 6 : 4} modifiers={[frame({ maxWidth: 10000, maxHeight: 10000, alignment: "topLeading" })]}>
      {line(today.heading, "caption", c?.today ?? fg, "semibold")}
      {today.none ? line(today.none.label, "footnote", muted, "regular", 2) : null}
      {shown.map((one) => row(one, wide))}
      <Spacer minLength={0} />
      {deadline ? (
        wide ? (
          <Link destination={deadline.url}>
            <VStack alignment="leading" spacing={0}>
              {line(deadline.label, "caption2", muted, "semibold")}
              {deadline.detail ? line(deadline.detail, "footnote", fg) : null}
            </VStack>
          </Link>
        ) : (
          <VStack alignment="leading" spacing={0}>
            {line(deadline.label, "caption2", muted, "semibold")}
          </VStack>
        )
      ) : null}
    </VStack>,
  );
}

/**
 * The widget, or null when iOS wouldn't make it. Made here, as the file loads, because expo-widgets reads each widget's
 * layout at build time by loading this file; and caught here, because an error thrown while a file loads closes the
 * app whoever asked for the file (../host/widget-ios.ios.ts's own catch never sees it).
 */
function make() {
  try {
    return createWidget(TODAY_WIDGET, TodayWidget, storable(setupDoc(process.env.EXPO_PUBLIC_DEMO === "1" ? "Edunex Plus Demo" : "Edunex Plus", null, "")));
  } catch (error) {
    console.warn("[widget-ios] TodayWidget wasn't made:", error);
    return null;
  }
}

export default make();
