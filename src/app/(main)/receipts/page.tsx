import Link from "next/link";
import CategoryBadge from "@/components/CategoryBadge";
import PageHeader from "@/components/PageHeader";
import { CATEGORIES, type Category } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { formatWon } from "@/lib/format";
import { listReceiptMonths, listReceipts } from "@/lib/receipts";

export default async function ReceiptsPage({ searchParams }: PageProps<"/receipts">) {
  await requireAuth();
  const sp = await searchParams;
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : undefined;
  const category =
    typeof sp.category === "string" && CATEGORIES.includes(sp.category as Category)
      ? (sp.category as Category)
      : undefined;
  const q = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : undefined;

  const rows = listReceipts({ month, category, q });
  const months = listReceiptMonths();
  const sum = rows.reduce((acc, r) => acc + r.amount, 0);

  const href = (patch: Record<string, string | undefined>) => {
    const next = { month, category, q, ...patch };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `/receipts?${s}` : "/receipts";
  };

  return (
    <>
      <PageHeader title="영수증" />

      <div className="space-y-3 px-4">
        <form action="/receipts" className="flex gap-2">
          {month && <input type="hidden" name="month" value={month} />}
          {category && <input type="hidden" name="category" value={category} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="병원·약국 이름 검색"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 outline-none focus:border-brand-500"
          />
          <button className="rounded-xl bg-slate-800 px-4 text-sm font-medium text-white">검색</button>
        </form>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <Chip href={href({ category: undefined })} active={!category}>전체</Chip>
          <Chip href={href({ category: "hospital" })} active={category === "hospital"}>병원비</Chip>
          <Chip href={href({ category: "pharmacy" })} active={category === "pharmacy"}>약제비</Chip>
          <span className="mx-1 w-px shrink-0 bg-slate-300" />
          <Chip href={href({ month: undefined })} active={!month}>전체 기간</Chip>
          {months.map((m) => (
            <Chip key={m} href={href({ month: m })} active={month === m}>
              {m.replace("-", ".")}
            </Chip>
          ))}
        </div>

        <div className="flex items-baseline justify-between px-1 text-sm text-slate-500">
          <span>{rows.length}건</span>
          <span>
            합계 <b className="text-base text-slate-900">{formatWon(sum)}</b>
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl bg-white px-4 py-16 text-center text-sm text-slate-400 shadow-sm">
            영수증이 없습니다.
            <br />
            오른쪽 아래 카메라 버튼으로 추가하세요.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/receipts/${r.id}`} className="flex items-center gap-3 px-3 py-3 active:bg-slate-50">
                  <div className="h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {r.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/uploads/${r.thumbnail}`}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-slate-400">
                        사진 없음
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-xs text-slate-400">{r.date}</p>
                    <p className="truncate font-medium">{r.hospital}</p>
                    <CategoryBadge category={r.category} />
                  </div>
                  <p className="font-semibold">{formatWon(r.amount)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link
        href="/receipts/new"
        aria-label="영수증 추가"
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-[max(1.25rem,calc(50vw-17rem))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg active:scale-95"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-7 w-7">
          <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" strokeLinejoin="round" />
          <circle cx="12" cy="13.5" r="3.5" />
        </svg>
      </Link>
    </>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm ${
        active ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600"
      }`}
    >
      {children}
    </Link>
  );
}
