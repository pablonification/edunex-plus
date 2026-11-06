// Presensi's old address (/presence), as alerts, notifications and the widget still name it: the
// courses with their absences left are the Kuliah tab now.
import { Redirect } from "expo-router";

export default function Screen() {
  return <Redirect href="/courses" />;
}
