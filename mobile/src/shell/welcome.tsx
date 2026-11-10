// The first frame while nobody is signed in: the first minute's empty stage, Beranda's header colour over the whole
// screen and over the tabs (../../app/_layout.tsx draws it with the app's first frame), the status bar's icons white
// on it. The scene itself (./first-minute/scene.tsx: the two doors, the hand-over to Beranda) comes up on it a moment
// later, from the sign-in host (./sign-in.tsx), which is there the whole time: the scene has to outlast this screen,
// which goes the moment a system is in. Nothing here but a colour, so a first open costs the first frame nothing.
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { useTheme } from "../ui/theme";
import { seam } from "./first-minute/seam";

export function Welcome() {
  const v = useTheme().v4;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: seam.color(v), zIndex: 50 }]}>
      <StatusBar style="light" />
    </View>
  );
}
