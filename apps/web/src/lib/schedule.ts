export type ScheduleKind =
  | "minutes"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "cron";

export interface ScheduleFields {
  everyMinutes: number;
  atMinute: number; // minute of the hour (hourly)
  atHour: number; // hour of the day (daily/weekly/monthly)
  atMin: number; // minute of the hour (daily/weekly/monthly)
  weekdays: number[]; // cron day-of-week, 0 = Sunday … 6 = Saturday
  monthDay: number; // 1-31
  cron: string; // raw expression (custom)
}

export const WEEKDAYS: { value: number; short: string; long: string }[] = [
  { value: 1, short: "Lun", long: "lundi" },
  { value: 2, short: "Mar", long: "mardi" },
  { value: 3, short: "Mer", long: "mercredi" },
  { value: 4, short: "Jeu", long: "jeudi" },
  { value: 5, short: "Ven", long: "vendredi" },
  { value: 6, short: "Sam", long: "samedi" },
  { value: 0, short: "Dim", long: "dimanche" },
];

export const COMMON_TIMEZONES = [
  "Europe/Paris",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Zurich",
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris";
  } catch {
    return "Europe/Paris";
  }
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.min(hi, Math.max(lo, Math.trunc(n)));
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Build a standard 5-field cron expression from the structured inputs. */
export function buildCron(kind: ScheduleKind, f: ScheduleFields): string {
  switch (kind) {
    case "minutes":
      return `*/${clamp(f.everyMinutes, 1, 59)} * * * *`;
    case "hourly":
      return `${clamp(f.atMinute, 0, 59)} * * * *`;
    case "daily":
      return `${clamp(f.atMin, 0, 59)} ${clamp(f.atHour, 0, 23)} * * *`;
    case "weekly": {
      const days = f.weekdays.length
        ? [...new Set(f.weekdays)].sort((a, b) => a - b).join(",")
        : "1";
      return `${clamp(f.atMin, 0, 59)} ${clamp(f.atHour, 0, 23)} * * ${days}`;
    }
    case "monthly":
      return `${clamp(f.atMin, 0, 59)} ${clamp(f.atHour, 0, 23)} ${clamp(f.monthDay, 1, 31)} * *`;
    case "cron":
    default:
      return f.cron.trim() || "0 * * * *";
  }
}

/** Human-readable French description of the schedule. */
export function describeSchedule(kind: ScheduleKind, f: ScheduleFields): string {
  switch (kind) {
    case "minutes": {
      const n = clamp(f.everyMinutes, 1, 59);
      return n === 1 ? "Chaque minute" : `Toutes les ${n} minutes`;
    }
    case "hourly": {
      const m = clamp(f.atMinute, 0, 59);
      return m === 0 ? "Chaque heure (à l'heure pile)" : `Chaque heure à la minute ${m}`;
    }
    case "daily":
      return `Tous les jours à ${pad(clamp(f.atHour, 0, 23))}:${pad(clamp(f.atMin, 0, 59))}`;
    case "weekly": {
      const days = f.weekdays.length ? f.weekdays : [1];
      const names = [...new Set(days)]
        .sort((a, b) => a - b)
        .map((d) => WEEKDAYS.find((w) => w.value === d)?.long ?? "")
        .filter(Boolean);
      const list =
        names.length > 1
          ? `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`
          : names[0];
      return `Chaque ${list} à ${pad(clamp(f.atHour, 0, 23))}:${pad(clamp(f.atMin, 0, 59))}`;
    }
    case "monthly":
      return `Le ${clamp(f.monthDay, 1, 31)} de chaque mois à ${pad(clamp(f.atHour, 0, 23))}:${pad(clamp(f.atMin, 0, 59))}`;
    case "cron":
    default:
      return `Expression cron : ${f.cron.trim() || "0 * * * *"}`;
  }
}

function fieldMatcher(spec: string, min: number, max: number): (v: number) => boolean {
  const allowed = new Set<number>();
  for (const part of spec.split(",")) {
    let range = part;
    let step = 1;
    if (part.includes("/")) {
      const [r, s] = part.split("/");
      range = r;
      step = Number(s) || 1;
    }
    let lo = min;
    let hi = max;
    if (range === "*" || range === "") {
      lo = min;
      hi = max;
    } else if (range.includes("-")) {
      const [a, b] = range.split("-").map(Number);
      lo = a;
      hi = b;
    } else {
      lo = hi = Number(range);
    }
    if (Number.isNaN(lo) || Number.isNaN(hi)) continue;
    for (let v = lo; v <= hi; v += step) allowed.add(v);
  }
  return (v: number) => allowed.has(v);
}

function compileCron(expr: string): ((d: Date) => boolean) | null {
  const f = expr.trim().split(/\s+/);
  if (f.length !== 5) return null;
  const minute = fieldMatcher(f[0], 0, 59);
  const hour = fieldMatcher(f[1], 0, 23);
  const dom = fieldMatcher(f[2], 1, 31);
  const month = fieldMatcher(f[3], 1, 12);
  const dow = fieldMatcher(f[4], 0, 7);
  const domRestricted = f[2] !== "*";
  const dowRestricted = f[4] !== "*";
  // `d` carries wall-clock time in its UTC fields.
  return (d: Date) => {
    if (!minute(d.getUTCMinutes())) return false;
    if (!hour(d.getUTCHours())) return false;
    if (!month(d.getUTCMonth() + 1)) return false;
    const wd = d.getUTCDay();
    const domOk = dom(d.getUTCDate());
    const dowOk = dow(wd) || (wd === 0 && dow(7));
    if (domRestricted && dowRestricted) return domOk || dowOk;
    if (dowRestricted) return dowOk;
    return domOk;
  };
}

function wallClockParts(date: Date, tz: string) {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
    return {
      y: Number(p.year),
      mo: Number(p.month),
      d: Number(p.day),
      h: Number(p.hour === "24" ? "0" : p.hour),
      mi: Number(p.minute),
    };
  } catch {
    return {
      y: date.getUTCFullYear(),
      mo: date.getUTCMonth() + 1,
      d: date.getUTCDate(),
      h: date.getUTCHours(),
      mi: date.getUTCMinutes(),
    };
  }
}

const DAY_NAMES = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MONTH_NAMES = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

function formatWall(d: Date): string {
  return `${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/**
 * Compute the next `count` occurrences of a cron expression in the given
 * timezone. The result is a list of human-readable strings. DST transitions are
 * approximated (the preview is indicative).
 */
export function nextRuns(cron: string, tz: string, count = 4): string[] {
  const matcher = compileCron(cron);
  if (!matcher) return [];
  const parts = wallClockParts(new Date(), tz);
  let ts = Date.UTC(parts.y, parts.mo - 1, parts.d, parts.h, parts.mi, 0, 0) + 60000;
  const results: string[] = [];
  const maxIter = 366 * 24 * 60;
  for (let i = 0; i < maxIter && results.length < count; i++) {
    const d = new Date(ts);
    if (matcher(d)) results.push(formatWall(d));
    ts += 60000;
  }
  return results;
}
