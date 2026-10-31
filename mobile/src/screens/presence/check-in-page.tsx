// "Tandai Hadir" on the phone (src/desktop/six-window.ts): SIX's own timetable in the app, on the
// class's month, signed in with the app's session, the class's popup opened so the Student only has
// to press SIX's button (../web/signed-page.tsx). The class gone from what the app read meanwhile:
// SIX's timetable all the same, without a popup.
import { useT } from "../../../../src/app/i18n";
import { useDataset } from "../../../../src/app/store";
import { SIX_WEB, sixTimetableUrl } from "../../../../src/core/links";
import { checkInUrl } from "../../host/check-in";
import { currentHost } from "../../shell/boot";
import { SignedPage } from "../web/signed-page";

export function CheckInPage({ meetingId }: { meetingId: string }) {
  const t = useT();
  const student = useDataset("six.student");
  const engine = currentHost?.engine;
  const url = (engine && checkInUrl(engine, meetingId)) ?? (student ? sixTimetableUrl(student) : `${SIX_WEB}/`);
  return <SignedPage url={url} meeting={meetingId} title={t("six.checkInTitle")} testID="screen.checkIn" />;
}
