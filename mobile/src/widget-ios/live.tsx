// The iPhone's Live Activity for the class on now (./live-doc.ts): on the Lock Screen and in the Dynamic Island, the
// course, how far through the class is (a bar iOS moves itself), and, while its Presence window is open, what to fill
// in and the time left as iOS's own countdown. Each fact once: the window's close is the countdown, nowhere else.
// Like the widgets, the function runs on its own in the widget extension: everything is in the props or inside it.
import { HStack, ProgressView, RoundedRectangle, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, frame, lineLimit, monospacedDigit, padding, tint } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity, type LiveActivityEnvironment } from "expo-widgets";
import type { LiveDoc } from "./live-doc";

/** The Live Activity's name to expo-widgets (no app.config.ts entry: the docs say a Live Activity needs none). */
export const LIVE_ACTIVITY = "EdunexClass";

export function ClassActivity(doc: LiveDoc, env: LiveActivityEnvironment) {
  "widget";
  const scheme = env.colorScheme === "dark" ? "dark" : "light";
  const c = doc.colors[scheme];
  const color = doc.color[scheme];
  const now = Date.now();
  const window = doc.presence && doc.presence.closesAt > now ? doc.presence : null;
  // The moment that matters next: the window closing while it's open, else the class ending.
  const until = new Date(window ? window.closesAt : doc.endsAt);
  const timer = (style: "caption2" | "caption" | "footnote" | "headline", color: string) => (
    <Text
      timerInterval={{ lower: new Date(Math.min(now, until.getTime())), upper: until }}
      countsDown
      modifiers={[font({ textStyle: style, weight: "semibold" }), monospacedDigit(), foregroundStyle(color), lineLimit(1)]}
    />
  );
  const title = (
    <HStack spacing={6} alignment="center">
      <RoundedRectangle cornerRadius={2} modifiers={[frame({ width: 4, height: 18 }), foregroundStyle(color)]} />
      <Text modifiers={[font({ textStyle: "headline", weight: "semibold" }), foregroundStyle(c.fg), lineLimit(1)]}>
        {doc.name ? `${doc.code} ${doc.name}` : doc.code}
      </Text>
    </HStack>
  );
  const progress = (
    <ProgressView timerInterval={{ lower: new Date(doc.startsAt), upper: new Date(doc.endsAt) }} countsDown={false} modifiers={[tint(color)]}>
      <Text modifiers={[font({ textStyle: "caption" }), foregroundStyle(c.muted), lineLimit(1)]}>{doc.detail}</Text>
    </ProgressView>
  );
  // What to do now: SIX's "Tandai Hadir" first, else the Presence with its countdown.
  const todo = doc.checkIn ? (
    <Text modifiers={[font({ textStyle: "footnote", weight: "semibold" }), foregroundStyle(c.live), lineLimit(1)]}>{doc.checkIn.label}</Text>
  ) : window ? (
    <HStack spacing={6}>
      <Text modifiers={[font({ textStyle: "footnote", weight: "semibold" }), foregroundStyle(c.warn), lineLimit(1)]}>{window.label}</Text>
      <Spacer minLength={0} />
      {timer("footnote", c.warn)}
    </HStack>
  ) : null;

  return {
    banner: (
      <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 14 })]}>
        {title}
        {progress}
        {todo}
      </VStack>
    ),
    compactLeading: (
      <HStack spacing={4}>
        <RoundedRectangle cornerRadius={2} modifiers={[frame({ width: 4, height: 14 }), foregroundStyle(color)]} />
        <Text modifiers={[font({ textStyle: "caption", weight: "semibold" }), lineLimit(1)]}>{doc.code}</Text>
      </HStack>
    ),
    compactTrailing: timer("caption", window ? c.warn : color),
    minimal: timer("caption2", window ? c.warn : color),
    expandedLeading: title,
    expandedTrailing: timer("headline", window ? c.warn : c.fg),
    expandedBottom: (
      <VStack alignment="leading" spacing={6}>
        {progress}
        {todo}
      </VStack>
    ),
  };
}

export default createLiveActivity(LIVE_ACTIVITY, ClassActivity);
