import { describe, expect, it } from "vitest";
import { formatNyClock, formatTime, getOpenStatus, nyWeekMinute } from "./hours";
import type { HoursPeriod } from "./types";

// Sun Sep 27 2026 is day 0; New York is on EDT (UTC-4) all that week.
const at = (day: number, hh: number, mm = 0) => new Date(Date.UTC(2026, 8, 27 + day, hh + 4, mm));
const P = (od: number, oh: number, om: number, cd: number, ch: number, cm: number): HoursPeriod => ({
  open: { day: od, hour: oh, minute: om },
  close: { day: cd, hour: ch, minute: cm },
});

// Mon-Fri 8:00-17:00
const weekdays = [1, 2, 3, 4, 5].map((d) => P(d, 8, 0, d, 17, 0));

describe("getOpenStatus: ordinary hours", () => {
  it("open mid-day, shows closing time", () => {
    expect(getOpenStatus(weekdays, at(2, 12))).toEqual({ state: "open", label: "Open · closes 5 PM", short: "Open · til 5PM", closesAt: "5 PM" });
  });
  it("open exactly at opening, closed exactly at closing", () => {
    expect(getOpenStatus(weekdays, at(2, 8)).state).toBe("open");
    expect(getOpenStatus(weekdays, at(2, 17)).state).toBe("closed");
    expect(getOpenStatus(weekdays, at(2, 16, 59)).state).toBe("open");
  });
  it("closed before opening: opens later today", () => {
    expect(getOpenStatus(weekdays, at(2, 7))).toMatchObject({ state: "closed", opensAt: "8 AM" });
  });
  it("closed after closing: opens next day with day name", () => {
    expect(getOpenStatus(weekdays, at(2, 20))).toMatchObject({ state: "closed", opensAt: "Wed 8 AM" });
  });
  it("closed Friday night: opens Monday (skips weekend)", () => {
    expect(getOpenStatus(weekdays, at(5, 20))).toMatchObject({ opensAt: "Mon 8 AM" });
    expect(getOpenStatus(weekdays, at(0, 12))).toMatchObject({ opensAt: "Mon 8 AM" });
  });
  it("closed Saturday night after Friday close wraps correctly to Monday", () => {
    expect(getOpenStatus(weekdays, at(6, 23, 30))).toMatchObject({ state: "closed", opensAt: "Mon 8 AM" });
  });
  it("formats half hours", () => {
    expect(getOpenStatus([P(1, 8, 0, 1, 17, 30)], at(1, 9))).toMatchObject({ closesAt: "5:30 PM" });
  });
});

describe("getOpenStatus: overnight", () => {
  // Fri 18:00 -> Sat 02:00
  const fri = [P(5, 18, 0, 6, 2, 0)];
  it("open before midnight and after, closing next morning", () => {
    expect(getOpenStatus(fri, at(5, 23))).toMatchObject({ state: "open", closesAt: "2 AM" });
    expect(getOpenStatus(fri, at(6, 1))).toMatchObject({ state: "open", closesAt: "2 AM" });
  });
  it("closed at the close time and after", () => {
    expect(getOpenStatus(fri, at(6, 2)).state).toBe("closed");
    expect(getOpenStatus(fri, at(6, 3))).toMatchObject({ opensAt: "Fri 6 PM" });
  });
  it("closed Friday afternoon before the overnight period opens", () => {
    expect(getOpenStatus(fri, at(5, 12))).toMatchObject({ state: "closed", opensAt: "6 PM" });
  });
});

describe("getOpenStatus: week wraparound (Sat night -> Sun morning)", () => {
  const sat = [P(6, 22, 0, 0, 1, 0)]; // Sat 22:00 -> Sun 01:00
  it("open late Saturday", () => {
    expect(getOpenStatus(sat, at(6, 23))).toMatchObject({ state: "open", closesAt: "1 AM" });
  });
  it("still open early Sunday, across the week boundary", () => {
    expect(getOpenStatus(sat, at(0, 0, 30))).toMatchObject({ state: "open", closesAt: "1 AM" });
  });
  it("closed after the wrapped close; next open is Saturday", () => {
    expect(getOpenStatus(sat, at(0, 1))).toMatchObject({ state: "closed", opensAt: "Sat 10 PM" });
  });
  it("Saturday daytime: closed, opens tonight", () => {
    expect(getOpenStatus(sat, at(6, 12))).toMatchObject({ state: "closed", opensAt: "10 PM" });
  });
});

describe("getOpenStatus: 24 hours", () => {
  it("24/7 (no close) is always open with no closing time", () => {
    const always: HoursPeriod[] = [{ open: { day: 0, hour: 0, minute: 0 } }];
    for (const d of [new Date(Date.UTC(2026, 8, 27, 4)), at(3, 12), at(6, 23, 59)]) {
      expect(getOpenStatus(always, d)).toEqual({ state: "open", label: "Open 24 hours", short: "Open 24 hours", closesAt: null });
    }
  });
  it("seven back-to-back midnight-to-midnight days merge into 24/7", () => {
    const days = [0, 1, 2, 3, 4, 5, 6].map((d) => P(d, 0, 0, (d + 1) % 7, 0, 0));
    expect(getOpenStatus(days, at(2, 15))).toMatchObject({ state: "open", closesAt: null });
  });
  it("one 24h day with other days closed: reports the real close", () => {
    const monday = [P(1, 0, 0, 2, 0, 0)];
    expect(getOpenStatus(monday, at(1, 10))).toMatchObject({ state: "open", closesAt: "12 AM" });
    expect(getOpenStatus(monday, at(3, 10))).toMatchObject({ state: "closed", opensAt: "Mon 12 AM" });
  });
});

describe("getOpenStatus: merging and missing data", () => {
  it("merges periods that touch at midnight", () => {
    const split = [P(1, 8, 0, 2, 0, 0), P(2, 0, 0, 2, 2, 0)];
    expect(getOpenStatus(split, at(1, 23))).toMatchObject({ state: "open", closesAt: "2 AM" });
  });
  it("two periods in one day (lunch gap)", () => {
    const split = [P(1, 8, 0, 1, 12, 0), P(1, 14, 0, 1, 18, 0)];
    expect(getOpenStatus(split, at(1, 13))).toMatchObject({ state: "closed", opensAt: "2 PM" });
    expect(getOpenStatus(split, at(1, 15))).toMatchObject({ state: "open", closesAt: "6 PM" });
  });
  it("null or empty hours are unknown, never closed", () => {
    expect(getOpenStatus(null, at(1, 12)).state).toBe("unknown");
    expect(getOpenStatus([], at(1, 12)).state).toBe("unknown");
  });
});

describe("time zone handling", () => {
  it("uses America/New_York wall clock regardless of the machine zone (EDT)", () => {
    // 2026-09-29 (Tue) 03:00 UTC = Mon 23:00 EDT
    expect(nyWeekMinute(new Date("2026-09-29T03:00:00Z"))).toBe(1 * 1440 + 23 * 60);
  });
  it("uses EST in winter (UTC-5)", () => {
    // 2027-01-05 (Tue) 03:00 UTC = Mon 22:00 EST
    expect(nyWeekMinute(new Date("2027-01-05T03:00:00Z"))).toBe(1 * 1440 + 22 * 60);
  });
  it("a UTC date that is already 'tomorrow' in UTC is still today in New York", () => {
    // Tue 21:30 EDT is Wed 01:30 UTC
    expect(getOpenStatus([P(2, 8, 0, 2, 23, 0)], new Date("2026-09-30T01:30:00Z"))).toMatchObject({
      state: "open",
      closesAt: "11 PM",
    });
  });
  it("handles the DST fall-back day without crashing or flipping state mid-day", () => {
    // Sun Nov 1 2026: clocks go back at 02:00 EDT. 12:00 EST = 17:00 UTC.
    expect(getOpenStatus([P(0, 8, 0, 0, 17, 0)], new Date("2026-11-01T17:00:00Z"))).toMatchObject({
      state: "open",
      closesAt: "5 PM",
    });
  });
});

describe("card short labels", () => {
  it("compact times, day name only when not today", () => {
    expect(getOpenStatus(weekdays, at(2, 7)).short).toBe("Closed · back at 8AM");
    expect(getOpenStatus(weekdays, at(2, 20)).short).toBe("Closed · back Wed 8AM");
    expect(getOpenStatus(weekdays, at(2, 20)).label).toBe("Closed · back Wed 8 AM");
    expect(getOpenStatus([P(1, 8, 0, 1, 17, 30)], at(1, 9)).short).toBe("Open · til 5:30PM");
    expect(getOpenStatus(null, at(1, 9)).short).toBe("Hours unavailable");
  });
});

describe("formatNyClock", () => {
  it("formats the New York wall clock", () => {
    expect(formatNyClock(new Date("2026-09-30T03:42:00Z"))).toBe("11:42 PM"); // EDT
    expect(formatNyClock(new Date("2027-01-05T17:05:00Z"))).toBe("12:05 PM"); // EST
  });
});

describe("formatTime", () => {
  it("formats midnight, noon and minutes", () => {
    expect(formatTime(0)).toBe("12 AM");
    expect(formatTime(12 * 60)).toBe("12 PM");
    expect(formatTime(0 * 60 + 5)).toBe("12:05 AM");
    expect(formatTime(23 * 60 + 59)).toBe("11:59 PM");
  });
});
