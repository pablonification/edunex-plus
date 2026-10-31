// Settings as Android lists them (Material 3's lists, Android 16's grouped settings): a group's title in
// the primary colour, its rows as tonal tiles (List), each row its label with the current value or a
// hint under it, the control at the end. A switch row toggles from anywhere on it; a choice row shows
// its value and opens the choices in a native sheet, one radio each; a plain row opens what it names.
// One row, one target, one outcome. Errors stay on the page (ErrorBanner), never in a snackbar.
import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useT } from "../../../src/app/i18n";
import { Switch } from "./controls";
import { Icons } from "./icons";
import { List } from "./layout";
import { Sheet } from "./sheet";
import { Text } from "./text";
import { space, TOUCH, useTheme } from "./theme";

/** A group of settings under its title: the rows as one list, a note under it. `lead` sits above the rows (a notice). */
export function SettingsGroup({
  title,
  note,
  lead,
  first = false,
  children,
  testID,
}: {
  title?: string;
  note?: string;
  lead?: ReactNode;
  first?: boolean;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <View style={{ marginTop: first ? 0 : space[6] }} testID={testID}>
      {title && (
        <Text size="titleSmall" tone="primary" accessibilityRole="header" style={styles.groupTitle}>
          {title}
        </Text>
      )}
      {lead}
      <List>{children}</List>
      {note && (
        <Text size="bodySmall" tone="muted" style={styles.note}>
          {note}
        </Text>
      )}
    </View>
  );
}

/**
 * One setting: what it is (`title`), its value or when it applies (`summary`), something at its start (`leading`) and
 * its control at its end (`trailing`). Pressable as a whole when `onPress` is given; `children` sit under the text,
 * inside the same tile (reminder chips, a stepper that needs the width).
 */
export function SettingRow({
  title,
  summary,
  leading,
  trailing,
  onPress,
  label,
  role = "button",
  checked,
  tone = "fg",
  busy,
  testID,
  children,
}: {
  title: ReactNode;
  summary?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  /** The accessible name, when the visible words alone don't say all of it. */
  label?: string;
  role?: "button" | "switch" | "link";
  checked?: boolean;
  tone?: "fg" | "danger";
  busy?: boolean;
  testID?: string;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const body = (
    <>
      <View style={styles.row}>
        {leading !== undefined && <View style={styles.leading}>{leading}</View>}
        <View style={{ flex: 1, minWidth: 0 }}>
          {typeof title === "string" ? (
            <Text size="bodyLarge" tone={tone === "danger" ? "danger" : "fg"}>
              {title}
            </Text>
          ) : (
            title
          )}
          {summary !== undefined &&
            summary !== null &&
            summary !== "" &&
            (typeof summary === "string" ? (
              <Text size="bodyMedium" tone="muted" style={{ marginTop: 2 }}>
                {summary}
              </Text>
            ) : (
              <View style={{ marginTop: 2 }}>{summary}</View>
            ))}
        </View>
        {trailing !== undefined && trailing !== null && <View style={{ flexShrink: 0 }}>{trailing}</View>}
      </View>
      {children && (
        <View style={{ paddingLeft: leading !== undefined ? space[4] + 40 + space[4] : space[4], paddingRight: space[4], paddingBottom: space[3] }}>
          {children}
        </View>
      )}
    </>
  );
  if (!onPress)
    return (
      <View testID={testID} accessibilityLabel={label}>
        {body}
      </View>
    );
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ ...(checked !== undefined ? { checked } : {}), ...(busy ? { busy } : {}) }}
      android_ripple={{ color: theme.color.selected }}
    >
      {body}
    </Pressable>
  );
}

/** A setting that's on or off: the whole row toggles it (Android's settings), the switch shows it. */
export function SwitchRow({
  title,
  summary,
  value,
  onChange,
  testID,
  rowTestID,
  disabled,
  children,
}: {
  title: string;
  summary?: ReactNode;
  value: boolean;
  onChange: (value: boolean) => void;
  /** On the switch itself, as the flows name it. */
  testID?: string;
  rowTestID?: string;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <SettingRow
      title={title}
      summary={summary}
      onPress={disabled ? undefined : () => onChange(!value)}
      role="switch"
      checked={value}
      label={title}
      testID={rowTestID}
      trailing={
        // The row is the switch for a screen reader (its name, "switch, on"): the switch inside isn't read twice.
        <View importantForAccessibility="no-hide-descendants">
          <Switch value={value} onChange={onChange} label={title} testID={testID} disabled={disabled} />
        </View>
      }
    >
      {children}
    </SettingRow>
  );
}

export interface Choice<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

/**
 * A setting with a few values (Tema, Bahasa): the row says the one picked, a tap opens the choices in a sheet, one
 * radio each; picking one closes it. `testID` is the row's; each choice is `<testID>.<value>`.
 */
export function ChoiceRow<T extends string>({
  title,
  hint,
  value,
  choices,
  onChange,
  testID,
}: {
  title: string;
  hint?: string;
  value: T;
  choices: readonly Choice<T>[];
  onChange: (value: T) => void;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  const picked = choices.find((choice) => choice.value === value)?.label ?? "";
  return (
    <>
      <SettingRow title={title} summary={picked} label={`${title}, ${picked}`} onPress={() => setOpen(true)} testID={testID}>
        {hint ? (
          <Text size="bodySmall" tone="muted">
            {hint}
          </Text>
        ) : undefined}
      </SettingRow>
      <ChoiceSheet
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        value={value}
        choices={choices}
        onChange={(next) => {
          setOpen(false);
          if (next !== value) onChange(next);
        }}
        testID={testID}
      />
    </>
  );
}

/** The choices of one setting in a native sheet: Material's radio list. */
export function ChoiceSheet<T extends string>({
  open,
  onClose,
  title,
  value,
  choices,
  onChange,
  testID,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  value: T;
  choices: readonly Choice<T>[];
  onChange: (value: T) => void;
  testID?: string;
}) {
  const theme = useTheme();
  const c = theme.color;
  return (
    <Sheet open={open} onClose={onClose} title={title} testID={testID ? `sheet.${testID}` : undefined}>
      <View accessibilityRole="radiogroup" accessibilityLabel={title} style={{ marginHorizontal: -space[6] }}>
        {choices.map((choice) => {
          const on = choice.value === value;
          return (
            <Pressable
              key={choice.value}
              testID={testID ? `${testID}.${choice.value}` : undefined}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, selected: on }}
              onPress={() => onChange(choice.value)}
              android_ripple={{ color: c.selected }}
              style={styles.choice}
            >
              {/* Material's radio button: a ring, filled at its centre when picked. */}
              <View style={[styles.radio, { borderColor: on ? c.primary : c.onSurfaceVariant }]}>
                {on && <View style={[styles.radioDot, { backgroundColor: c.primary }]} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text size="bodyLarge">{choice.label}</Text>
                {choice.hint && (
                  <Text size="bodyMedium" tone="muted">
                    {choice.hint}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

/** What went wrong on this page, under its top bar, until it's closed or the next try works. */
export function ErrorBanner({ text, onClose }: { text: string; onClose: () => void }) {
  const t = useT();
  const theme = useTheme();
  const c = theme.color;
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.banner, { backgroundColor: c.errorContainer }]} testID="banner.error">
      <Icons.AlertTriangle size={20} color={c.onErrorContainer} weight="bold" />
      <Text size="bodyMedium" style={{ flex: 1, color: c.onErrorContainer }}>
        {text}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("action.close")}
        onPress={onClose}
        android_ripple={{ color: c.selected, borderless: true, radius: 20 }}
        style={styles.bannerClose}
      >
        <Icons.X size={18} color={c.onErrorContainer} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  groupTitle: { paddingHorizontal: space[4], marginBottom: space[2] },
  note: { paddingHorizontal: space[4], marginTop: space[2] },
  row: { flexDirection: "row", alignItems: "center", gap: space[4], paddingHorizontal: space[4], paddingVertical: space[3], minHeight: 56 },
  leading: { width: 40, alignItems: "center", justifyContent: "center" },
  choice: { flexDirection: "row", alignItems: "center", gap: space[4], minHeight: 56, paddingVertical: space[2], paddingHorizontal: space[6] },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  banner: { flexDirection: "row", alignItems: "center", gap: space[3], paddingLeft: space[4], paddingRight: space[1], minHeight: TOUCH },
  bannerClose: { width: TOUCH, height: TOUCH, alignItems: "center", justifyContent: "center" },
});
