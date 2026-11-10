// Beranda's services (direction B): two rows of four round marks, each a filled Fluent glyph in a colour of its own,
// one word under it, the last one "Lainnya" (Semua layanan, every service in named groups). What the official app
// calls "Navigation Bar", with a heading a Student would say.
import { router } from "expo-router";
import { View } from "react-native";
import { useT } from "../../../../src/app/i18n";
import { ServiceRow, ServiceTile } from "../../ui/b";
import { space } from "../../ui/theme";
import { HOME_SERVICES } from "../services/list";
import { useOpenService } from "../services/open";

export function HomeGrid() {
  const t = useT();
  const open = useOpenService();
  const first = HOME_SERVICES.slice(0, 4);
  const second = HOME_SERVICES.slice(4, 7);
  return (
    <View testID="home.grid" style={{ gap: space[3] }}>
      <ServiceRow count={4}>
        {first.map((service) => (
          <ServiceTile
            key={service.id}
            icon={service.icon}
            tone={service.tone}
            label={t(service.label)}
            onPress={() => open(service)}
            testID={`action.service.${service.id}`}
          />
        ))}
      </ServiceRow>
      <ServiceRow count={4}>
        {second.map((service) => (
          <ServiceTile
            key={service.id}
            icon={service.icon}
            tone={service.tone}
            label={t(service.label)}
            onPress={() => open(service)}
            testID={`action.service.${service.id}`}
          />
        ))}
        <ServiceTile icon="Apps28Filled" tone="grey" label={t("mobile.tab.more")} onPress={() => router.push("/services")} testID="action.service.more" />
      </ServiceRow>
    </View>
  );
}
