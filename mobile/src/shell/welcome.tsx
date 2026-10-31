// The first run on the phone (and after signing out of everything), W15: no deck. One screen in the app's own colours:
// the mark, what the app is in a line, three reasons as an icon and a few words, and one button, "Masuk dengan akun
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
import { type IconProps, Icons } from "../ui/icons";
import { useReduceMotion } from "../ui/motion";
import { Text } from "../ui/text";
import { motion, shape, space, TOUCH, useTheme } from "../ui/theme";

const MARK = 72;

const REASONS: readonly { icon: React.ComponentType<IconProps>; key: "class" | "tasks" | "attendance" }[] = [
  { icon: Icons.CalendarCheck, key: "class" },
  { icon: Icons.ListChecks, key: "tasks" },
  { icon: Icons.Hand, key: "attendance" },
];

export function Welcome() {
  const t = useT();
  const theme = useTheme();
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
        <View style={{ flexGrow: 1, justifyContent: "center", paddingVertical: space[6] }}>
          <Animated.View entering={enter(0)}>
            <Image source={require("../../assets/icon.png")} style={styles.mark} accessibilityIgnoresInvertColors accessibilityElementsHidden />
          </Animated.View>
          <Animated.View entering={enter(1)} style={{ marginTop: space[6] }}>
            <Text size="headlineMedium" accessibilityRole="header">
              Edunex Plus
            </Text>
            <Text size="bodyLarge" tone="muted" style={{ marginTop: space[1] }}>
              {t("mobile.welcome.line")}
            </Text>
          </Animated.View>
          <View style={{ marginTop: space[8], gap: space[4] }}>
            {REASONS.map(({ icon: Icon, key }, i) => (
              <Animated.View key={key} entering={enter(2 + i)} style={{ flexDirection: "row", alignItems: "center", gap: space[4] }}>
                <View style={[styles.reason, { backgroundColor: theme.color.secondaryContainer }]}>
                  <Icon size={22} color={theme.color.onSecondaryContainer} />
                </View>
                <Text size="bodyLarge" style={{ flex: 1 }}>
                  {t(`mobile.welcome.reason.${key}`)}
                </Text>
              </Animated.View>
            ))}
          </View>
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
      style={[styles.chip, { borderColor: theme.color.outline }]}
    >
      <Icons.Globe size={18} color={theme.color.onSurfaceVariant} />
      <Text size="labelLarge" tone="muted">
        {name[lang]}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mark: { width: MARK, height: MARK, borderRadius: shape.lgPlus },
  reason: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
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
