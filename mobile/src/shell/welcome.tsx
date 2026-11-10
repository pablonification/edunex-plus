// The first frame while nobody is signed in: the first minute's empty stage, Edunex Plus's blue over the whole screen
// and over the tabs (../../app/_layout.tsx draws it with the app's first frame), the status bar's icons white on it.
// The scene itself (./first-minute/scene.tsx: the two doors, the hand-over to Beranda) comes up on it a moment later,
// from the sign-in host (./sign-in.tsx), which is there the whole time: the scene has to outlast this screen, which
// goes the moment a system is in. Nothing here but a colour, so a first open costs the first frame nothing.
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "../ui/theme";
import { STAGE } from "./first-minute/colors";
import { setCovering } from "./first-minute/covering";

export function Welcome() {
  const scheme = useTheme().scheme === "dark" ? "dark" : "light";
  // The tabs under it are unseen: their endless animations rest, and TalkBack stays on the stage (./first-minute/covering.ts).
  useEffect(() => {
    setCovering("welcome", true);
    return () => setCovering("welcome", false);
  }, []);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: STAGE[scheme], zIndex: 50 }]}>
      <StatusBar style="light" />
    </View>
  );
}
