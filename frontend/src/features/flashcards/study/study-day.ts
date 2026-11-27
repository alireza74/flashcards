// Lerntag: beginnt um 4 Uhr nachts (Geraetezeit), nicht um Mitternacht.
// Wer um 0:30 Uhr lernt, gehoert noch zum Vortag und bekommt keine neuen Karten dazu (wie Anki).

export const DAY_START_HOUR = 4;

/** Beginn des aktuellen Lerntags in Millisekunden. */
export function startOfStudyDay(now: number): number {
  const date = new Date(now);
  if (date.getHours() < DAY_START_HOUR) date.setDate(date.getDate() - 1);
  date.setHours(DAY_START_HOUR, 0, 0, 0);
  return date.getTime();
}

/** Beginn des naechsten Lerntags. */
export function startOfNextStudyDay(now: number): number {
  const date = new Date(startOfStudyDay(now));
  date.setDate(date.getDate() + 1);
  return date.getTime();
}
