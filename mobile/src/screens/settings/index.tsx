// Settings, from Profil (its gear and its "Pengaturan" row): change one thing fast. The desktop's settings
// (src/app/shell/settings.tsx) with the same words, on the white page. Who's signed in is Profil's card, a step back,
// so it isn't said again here: each group is a heading over its rows: Akun, Notifikasi, Tampilan, Beranda, Kehadiran, Warna mata kuliah, problem
// reports (while the app has the maintainer's relay), Tentang, and signing out of everything last, in its own card.
// A row is a title, its current value and one thing at its end; on/off is Android's MaterialSwitch, a pick-one opens
// a native sheet, what explains a setting is spoken or one tap deeper. What only a computer has is left out: closing
// to the tray, installing updates (the phone shows the version and asks GitHub, D5) and phone alerts through ntfy
// (A18). A setting that can't be saved says so under the top bar, never in a snackbar. `?at=alerts|courseColors`
// opens it at that group. The groups under the first screenful mount a frame apart (all at once when opened at one).
import { type ComponentRef, type ReactNode, useCallback, useRef, useState } from "react";
import { type ScrollView, View } from "react-native";
import { errorKey } from "../../../../src/app/bridge";
import { useT } from "../../../../src/app/i18n";
import { useBridge, useSettings, useStore } from "../../../../src/app/store";
import type { Settings } from "../../../../src/core/models";
import { useParam } from "../../nav";
import { usePerfDrawn } from "../../perf";
import { useB } from "../../ui/b";
import { Rise } from "../../ui/expressive";
import { Page } from "../../ui/layout";
import { ErrorBanner } from "../../ui/settings-list";
import { TopBar } from "../../ui/top-bar";
import { Later } from "../plan/deferred";
import { AboutSettings, ReportSettings, SignOutAll } from "./about";
import { Accounts } from "./accounts";
import { AlertSettings } from "./alerts";
import { Appearance, AttendanceTargets, CourseColors, HomeSettings } from "./choices";
import type { Report, Update } from "./save";

export function SettingsScreen() {
  usePerfDrawn(true);
  const t = useT();
  const b = useB();
  const bridge = useBridge();
  const store = useStore();
  const settings = useSettings();
  const at = useParam("at");
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const report: Report = useCallback((error, fallback) => setProblem(t(errorKey(error, fallback))), [t]);
  const update: Update = (patch: Partial<Settings>) =>
    void bridge.invoke("settings.update", patch).then(
      () => setProblem(null),
      (error: unknown) => report(error),
    );
  // Opened at a group (the bell's "Atur notifikasi", a course's long-press): scrolled to it once it's laid out, once.
  const arrived = useRef(false);
  const anchor = (group: string) =>
    at === group
      ? (y: number) => {
          if (arrived.current) return;
          arrived.current = true;
          requestAnimationFrame(() => scroll.current?.scrollTo({ y: Math.max(0, y - 8), animated: false }));
        }
      : undefined;
  const now = at !== undefined;

  return (
    <Page
      testID="screen.settings"
      background={b.page}
      header={
        <>
          <TopBar title={t("nav.settings")} />
          {problem && <ErrorBanner text={problem} onClose={() => setProblem(null)} />}
        </>
      }
      scrollRef={scroll}
    >
      <Rise screen="settings" index={0}>
        <Accounts report={report} />
      </Rise>
      <Section index={1} onY={anchor("alerts")}>
        <AlertSettings settings={settings} update={update} report={report} />
      </Section>
      <Part now={now} frame={1}>
        <Section index={3}>
          <Appearance settings={settings} update={update} />
        </Section>
        <Section index={4}>
          <HomeSettings settings={settings} update={update} />
        </Section>
      </Part>
      <Part now={now} frame={2}>
        <Section index={5}>
          <AttendanceTargets settings={settings} update={update} />
        </Section>
        <Section index={6} onY={anchor("courseColors")}>
          <CourseColors />
        </Section>
      </Part>
      <Part now={now} frame={3}>
        {store.relay && (
          <Section index={7}>
            <ReportSettings settings={settings} update={update} report={report} />
          </Section>
        )}
        <Section index={8}>
          <AboutSettings version={store.version} relay={!!store.relay} />
        </Section>
        <Section index={9}>
          <SignOutAll report={report} />
        </Section>
      </Part>
    </Page>
  );
}

/** Below the first screenful, a group a frame; opened at a group (`now`), all at once so the page is long enough to get there. */
function Part({ now, frame, children }: { now: boolean; frame: number; children: ReactNode }) {
  return now ? children : <Later frame={frame}>{children}</Later>;
}

/** A group rising in its turn; `onY` hears where it sits in the page (to open the page at it). */
function Section({ index, onY, children }: { index: number; onY?: (y: number) => void; children: ReactNode }) {
  return (
    <View onLayout={onY ? (event) => onY(event.nativeEvent.layout.y) : undefined}>
      <Rise screen="settings" index={index}>
        {children}
      </Rise>
    </View>
  );
}
