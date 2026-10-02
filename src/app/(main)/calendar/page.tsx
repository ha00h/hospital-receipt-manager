import Link from "next/link";
import AppointmentSheet from "@/components/AppointmentSheet";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import PageHeader from "@/components/PageHeader";
import { requireAuth } from "@/lib/auth";
import { listAppointmentsInMonth } from "@/lib/appointments";
import { WEEKDAY_LABELS, currentMonthKST, formatShortDate, shiftMonth, todayKST } from "@/lib/format";
import { listHospitalNames } from "@/lib/receipts";
import { deleteAppointment, toggleAppointment } from "./actions";

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  await requireAuth();
  const sp = await searchParams;
  const today = todayKST();
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : currentMonthKST();
  const selected =
    typeof sp.date === "string" && sp.date.startsWith(`${month}-`)
      ? sp.date
      : today.startsWith(month)
        ? today
        : `${month}-01`;

  const items = listAppointmentsInMonth(month);
  const hospitals = listHospitalNames();
  const byDate = new Map<string, typeof items>();
  for (const a of items) byDate.set(a.date, [...(byDate.get(a.date) ?? []), a]);

  const [y, m] = month.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];
  while (cells.length % 7) cells.push(null);

  const dayItems = byDate.get(selected) ?? [];

  return (
    <>
      <PageHeader
        title="병원 캘린더"
        right={
          today.startsWith(month) ? null : (
            <Link href="/calendar" className="rounded-lg px-2 py-1 text-sm text-brand-700">
              오늘
            </Link>
          )
        }
      />

      <div className="space-y-4 px-4">
        <section className="rounded-2xl bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between px-1">
            <Link href={`/calendar?month=${shiftMonth(month, -1)}`} className="p-2 text-slate-500" aria-label="이전 달">
              ‹
            </Link>
            <span className="font-semibold">
              {y}년 {m}월
            </span>
            <Link href={`/calendar?month=${shiftMonth(month, 1)}`} className="p-2 text-slate-500" aria-label="다음 달">
              ›
            </Link>
          </div>
          <div className="grid grid-cols-7 text-center text-xs text-slate-400">
            {WEEKDAY_LABELS.map((w, i) => (
              <div key={w} className={`py-1 ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : ""}`}>
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 text-center">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const list = byDate.get(d) ?? [];
              const isSelected = d === selected;
              const isToday = d === today;
              const weekday = i % 7;
              return (
                <Link
                  key={d}
                  href={`/calendar?month=${month}&date=${d}`}
                  scroll={false}
                  className="flex flex-col items-center gap-0.5 py-1.5"
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                      isSelected
                        ? "bg-brand-600 font-semibold text-white"
                        : isToday
                          ? "font-semibold text-brand-700 ring-1 ring-brand-500"
                          : weekday === 0
                            ? "text-red-500"
                            : weekday === 6
                              ? "text-blue-500"
                              : ""
                    }`}
                  >
                    {Number(d.slice(8))}
                  </span>
                  <span className="flex h-1.5 gap-0.5">
                    {list.slice(0, 3).map((a) => (
                      <span
                        key={a.id}
                        className={`h-1.5 w-1.5 rounded-full ${a.done ? "bg-slate-300" : "bg-orange-500"}`}
                      />
                    ))}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">{formatShortDate(selected)} 일정</h2>
            <AppointmentSheet
              defaultDate={selected}
              hospitals={hospitals}
              trigger="+ 추가"
              triggerClassName="rounded-full bg-brand-600 px-3.5 py-1.5 text-sm font-semibold text-white"
            />
          </div>
          {dayItems.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">이 날은 예약이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {dayItems.map((a) => (
                <li key={a.id} className="flex items-start gap-3 py-3">
                  <form action={toggleAppointment.bind(null, a.id)}>
                    <button
                      aria-label={a.done ? "완료 취소" : "완료 표시"}
                      className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs ${
                        a.done ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300"
                      }`}
                    >
                      {a.done ? "✓" : ""}
                    </button>
                  </form>
                  <div className={`min-w-0 flex-1 ${a.done ? "text-slate-400 line-through" : ""}`}>
                    <p className="font-medium">
                      {a.time && <span className="mr-1.5 text-brand-700">{a.time}</span>}
                      {a.hospital}
                    </p>
                    {a.purpose && <p className="text-sm text-slate-500">{a.purpose}</p>}
                    {a.memo && <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-400">{a.memo}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1 text-xs">
                    <AppointmentSheet
                      defaultDate={selected}
                      appointment={a}
                      hospitals={hospitals}
                      trigger="수정"
                      triggerClassName="rounded-lg px-2 py-1 text-slate-500"
                    />
                    <form action={deleteAppointment.bind(null, a.id)}>
                      <ConfirmSubmit message="이 예약을 삭제할까요?" className="rounded-lg px-2 py-1 text-red-500">
                        삭제
                      </ConfirmSubmit>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {items.length > 0 && (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-semibold">{m}월 전체 예약</h2>
            <ul className="space-y-1.5 text-sm">
              {items.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/calendar?month=${month}&date=${a.date}`}
                    scroll={false}
                    className={`flex gap-3 ${a.done ? "text-slate-400 line-through" : ""}`}
                  >
                    <span className="w-16 shrink-0 text-slate-500">{formatShortDate(a.date)}</span>
                    <span className="w-11 shrink-0 text-slate-500">{a.time ?? ""}</span>
                    <span className="truncate">{a.hospital}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
