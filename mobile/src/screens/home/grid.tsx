// Beranda's services (`home.grid`): what the service list gives (../services/list.ts), four across, one word under each,
// the last one "Lainnya" (Semua layanan, every service in named groups). No heading over it: the tiles say what they are.
//
// Tiles that answer (the decisions, round 1): where a service has one fact a student wants before opening it, its
// tile carries it as a small tag over its corner: Nilai its IPK, UKT "Lunas" or the date it's due by, KRS its SKS.
// Each is the figure its own page leads with, read the way Profil's rows read it, and none repeats the strip. A tag
// is drawn only once its data is in and the first read is over (never a guess), after Beranda's first frame, and over
// the tile (b.tsx's ServiceTile draws it from `tag`), so it takes no room and moves nothing.
import { router } from "expo-router";
import { memo } from "react";
import { View } from "react-native";
import { useThisTerm } from "../../../../src/app/deadlines";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useDataset } from "../../../../src/app/store";
import { billUrgency } from "../../../../src/core/academic";
import { useSettling } from "../../host/settling";
import { useFirstFrameShown } from "../../shell/first-frame";
import { useFirstReadRunning } from "../../shell/source-status";
import { ServiceRow, ServiceTile } from "../../ui/b";
import { space } from "../../ui/theme";
import { shownIndex } from "../grades/transcript";
import { HOME_SERVICES, MORE } from "../services/list";
import { useOpenService } from "../services/open";

/** At most eight tiles: the list's first seven, then "Lainnya". */
const LISTED = HOME_SERVICES.slice(0, 7);
const ROWS = [LISTED.slice(0, 4), LISTED.slice(4, 7)];

export const HomeGrid = memo(function HomeGrid() {
  const t = useT();
  const open = useOpenService();
  const settling = useSettling();
  const firstRead = useFirstReadRunning();
  const tagged = useFirstFrameShown() && !settling && !firstRead;
  const tags: Record<string, string | null> = { grades: useGradesTag(), bills: useBillsTag(), krs: useKrsTag() };
  return (
    // Not collapsed: the grid stays a view of its own that holds its tiles, so a reader of the screen (TalkBack's
    // tree, qa/layout-read.mjs) finds the eight inside `home.grid`. A testID alone keeps the view but hands its
    // children to the parent. The two rows stand apart: a row is a tile and its word, not a block of sixteen things.
    <View testID="home.grid" collapsable={false} style={{ gap: space[4] }}>
      {ROWS.map((row, i) => {
        const last = i === ROWS.length - 1;
        return (
          <ServiceRow key={row[0]?.id ?? i} count={4}>
            {row.map((service) => (
              <ServiceTile
                key={service.id}
                icon={service.icon}
                tone={service.tone}
                label={t(service.label)}
                tag={(tagged && tags[service.id]) || undefined}
                onPress={() => open(service)}
                testID={`action.service.${service.id}`}
              />
            ))}
            {last && (
              <ServiceTile icon={MORE.icon} tone={MORE.tone} label={t(MORE.label)} onPress={() => router.push("/services")} testID="action.service.more" />
            )}
          </ServiceRow>
        );
      })}
    </View>
  );
});

/** Nilai: the IPK, as Profil's card and Nilai's page say it. */
function useGradesTag(): string | null {
  const f = useFormat();
  const transcript = useDataset("six.transcript");
  const ipk = transcript ? shownIndex(transcript.ipk) : null;
  return ipk === null ? null : f.number(ipk, 2);
}

/** UKT: "Lunas", or the date this term's bill is due by (Profil's row, the same bill). Anything else is the page's to say. */
function useBillsTag(): string | null {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const bills = useDataset("six.bills");
  const term = useThisTerm();
  if (!bills) return null;
  const bill = (term && bills.find((b) => b.term === term)) || bills.filter((b) => b.status !== "not-billed").at(-1);
  if (!bill) return null;
  const urgency = billUrgency(bill, now);
  return (urgency === "soon" || urgency === "due") && bill.nextDueAt !== null
    ? f.dayMonth(bill.nextDueAt)
    : bill.status === "paid"
      ? t("bills.status.paid")
      : null;
}

/** KRS: the SKS taken this term. */
function useKrsTag(): string | null {
  const t = useT();
  const plan = useDataset("six.krs");
  return plan?.sks == null ? null : t("krs.sks", { sks: plan.sks });
}
