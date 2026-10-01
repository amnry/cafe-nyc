import type { HoursPeriod } from "./types";

const TZ = "America/New_York";
const MIN_PER_DAY = 1440;
const MIN_PER_WEEK = 7 * MIN_PER_DAY;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type OpenStatus =
  | { state: "open"; label: string; closesAt: string | null } // closesAt null = open 24 hours
  | { state: "closed"; label: string; opensAt: string | null }
  | { state: "unknown"; label: string }; // no hours data: never shown as closed

const nyFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  weekday: "short",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

/** Minutes since Sunday 00:00, on the America/New_York wall clock. */
export function nyWeekMinute(now: Date): number {
  const parts = Object.fromEntries(nyFormat.formatToParts(now).map((p) => [p.type, p.value]));
  const day = DAY_NAMES.indexOf(parts.weekday);
  return day * MIN_PER_DAY + Number(parts.hour) * 60 + Number(parts.minute);
}

export function formatTime(minuteOfDay: number): string {
  const h24 = Math.floor(minuteOfDay / 60) % 24;
  const m = minuteOfDay % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h24 < 12 ? "AM" : "PM"}`;
}

type Interval = [start: number, end: number];

/**
 * Week-minute intervals [start, end). A period closing at or before it opens wraps
 * past the week boundary (Sat night -> Sun morning). Touching/overlapping intervals
 * are merged, so a place open Mon 8:00-24:00 and Tue 0:00-2:00 reports a 2 AM close.
 * The week is repeated once so lookups near the boundary need no special casing.
 */
function buildIntervals(periods: HoursPeriod[]): Interval[] {
  const raw: Interval[] = [];
  for (const p of periods) {
    const start = p.open.day * MIN_PER_DAY + p.open.hour * 60 + p.open.minute;
    let end = start + MIN_PER_WEEK; // no close = open 24/7
    if (p.close) {
      end = p.close.day * MIN_PER_DAY + p.close.hour * 60 + p.close.minute;
      if (end <= start) end += MIN_PER_WEEK;
    }
    raw.push([start, end], [start + MIN_PER_WEEK, end + MIN_PER_WEEK]);
  }
  raw.sort((a, b) => a[0] - b[0]);
  const merged: Interval[] = [];
  for (const iv of raw) {
    const last = merged[merged.length - 1];
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
    else merged.push([iv[0], iv[1]]);
  }
  return merged;
}

export function getOpenStatus(periods: HoursPeriod[] | null, now: Date = new Date()): OpenStatus {
  if (!periods || periods.length === 0) return { state: "unknown", label: "Hours unavailable" };

  const t = nyWeekMinute(now);
  const intervals = buildIntervals(periods);

  // Intervals are repeated one week ahead, so test t shifted into the second copy.
  const probe = t + MIN_PER_WEEK;
  const current = intervals.find(([start, end]) => start <= probe && probe < end);
  if (current) {
    if (current[1] - current[0] >= 2 * MIN_PER_WEEK) {
      return { state: "open", label: "Open 24 hours", closesAt: null };
    }
    const closesAt = formatTime(current[1] % MIN_PER_DAY);
    return { state: "open", label: `Open · closes ${closesAt}`, closesAt };
  }

  // Closed: soonest merged-interval start strictly after now, wrapping the week.
  let delta = MIN_PER_WEEK;
  for (const [start] of intervals) {
    const d = (((start % MIN_PER_WEEK) - t) % MIN_PER_WEEK + MIN_PER_WEEK) % MIN_PER_WEEK;
    if (d > 0 && d < delta) delta = d;
  }
  const opensAbs = t + delta;
  const sameDay = Math.floor(opensAbs / MIN_PER_DAY) === Math.floor(t / MIN_PER_DAY);
  const dayLabel = sameDay ? "" : `${DAY_NAMES[Math.floor(opensAbs / MIN_PER_DAY) % 7]} `;
  const opensAt = `${dayLabel}${formatTime(opensAbs % MIN_PER_DAY)}`;
  return { state: "closed", label: `Closed · opens ${opensAt}`, opensAt };
}
