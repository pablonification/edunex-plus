// "Tambahkan ke kalender HP" (src/app/screens/schedule/export.tsx): the desktop's dialog as a sheet,
// with the same choices (what goes in, each with how many, and how far ahead, from today) and the
// same events. The phone finishes the job itself: the events go straight into its calendar (asking
// for access first), and doing it again updates them. "Bagikan .ics" is the other way, the
// desktop's file through the share sheet. Both stay in view at the sheet's foot.
import { useMemo, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { useFormat, useLang, useNow, useT } from "../../../../src/app/i18n";
import { useDataset, useStatus, useStore } from "../../../../src/app/store";
import { wibDay } from "../../../../src/core/course-meetings";
import { PHONE_KINDS, type PhoneKind, phoneItems } from "../../../../src/core/phone-calendar";
import { dayNoon, dayStart, shiftDay } from "../../../../src/core/schedule";
import { toast } from "../../swaps/overlays";
import { Button, Switch } from "../../ui/controls";
import { Icons } from "../../ui/icons";
import { Notice } from "../../ui/layout";
import { Sheet } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { radius, space, useTheme } from "../../ui/theme";
import { addToPhoneCalendar, openPhoneCalendar, shareIcs } from "./phone-calendar";

type Range = "term" | "weeks";
type Step = { step: "choose" } | { step: "adding" } | { step: "denied" } | { step: "done"; events: number };

const ALL: Record<PhoneKind, boolean> = { classes: true, exams: true, deadlines: true, itb: true };
const DAY = 24 * 3_600_000;

/** "2026-11" → "2026-11-30". */
const lastDayOf = (month: string) => {
  const [year, index] = month.split("-").map(Number);
  return shiftDay(new Date(Date.UTC(year!, index!, 1)).toISOString().slice(0, 10), -1);
};

/** Opens the sheet; while there's nothing to put in the calendar it's off, and says why under it. */
export function AddToCalendarButton() {
  const t = useT();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const schedule = useDataset("six.schedule");
  const tasks = useDataset("edunex.tasks");
  const calendar = useDataset("itb.calendar");
  const anything = Boolean(schedule?.length || tasks?.some((task) => task.dueAt !== null) || calendar?.events.length);
  return (
    <View style={{ gap: space[1.5] }}>
      <Button
        icon={<Icons.Smartphone size={16} color={anything ? theme.color.fg : theme.color.faint} />}
        disabled={!anything}
        onPress={() => setOpen(true)}
        testID="action.addToCalendar"
      >
        {t("schedule.export")}
      </Button>
      {!anything && (
        <Text size="small" tone="muted" style={{ textAlign: "center" }}>
          {t("schedule.export.disabled")}
        </Text>
      )}
      {open && <CalendarSheet onClose={() => setOpen(false)} />}
    </View>
  );
}

function CalendarSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const now = useNow();
  const store = useStore();
  const theme = useTheme();
  const six = useStatus("six");
  const months = useDataset("six.scheduleMonths");
  const calendar = useDataset("itb.calendar");
  const [include, setInclude] = useState<Record<PhoneKind, boolean>>(ALL);
  const [range, setRange] = useState<Range>("term");
  const [step, setStep] = useState<Step>({ step: "choose" });
  const [sharing, setSharing] = useState(false);

  const today = wibDay(now);
  // The end of the term: its UAS's last day, from ITB's calendar.
  const termEnd =
    calendar?.events.filter((e) => e.kind === "uas" && e.lastDay >= today).sort((a, b) => a.firstDay.localeCompare(b.firstDay))[0]?.lastDay ?? null;
  const until = range === "term" && termEnd ? termEnd : shiftDay(today, 27);
  const items = useMemo(
    () => phoneItems((name) => store.dataset(name)?.value as never, lang, now, { from: today, until }),
    // The datasets are read when the sheet opens and whenever the choice changes.
    [store, lang, now, today, until],
  );
  const count = (kind: PhoneKind) => items.filter((item) => item.kind === kind).length;
  const chosen = items.filter((item) => include[item.kind]);
  // SIX's timetable comes a month at a time: say where it stops when the range goes past it.
  const lastMonth = [...(months ?? [])].sort().at(-1);
  const sixUntil = lastMonth && include.classes ? lastDayOf(lastMonth) : null;
  const day = (d: string) => `${f.weekdayShort(dayNoon(d))}, ${f.dayMonth(dayNoon(d))}`;

  const add = async () => {
    setStep({ step: "adding" });
    try {
      const result = await addToPhoneCalendar(chosen, new Set(items.map((item) => item.uid)), { from: dayStart(today), until: dayStart(until) + DAY });
      setStep(result.kind === "added" ? { step: "done", events: result.events } : { step: "denied" });
    } catch {
      setStep({ step: "choose" });
      toast(t("mobile.calendar.failed"), "danger");
    }
  };
  const share = async () => {
    setSharing(true);
    try {
      await shareIcs(chosen, now);
    } catch {
      toast(t("mobile.calendar.shareFailed"), "danger");
    } finally {
      setSharing(false);
    }
  };

  // The main action stays in view under the choices, as the desktop's dialog shows "Simpan 29 acara" without scrolling.
  const footer =
    step.step === "done" ? (
      <>
        <Button
          icon={<Icons.Calendar size={16} color={theme.color.fg} />}
          onPress={() => void openPhoneCalendar(now).catch(() => toast(t("mobile.calendar.openFailed"), "danger"))}
          testID="action.openCalendar"
        >
          {t("mobile.calendar.open")}
        </Button>
        <Button variant="primary" onPress={onClose} testID="action.calendarDone">
          {t("schedule.export.done")}
        </Button>
      </>
    ) : (
      <>
        <Button
          busy={sharing}
          disabled={chosen.length === 0}
          icon={<Icons.ArrowUpRight size={16} color={theme.color.fg} />}
          onPress={() => void share()}
          testID="action.shareIcs"
        >
          {t("mobile.calendar.share")}
        </Button>
        <Button
          variant="primary"
          size="lg"
          busy={step.step === "adding"}
          disabled={chosen.length === 0}
          onPress={() => void add()}
          testID="action.addToCalendar.confirm"
        >
          {chosen.length === 0 ? t("schedule.export.nothing") : t("mobile.calendar.add", { count: chosen.length })}
        </Button>
      </>
    );

  return (
    <Sheet open onClose={onClose} title={t("schedule.export.title")} footer={footer} testID="sheet.addToCalendar">
      {step.step === "done" ? (
        <View style={{ gap: space[4], paddingBottom: space[2] }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[3] }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: theme.color.successBg }}>
              <Icons.Check size={20} color={theme.color.successFg} weight="bold" />
            </View>
            <View style={{ flex: 1 }}>
              <Text size="title" weight="semibold">
                {t("mobile.calendar.added", { count: step.events })}
              </Text>
              <Text size="small" tone="muted" style={{ marginTop: space[1] }}>
                {t("mobile.calendar.again")}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={{ paddingBottom: space[2] }}>
          <Text size="body" tone="muted">
            {t("mobile.calendar.lead")}
          </Text>

          {step.step === "denied" && (
            <View style={{ marginTop: space[4] }}>
              <Notice
                tone="warning"
                title={t("mobile.calendar.denied")}
                action={
                  <Button size="sm" onPress={() => void Linking.openSettings()} testID="action.calendarSettings">
                    {t("mobile.calendar.settings")}
                  </Button>
                }
              >
                {t("mobile.calendar.deniedHint")}
              </Notice>
            </View>
          )}

          <Text size="small" weight="semibold" style={{ marginTop: space[5], marginBottom: space[1] }} accessibilityRole="header">
            {t("schedule.export.what")}
          </Text>
          {PHONE_KINDS.map((kind, i) => {
            const n = count(kind);
            const hint = kind === "classes" && six.state === "signed-out" && n === 0 ? t("schedule.export.needsSix") : t(`schedule.export.${kind}.hint`);
            return (
              <View
                key={kind}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space[3],
                  minHeight: 56,
                  paddingVertical: space[2],
                  opacity: n === 0 ? 0.6 : 1,
                  borderTopWidth: i > 0 ? 1 : 0,
                  borderTopColor: theme.color.line,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text size="body" weight="medium">
                    {t(`schedule.export.${kind}`)}
                  </Text>
                  <Text size="small" tone="muted">
                    {hint}
                  </Text>
                </View>
                <Text size="small" weight="semibold" tone="muted" tabular>
                  {String(n)}
                </Text>
                <Switch
                  value={include[kind] && n > 0}
                  disabled={n === 0}
                  onChange={(value) => setInclude((current) => ({ ...current, [kind]: value }))}
                  label={t(`schedule.export.${kind}`)}
                  testID={`switch.calendar.${kind}`}
                />
              </View>
            );
          })}

          <Text size="small" weight="semibold" style={{ marginTop: space[5], marginBottom: space[2] }} accessibilityRole="header">
            {t("schedule.export.range")}
          </Text>
          <View style={{ gap: space[2] }} accessibilityRole="radiogroup">
            {(termEnd ? (["term", "weeks"] as const) : (["weeks"] as const)).map((value) => {
              const on = range === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setRange(value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  testID={`range.${value}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space[3],
                    minHeight: 56,
                    borderRadius: radius.xl,
                    borderWidth: on ? 1.5 : 1,
                    borderColor: on ? theme.color.accent : theme.color.edge,
                    backgroundColor: on ? theme.color.infoBg : theme.color.surface,
                    paddingHorizontal: space[3.5],
                    paddingVertical: space[2.5],
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      borderWidth: on ? 6 : 1.5,
                      borderColor: on ? theme.color.accent : theme.color.fieldEdge,
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text size="body" weight="medium">
                      {t(`schedule.export.range.${value}`)}
                    </Text>
                    <Text size="small" tone="muted" tabular>
                      {t("schedule.export.range.until", { date: day(value === "term" && termEnd ? termEnd : shiftDay(today, 27)) })}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Text size="small" tone="muted" style={{ marginTop: space[2] }}>
            {t("schedule.export.fromToday")}
            {sixUntil && sixUntil < until ? ` ${t("schedule.export.sixUntil", { date: day(sixUntil) })}` : ""}
          </Text>

          <View style={{ flexDirection: "row", gap: space[2], marginTop: space[4], alignItems: "flex-start" }}>
            <View style={{ paddingTop: 2 }}>
              <Icons.Info size={14} color={theme.color.muted} />
            </View>
            <Text size="small" tone="muted" style={{ flex: 1 }}>
              {t("mobile.calendar.again")}
            </Text>
          </View>
        </View>
      )}
    </Sheet>
  );
}
