// A long text on a Task's page folded to its first lines (round 3, the real phone): long instructions pushed Jawabanmu
// under Kumpulkan's bar while "Kumpulkan" sat grey, asking for an answer box the Student couldn't see. Folded, the box
// shows on the first screen; "Selengkapnya" opens the rest, where it is. Only a text at least two lines longer than the
// fold is folded (never a fold that hides a line or two). TalkBack reads it whole, folded or not.
import { type ReactNode, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useT } from "../../../../src/app/i18n";
import { Button } from "../../ui/controls";
import { Icons } from "../../ui/icons";
import { space, useTheme } from "../../ui/theme";

/** Lines shown while folded (Body L's 24 dp line, grown with the font size). */
const LINES = 4;
const LINE = 24;
const FADE = 32;

export function Folded({ children }: { children: ReactNode }) {
  const t = useT();
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const fold = Math.round(LINES * LINE * fontScale);
  const [height, setHeight] = useState(0);
  const [open, setOpen] = useState(false);
  const folds = height > fold + 2 * LINE * fontScale;
  const shut = folds && !open;
  return (
    <View>
      <View style={shut ? { maxHeight: fold, overflow: "hidden" } : undefined}>
        <View onLayout={(event) => setHeight(Math.round(event.nativeEvent.layout.height))}>{children}</View>
        {shut && (
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: FADE }}>
            <Svg width="100%" height="100%">
              <Defs>
                <LinearGradient id="fold-fade" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={theme.v4.card} stopOpacity={0} />
                  <Stop offset="1" stopColor={theme.v4.card} stopOpacity={1} />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#fold-fade)" />
            </Svg>
          </View>
        )}
      </View>
      {folds && (
        <View style={{ alignItems: "flex-start", marginTop: space[1], marginLeft: -space[3], marginBottom: -space[2] }}>
          <Button
            size="sm"
            variant="ghost"
            icon={
              <View style={open ? { transform: [{ rotate: "180deg" }] } : undefined}>
                <Icons.ChevronDown size={16} color={theme.color.primary} />
              </View>
            }
            onPress={() => setOpen((was) => !was)}
            testID="action.instructionsMore"
          >
            {open ? t("mobile.tasks.less") : t("mobile.tasks.more")}
          </Button>
        </View>
      )}
    </View>
  );
}
