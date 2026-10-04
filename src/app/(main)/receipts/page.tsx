import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import ReceiptList from "@/components/ReceiptList";
import { CATEGORIES, type Category } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
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

        <ReceiptList rows={rows} />
      </div>
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
