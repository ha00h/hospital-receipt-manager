const TZ = "Asia/Seoul";

export function formatWon(amount: number) {
  return `₩${amount.toLocaleString("ko-KR")}`;
}

/** Today as YYYY-MM-DD in Korea time, regardless of server timezone. */
export function todayKST() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(new Date());
}

export function currentMonthKST() {
  return todayKST().slice(0, 7);
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function weekdayOf(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** "2026-10-08" -> "10/8 (목)" */
export function formatShortDate(date: string) {
  const [, m, d] = date.split("-").map(Number);
  return `${m}/${d} (${weekdayOf(date)})`;
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const WEEKDAY_LABELS = WEEKDAYS;
