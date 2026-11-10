// Beranda's services (`home.grid`): what the service list gives (../services/list.ts), four across, one word under each,
// the last one "Lainnya" (Semua layanan, every service in named groups). No heading over it: the tiles say what they are.
import { router } from "expo-router";
import { memo } from "react";
import { View } from "react-native";
import { useT } from "../../../../src/app/i18n";
import { ServiceRow, ServiceTile } from "../../ui/b";
import { space } from "../../ui/theme";
import { HOME_SERVICES, MORE } from "../services/list";
import { useOpenService } from "../services/open";

/** At most eight tiles: the list's first seven, then "Lainnya". */
const LISTED = HOME_SERVICES.slice(0, 7);
const ROWS = [LISTED.slice(0, 4), LISTED.slice(4, 7)];

export const HomeGrid = memo(function HomeGrid() {
  const t = useT();
  const open = useOpenService();
  return (
    // Not collapsed: the grid stays a view of its own that holds its tiles, so a reader of the screen (TalkBack's
    // tree, qa/layout-read.mjs) finds the eight inside `home.grid`. A testID alone keeps the view but hands its
    // children to the parent.
    <View testID="home.grid" collapsable={false} style={{ gap: space[3] }}>
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
