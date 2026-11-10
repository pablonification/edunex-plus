// Beranda's services: two rows of four solid tiles, each a white filled Fluent glyph on a colour of its own,
// one word under it, the last one "Lainnya" (Semua layanan, every service in named groups). What the official app
// calls "Navigation Bar", with a heading a Student would say.
import { router } from "expo-router";
import { View } from "react-native";
import { useT } from "../../../../src/app/i18n";
import { ServiceRow, ServiceTile } from "../../ui/b";
import { space } from "../../ui/theme";
import { HOME_SERVICES, MORE } from "../services/list";
import { useOpenService } from "../services/open";

export function HomeGrid() {
  const t = useT();
  const open = useOpenService();
  const first = HOME_SERVICES.slice(0, 4);
  const second = HOME_SERVICES.slice(4, 7);
  return (
    // Not collapsed: the grid stays a view of its own that holds its tiles, so a reader of the screen (TalkBack's
    // tree, qa/layout-read.mjs) finds the eight inside `home.grid`. A testID alone keeps the view but hands its
    // children to the parent.
    <View testID="home.grid" collapsable={false} style={{ gap: space[3] }}>
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
        <ServiceTile icon={MORE.icon} tone={MORE.tone} label={t(MORE.label)} onPress={() => router.push("/services")} testID="action.service.more" />
      </ServiceRow>
    </View>
  );
}
