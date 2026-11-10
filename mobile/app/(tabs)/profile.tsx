// Profil (round 4): who the Student is, their IPK and SKS, then Akademik's screens, the accounts, Settings and signing
// out, in src/screens/profile.
import { usePerfFocused } from "../../src/perf";
import { ProfileScreen } from "../../src/screens/profile/profile-screen";
import { TabClock } from "../../src/ui/tab-clock";

export default function Screen() {
  usePerfFocused("profile");
  return <TabClock name="profile">{() => <ProfileScreen />}</TabClock>;
}
