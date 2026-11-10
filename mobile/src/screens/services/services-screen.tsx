// Semua layanan (direction B), behind Beranda's "Lainnya": a search field, then every service the app has in named
// groups, four across, the same round marks as Beranda's. Typing narrows the groups to the services whose name holds
// what was typed; a group with none left goes. A first, plain version.
import { useState } from "react";
import { TextInput, View } from "react-native";
import { useT } from "../../../../src/app/i18n";
import { BHeading, ServiceRow, ServiceTile, useB } from "../../ui/b";
import { Fluent } from "../../ui/fluent";
import { Page } from "../../ui/layout";
import { Text, useFieldColors } from "../../ui/text";
import { space } from "../../ui/theme";
import { TopBar } from "../../ui/top-bar";
import { SERVICE_GROUPS, type Service } from "./list";
import { useOpenService } from "./open";

/** A group's services in rows of four. */
function rowsOf(services: readonly Service[]): Service[][] {
  const rows: Service[][] = [];
  for (let i = 0; i < services.length; i += 4) rows.push(services.slice(i, i + 4));
  return rows;
}

export function ServicesScreen() {
  const t = useT();
  const b = useB();
  const open = useOpenService();
  const field = useFieldColors();
  const [query, setQuery] = useState("");
  const asked = query.trim().toLowerCase();
  const groups = SERVICE_GROUPS.map((group) => ({
    ...group,
    services: asked ? group.services.filter((service) => t(service.label).toLowerCase().includes(asked)) : group.services,
  })).filter((group) => group.services.length > 0);
  return (
    <Page testID="screen.services" header={<TopBar title={t("mobile.services.title")} />} background={b.page} keyboardShouldPersistTaps="handled">
      <View
        style={{
          height: 48,
          borderRadius: 24,
          backgroundColor: b.soft,
          flexDirection: "row",
          alignItems: "center",
          gap: space[3],
          paddingHorizontal: space[4],
          marginTop: space[1],
        }}
      >
        <Fluent name="Search20Regular" color={b.fg2} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("mobile.services.search")}
          placeholderTextColor={b.muted}
          accessibilityLabel={t("mobile.services.search")}
          returnKeyType="search"
          autoCorrect={false}
          testID="services.search"
          style={{ flex: 1, color: b.fg, fontSize: 16, paddingVertical: 0 }}
          {...field}
        />
      </View>
      {groups.map((group) => (
        <View key={group.id} testID={`section.services.${group.id}`} style={{ marginTop: space[6] }}>
          <BHeading>{t(group.title)}</BHeading>
          <View style={{ gap: space[3] }}>
            {rowsOf(group.services).map((row) => (
              <ServiceRow key={row[0]!.id} count={row.length}>
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
              </ServiceRow>
            ))}
          </View>
        </View>
      ))}
      {groups.length === 0 && (
        <Text size="bodyLarge" style={{ color: b.muted, textAlign: "center", marginTop: space[8] }}>
          {t("mobile.services.none", { query: query.trim() })}
        </Text>
      )}
    </Page>
  );
}
