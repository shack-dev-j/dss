// The school runs on Asia/Tashkent time; "today" must not depend on the server's timezone.
const SCHOOL_TZ = "Asia/Tashkent";
export const BACKDATE_WINDOW_DAYS = 7;

/** YYYY-MM-DD for the given instant in school time. */
export function schoolDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SCHOOL_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && addDays(date, 0) === date;
}

/** Oldest lesson date a teacher may still edit without admin approval. */
export function earliestEditableDate(now: Date = new Date()): string {
  return addDays(schoolDate(now), -BACKDATE_WINDOW_DAYS);
}
