// Beranda's services (`home.grid`): what the service list gives (../services/list.ts), four across, one word under each,
// the last one "Lainnya" (Semua layanan, every service in named groups). No heading over it: the tiles say what they are.
import { router } from "expo-router";
import { memo } from "react";
import { View } from "react-native";
import { useT } from "../../../../src/app/i18n";
import { ServiceRow, ServiceTile } from "../../ui/b";
import { space } from "../../ui/theme";
import { HOME_SERVICES } from "../services/list";
import { useOpenService } from "../services/open";

/** At most eight tiles: the list's, then "Lainnya" unless the list brings its own (`more`). */
const LISTED = HOME_SERVICES.some((service) => service.id === "more") ? HOME_SERVICES.slice(0, 8) : HOME_SERVICES.slice(0, 7);
const OWN_MORE = LISTED.some((service) => service.id === "more");
const ROWS = [LISTED.slice(0, 4), LISTED.slice(4, 8)].filter((row) => row.length > 0);

export const HomeGrid = memo(function HomeGrid() {
  const t = useT();
  const open = useOpenService();
  return (
    <View testID="home.grid" style={{ gap: space[3] }}>
      {ROWS.map((row, i) => {
        const more = !OWN_MORE && i === ROWS.length - 1;
        return (
          <ServiceRow key={row[0]?.id} count={row.length + (more ? 1 : 0)}>
            {row.map((service) => (
              <ServiceTile
                key={service.id}
                icon={service.icon}
                tone={service.tone}
                label={t(service.label)}
                onPress={() => (service.id === "more" ? router.push("/services") : open(service))}
                testID={`action.service.${service.id}`}
              />
            ))}
            {more && (
              <ServiceTile icon="Apps28Filled" tone="grey" label={t("mobile.tab.more")} onPress={() => router.push("/services")} testID="action.service.more" />
            )}
          </ServiceRow>
        );
      })}
    </View>
  );
});
