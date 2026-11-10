// The first frame while nobody is signed in: the first minute's empty stage, in the page's own colour, over the tabs
// (../../app/_layout.tsx draws it with the app's first frame). The scene itself (./first-minute/scene.tsx: the two
// doors, the room, the hand-over to Beranda) comes up on it a moment later, from the sign-in host (./sign-in.tsx),
// which is there the whole time: the scene has to outlast this screen, which goes the moment a system is in.
// Nothing here but a colour, so a first open costs the first frame nothing.
import { StyleSheet, View } from "react-native";
import { useTheme } from "../ui/theme";

export function Welcome() {
  const v = useTheme().v4;
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: v.page, zIndex: 50 }]} />;
}
