import type { RatePoint } from "./types";

export interface RateChartRow {
  date: string;
  purchase?: number;
  sale?: number;
  list?: number;
}

const paise = (value: number) => Math.round(value * 100) / 100;

/**
 * One chart row per day: the day's landed purchase rate and sale rate, each
 * weighted by quantity when several documents fall on it, and the price list
 * rate that started that day. Days without a figure leave the series blank;
 * the chart joins across them.
 */
export function rateChartRows(points: RatePoint[]): RateChartRow[] {
  const days = new Map<string, { purchase: [number, number]; sale: [number, number]; list?: number }>();
  for (const point of points) {
    const day = days.get(point.date) ?? { purchase: [0, 0], sale: [0, 0] };
    if (point.kind === "list") day.list = point.rate;
    else {
      const units = point.quantity ?? 0;
      day[point.kind][0] += point.rate * units;
      day[point.kind][1] += units;
    }
    days.set(point.date, day);
  }
  return [...days]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, day]) => ({
      date,
      ...(day.purchase[1] > 0 && { purchase: paise(day.purchase[0] / day.purchase[1]) }),
      ...(day.sale[1] > 0 && { sale: paise(day.sale[0] / day.sale[1]) }),
      ...(day.list !== undefined && { list: day.list }),
    }));
}

/** "2026-10" → "Oct 2026". */
export const monthLabel = (month: string) => new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(new Date(`${month}-01T00:00:00`));
