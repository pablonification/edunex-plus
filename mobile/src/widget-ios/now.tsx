// The iPhone's "Edunex Plus" widget: the class on now or next, "Tandai Hadir", and what needs you, as Android's Now
// widget (../widget/view.tsx) says them, from the same model (./doc.ts). Drawn by WidgetKit through expo-widgets: the
// function below runs on its own in the widget (no imports, no module values, no hooks), so everything it needs is
// in the document or declared inside it. Small, medium and large on the Home Screen; rectangular, round and one
// line on the Lock Screen.
import { AccessoryWidgetBackground, HStack, Link, RoundedRectangle, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  background,
  clipShape,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  padding,
  redacted,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";
import { type IosWidgetDoc, setupDoc } from "./doc";

/** The widget's name in app.config.ts (expo-widgets' `widgets[].name`) and to WidgetKit. */
export const NOW_WIDGET = "EdunexNow";

export function NowWidget(doc: IosWidgetDoc, env: WidgetEnvironment) {
  "widget";
  const family = env.widgetFamily ?? "systemMedium";
  const ready = doc?.v === 1;
  const scheme = ready && doc.scheme !== "system" ? doc.scheme : env.colorScheme === "dark" ? "dark" : "light";
  const c = ready ? doc.colors[scheme] : null;
  const fg = c ? c.fg : "primary";
  const muted = c ? c.muted : "secondary";
  const lock = family === "accessoryCircular" || family === "accessoryRectangular" || family === "accessoryInline";
  // The Lock Screen tints everything itself: colours there are the system's primary and secondary.
  const ink = (color: string | undefined, fallback: string) => (lock ? fallback : (color ?? fallback));
  // iOS 17 and later keep the widget's content off its edges themselves (and say by how much); iOS 16 doesn't.
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
    style: "caption2" | "caption" | "footnote" | "subheadline" | "headline" | "title3",
    color: string,
    weight: "regular" | "medium" | "semibold" | "bold" = "regular",
    lines = 1,
  ) => <Text modifiers={[font({ textStyle: style, weight }), foregroundStyle(color), lineLimit(lines)]}>{text}</Text>;

  // ---------------------------------------------------------------- before the app has anything

  // Nothing to show yet (never opened, nothing saved, or signed in nowhere): the app's name and the one thing to do.
  const empty = !ready || doc.state === "setup" || (!doc.now && !doc.needs && !doc.actions.length);
  if (empty) {
    const title = ready ? doc.title : "Edunex Plus";
    const hint = ready ? doc.hint || doc.status.text || null : null;
    const warn = ready && doc.status.problem && !doc.hint;
    if (family === "accessoryInline") return <Text>{title}</Text>;
    if (family === "accessoryCircular")
      return root(
        ready ? doc.url : undefined,
        <ZStack modifiers={[frame({ maxWidth: 10000, maxHeight: 10000 })]}>
          <AccessoryWidgetBackground />
          {line("–", "headline", "primary", "bold")}
        </ZStack>,
      );
    if (lock)
      return root(
        ready ? doc.url : undefined,
        <VStack alignment="leading" spacing={2}>
          {line(title, "headline", "primary", "semibold")}
          {hint ? line(hint, "caption", "secondary", "regular", 2) : null}
        </VStack>,
      );
    // Never opened yet (or the gallery's preview): the class card's shape, greyed as iOS shows a widget still loading.
    return root(
      ready ? doc.url : undefined,
      <VStack alignment="leading" spacing={6}>
        {line(title, "headline", fg, "semibold")}
        {hint ? (
          line(hint, "footnote", warn ? (c?.warn ?? muted) : muted, warn ? "semibold" : "regular", 3)
        ) : (
          <VStack alignment="leading" spacing={4} modifiers={[redacted("placeholder")]}>
            {line("XXXXXXXXXXXX", "caption", muted)}
            {line("XXXXXX XXXXXXXXXX", "subheadline", fg, "semibold")}
            {line("00:00–00:00", "caption", muted)}
          </VStack>
        )}
      </VStack>,
    );
  }

  const now = doc.now;
  const klass = now && now.kind === "class" ? now : null;
  /** No class in the coming week: the line saying so. */
  const plain = now && now.kind === "line" ? now : null;
  const primary = doc.actions.find((one) => one.primary) ?? null;
  const status = doc.status.text
    ? line(
        doc.status.text,
        "caption2",
        doc.status.problem ? ink(c?.warn, "primary") : muted,
        doc.status.problem ? "semibold" : "regular",
        doc.status.problem ? 2 : 1,
      )
    : null;

  // ---------------------------------------------------------------- the Lock Screen

  if (family === "accessoryInline") {
    // One line beside the date: "08:00 DK4073 · 7602", or the line saying there's none.
    if (klass) return <Text>{[klass.start, klass.code, klass.where].filter(Boolean).join(" · ")}</Text>;
    return <Text>{plain ? plain.label : doc.title}</Text>;
  }
  if (family === "accessoryCircular") {
    return root(
      klass?.url ?? doc.url,
      <ZStack modifiers={[frame({ maxWidth: 10000, maxHeight: 10000 })]}>
        <AccessoryWidgetBackground />
        <VStack spacing={0}>
          {line(klass ? klass.start : "–", "headline", "primary", "bold")}
          {klass ? <Text modifiers={[font({ textStyle: "caption2", weight: "medium" }), minimumScaleFactor(0.6), lineLimit(1)]}>{klass.code}</Text> : null}
        </VStack>
      </ZStack>,
    );
  }
  if (family === "accessoryRectangular") {
    if (!klass)
      return root(
        now?.url ?? doc.url,
        <VStack alignment="leading" spacing={1}>
          {line(doc.title, "headline", "primary", "semibold")}
          {line(plain ? plain.label : doc.status.text, "caption", "secondary", "regular", 2)}
        </VStack>,
      );
    return root(
      primary?.url ?? klass.url,
      <VStack alignment="leading" spacing={1}>
        {line(klass.heading, "caption2", "secondary", "semibold")}
        {line(klass.name ? `${klass.code} ${klass.name}` : klass.code, "headline", "primary", "semibold")}
        {line(primary ? primary.label : [klass.time, klass.where].filter(Boolean).join(" · "), "caption", "secondary")}
      </VStack>,
    );
  }

  // ---------------------------------------------------------------- the Home Screen

  const large = family === "systemLarge" || family === "systemExtraLarge";
  const small = family === "systemSmall";

  /** "Sedang berlangsung" in the live green, the time and room under it, then the course's colour, code and name. */
  const classBlock = () => {
    if (!now)
      return (
        <VStack alignment="leading" spacing={2}>
          {line(doc.title, "headline", fg, "semibold")}
        </VStack>
      );
    if (!klass) return line(plain ? plain.label : doc.title, "footnote", muted, "regular", small ? 4 : 2);
    const color = klass.color[scheme];
    return (
      <VStack
        alignment="leading"
        spacing={3}
        modifiers={[accessibilityLabel([klass.heading, klass.time, klass.code, klass.name, klass.where].filter(Boolean).join(", "))]}
      >
        {line(klass.heading, "caption", klass.live ? (c?.live ?? fg) : muted, "semibold", large ? 1 : 2)}
        {large ? (
          // Large: the code and name on one line, the time and room under it.
          <HStack spacing={6} alignment="center">
            <RoundedRectangle cornerRadius={2} modifiers={[frame({ width: 4, height: 20 }), foregroundStyle(color)]} />
            {line(klass.name ? `${klass.code} ${klass.name}` : klass.code, "headline", fg, "semibold")}
          </HStack>
        ) : (
          // Small and medium: the code big beside the course's colour, its name and when under it.
          <HStack spacing={6} alignment="center">
            <RoundedRectangle cornerRadius={2} modifiers={[frame({ width: 4, height: 34 }), foregroundStyle(color)]} />
            <VStack alignment="leading" spacing={0}>
              {line(klass.code, "headline", fg, "bold")}
              {line(small ? klass.time : [klass.time, klass.where].filter(Boolean).join(" · "), "caption", muted)}
            </VStack>
          </HStack>
        )}
        {large
          ? line([klass.time, klass.where].filter(Boolean).join(" · "), "caption", muted)
          : klass.name && !(small && primary)
            ? line(klass.name, "caption", fg, "regular", small ? 2 : 1)
            : null}
      </VStack>
    );
  };

  /** "Tandai Hadir sudah dibuka di SIX · PL3002" as the app's main button; the Presence to fill in as a quiet one. */
  const pill = (one: IosWidgetDoc["actions"][number], key: string) => {
    const body = (
      <HStack
        spacing={4}
        modifiers={[
          padding({ horizontal: 10, vertical: 6 }),
          frame({ maxWidth: 10000, alignment: "leading" }),
          background(one.primary ? (c?.accent ?? "blue") : (c?.chip ?? "gray")),
          clipShape("roundedRectangle", 10),
        ]}
      >
        {line(
          large ? [one.label, one.detail].filter(Boolean).join(" · ") : one.label,
          "caption",
          one.primary ? (c?.onAccent ?? "white") : fg,
          "semibold",
          large ? 1 : 2,
        )}
      </HStack>
    );
    return small ? (
      <VStack key={key}>{body}</VStack>
    ) : (
      <Link key={key} destination={one.url} modifiers={[accessibilityLabel(one.a11y ?? one.label)]}>
        {body}
      </Link>
    );
  };

  /** "Perlu perhatianmu", as many as `count`, then "Lihat semua" when some are left out. */
  const needsBlock = (count: number, details: boolean) => {
    const needs = doc.needs;
    if (!needs) return null;
    if (needs.empty)
      return (
        <VStack alignment="leading" spacing={2}>
          {line(needs.heading, "caption2", muted, "semibold")}
          {line(needs.empty.label, "footnote", muted, "regular", 2)}
        </VStack>
      );
    const shown = needs.items.slice(0, count);
    return (
      <VStack alignment="leading" spacing={details ? 6 : 3}>
        {line(needs.heading, "caption2", muted, "semibold")}
        {shown.map((item) => (
          <Link
            key={`${item.label}${item.detail ?? ""}`}
            destination={item.url}
            modifiers={[accessibilityLabel(item.a11y ?? [item.label, item.detail].filter(Boolean).join(", "))]}
          >
            <VStack alignment="leading" spacing={0}>
              {line(item.label, "footnote", fg, "semibold")}
              {details && item.detail ? line(item.detail, "caption", muted) : null}
            </VStack>
          </Link>
        ))}
        {needs.all && shown.length < needs.items.length ? (
          <Link destination={needs.all.url}>{line(needs.all.label, "caption", c?.link ?? fg, "semibold")}</Link>
        ) : null}
      </VStack>
    );
  };

  if (small) {
    // One tap for the whole widget: "Tandai Hadir" when it's open, else the class.
    return root(
      primary?.url ?? (now ? now.url : doc.url),
      <VStack alignment="leading" spacing={6} modifiers={[frame({ maxWidth: 10000, maxHeight: 10000, alignment: "topLeading" })]}>
        {classBlock()}
        <Spacer minLength={0} />
        {primary ? pill(primary, "primary") : now ? null : status}
      </VStack>,
    );
  }

  if (!large) {
    // Medium: the class and its buttons on the left, what needs you on the right.
    return root(
      doc.url,
      <VStack alignment="leading" spacing={6} modifiers={[frame({ maxWidth: 10000, maxHeight: 10000, alignment: "topLeading" })]}>
        <HStack alignment="top" spacing={12}>
          <VStack alignment="leading" spacing={8} modifiers={[frame({ maxWidth: 10000, alignment: "leading" })]}>
            <Link destination={now ? now.url : doc.url}>{classBlock()}</Link>
            {doc.actions.slice(0, 1).map((one, index) => pill(one, `action-${index}`))}
          </VStack>
          {doc.needs ? <VStack modifiers={[frame({ maxWidth: 10000, alignment: "leading" })]}>{needsBlock(3, false)}</VStack> : null}
        </HStack>
        <Spacer minLength={0} />
        {status}
      </VStack>,
    );
  }

  // Large: the class, its buttons, then what needs you with each one's when, and the status at the foot.
  return root(
    doc.url,
    <VStack alignment="leading" spacing={10} modifiers={[frame({ maxWidth: 10000, maxHeight: 10000, alignment: "topLeading" })]}>
      <Link destination={now ? now.url : doc.url}>{classBlock()}</Link>
      {doc.actions.slice(0, 2).map((one, index) => pill(one, `action-${index}`))}
      {needsBlock(6 - Math.min(2, doc.actions.length), true)}
      <Spacer minLength={0} />
      {status}
    </VStack>,
  );
}

export default createWidget(NOW_WIDGET, NowWidget, setupDoc(process.env.EXPO_PUBLIC_DEMO === "1" ? "Edunex Plus Demo" : "Edunex Plus", null, ""));
