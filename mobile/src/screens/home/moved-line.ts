// The class sheet's quiet line under a moved class's time or room (./class-sheet.tsx). Where its "Berubah" chip shows,
// the line only says what's usual ("Biasanya 08:00–09:30"); where another status took the chip (SIX's verdict on a
// class that's over, a clash), the line says it moved too, in Jadwal's words ("Berubah · biasanya 08:00–09:30"), so
// the move is never left out of the sheet.

export type MovedLine =
  | { key: "mobile.home.usually"; vars: { usual: string } }
  | { key: "schedule.moved.time"; vars: { usual: string } }
  | { key: "schedule.moved.room"; vars: { room: string } };

/** `usual`: the usual time range or room; `chipSaysMoved`: the row's chip is the "Berubah" one. */
export function movedLine(part: "time" | "room", usual: string, chipSaysMoved: boolean): MovedLine {
  if (chipSaysMoved) return { key: "mobile.home.usually", vars: { usual } };
  return part === "time" ? { key: "schedule.moved.time", vars: { usual } } : { key: "schedule.moved.room", vars: { room: usual } };
}
