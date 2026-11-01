// Jadwal's month, a screen of its own (the top bar's calendar button on Jadwal): the month as a grid of days, each
// with the desktop's marks, the day tapped listed under it (./month.tsx). Back (the gesture too) returns to the
// agenda where it was; "Lihat minggunya" returns to it on that day. The top bar names the month.
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { useLang, useT } from "../../../../src/app/i18n";
import { dayStart, monthGrid, scheduleDays } from "../../../../src/core/schedule";
import { usePerfDrawn } from "../../perf";
import { usePullToRefresh } from "../../shell/source-status";
import { IconButton } from "../../ui/controls";
import { Skeleton } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Page } from "../../ui/layout";
import { useTheme } from "../../ui/theme";
import { TopBar } from "../../ui/top-bar";
import { useToday } from "./clock";
import { useAgendaInput } from "./input";
import { MonthView } from "./month";
import { showOnSchedule } from "./schedule-screen";
import { useScheduleSheets } from "./sheets";
import { ScheduleWorldProvider } from "./world";

export function MonthScreen() {
  return (
    <ScheduleWorldProvider>
      <Month />
    </ScheduleWorldProvider>
  );
}

/** Months from "2026-10" to "2027-01": 3. */
const monthsBetween = (from: string, to: string) => {
  const [a, b] = [from, to].map((m) => m.split("-").map(Number)) as [number[], number[]];
  return (b[0]! - a[0]!) * 12 + (b[1]! - a[1]!);
};

function Month() {
  const t = useT();
  const lang = useLang();
  const theme = useTheme();
  const input = useAgendaInput();
  const today = useToday();
  const pull = usePullToRefresh();
  const [offset, setOffset] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const { open, sheets } = useScheduleSheets();
  const noon = Date.parse(`${today}T12:00:00+07:00`);
  const month = useMemo(() => monthGrid(noon, offset), [noon, offset]);
  const plan = useMemo(() => (input ? scheduleDays(month.weeks.flat(), input) : []), [month, input]);
  usePerfDrawn(input !== undefined);
  const name = new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-GB", { month: "long", year: "numeric" }).format(dayStart(`${month.month}-15`));
  const day = chosen?.startsWith(month.month) ? chosen : today.startsWith(month.month) ? today : `${month.month}-01`;
  const step = (by: number) => {
    setOffset(monthsBetween(today.slice(0, 7), month.month) + by);
    setChosen(null);
  };
  return (
    <Page
      testID="screen.month"
      header={
        <TopBar
          title={name}
          actions={
            // The month's arrows in the top bar: the bar names the month once, the page is the grid.
            <>
              <IconButton label={t("schedule.prevMonth")} onPress={() => step(-1)} testID="action.prevMonth">
                <Icons.ChevronLeft size={24} color={theme.color.onSurfaceVariant} />
              </IconButton>
              <IconButton label={t("schedule.nextMonth")} onPress={() => step(1)} testID="action.nextMonth">
                <Icons.ChevronRight size={24} color={theme.color.onSurfaceVariant} />
              </IconButton>
            </>
          }
        />
      }
      background={theme.v4.page}
      {...pull}
    >
      {input ? (
        <MonthView
          month={month}
          plan={plan}
          periods={input.events}
          chosen={day}
          onChoose={setChosen}
          onPick={open}
          onShowWeek={(week) => {
            showOnSchedule(week);
            router.back();
          }}
        />
      ) : (
        <Skeleton height={320} />
      )}
      {sheets}
    </Page>
  );
}
