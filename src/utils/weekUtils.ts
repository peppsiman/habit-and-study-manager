import { DayKey } from '../types';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const DAY_INDEX_OFFSET: Record<DayKey, number> = {
  MON: 0,
  TUE: 1,
  WED: 2,
  THU: 3,
  FRI: 4
};

export function getKstParts(nowMs = Date.now()): {
  year: number;
  month: number;
  day: number;
  dayOfWeek: number;
  hour: number;
  minute: number;
} {
  const kstDate = new Date(nowMs + KST_OFFSET_MS);
  return {
    year: kstDate.getUTCFullYear(),
    month: kstDate.getUTCMonth() + 1,
    day: kstDate.getUTCDate(),
    dayOfWeek: kstDate.getUTCDay(),
    hour: kstDate.getUTCHours(),
    minute: kstDate.getUTCMinutes()
  };
}

function formatUtcDateId(utcDate: Date): string {
  const y = utcDate.getUTCFullYear();
  const m = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utcDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseWeekIdToUtcDate(weekId: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekId.trim());
  if (!match) {
    const fallbackId = getWeekIdForTimestamp(Date.now());
    const [y, m, d] = fallbackId.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day));
}

export function getWeekIdForTimestamp(nowMs = Date.now()): string {
  const { year, month, day, dayOfWeek } = getKstParts(nowMs);
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const mondayUtc = new Date(Date.UTC(year, month - 1, day - daysSinceMonday));
  return formatUtcDateId(mondayUtc);
}

/**
 * Normalizes any YYYY-MM-DD date string to its Monday weekId.
 */
export function normalizeToMondayWeekId(dateStr: string): string {
  const parsed = parseWeekIdToUtcDate(dateStr);
  const dow = parsed.getUTCDay();
  const daysSinceMonday = dow === 0 ? 6 : dow - 1;
  const monday = new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate() - daysSinceMonday)
  );
  return formatUtcDateId(monday);
}

export function isPastMonday1AmKstForWeek(weekId: string, nowMs = Date.now()): boolean {
  const monday = parseWeekIdToUtcDate(weekId);
  const monday1AmKstInUtcMs =
    Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate(), 1, 0, 0) -
    KST_OFFSET_MS;
  return nowMs >= monday1AmKstInUtcMs;
}

export function shiftWeekId(weekId: string, deltaWeeks: number): string {
  const monday = parseWeekIdToUtcDate(weekId);
  const shifted = new Date(
    Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + deltaWeeks * 7)
  );
  return formatUtcDateId(shifted);
}

export function formatWeekRangeLabel(weekId: string): string {
  const monday = parseWeekIdToUtcDate(weekId);
  const sunday = new Date(
    Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 6)
  );

  const mYear = monday.getUTCFullYear();
  const mMonth = String(monday.getUTCMonth() + 1).padStart(2, '0');
  const mDay = String(monday.getUTCDate()).padStart(2, '0');

  const sMonth = String(sunday.getUTCMonth() + 1).padStart(2, '0');
  const sDay = String(sunday.getUTCDate()).padStart(2, '0');

  return `${mYear}.${mMonth}.${mDay}(월) ~ ${sMonth}.${sDay}(일)`;
}

export function getWeekDayShortDate(weekId: string, dayKey: DayKey): string {
  const monday = parseWeekIdToUtcDate(weekId);
  const offset = DAY_INDEX_OFFSET[dayKey] ?? 0;
  const target = new Date(
    Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + offset)
  );
  return `${target.getUTCMonth() + 1}/${target.getUTCDate()}`;
}
