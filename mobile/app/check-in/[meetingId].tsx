import { useParam } from "../../src/nav";
import { CheckInPage } from "../../src/screens/presence/check-in-page";

export default function Screen() {
  const meetingId = useParam("meetingId") ?? "";
  return <CheckInPage key={meetingId} meetingId={meetingId} />;
}
