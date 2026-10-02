import Link from "next/link";
import MonthlyChart, { type MonthlyPoint } from "@/components/MonthlyChart";
import PageHeader from "@/components/PageHeader";
import { requireAuth } from "@/lib/auth";
import { listUpcomingAppointments } from "@/lib/appointments";
import { currentMonthKST, formatShortDate, formatWon, shiftMonth, todayKST } from "@/lib/format";
import { getMonthlyTotals, getTopHospitals, getTotals } from "@/lib/receipts";
import { logout } from "../login/actions";

const PERIODS = {
  month: "이번 달",
  year: "올해",
  all: "전체",
} as const;
type Period = keyof typeof PERIODS;

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  await requireAuth();
  const sp = await searchParams;
  const period: Period = sp.period === "year" || sp.period === "all" ? sp.period : "month";

  const today = todayKST();
  const thisMonth = currentMonthKST();
  const from =
    period === "month" ? `${thisMonth}-01` : period === "year" ? `${today.slice(0, 4)}-01-01` : undefined;
  const to =
    period === "month" ? `${thisMonth}-31` : period === "year" ? `${today.slice(0, 4)}-12-31` : undefined;

  const totals = getTotals(from, to);
  const top = getTopHospitals(5, from, to);
  const upcoming = listUpcomingAppointments(today, 3);

  const firstMonth = shiftMonth(thisMonth, -11);
  const monthly = new Map(getMonthlyTotals(firstMonth, thisMonth).map((m) => [m.month, m]));
  const chart: MonthlyPoint[] = Array.from({ length: 12 }, (_, i) => {
    const m = shiftMonth(firstMonth, i);
    const row = monthly.get(m);
    return { label: `${Number(m.slice(5))}월`, hospital: row?.hospital ?? 0, pharmacy: row?.pharmacy ?? 0 };
  });

  return (
    <>
      <PageHeader
        title="대시보드"
        right={
          <form action={logout}>
            <button className="rounded-lg px-2 py-1 text-xs text-slate-500">로그아웃</button>
          </form>
        }
      />

      <div className="space-y-4 px-4">
        <div className="flex gap-1 rounded-xl bg-slate-200/70 p-1 text-sm">
          {(Object.keys(PERIODS) as Period[]).map((p) => (
            <Link
              key={p}
              href={p === "month" ? "/" : `/?period=${p}`}
              className={`flex-1 rounded-lg py-1.5 text-center ${
                period === p ? "bg-white font-semibold shadow-sm" : "text-slate-500"
              }`}
            >
              {PERIODS[p]}
            </Link>
          ))}
        </div>

        <section className="rounded-2xl bg-brand-600 p-5 text-white shadow-sm">
          <p className="text-sm opacity-80">{PERIODS[period]} 총액 · {totals.count}건</p>
          <p className="mt-1 text-3xl font-bold">{formatWon(totals.total)}</p>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <StatCard label="병원비 (약제비 제외)" value={totals.hospital} tone="brand" />
          <StatCard label="약제비" value={totals.pharmacy} tone="orange" />
        </div>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-semibold">월별 지출 (최근 12개월)</h2>
          <MonthlyChart data={chart} />
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">다가오는 예약</h2>
            <Link href="/calendar" className="text-sm text-brand-700">
              캘린더
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">예정된 진료가 없습니다.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/calendar?month=${a.date.slice(0, 7)}&date=${a.date}`}
                    className="flex items-center gap-3 py-2.5"
                  >
                    <div className="w-20 shrink-0 text-sm font-semibold text-brand-700">
                      {formatShortDate(a.date)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{a.hospital}</p>
                      <p className="truncate text-xs text-slate-500">
                        {[a.time, a.purpose].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-semibold">병원별 지출 ({PERIODS[period]})</h2>
          {top.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">데이터가 없습니다.</p>
          ) : (
            <ul className="space-y-2.5">
              {top.map((h) => (
                <li key={h.hospital}>
                  <div className="flex justify-between text-sm">
                    <span className="truncate">
                      {h.hospital} <span className="text-slate-400">· {h.count}건</span>
                    </span>
                    <span className="font-semibold">{formatWon(h.amount)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${Math.max(4, (h.amount / top[0].amount) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: "brand" | "orange" }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${tone === "brand" ? "text-brand-700" : "text-orange-600"}`}>
        {formatWon(value)}
      </p>
    </section>
  );
}
