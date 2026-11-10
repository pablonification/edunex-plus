// The first run on the phone (and after signing out of everything), W15: no deck. One screen in the app's own colours:
// Beranda's blue holding the mark and three reasons as small cards (the one focal point), the name and what the app
// is in a line, and one button, "Masuk dengan akun
// ITB", within the thumb's reach; the language as a small chip in the corner. The button opens ITB's Microsoft page as
// a screen of its own (./sign-in.tsx: a top bar with close); SIX joins quietly on the same Microsoft session
// (the desktop's signInToBoth). Once a system is in, this screen fades and Beranda fills in as the data comes, with
// the first read's progress in the top bar; the summary and the ask for notifications wait on Beranda as cards
// (src/screens/home/first-run.tsx).
import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorKey } from "../../../src/app/bridge";
import { useT } from "../../../src/app/i18n";
import { useBridge, useSettings } from "../../../src/app/store";
import { Button } from "../ui/controls";
import { IconTile, type PillTone } from "../ui/group";
import { type IconProps, Icons } from "../ui/icons";
import { useReduceMotion } from "../ui/motion";
import { iosPressed } from "../ui/press";
import { Text } from "../ui/text";
import { motion, shape, space, TOUCH, useTheme } from "../ui/theme";

/** The mark's size, and the empty edge of its adaptive-icon canvas (a third of it, Android's safe zone). */
const MARK = 84;
const MARK_EDGE = 28;

/** What the app keeps, each in its tone and nudged along (dp) so the three sit like a hand of cards. */
const REASONS: readonly { icon: React.ComponentType<IconProps>; key: "class" | "tasks" | "attendance"; tone: PillTone; shift: number }[] = [
  { icon: Icons.CalendarCheck, key: "class", tone: "brand", shift: 0 },
  { icon: Icons.ListChecks, key: "tasks", tone: "ok", shift: space[4] },
  { icon: Icons.Hand, key: "attendance", tone: "amber", shift: space[2] },
];

export function Welcome() {
  const t = useT();
  const theme = useTheme();
  const v = theme.v4;
  const insets = useSafeAreaInsets();
  const bridge = useBridge();
  const still = useReduceMotion();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  // Each part comes up a beat after the one before (a fade where the phone asks for less motion).
  const enter = (step: number) =>
    still
      ? FadeIn.delay(step * 60)
      : FadeInDown.delay(step * 70)
          .springify()
          .damping(18)
          .stiffness(180);
  const signIn = async () => {
    setFailed(null);
    setBusy(true);
    try {
      // Edunex on Microsoft's page; SIX tries the same session out of sight right after (signInToBoth).
      await bridge.invoke("auth.signIn", { source: "edunex" });
    } catch (error) {
      setFailed(t(errorKey(error, "welcome.signInFailed")));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Animated.View
      testID="screen.welcome"
      exiting={FadeOut.duration(motion.duration.medium)}
      style={[StyleSheet.absoluteFill, { backgroundColor: theme.color.surface, paddingTop: insets.top, paddingBottom: insets.bottom, zIndex: 50 }]}
    >
      <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: space[2], minHeight: TOUCH + space[2], alignItems: "center" }}>
        <LanguageChip />
      </View>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: space[6] }}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexGrow: 1, justifyContent: "center", paddingVertical: space[4] }}>
          {/* The one focal point: Beranda's blue with the mark and what the app keeps for the Student, each a small
              card as Beranda's are, a little off-line like a hand of cards. */}
          <View style={{ backgroundColor: v.head, borderRadius: 28, padding: space[5], paddingBottom: space[6] }}>
            <Animated.View entering={enter(0)}>
              {/* The launcher's own one-colour mark, in the header's white; its safe zone's margin trimmed to line up. */}
              <Image
                source={require("../../assets/android-icon-monochrome.png")}
                style={[styles.mark, { tintColor: v.onHead }]}
                accessibilityIgnoresInvertColors
                accessibilityElementsHidden
              />
            </Animated.View>
            <View style={{ marginTop: space[5], gap: space[2] }}>
              {REASONS.map(({ icon: Icon, key, tone, shift }, i) => (
                <Animated.View
                  key={key}
                  entering={enter(1 + i)}
                  style={{
                    marginLeft: shift,
                    marginRight: space[4] - shift,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space[3],
                    backgroundColor: v.card,
                    borderRadius: 20,
                    padding: space[3],
                  }}
                >
                  <IconTile tone={tone} icon={(color) => <Icon size={22} weight="fill" color={color} />} />
                  <Text size="bodyLarge" weight="medium" style={{ flex: 1, color: v.fg }}>
                    {t(`mobile.welcome.reason.${key}`)}
                  </Text>
                </Animated.View>
              ))}
            </View>
          </View>
          <Animated.View entering={enter(4)} style={{ marginTop: space[8] }}>
            <Text size="headlineMedium" face="display" weight="bold" accessibilityRole="header" style={{ letterSpacing: -0.4 }}>
              Edunex Plus
            </Text>
            <Text size="bodyLarge" tone="muted" style={{ marginTop: space[1] }}>
              {t("mobile.welcome.line")}
            </Text>
          </Animated.View>
        </View>
        <Animated.View entering={enter(5)} style={{ paddingBottom: space[6], gap: space[3] }}>
          {failed && (
            <View style={{ borderRadius: shape.md, backgroundColor: theme.color.errorContainer, padding: space[3] }} accessibilityLiveRegion="polite">
              <Text size="bodyMedium" style={{ color: theme.color.onErrorContainer }}>
                {failed}
              </Text>
            </View>
          )}
          <Button variant="primary" size="lg" busy={busy} onPress={() => void signIn()} testID="action.signIn">
            {t("mobile.welcome.signIn")}
          </Button>
          <Text size="bodySmall" tone="muted" style={{ textAlign: "center" }}>
            {t("welcome.connectLead")}
          </Text>
        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
}

/** Indonesia or English, as a small chip: the phone's language picked it; a tap switches. Settings has it later. */
function LanguageChip() {
  const t = useT();
  const theme = useTheme();
  const bridge = useBridge();
  const { lang } = useSettings();
  const other = lang === "id" ? "en" : "id";
  const name = { id: "Indonesia", en: "English" } as const;
  return (
    <Pressable
      testID="action.welcomeLanguage"
      accessibilityRole="button"
      accessibilityLabel={`${t("settings.language")}: ${name[lang]}`}
      accessibilityHint={name[other]}
      onPress={() => void bridge.invoke("settings.update", { lang: other }).catch(() => undefined)}
      android_ripple={{ color: theme.color.selected }}
      hitSlop={{ top: 8, bottom: 8 }}
      style={({ pressed }) => [[styles.chip, { borderColor: theme.color.outline }], iosPressed(pressed)]}
    >
      <Icons.Globe size={18} color={theme.color.onSurfaceVariant} />
      <Text size="labelLarge" tone="muted">
        {name[lang]}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mark: { width: MARK, height: MARK, margin: -MARK_EDGE + 4 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    height: 32,
    paddingHorizontal: space[3],
    borderRadius: shape.sm,
    borderWidth: 1,
    overflow: "hidden",
  },
});
