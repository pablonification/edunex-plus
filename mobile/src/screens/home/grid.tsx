// Beranda's services (`home.grid`): what the service list gives (../services/list.ts), four across, one word under each,
// the last one "Lainnya" (Semua layanan, every service in named groups). No heading over it: the tiles say what they are.
//
// Tiles that answer (the decisions, round 1): where a service has one fact a student wants before opening it, its
// tile carries it as a small tag over its corner: Nilai its IPK, UKT "Lunas" or the date it's due by, KRS its SKS.
// Each is the figure its own page leads with, read the way Profil's rows read it, and none repeats the strip. A tag
// is drawn only once its data is in and the first read is over (never a guess), after Beranda's first frame, and over
// the tile, so it takes no room and moves nothing. It's a sibling here until b.tsx's ServiceTile takes a `tag`.
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
import { ServiceRow, ServiceTile, useB } from "../../ui/b";
import { Text } from "../../ui/text";
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
  return (
    // Not collapsed: the grid stays a view of its own that holds its tiles, so a reader of the screen (TalkBack's
    // tree, qa/layout-read.mjs) finds the eight inside `home.grid`. A testID alone keeps the view but hands its
    // children to the parent.
    <View testID="home.grid" collapsable={false} style={{ gap: space[1] }}>
      {ROWS.map((row, i) => {
        const last = i === ROWS.length - 1;
        return (
          <ServiceRow key={row[0]?.id ?? i} count={4}>
            {row.map((service) => (
              <View key={service.id} style={{ flex: 1, flexDirection: "row" }}>
                <ServiceTile
                  icon={service.icon}
                  tone={service.tone}
                  label={t(service.label)}
                  onPress={() => open(service)}
                  testID={`action.service.${service.id}`}
                />
                {tagged && service.id in TAGS && <TileTag id={service.id as keyof typeof TAGS} service={t(service.label)} />}
              </View>
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

/** The services whose tile answers, and what each says. */
const TAGS = { grades: GradesTag, bills: BillsTag, krs: KrsTag } as const;

function TileTag({ id, service }: { id: keyof typeof TAGS; service: string }) {
  const Says = TAGS[id];
  return <Says service={service} />;
}

/** Nilai: the IPK, as Profil's card and Nilai's page say it. */
function GradesTag({ service }: { service: string }) {
  const f = useFormat();
  const transcript = useDataset("six.transcript");
  const ipk = transcript ? shownIndex(transcript.ipk) : null;
  return ipk === null ? null : <Tag id="grades" service={service} text={f.number(ipk, 2)} />;
}

/** UKT: "Lunas", or the date this term's bill is due by (Profil's row, the same bill). Anything else is the page's to say. */
function BillsTag({ service }: { service: string }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const bills = useDataset("six.bills");
  const term = useThisTerm();
  if (!bills) return null;
  const bill = (term && bills.find((b) => b.term === term)) || bills.filter((b) => b.status !== "not-billed").at(-1);
  if (!bill) return null;
  const urgency = billUrgency(bill, now);
  const text =
    (urgency === "soon" || urgency === "due") && bill.nextDueAt !== null ? f.dayMonth(bill.nextDueAt) : bill.status === "paid" ? t("bills.status.paid") : null;
  return text === null ? null : <Tag id="bills" service={service} text={text} />;
}

/** KRS: the SKS taken this term. */
function KrsTag({ service }: { service: string }) {
  const t = useT();
  const plan = useDataset("six.krs");
  return plan?.sks == null ? null : <Tag id="krs" service={service} text={t("krs.sks", { sks: plan.sks })} />;
}

/**
 * The tag itself: a small pill on the page's own surface over the tile's top right corner, the page's ink (never the
 * state colours: it's a fact, not an alarm). It takes no touch: the tile under it is the target.
 */
function Tag({ id, service, text }: { id: string; service: string; text: string }) {
  const b = useB();
  return (
    <View
      pointerEvents="none"
      accessible
      accessibilityLabel={`${service}: ${text}`}
      testID={`tag.service.${id}`}
      style={{ position: "absolute", top: -2, left: 0, right: 0, alignItems: "center" }}
    >
      <View
        style={{
          transform: [{ translateX: 24 }],
          borderRadius: 999,
          borderWidth: 1,
          borderColor: b.line,
          backgroundColor: b.page,
          paddingHorizontal: 5,
          paddingVertical: 1,
        }}
      >
        <Text size="labelMedium" weight="bold" tabular numberOfLines={1} style={{ color: b.fg, fontSize: 11, lineHeight: 14, letterSpacing: 0 }}>
          {text}
        </Text>
      </View>
    </View>
  );
}
