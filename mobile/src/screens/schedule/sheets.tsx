// Which sheet a tap on Jadwal or its month opens: a class (and a meeting Edunex numbered) opens Beranda's class sheet,
// built from the same facts Beranda reads (src/core/needs), so a class reads the same wherever it's opened; a hand-in,
// a deadline, a meeting Edunex didn't number and a class the app couldn't read open Jadwal's own (./details.tsx).
import { type ReactNode, useCallback, useRef, useState } from "react";
import { useTermCourses } from "../../../../src/app/courses";
import { useHomeWorld } from "../../../../src/app/home-world";
import { useClock } from "../../../../src/app/i18n";
import { classFacts, homeContext, type NowCard } from "../../../../src/core/needs";
import { ClassSheet, classCard } from "../home/class-sheet";
import { DetailSheet, type Picked } from "./details";

export function useScheduleSheets(): { open: (picked: Picked) => void; sheets: ReactNode } {
  const courses = useTermCourses() ?? [];
  const world = useHomeWorld();
  const worldRef = useRef(world);
  worldRef.current = world;
  const clock = useClock();
  const [sheet, setSheet] = useState<{ card: NowCard } | { picked: Picked } | null>(null);
  const open = useCallback(
    (what: Picked) => {
      if (what.kind === "class" && worldRef.current) {
        setSheet({ card: classCard(classFacts(homeContext(worldRef.current), what.item.session), clock.now()) });
        return;
      }
      if (what.kind === "meeting" && typeof what.meeting.number === "number") {
        const { meeting } = what;
        setSheet({
          card: {
            state: "next",
            class: null,
            meeting: {
              code: meeting.code,
              meeting: { number: meeting.number!, start: meeting.start, end: meeting.end, note: null, online: meeting.online, link: meeting.link },
              ...(what.notInSix ? {} : { maybeInSix: true as const }),
            },
            presence: null,
            after: null,
            unreadDay: null,
          },
        });
        return;
      }
      setSheet({ picked: what });
    },
    [clock],
  );
  const close = () => setSheet(null);
  const sheets = (
    <>
      <ClassSheet card={sheet && "card" in sheet ? sheet.card : null} courses={courses} open={sheet !== null && "card" in sheet} onClose={close} />
      <DetailSheet picked={sheet && "picked" in sheet ? sheet.picked : null} onClose={close} />
    </>
  );
  return { open, sheets };
}
