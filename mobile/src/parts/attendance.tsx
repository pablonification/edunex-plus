// Attendance pieces every screen that shows it shares (src/app/attendance-parts.tsx): the absence
// budget with its bar and words, the course's target and the stepper that changes it. The words
// and tones come from the desktop's own src/app/attendance-labels.ts.
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { BAR_TEXT, budgetLabel, budgetWords, STATE_TONE } from "../../../src/app/attendance-labels";
import { errorKey } from "../../../src/app/bridge";
import { useT } from "../../../src/app/i18n";
import { useBridge, useSettings } from "../../../src/app/store";
import { type AttendanceHealth, percent } from "../../../src/core/attendance";
import type { Settings } from "../../../src/core/models";
import { toast } from "../swaps/overlays";
import { Button, IconButton } from "../ui/controls";
import { Icons } from "../ui/icons";
import { Meta } from "../ui/layout";
import { Sheet } from "../ui/sheet";
import { Text, type TextTone } from "../ui/text";
import { radius, space, useTheme } from "../ui/theme";
import { AbsenceBar } from "./meter";

const MIN = 50;
const MAX = 100;
const STEP = 5;

/** The desktop's text-color classes as the phone's tones. */
export function toneOf(className: string): TextTone {
  if (className.includes("danger")) return "danger";
  if (className.includes("warning")) return "warning";
  if (className.includes("success")) return "success";
  if (className.includes("faint")) return "faint";
  if (className.includes("muted")) return "muted";
  return "fg";
}

/** The Student's targets: the default, each course's own, and the way to change them. */
export function useTargets() {
  const t = useT();
  const bridge = useBridge();
  const { attendanceTarget, attendanceTargets } = useSettings();
  const save = (patch: Partial<Settings>) => void bridge.invoke("settings.update", patch).catch((error: unknown) => toast(t(errorKey(error)), "danger"));
  return {
    target: attendanceTarget,
    own: attendanceTargets,
    setDefault: (value: number) => save({ attendanceTarget: value }),
    setOwn: (code: string, value: number | null) => {
      const next = { ...attendanceTargets };
      if (value === null) delete next[code];
      else next[code] = value;
      save({ attendanceTargets: next });
    },
  };
}

/** "− 80% +", in steps of 5 between 50 and 100; its buttons name the course (`code`), or the default. */
export function TargetStepper({ value, onChange, code }: { value: number; onChange: (value: number) => void; code?: string }) {
  const t = useT();
  const theme = useTheme();
  return (
    // In a box, as the desktop's Stepper: the two buttons and the value read as one control.
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: theme.color.edge,
        borderRadius: radius.lg,
        backgroundColor: theme.color.surfaceContainerLow,
      }}
    >
      <IconButton
        label={code ? t("presence.target.lowerFor", { code }) : t("presence.target.lower")}
        onPress={() => value > MIN && onChange(value - STEP)}
        testID="action.targetLower"
      >
        <Icons.Minus size={18} color={value > MIN ? theme.color.fg : theme.color.faint} />
      </IconButton>
      <Text size="title" weight="semibold" tabular style={{ minWidth: 56, textAlign: "center" }} accessibilityLiveRegion="polite">
        {`${value}%`}
      </Text>
      <IconButton
        label={code ? t("presence.target.raiseFor", { code }) : t("presence.target.raise")}
        onPress={() => value < MAX && onChange(value + STEP)}
        testID="action.targetRaise"
      >
        <Icons.Plus size={18} color={value < MAX ? theme.color.fg : theme.color.faint} />
      </IconButton>
    </View>
  );
}

/** "Target 80% ▾" on the course page: its own target in a sheet, or back to the default. */
export function CourseTarget({ code }: { code: string }) {
  const t = useT();
  const theme = useTheme();
  const { target, own, setOwn } = useTargets();
  const [open, setOpen] = useState(false);
  const mine = Object.hasOwn(own, code) ? own[code]! : null;
  const value = mine ?? target;
  return (
    <>
      <Button
        size="sm"
        icon={<Icons.Target size={14} />}
        label={t("presence.target.for", { value, code })}
        onPress={() => setOpen(true)}
        testID="action.courseTarget"
      >
        {/* The desktop's ⌄: the button opens a choice. */}
        <Text size="small" weight="semibold" tabular numberOfLines={1}>
          {t("presence.target", { value })}
        </Text>
        <Icons.ChevronDown size={12} color={theme.color.muted} />
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("presence.target.course", { code })}>
        <Text size="small" tone="muted">
          {t(mine === null ? "presence.target.followsDefault" : "presence.target.ownSet")}
        </Text>
        <View style={{ marginTop: space[3], flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: space[2] }}>
          <TargetStepper value={value} onChange={(next) => setOwn(code, next)} code={code} />
          {mine !== null && (
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                setOwn(code, null);
                setOpen(false);
              }}
            >
              {t("presence.target.useDefault", { value: target })}
            </Button>
          )}
        </View>
        <Text size="caption" tone="faint" style={{ marginTop: space[3], marginBottom: space[2] }}>
          {t("presence.target.contract")}
        </Text>
      </Sheet>
    </>
  );
}

/** "Jatah absen": the bar and its words ("Terpakai 1× · sisa 1×"), in a row, a header or a card. */
export function AbsenceBudget({
  health,
  place,
  own = false,
  soFar = false,
}: {
  health: AttendanceHealth;
  place: "row" | "header" | "card";
  own?: boolean;
  soFar?: boolean;
}) {
  const t = useT();
  const words = budgetWords(t, health, soFar);
  const share = health.held ? percent(health.attended ?? 0, health.held) : 0;
  const over = health.state === "met" || health.state === "missed";
  const count =
    place === "header" && health.held ? (
      <Text size="caption" tone="faint" tabular style={{ marginTop: 2 }}>
        {over ? t("presence.row.final", { percent: share }) : t("presence.row.count", { attended: health.attended ?? 0, held: health.held, percent: share })}
      </Text>
    ) : null;
  if (!words) {
    if (place === "row" || !over) return null;
    return (
      <View>
        <Text size="small" weight="semibold" tone={toneOf(STATE_TONE[health.state])}>
          {budgetLabel(t, health)}
        </Text>
        {count}
      </View>
    );
  }
  const bar = words.bar && (
    <AbsenceBar
      allowed={words.bar.allowed}
      used={words.bar.used}
      over={words.bar.over}
      estimate={words.bar.estimate}
      tone={words.tone}
      size={place === "row" ? "sm" : "md"}
      label={words.label}
    />
  );
  const text = (
    <Meta size="small">
      {words.lead ?? ""}
      <Text size="small" weight="semibold" tabular tone={toneOf(BAR_TEXT[words.tone])}>
        {words.bold}
      </Text>
      {own ? t("presence.row.ownTarget", { value: health.target }) : ""}
    </Meta>
  );
  if (place === "row")
    return (
      <View style={{ gap: 4 }}>
        {health.held ? (
          <View style={{ flexDirection: "row", gap: space[3] }}>
            <Text size="caption" tone="faint" style={{ width: 84 }}>
              {t("presence.share.label")}
            </Text>
            <Text size="small" tone="muted" tabular style={{ flex: 1 }}>
              <Text size="small" weight="medium" tabular>{`${share}%`}</Text> {t("presence.share.soFar", { attended: health.attended ?? 0, held: health.held })}
            </Text>
          </View>
        ) : null}
        <View style={{ flexDirection: "row", gap: space[3] }}>
          <Text size="caption" tone="faint" style={{ width: 84 }}>
            {t("presence.bar.label")}
          </Text>
          <View style={{ flex: 1, gap: 4 }}>
            {bar}
            {text}
          </View>
        </View>
      </View>
    );
  return (
    <View>
      <Text size={place === "header" ? "small" : "caption"} weight="medium" tone="muted">
        {t("presence.bar.label")}
      </Text>
      {bar && <View style={{ marginTop: 6, flexDirection: "row" }}>{bar}</View>}
      <View style={{ marginTop: 4 }}>{text}</View>
      {count}
    </View>
  );
}
