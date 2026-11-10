// Settings in round 2's v4 look (DESIGN.md "Round 2's look: v4"): each group a heading in Plus Jakarta Sans over one
// white card of rows (ui/group.tsx), hairlines inset. A row is its title, at most one short meta line (the current
// value) and at most one thing at its end (Android's MaterialSwitch, a value, a chevron); what explains it is in its
// spoken label or one tap deeper. Every row is one target with the press spring. A switch row toggles from anywhere on
// it, with a haptic; a choice row shows its value and opens the choices in a native sheet, one radio each, picking one
// closes it. Errors stay on the page (ErrorBanner, under the top bar), never in a snackbar.
import { Children, createContext, isValidElement, type ReactNode, useContext, useRef, useState } from "react";
import { type AccessibilityProps, ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useT } from "../../../src/app/i18n";
import { Switch } from "./controls";
import { Group, GroupRow, Heading } from "./group";
import { haptic } from "./haptics";
import { Icons } from "./icons";
import { iosPressed, PressScale } from "./press";
import { RowChevron } from "./row-end";
import { Sheet, SheetTitle } from "./sheet";
import { Text } from "./text";
import { space, TOUCH, useTheme } from "./theme";

/** The haptics of a settings commit: a switch's on and off, a pick in a sheet, a step, a confirmed sign-out (./haptics.ts). */
export { haptic };

/** Whether a row is its card's first (no hairline above it). */
const FirstRow = createContext(false);

/**
 * A group of settings: its heading, `lead` above the card (a notice), the rows in one card, a quiet `note` under it.
 * Rows that are direct children (or in an array) know which is first; a component drawing several rows passes
 * `first` itself.
 */
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
  const v = useTheme().v4;
  const rows = Children.toArray(children);
  return (
    <View testID={testID}>
      {title ? <Heading first={first}>{title}</Heading> : <View style={{ height: first ? space[2] : space[6] }} />}
      {lead}
      <Group>
        {rows.map((row, index) => (
          <FirstRow.Provider key={isValidElement(row) && row.key !== null ? row.key : index} value={index === 0}>
            {row}
          </FirstRow.Provider>
        ))}
      </Group>
      {note ? (
        <Text size="bodySmall" style={{ color: v.muted, marginTop: space[2], marginHorizontal: space[1] }}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

export type MetaTone = "muted" | "red" | "amber" | "ok";

/**
 * One setting as a `GroupRow`: its `title`, its value or state (`meta`), a tile at its start (`leading`, 44 dp) and
 * one thing at its end (`trailing`). With `onPress` the whole row is one target with the press spring. `hint` is
 * spoken after the label, for what the row no longer says (TalkBack's hint).
 */
export function SettingRow({
  title,
  meta,
  metaTone,
  leading,
  trailing,
  chevron,
  onPress,
  label,
  hint,
  role = "button",
  checked,
  busy,
  disabled,
  tone = "fg",
  first,
  testID,
  children,
}: {
  title: ReactNode;
  meta?: ReactNode;
  metaTone?: MetaTone;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** The chevron at its end: by itself on a row that opens something (a button with nothing at its end, not a danger); true or false to say so. */
  chevron?: boolean;
  onPress?: () => void;
  /** The accessible name, when the visible words alone don't say all of it. */
  label?: string;
  hint?: string;
  role?: "button" | "switch" | "link";
  checked?: boolean;
  busy?: boolean;
  disabled?: boolean;
  tone?: "fg" | "danger";
  first?: boolean;
  testID?: string;
  children?: ReactNode;
}) {
  const v = useTheme().v4;
  const firstInCard = useContext(FirstRow);
  const a11y: AccessibilityProps = {
    accessibilityLabel: label,
    accessibilityHint: hint,
    ...(onPress
      ? {
          accessibilityRole: role,
          accessibilityState: { ...(checked !== undefined ? { checked } : {}), ...(busy ? { busy } : {}), ...(disabled ? { disabled } : {}) },
        }
      : {}),
  };
  return (
    <GroupRow
      first={first ?? firstInCard}
      leading={leading}
      title={
        typeof title === "string" ? (
          <Text size="bodyLarge" weight="medium" style={{ color: tone === "danger" ? v.redFg : v.fg, lineHeight: 21 }}>
            {title}
          </Text>
        ) : (
          title
        )
      }
      meta={meta}
      metaTone={metaTone}
      trailing={busy ? <ActivityIndicator size="small" color={v.muted} /> : trailing}
      // A switch's row and a danger (sign out) don't open a place: no chevron unless asked.
      chevron={chevron ?? (role === "button" && tone !== "danger" ? undefined : false)}
      onPress={onPress && !busy && !disabled ? onPress : undefined}
      testID={testID}
      {...a11y}
    >
      {children}
    </GroupRow>
  );
}

/** A row that opens something (a screen, a sheet): the chevron at its end. The shared one (ui/row-end.tsx). */
export const Chevron = RowChevron;

/**
 * A setting that's on or off: the whole row toggles it (Android's settings), Android's MaterialSwitch at its end shows
 * it, a haptic says it took. The row is the switch for TalkBack and the flows (`testID`, role switch, its checked
 * state); the switch inside isn't read twice. `hint` (what the setting does) is spoken, not shown.
 */
export function SwitchRow({
  title,
  meta,
  metaTone,
  hint,
  value,
  onChange,
  testID,
  disabled,
}: {
  title: string;
  meta?: ReactNode;
  metaTone?: MetaTone;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID?: string;
  disabled?: boolean;
}) {
  // A tap on the switch itself reaches both the switch and the row: the second of the two asks is dropped.
  const last = useRef({ value: value, at: 0 });
  const flip = (next: boolean) => {
    const now = Date.now();
    if (last.current.value === next && now - last.current.at < 400) return;
    last.current = { value: next, at: now };
    haptic.toggle(next);
    onChange(next);
  };
  return (
    <SettingRow
      title={title}
      meta={meta}
      metaTone={metaTone}
      onPress={() => flip(!value)}
      disabled={disabled}
      role="switch"
      checked={value}
      label={hint ? `${title}, ${hint}` : title}
      testID={testID}
      trailing={
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Switch value={value} onChange={flip} label={title} disabled={disabled} />
        </View>
      }
    />
  );
}

export interface Choice<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

/**
 * A setting with a few values (Tema, Bahasa, Jangkauan): the row shows the one picked, a tap opens the choices in a
 * native sheet, one radio each; picking one closes it. `note` (what the setting does) sits in the sheet, over the
 * choices. `testID` is the row's; each choice is `<testID>.<value>`.
 */
export function ChoiceRow<T extends string>({
  title,
  note,
  value,
  choices,
  onChange,
  leading,
  testID,
}: {
  title: string;
  note?: string;
  value: T;
  choices: readonly Choice<T>[];
  onChange: (value: T) => void;
  leading?: ReactNode;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  const picked = choices.find((choice) => choice.value === value)?.label ?? "";
  return (
    <>
      <SettingRow
        title={title}
        meta={picked}
        leading={leading}
        label={`${title}, ${picked}`}
        hint={note}
        onPress={() => setOpen(true)}
        trailing={<Chevron />}
        testID={testID}
      />
      <ChoiceSheet
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        note={note}
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

/** A sheet's title in v4's face: the shared one (./sheet.tsx), here too for the settings' sheets. */
export { SheetTitle };

/** The choices of one setting in a native sheet (v4's white): Material's radio list, each row springing. */
export function ChoiceSheet<T extends string>({
  open,
  onClose,
  title,
  note,
  value,
  choices,
  onChange,
  testID,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  note?: string;
  value: T;
  choices: readonly Choice<T>[];
  onChange: (value: T) => void;
  testID?: string;
}) {
  const v = useTheme().v4;
  return (
    <Sheet open={open} onClose={onClose} title={<SheetTitle>{title}</SheetTitle>} background={v.card} testID={testID ? `sheet.${testID}` : undefined}>
      {note ? (
        <Text size="bodyMedium" style={{ color: v.muted, marginBottom: space[2] }}>
          {note}
        </Text>
      ) : null}
      <View accessibilityRole="radiogroup" accessibilityLabel={title} style={{ marginHorizontal: -space[6] }}>
        {choices.map((choice) => {
          const on = choice.value === value;
          return (
            <PressScale
              key={choice.value}
              testID={testID ? `${testID}.${choice.value}` : undefined}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, selected: on }}
              onPress={() => {
                if (!on) haptic.tick();
                onChange(choice.value);
              }}
              style={styles.choice}
            >
              {/* Material's radio button: a ring, filled at its centre when picked. */}
              <View style={[styles.radio, { borderColor: on ? v.brand : v.muted }]}>
                {on && <View style={[styles.radioDot, { backgroundColor: v.brand }]} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text size="bodyLarge" weight={on ? "medium" : undefined} style={{ color: v.fg }}>
                  {choice.label}
                </Text>
                {choice.hint ? (
                  <Text size="bodyMedium" style={{ color: v.muted }}>
                    {choice.hint}
                  </Text>
                ) : null}
              </View>
            </PressScale>
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
        style={({ pressed }) => [styles.bannerClose, iosPressed(pressed)]}
      >
        <Icons.X size={18} color={c.onErrorContainer} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  choice: { flexDirection: "row", alignItems: "center", gap: space[4], minHeight: 56, paddingVertical: space[2], paddingHorizontal: space[6] },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  banner: { flexDirection: "row", alignItems: "center", gap: space[3], paddingLeft: space[4], paddingRight: space[1], minHeight: TOUCH },
  bannerClose: { width: TOUCH, height: TOUCH, alignItems: "center", justifyContent: "center" },
});
